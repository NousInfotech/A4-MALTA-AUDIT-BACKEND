// models/DocumentRequest.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Auditor requests documents from client.
 * Client will see these and upload via Supabase Storage.
 */
const DocumentRequestSchema = new Schema({
  engagement:   { type: Types.ObjectId, ref: 'Engagement', required: true },
  clientId:     { type: String, required: true },
  category:     { type: String, required: true, index: true },
  description:  { type: String, required: true },
  status: {
    type: String,
    enum: ['pending','completed'],
    default: 'pending'
  },
  requestedAt:  { type: Date,   default: Date.now },
  completedAt:  { type: Date },
  documents: [{
    name:       { type: String, required: true },
    url:        { type: String, required: true }, // Supabase file URL
    uploadedAt: { type: Date,   default: Date.now }
  }],
});

module.exports = mongoose.model('DocumentRequest', DocumentRequestSchema);
