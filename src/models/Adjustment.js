const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

/**
 * Single Adjustment Entry Schema
 * Each represents one posting line in the adjustment (Dr OR Cr)
 */
const AdjustmentEntrySchema = new Schema(
  {
    etbRowId: {
      type: String, // references ETBRowSchema._id
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    dr: {
      type: Number,
      default: 0,
    },
    cr: {
      type: Number,
      default: 0,
    },
    details: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

/**
 * Validation — prevent both Dr and Cr in the same entry
 */
AdjustmentEntrySchema.pre("validate", function (next) {
  if (this.dr > 0 && this.cr > 0) {
    return next(
      new Error(`Invalid adjustment entry: ${this.code} cannot have both Dr and Cr values.`)
    );
  }
  next();
});

/**
 * History Entry Schema
 * Records all changes made to an adjustment
 */
const AdjustmentHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ["created", "updated", "posted", "unposted", "deleted", "reversed"],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: String,
      default: "system",
    },
    userName: {
      type: String,
      default: "System",
    },
    previousValues: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValues: {
      type: Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    description: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

/**
 * Main Adjustment Schema
 * One document represents a single adjustment journal (AA1, AA2, etc.)
 */
const AdjustmentSchema = new Schema(
  {
    engagementId: {
      type: Types.ObjectId,
      ref: "Engagement",
      required: true,
    },
    etbId: {
      type: Types.ObjectId,
      ref: "ExtendedTrialBalance",
      required: true,
    },
    adjustmentNo: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "posted"],
      default: "draft",
    },
    entries: {
      type: [AdjustmentEntrySchema],
      default: [],
    },
    totalDr: {
      type: Number,
      default: 0,
    },
    totalCr: {
      type: Number,
      default: 0,
    },
    history: {
      type: [AdjustmentHistorySchema],
      default: [],
    },
    evidenceFiles: {
      type: [{
        fileName: {
          type: String,
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          userId: String,
          userName: String,
        },
      }],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * Pre-save hook
 * - Update timestamps
 * - Auto-calculate totalDr and totalCr
 * - Validate Dr = Cr for posted adjustments
 */
AdjustmentSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  this.totalDr = this.entries.reduce((sum, e) => sum + (e.dr || 0), 0);
  this.totalCr = this.entries.reduce((sum, e) => sum + (e.cr || 0), 0);

  // For posted adjustments, enforce double-entry rule
  if (this.status === "posted" && this.totalDr !== this.totalCr) {
    return next(
      new Error(
        `Unbalanced adjustment (${this.adjustmentNo}): Dr ${this.totalDr} ≠ Cr ${this.totalCr}`
      )
    );
  }

  next();
});

module.exports = mongoose.model("Adjustment", AdjustmentSchema);
