const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const QnASchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, default: "" },
  state: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['Implemented', 'Partially Implemented', 'Not Implemented', 'Error', null],
    default: null
  },
  
  // Additional fields for enhanced functionality
  questionId: { type: String }, // Unique identifier for the question
  isMandatory: { type: Boolean, default: false },
  questionType: { 
    type: String, 
    enum: ['yes-no', 'text', 'textarea', 'select', 'multi-select'],
    default: 'yes-no'
  },
  options: [{ type: String }], // For select/multi-select questions
  helpText: { type: String }, // Additional guidance for the question
  
  // Answer tracking
  answeredAt: { type: Date },
  answeredBy: { type: String }, // User ID who answered
  
  // Comments and notes
  comments: [{ 
    text: String,
    addedBy: String,
    addedAt: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  _id: true
});

const SectionSchema = new Schema({
  heading: { type: String, required: true },
  sectionId: { type: String }, // Unique identifier for the section
  description: { type: String }, // Optional section description
  order: { type: Number, default: 0 }, // For ordering sections
  
  qna: [QnASchema],
  
  // Section-level metadata
  isCompleted: { type: Boolean, default: false },
  completionPercentage: { type: Number, default: 0 },
  
  // Section notes
  notes: [{ 
    text: String,
    addedBy: String,
    addedAt: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  _id: true
});

const ISQMQuestionnaireSchema = new Schema({
  parentId: { type: Types.ObjectId, ref: "ISQMParent", required: true },
  key: { type: String, required: true }, // e.g. "ISQM_1", "ISQM_2", "ISA_220_Revised"
  heading: { type: String, required: true },
  description: { type: String }, // Optional description of the questionnaire
  
  sections: [SectionSchema],
  
  // Questionnaire-level metadata
  version: { type: String },
  framework: { type: String }, // e.g., "IFRS", "GAPSME"
  
  // Completion tracking
  status: { 
    type: String, 
    enum: ['not-started', 'in-progress', 'completed', 'under-review'],
    default: 'not-started'
  },
  
  // Statistics
  stats: {
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    lastUpdated: { type: Date }
  },
  
  // Assignment and review
  assignedTo: { type: String }, // User ID assigned to complete this questionnaire
  reviewedBy: { type: String }, // User ID who reviewed
  reviewedAt: { type: Date },
  
  // Document URL tracking
  procedureUrls: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    version: { type: String, default: "1.0" },
    uploadedBy: { type: String, required: true },
    description: { type: String }
  }],
  
  policyUrls: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    version: { type: String, default: "1.0" },
    uploadedBy: { type: String, required: true },
    description: { type: String }
  }],
  
  // Overall questionnaire notes
  notes: [{ 
    text: String,
    addedBy: String,
    addedAt: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for parent reference
ISQMQuestionnaireSchema.virtual('parent', {
  ref: 'ISQMParent',
  localField: 'parentId',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
ISQMQuestionnaireSchema.index({ parentId: 1 });
ISQMQuestionnaireSchema.index({ key: 1 });
ISQMQuestionnaireSchema.index({ status: 1 });
ISQMQuestionnaireSchema.index({ assignedTo: 1 });

// Pre-save middleware to calculate statistics
ISQMQuestionnaireSchema.pre('save', function(next) {
  let totalQuestions = 0;
  let answeredQuestions = 0;
  
  this.sections.forEach(section => {
    section.qna.forEach(qna => {
      totalQuestions++;
      if (qna.answer && qna.answer.trim() !== '') {
        answeredQuestions++;
      }
    });
    
    // Calculate section completion percentage
    const sectionTotal = section.qna.length;
    const sectionAnswered = section.qna.filter(q => q.answer && q.answer.trim() !== '').length;
    section.completionPercentage = sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;
    section.isCompleted = section.completionPercentage === 100;
  });
  
  // Update questionnaire statistics
  this.stats.totalQuestions = totalQuestions;
  this.stats.answeredQuestions = answeredQuestions;
  this.stats.completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  this.stats.lastUpdated = new Date();
  
  // Update status based on completion
  if (this.stats.completionPercentage === 100) {
    this.status = 'completed';
  } else if (this.stats.answeredQuestions > 0) {
    this.status = 'in-progress';
  } else {
    this.status = 'not-started';
  }
  
  next();
});

// Dynamic tag method - generates tags based on component key/heading
ISQMQuestionnaireSchema.methods.generateTags = function() {
  const tags = [];
  
  // Add component-based tags
  if (this.key) {
    tags.push(this.key);
    
    // Extract component type (ISQM, ISA, etc.)
    const componentType = this.key.split('_')[0];
    tags.push(componentType);
    
    // Add specific component number if available
    const componentNumber = this.key.split('_')[1];
    if (componentNumber) {
      tags.push(`${componentType}_${componentNumber}`);
    }
  }
  
  // Add heading-based tags
  if (this.heading) {
    const headingWords = this.heading.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .split(' ')
      .filter(word => word.length > 2); // Filter short words
    
    tags.push(...headingWords);
  }
  
  // Add framework tags
  if (this.framework) {
    tags.push(this.framework.toLowerCase());
  }
  
  // Add status tags
  if (this.status) {
    tags.push(this.status);
  }
  
  // Remove duplicates and return
  return [...new Set(tags)];
};

// Method to add procedure URL
ISQMQuestionnaireSchema.methods.addProcedureUrl = function(urlData) {
  this.procedureUrls.push({
    name: urlData.name,
    url: urlData.url,
    version: urlData.version || "1.0",
    uploadedBy: urlData.uploadedBy,
    description: urlData.description,
    updatedAt: new Date()
  });
  
  return this.save();
};

// Method to add policy URL
ISQMQuestionnaireSchema.methods.addPolicyUrl = function(urlData) {
  this.policyUrls.push({
    name: urlData.name,
    url: urlData.url,
    version: urlData.version || "1.0",
    uploadedBy: urlData.uploadedBy,
    description: urlData.description,
    updatedAt: new Date()
  });
  
  return this.save();
};

// Method to get latest procedure URL
ISQMQuestionnaireSchema.methods.getLatestProcedureUrl = function() {
  if (this.procedureUrls.length === 0) return null;
  
  return this.procedureUrls
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
};

// Method to get latest policy URL
ISQMQuestionnaireSchema.methods.getLatestPolicyUrl = function() {
  if (this.policyUrls.length === 0) return null;
  
  return this.policyUrls
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
};

// Method to remove procedure URL
ISQMQuestionnaireSchema.methods.removeProcedureUrl = function(urlId) {
  this.procedureUrls = this.procedureUrls.filter(url => url._id.toString() !== urlId);
  return this.save();
};

// Method to remove policy URL
ISQMQuestionnaireSchema.methods.removePolicyUrl = function(urlId) {
  this.policyUrls = this.policyUrls.filter(url => url._id.toString() !== urlId);
  return this.save();
};

// Static method to get questionnaires by component type
ISQMQuestionnaireSchema.statics.getByComponentType = function(componentType) {
  return this.find({ key: new RegExp(`^${componentType}_`, 'i') });
};

// Static method to get questionnaires by tags
ISQMQuestionnaireSchema.statics.getByTags = function(tags) {
  const query = {
    $or: [
      { key: { $in: tags } },
      { heading: { $regex: tags.join('|'), $options: 'i' } },
      { framework: { $in: tags } }
    ]
  };
  
  return this.find(query);
};

module.exports = mongoose.model('ISQMQuestionnaire', ISQMQuestionnaireSchema);
