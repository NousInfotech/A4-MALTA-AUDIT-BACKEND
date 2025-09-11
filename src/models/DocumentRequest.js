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
});

module.exports = mongoose.model('DocumentRequest', DocumentRequestSchema);
