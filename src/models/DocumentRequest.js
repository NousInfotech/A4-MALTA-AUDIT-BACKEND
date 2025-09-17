const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DocumentRequestSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  clientId: { type: String, required: true },
  name: { type: String, },
  category: { type: String, required: true, index: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  documents: [{
    name: { type: String, required: true },
    url: { type: String }, // Supabase file URL 
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'in-review', 'approved', 'rejected'],
      default: 'pending'
    },
  }],

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
  }
});

module.exports = mongoose.model('DocumentRequest', DocumentRequestSchema);
