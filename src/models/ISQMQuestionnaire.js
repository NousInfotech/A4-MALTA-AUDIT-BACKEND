const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const QnASchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, default: "" },
  state: { type: Boolean, default: false },
  
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

module.exports = mongoose.model('ISQMQuestionnaire', ISQMQuestionnaireSchema);
