const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Version History Schema (Embedded)
 * Stores snapshots of analytical review data at each edit
 */
const AnalyticalReviewVersionSchema = new Schema({
  versionNumber: {
    type: Number,
    required: true
  },
  data: {
    ratios: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },
    commentary: { type: String },
    conclusions: { type: String },
    keyFindings: [{ type: String }],
    riskAssessment: { type: String }
  },
  editedBy: {
    type: String, // User ID
    required: true
  },
  editedAt: {
    type: Date,
    default: Date.now
  },
  changeNote: {
    type: String
  },
  ipAddress: {
    type: String
  }
}, { _id: true });

/**
 * Analytical Review Schema
 * Main document for storing analytical review data with embedded version history
 */
const AnalyticalReviewSchema = new Schema({
  engagement: {
    type: Types.ObjectId,
    ref: 'Engagement',
    required: true,
    unique: true,
    index: true
  },
  
  // User context
  auditorId: {
    type: String,
    required: true,
    index: true
  },
  clientId: {
    type: String,
    required: true,
    index: true
  },

  // Current data
  ratios: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  
  commentary: {
    type: String,
    default: ''
  },
  
  conclusions: {
    type: String,
    default: ''
  },

  keyFindings: [{
    type: String
  }],

  riskAssessment: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical', ''],
    default: ''
  },

  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'in-progress', 'submitted', 'reviewed', 'approved', 'rejected'],
    default: 'draft',
    index: true
  },

  // Version tracking
  currentVersion: {
    type: Number,
    default: 1
  },

  // Embedded version history
  versions: [AnalyticalReviewVersionSchema],

  // Metadata
  lastEditedBy: {
    type: String,
    index: true
  },
  lastEditedAt: {
    type: Date
  },

  // Review tracking
  submittedAt: {
    type: Date
  },
  submittedBy: {
    type: String
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String
  },
  reviewComments: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for engagement reference
AnalyticalReviewSchema.virtual('engagementDoc', {
  ref: 'Engagement',
  localField: 'engagement',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
AnalyticalReviewSchema.index({ engagement: 1 }, { unique: true });
AnalyticalReviewSchema.index({ auditorId: 1, status: 1 });
AnalyticalReviewSchema.index({ status: 1, createdAt: -1 });
AnalyticalReviewSchema.index({ clientId: 1 });

// Static methods
AnalyticalReviewSchema.statics.getByEngagement = function(engagementId) {
  return this.findOne({ engagement: engagementId });
};

AnalyticalReviewSchema.statics.getByAuditor = function(auditorId, status = null) {
  const filter = { auditorId };
  if (status) filter.status = status;
  return this.find(filter).sort({ updatedAt: -1 });
};

AnalyticalReviewSchema.statics.getByClient = function(clientId) {
  return this.find({ clientId }).sort({ updatedAt: -1 });
};

AnalyticalReviewSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ updatedAt: -1 });
};

// Instance methods

/**
 * Create a version snapshot before updating
 */
AnalyticalReviewSchema.methods.createVersion = function(userId, changeNote = '', ipAddress = null) {
  const versionData = {
    versionNumber: this.currentVersion,
    data: {
      ratios: this.ratios,
      commentary: this.commentary,
      conclusions: this.conclusions,
      keyFindings: this.keyFindings,
      riskAssessment: this.riskAssessment
    },
    editedBy: userId,
    editedAt: new Date(),
    changeNote,
    ipAddress
  };

  this.versions.push(versionData);
  this.currentVersion += 1;
  this.lastEditedBy = userId;
  this.lastEditedAt = new Date();

  return this;
};

/**
 * Get specific version by number
 */
AnalyticalReviewSchema.methods.getVersion = function(versionNumber) {
  return this.versions.find(v => v.versionNumber === versionNumber);
};

/**
 * Restore to a specific version
 */
AnalyticalReviewSchema.methods.restoreVersion = function(versionNumber, userId, changeNote = '') {
  const version = this.getVersion(versionNumber);
  if (!version) {
    throw new Error(`Version ${versionNumber} not found`);
  }

  // Create a snapshot of current state before restoring
  this.createVersion(userId, changeNote || `Restored to version ${versionNumber}`);

  // Restore data from the version
  this.ratios = version.data.ratios;
  this.commentary = version.data.commentary;
  this.conclusions = version.data.conclusions;
  this.keyFindings = version.data.keyFindings;
  this.riskAssessment = version.data.riskAssessment;

  this.lastEditedBy = userId;
  this.lastEditedAt = new Date();

  return this;
};

/**
 * Submit for review
 */
AnalyticalReviewSchema.methods.submitForReview = function(userId) {
  this.status = 'submitted';
  this.submittedAt = new Date();
  this.submittedBy = userId;
  return this.save();
};

/**
 * Approve review
 */
AnalyticalReviewSchema.methods.approve = function(userId, comments = '') {
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = userId;
  this.reviewedAt = new Date();
  this.reviewedBy = userId;
  this.reviewComments = comments;
  return this.save();
};

/**
 * Reject review
 */
AnalyticalReviewSchema.methods.reject = function(userId, comments = '') {
  this.status = 'rejected';
  this.reviewedAt = new Date();
  this.reviewedBy = userId;
  this.reviewComments = comments;
  return this.save();
};

// Pre-save middleware
AnalyticalReviewSchema.pre('save', function(next) {
  if (this.isModified('ratios') || this.isModified('commentary') || 
      this.isModified('conclusions') || this.isModified('keyFindings') || 
      this.isModified('riskAssessment')) {
    this.lastEditedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('AnalyticalReview', AnalyticalReviewSchema);

