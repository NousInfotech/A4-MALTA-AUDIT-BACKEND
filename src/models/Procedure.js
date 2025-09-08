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
    type: String, 
    default: "" 
  },
  recommendationsByClassification: {
    type: Map,
    of: String,
    default: {}
  },
  status: { 
    type: String, 
    enum: ["draft", "completed"], 
    default: "draft" 
  }
}, { 
  timestamps: true 
});

// Index for faster queries
ProcedureSchema.index({ engagement: 1 });

module.exports = mongoose.model("Procedure", ProcedureSchema);