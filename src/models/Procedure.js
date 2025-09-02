// src/models/Procedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuestionSchema = new mongoose.Schema({
  key: { type: String },
  classificationTag: { type: String },
  question: { type: String },
  assertions: [{ type: String }],
  commentable: { type: Boolean, default: true },
  // manual fields compatibility
  type: { type: String },   // "procedure" | "textarea" | "label"
  label: { type: String },
  procedure: { type: String },
  help: { type: String }
}, { _id: false });

const AnswerSchema = new mongoose.Schema({
  key: { type: String, required: true },
  answer: { type: String, required: true }
}, { _id: false });

const ProcedureSchema = new mongoose.Schema({
     engagement: {
      type: Schema.Types.ObjectId,
      ref: "Engagement",
    },
  createdBy: { type: String },
  framework: { type: String, enum: ["IFRS", "GAPSME"], default: "IFRS" },
  mode: { type: String, enum: ["manual", "ai", "hybrid"], required: true },
  classificationsSelected: [String],
  manualPacks: [{
    sectionId: String,
    title: String,
    standards: [String],
    fields: [QuestionSchema]
  }],
  aiQuestions: [QuestionSchema],
  aiAnswers: [AnswerSchema],
  recommendations:  { type: String, default:"" },
  status: { type: String, enum: ["draft", "final"], default: "draft" }
}, { timestamps: true });

module.exports = mongoose.model("Procedure", ProcedureSchema);
