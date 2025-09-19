const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ReviewHistorySchema = new Schema({
  // Item identification
  itemType: {
    type: String,
    required: true,
    enum: ['procedure', 'planning-procedure', 'document-request', 'checklist-item', 'pbc', 'kyc', 'isqm-document', 'working-paper', 'classification-section'],
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

  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      'submitted-for-review',
      'assigned-reviewer',
      'review-started',
      'review-completed',
      'review-approved',
      'review-rejected',
      'signed-off',
      'reopened',
      'status-changed',
      'comment-added',
      'priority-changed',
      'due-date-changed'
    ],
    index: true
  },

  // User information
  performedBy: {
    type: String, // User ID
    required: true,
    index: true
  },
  performedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Action details
  previousStatus: {
    type: String
  },
  newStatus: {
    type: String
  },
  comments: {
    type: String
  },

  // Additional context
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },

  // IP and device info for audit trail
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  location: {
    type: String
  },

  // System information
  systemVersion: {
    type: String
  },
  sessionId: {
    type: String
  }
}, {
  timestamps: false, // We use performedAt instead
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for user reference
ReviewHistorySchema.virtual('user', {
  ref: 'Profile', // Assuming profiles are stored in Supabase
  localField: 'performedBy',
  foreignField: 'user_id',
  justOne: true
});

// Indexes for better query performance
ReviewHistorySchema.index({ itemType: 1, itemId: 1, performedAt: -1 });
ReviewHistorySchema.index({ engagement: 1, performedAt: -1 });
ReviewHistorySchema.index({ performedBy: 1, performedAt: -1 });
ReviewHistorySchema.index({ action: 1, performedAt: -1 });
ReviewHistorySchema.index({ performedAt: -1 });

// Static methods
ReviewHistorySchema.statics.getByItem = function(itemType, itemId) {
  return this.find({ itemType, itemId }).sort({ performedAt: -1 });
};

ReviewHistorySchema.statics.getByEngagement = function(engagementId, limit = 100) {
  return this.find({ engagement: engagementId })
    .sort({ performedAt: -1 })
    .limit(limit);
};

ReviewHistorySchema.statics.getByUser = function(userId, limit = 50) {
  return this.find({ performedBy: userId })
    .sort({ performedAt: -1 })
    .limit(limit);
};

ReviewHistorySchema.statics.getByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ performedAt: -1 })
    .limit(limit);
};

ReviewHistorySchema.statics.getRecentActivity = function(hours = 24, limit = 100) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ performedAt: { $gte: since } })
    .sort({ performedAt: -1 })
    .limit(limit);
};

// Instance methods
ReviewHistorySchema.methods.addMetadata = function(key, value) {
  this.metadata.set(key, value);
  return this.save();
};

ReviewHistorySchema.methods.getMetadata = function(key) {
  return this.metadata.get(key);
};

// Pre-save middleware to add system information
ReviewHistorySchema.pre('save', function(next) {
  // Add system version if not present
  if (!this.systemVersion) {
    this.systemVersion = process.env.APP_VERSION || '1.0.0';
  }
  next();
});

// Static method to create history entry
ReviewHistorySchema.statics.createEntry = function(data) {
  return this.create({
    itemType: data.itemType,
    itemId: data.itemId,
    engagement: data.engagement,
    action: data.action,
    performedBy: data.performedBy,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
    comments: data.comments,
    metadata: data.metadata || {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    location: data.location,
    sessionId: data.sessionId
  });
};

module.exports = mongoose.model('ReviewHistory', ReviewHistorySchema);
