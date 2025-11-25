const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

/**
 * Single Reclassification Entry Schema
 * Each represents one posting line in the reclassification journal (Dr OR Cr)
 */
const ReclassificationEntrySchema = new Schema(
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
ReclassificationEntrySchema.pre("validate", function (next) {
  if (this.dr > 0 && this.cr > 0) {
    return next(
      new Error(`Invalid reclassification entry: ${this.code} cannot have both Dr and Cr values.`)
    );
  }
  next();
});

/**
 * History Entry Schema
 * Records all changes made to a reclassification
 */
const ReclassificationHistorySchema = new Schema(
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
 * Main Reclassification Schema
 * One document represents a single reclassification journal (RC1, RC2, etc.)
 */
const ReclassificationSchema = new Schema(
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
    reclassificationNo: {
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
      type: [ReclassificationEntrySchema],
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
      type: [ReclassificationHistorySchema],
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
 * - Validate Dr = Cr for posted reclassifications
 */
ReclassificationSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  this.totalDr = this.entries.reduce((sum, e) => sum + (e.dr || 0), 0);
  this.totalCr = this.entries.reduce((sum, e) => sum + (e.cr || 0), 0);

  // For posted reclassifications, enforce double-entry rule
  if (this.status === "posted" && this.totalDr !== this.totalCr) {
    return next(
      new Error(
        `Unbalanced reclassification (${this.reclassificationNo}): Dr ${this.totalDr} ≠ Cr ${this.totalCr}`
      )
    );
  }

  next();
});

module.exports = mongoose.model("Reclassification", ReclassificationSchema);

