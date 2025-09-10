const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ISQMParentSchema = new Schema({
  metadata: {
    title: { type: String, required: true },
    version: { type: String },
    jurisdiction_note: { type: String },
    sources: [{ type: String }],
    generated: { type: Date }
  },
  // References to children questionnaires (ISQM1, ISQM2, ISA220 etc.)
  children: [{ type: Types.ObjectId, ref: "ISQMQuestionnaire" }],
  
  // Supporting documents for the ISQM pack
  supportingDocuments: [{ type: Types.ObjectId, ref: "ISQMSupportingDocument" }],
  
  // Additional metadata for audit purposes
  createdBy: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'in-progress', 'completed', 'archived'],
    default: 'draft'
  },
  
  // Completion tracking
  completionStats: {
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for populated children
ISQMParentSchema.virtual('questionnaires', {
  ref: 'ISQMQuestionnaire',
  localField: 'children',
  foreignField: '_id'
});

// Virtual for populated supporting documents
ISQMParentSchema.virtual('documents', {
  ref: 'ISQMSupportingDocument',
  localField: 'supportingDocuments',
  foreignField: '_id'
});

// Index for better query performance
ISQMParentSchema.index({ 'metadata.title': 1 });
ISQMParentSchema.index({ createdBy: 1 });
ISQMParentSchema.index({ status: 1 });

module.exports = mongoose.model('ISQMParent', ISQMParentSchema);
