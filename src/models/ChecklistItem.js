const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ChecklistItemSchema = new Schema({
  engagement: {
    type: Types.ObjectId,
    ref: 'Engagement',
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  isNotApplicable: {
    type: Boolean,
    default: false
  },
  fieldType: {
    type: String,
    enum: ['checkbox', 'text', 'date', 'select'],
    default: 'checkbox'
  },
  textValue: {
    type: String,
    default: ''
  },
  dateValue: {
    type: Date,
    default: null
  },
  selectValue: {
    type: String,
    default: ''
  },
  selectOptions: {
    type: [String],
    default: []
  },

  // Review and Sign-off fields
  reviewStatus: {
    type: String,
    enum: ['in-progress', 'ready-for-review', 'under-review', 'approved', 'rejected', 'signed-off', 're-opened'],
    default: 'in-progress'
  },
  reviewerId: {
    type: String // User ID of assigned reviewer
  },
  reviewedAt: {
    type: Date
  },
  reviewComments: {
    type: String
  },
  approvedBy: {
    type: String // User ID of approver
  },
  approvedAt: {
    type: Date
  },
  signedOffBy: {
    type: String // User ID of partner who signed off
  },
  signedOffAt: {
    type: Date
  },
  signOffComments: {
    type: String
  },
  isSignedOff: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: {
    type: Date
  },
  lockedBy: {
    type: String // User ID who locked the item
  },
  reopenedAt: {
    type: Date
  },
  reopenedBy: {
    type: String // User ID who reopened the item
  },
  reopenReason: {
    type: String
  },
  reviewVersion: {
    type: Number,
    default: 1
  },
  
  // Document Request Integration
  documentRequestId: {
    type: Types.ObjectId,
    ref: 'DocumentRequest',
    default: null
  },
  isRequested: {
    type: Boolean,
    default: false
  },
  isUploaded: {
    type: Boolean,
    default: false
  },
  documentLibraryId: {
    type: Types.ObjectId,
    ref: 'EngagementLibrary',
    default: null
  },
  isRestricted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChecklistItem', ChecklistItemSchema);
