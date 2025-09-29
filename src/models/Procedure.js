// src/models/Procedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuestionSchema = new mongoose.Schema({
  key: { type: String },
  classificationTag: { type: String },
  question: { type: String },
  assertions: [{ type: String }],
  commentable: { type: Boolean, default: true },
  id: { type: String },
  classification: { type: String },
  framework:{
    type:String,
  },
  reference:{
    type:String,
  },
  answer: { type: String },
  // manual fields compatibility
  type: { type: String },   // "procedure" | "textarea" | "label"
  label: { type: String },
  procedure: { type: String },
  help: { type: String }
}, { _id: false });

const ValiditySelectionSchema = new mongoose.Schema({
  rowId: { type: String },
  code: { type: String },
  accountName: { type: String },
  finalBalance: { type: Number },
  classification: { type: String },
  isValid: { type: Boolean }
}, { _id: false });

// NEW: Recommendation checklist item schema
const RecommendationItemSchema = new mongoose.Schema({
  id: { type: String },
  text: { type: String },
  checked: { type: Boolean, default: false },
  classification: { type: String } // For fieldwork procedures
}, { _id: false });

const ProcedureSchema = new mongoose.Schema({
  engagement: {
    type: Schema.Types.ObjectId,
    ref: "Engagement",
    required: true,
    unique: true
  },
  createdBy: { type: String },
  framework: { 
    type: String, 
    enum: ["IFRS", "GAPSME"], 
    default: "IFRS" 
  },
  mode: { 
    type: String, 
    enum: ["manual", "ai", "hybrid"], 
    required: true 
  },
  materiality: { type: Number },
  validitySelections: [ValiditySelectionSchema],
  selectedClassifications: [{ type: String }],
  questions: [QuestionSchema],
  recommendations: { 
    type: [RecommendationItemSchema], // CHANGED: Now array of checklist items
    default: [] 
  },
  recommendationsByClassification: {
    type: Map,
    of: [RecommendationItemSchema], // CHANGED: Now arrays of checklist items
    default: {}
  },
  status: { 
    type: String, 
    enum: ["draft", "completed"], 
    default: "draft" 
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
  }
}, { 
  timestamps: true 
});

// Index for faster queries
ProcedureSchema.index({ engagement: 1 });

module.exports = mongoose.model("Procedure", ProcedureSchema);