const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

// MBR Status Enum
const MBRStatusEnum = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};

// Status History Schema
const StatusHistorySchema = new Schema({
  status: {
    type: String,
    enum: Object.values(MBRStatusEnum),
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

const MBRSchema = new Schema(
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
    statusHistory: {
      type: [StatusHistorySchema],
      default: []
    },
    currentStatus: {
      type: String,
      enum: Object.values(MBRStatusEnum),
      default: MBRStatusEnum.PENDING,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
MBRSchema.index({ engagementId: 1, currentStatus: 1 });

// Virtual to get the latest status from statusHistory
MBRSchema.virtual("latestStatus").get(function() {
  if (this.statusHistory && this.statusHistory.length > 0) {
    return this.statusHistory[this.statusHistory.length - 1];
  }
  return null;
});

// Method to add status to history
MBRSchema.methods.addStatusHistory = function(status, employeeId) {
  this.statusHistory.push({
    status,
    createdAt: new Date(),
    employeeId
  });
  this.currentStatus = status;
};

// Method to validate status transition
MBRSchema.statics.isValidStatusTransition = function(currentStatus, newStatus) {
  const validTransitions = {
    [MBRStatusEnum.PENDING]: [MBRStatusEnum.SUBMITTED],
    [MBRStatusEnum.SUBMITTED]: [MBRStatusEnum.APPROVED, MBRStatusEnum.REJECTED],
    [MBRStatusEnum.APPROVED]: [], // Final state
    [MBRStatusEnum.REJECTED]: [] // Final state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

module.exports = mongoose.model("MBR", MBRSchema);
module.exports.MBRStatusEnum = MBRStatusEnum;

