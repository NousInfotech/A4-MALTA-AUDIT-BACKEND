const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

// Tax Status Enum
const TaxStatusEnum = {
  PENDING: "PENDING",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

// Status History Schema
const StatusHistorySchema = new Schema({
  status: {
    type: String,
    enum: Object.values(TaxStatusEnum),
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  employeeId: {
    type: String,
    required: true
  }
}, { _id: false });

// Document Schema
const DocumentSchema = new Schema({
  fileId: {
    type: Types.ObjectId,
    ref: "EngagementLibrary",
    default: null
  },
  url: {
    type: String,
    default: null
  },
  employeeId: {
    type: String,
    default: null
  }
}, { _id: false });

const TaxSchema = new Schema(
  {
    engagementId: {
      type: Types.ObjectId,
      ref: "Engagement",
      required: true,
      index: true
    },
    document: {
      type: DocumentSchema,
      default: () => ({
        fileId: null,
        url: null,
        employeeId: null
      })
    },
    draftDocument: {
      type: DocumentSchema,
      default: () => ({
        fileId: null,
        url: null,
        employeeId: null
      })
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: []
    },
    currentStatus: {
      type: String,
      enum: Object.values(TaxStatusEnum),
      default: TaxStatusEnum.PENDING,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
TaxSchema.index({ engagementId: 1, currentStatus: 1 });

// Virtual to get the latest status from statusHistory
TaxSchema.virtual("latestStatus").get(function() {
  if (this.statusHistory && this.statusHistory.length > 0) {
    return this.statusHistory[this.statusHistory.length - 1];
  }
  return null;
});

// Method to add status to history
TaxSchema.methods.addStatusHistory = function(status, employeeId) {
  this.statusHistory.push({
    status,
    createdAt: new Date(),
    employeeId
  });
  this.currentStatus = status;
};

// Method to validate status transition
TaxSchema.statics.isValidStatusTransition = function(currentStatus, newStatus) {
  const validTransitions = {
    [TaxStatusEnum.PENDING]: [TaxStatusEnum.DRAFT],
    [TaxStatusEnum.DRAFT]: [TaxStatusEnum.SUBMITTED],
    [TaxStatusEnum.SUBMITTED]: [TaxStatusEnum.APPROVED, TaxStatusEnum.REJECTED],
    [TaxStatusEnum.APPROVED]: [], // Final state
    [TaxStatusEnum.REJECTED]: [] // Final state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

module.exports = mongoose.model("Tax", TaxSchema);
module.exports.TaxStatusEnum = TaxStatusEnum;

