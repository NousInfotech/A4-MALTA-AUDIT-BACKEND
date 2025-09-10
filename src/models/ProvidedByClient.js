const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * QnA Discussion Schema
 */
const QnADiscussionSchema = new Schema({
  role: {
    type: String,
    enum: ['client', 'auditor'],
    required: true
  },
  message: { type: String, required: true },
  replyTo: { type: Types.ObjectId }, // reply chain
  createdAt: { type: Date, default: Date.now }
}, { _id: true });


/**
 * QnA Question Schema
 */
const QnAQuestionSchema = new Schema({
  question: { type: String, required: true },
  isMandatory: { type: Boolean, default: false },
  answer: { type: String },
  status: {
    type: String,
    enum: ['unanswered', 'answered', 'doubt'],
    default: 'unanswered'
  },
  discussions: [QnADiscussionSchema],
  answeredAt: { type: Date }
}, { timestamps: true });


/**
 * Category Schema (linked to PBC)
 */
const QnACategorySchema = new Schema({
  pbcId: { type: Types.ObjectId, ref: 'PBC', required: true },
  title: { type: String, required: true },
  qnaQuestions: [QnAQuestionSchema],
}, { timestamps: true });


/**
 * PBC Schema
 */
const PBCSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  clientId: { type: String, required: true },
  auditorId: { type: String, required: true },
  documentRequests: [{ type: Types.ObjectId, ref: 'DocumentRequest' }],

  // 🔹 Extra fields for AI context
  entityName: { type: String }, // engagement.title
  periodStart: { type: Date },  // optional, can be null
  periodEnd: { type: Date },    // engagement.yearEndDate
  currency: { type: String, default: "EUR" },
  framework: { type: String, default: "IFRS" }, // GAAP/IFRS etc
  industry: { type: String }, // free text
  materialityAbsolute: { type: Number, default: null },
  riskNotes: { type: String, default: "" },

  // 🔹 trial balance linkage
  trialBalanceUrl: { type: String }, // direct link
  trialBalance: { type: Types.ObjectId, ref: "TrialBalance" },

  // 🔹 workflow level
  status: {
    type: String,
    enum: [
      'document-collection',  // Level 1
      'qna-preparation',      // Level 2
      'client-responses',     // Level 3
      'doubt-resolution',     // Level 4
      'submitted'             // Level 5
    ],
    default: 'document-collection'
  }
}, { timestamps: true });


const PBC = mongoose.model('PBC', PBCSchema);
const QnACategory = mongoose.model('QnACategory', QnACategorySchema);

module.exports = { PBC, QnACategory };
