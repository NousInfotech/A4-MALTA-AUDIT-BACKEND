const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const DocumentRequestSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  clientId: { type: String, required: true },
  name: { type: String, },
  category: { type: String, required: true, index: true },
  description: { type: String, required: true },
  comment: { type: String, default: "" },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'completed'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  documents: [{
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['direct', 'template'], 
      default: 'direct' 
    },
    
    // Optional: Template for client to download and fill (template-based workflow)
    template: {
      url: { type: String }, // Auditor's uploaded template URL
      instruction: { type: String } // Instructions for filling the template
    },
    
    // Client's uploaded document (works for both direct-upload and template-based)
    url: { type: String }, // Supabase file URL 
    uploadedFileName: { type: String }, // Store the actual uploaded filename separately
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'in-review', 'approved', 'rejected'],
      default: 'pending'
    },
    comment: { type: String, default: "" }, // Comment from client when uploading
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
