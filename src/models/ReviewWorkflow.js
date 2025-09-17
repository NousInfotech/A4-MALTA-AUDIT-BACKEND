const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ReviewWorkflowSchema = new Schema({
  // Item identification
  itemType: {
    type: String,
    required: true,
    enum: ['procedure', 'planning-procedure', 'document-request', 'checklist-item', 'pbc', 'kyc', 'isqm-document', 'working-paper'],
    index: true
  },
  itemId: {
    type: Types.ObjectId,
    required: true,
    index: true
  },
  engagement: {
    type: Types.ObjectId,
    ref: 'Engagement',
    required: true,
    index: true
  },

  // Current review state
  status: {
    type: String,
    enum: ['in-progress', 'ready-for-review', 'under-review', 'approved', 'rejected', 'signed-off', 're-opened'],
    default: 'in-progress',
    index: true
  },

  // Review assignment
  assignedReviewer: {
    type: String, // User ID
    index: true
  },
  assignedAt: {
    type: Date
  },

  // Review process
  submittedForReviewAt: {
    type: Date
  },
  submittedBy: {
    type: String // User ID
  },

  // Review completion
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String // User ID
  },
  reviewComments: {
    type: String
  },

  // Sign-off process
  signedOffAt: {
    type: Date
  },
  signedOffBy: {
    type: String // User ID
  },
  signOffComments: {
    type: String
  },

  // Locking mechanism
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: {
    type: Date
  },
  lockedBy: {
    type: String // User ID
  },

  // Re-opening tracking
  reopenedAt: {
    type: Date
  },
  reopenedBy: {
    type: String // User ID
  },
  reopenReason: {
    type: String
  },

  // Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },

  // Additional metadata
  tags: [{
    type: String
  }],
  notes: [{
    text: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Version tracking
  version: {
    type: Number,
    default: 1
  },
  previousVersion: {
    type: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for item reference
ReviewWorkflowSchema.virtual('item', {
  ref: function() {
    // Dynamic reference based on itemType
    const refMap = {
      'procedure': 'Procedure',
      'planning-procedure': 'PlanningProcedure',
      'document-request': 'DocumentRequest',
      'checklist-item': 'ChecklistItem',
      'pbc': 'PBC',
      'kyc': 'KYC',
      'isqm-document': 'ISQMSupportingDocument',
      'working-paper': 'WorkingPaper'
    };
    return refMap[this.itemType];
  },
  localField: 'itemId',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
ReviewWorkflowSchema.index({ itemType: 1, itemId: 1 }, { unique: true });
ReviewWorkflowSchema.index({ engagement: 1, status: 1 });
ReviewWorkflowSchema.index({ assignedReviewer: 1, status: 1 });
ReviewWorkflowSchema.index({ status: 1, priority: 1 });
ReviewWorkflowSchema.index({ dueDate: 1 });
ReviewWorkflowSchema.index({ createdAt: -1 });

// Pre-save middleware to handle status transitions
ReviewWorkflowSchema.pre('save', function(next) {
  // Auto-lock when signed off
  if (this.status === 'signed-off' && !this.isLocked) {
    this.isLocked = true;
    this.lockedAt = new Date();
    this.lockedBy = this.signedOffBy;
  }

  // Auto-unlock when re-opened
  if (this.status === 're-opened' && this.isLocked) {
    this.isLocked = false;
    this.lockedAt = undefined;
    this.lockedBy = undefined;
  }

  next();
});

// Static methods
ReviewWorkflowSchema.statics.getByEngagement = function(engagementId, status = null) {
  const filter = { engagement: engagementId };
  if (status) filter.status = status;
  return this.find(filter).sort({ createdAt: -1 });
};

ReviewWorkflowSchema.statics.getReviewQueue = function(reviewerId = null) {
  const filter = { 
    status: { $in: ['ready-for-review', 'under-review'] }
  };
  if (reviewerId) filter.assignedReviewer = reviewerId;
  return this.find(filter).sort({ priority: -1, dueDate: 1, createdAt: 1 });
};

ReviewWorkflowSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Instance methods
ReviewWorkflowSchema.methods.submitForReview = function(submittedBy) {
  this.status = 'ready-for-review';
  this.submittedForReviewAt = new Date();
  this.submittedBy = submittedBy;
  return this.save();
};

ReviewWorkflowSchema.methods.assignReviewer = function(reviewerId) {
  this.assignedReviewer = reviewerId;
  this.assignedAt = new Date();
  this.status = 'under-review';
  return this.save();
};

ReviewWorkflowSchema.methods.completeReview = function(reviewerId, approved, comments) {
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.reviewComments = comments;
  this.status = approved ? 'approved' : 'rejected';
  return this.save();
};

ReviewWorkflowSchema.methods.signOff = function(partnerId, comments) {
  this.signedOffAt = new Date();
  this.signedOffBy = partnerId;
  this.signOffComments = comments;
  this.status = 'signed-off';
  this.isLocked = true;
  this.lockedAt = new Date();
  this.lockedBy = partnerId;
  return this.save();
};

ReviewWorkflowSchema.methods.reopen = function(userId, reason) {
  this.reopenedAt = new Date();
  this.reopenedBy = userId;
  this.reopenReason = reason;
  this.status = 're-opened';
  this.isLocked = false;
  this.lockedAt = undefined;
  this.lockedBy = undefined;
  this.version += 1;
  this.previousVersion = this.version - 1;
  return this.save();
};

module.exports = mongoose.model('ReviewWorkflow', ReviewWorkflowSchema);
