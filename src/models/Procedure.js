// models/Procedure.js

const mongoose = require("mongoose");

const TestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    assertions: [{ type: String, enum: ["EX", "CO", "VA", "RO", "PD"] }],
    linkedRiskIds: [{ type: String }],
    procedureType: {
      type: String,
      enum: ["Test of Controls", "Substantive Analytical Procedure", "Test of Details"],
    },
    threshold: { type: String, default: null },
    population: { type: String, default: null },
    sampleMethod: { type: String, default: null },
    evidenceExpected: [{ type: String }],
    notes: { type: String, default: null },
    etbRefs: [{ type: String }],
  },
  { _id: false },
);

const LinkedRiskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    rating: { type: String, enum: ["High", "Medium", "Low"], required: true },
  },
  { _id: false },
);

const ProcedureDetailSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    objective: { type: String, required: true },
    assertions: [{ type: String, enum: ["EX", "CO", "VA", "RO", "PD"] }],
    linkedRisks: [LinkedRiskSchema],
    procedureType: {
      type: String,
      enum: ["Test of Controls", "Substantive Analytical Procedure", "Test of Details"],
    },
    tests: [TestSchema],
    expectedResults: { type: String, required: true },
    standards: {
      isa: [{ type: String }],
      gapsme: [{ type: String }],
    },
  },
  { _id: false },
);

const ProcedureQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, default: "" },
    isRequired: { type: Boolean, default: false },
    classification: { type: String, default: "" },
  },
  { _id: false },
);

const ProcedureSchema = new mongoose.Schema(
  {
    engagement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
      unique: true, // each engagement has at most one Procedure doc
    },
    mode: {
      type: String,
      enum: ["manual", "ai", "hybrid"],
      required: true,
    },
    materiality: {
      type: Number,
      required: true,
    },
    selectedClassifications: [{ type: String }],
    validitySelections: [
      {
        rowId: String,
        code: String,
        accountName: String,
        finalBalance: Number,
        isValid: Boolean,
      },
    ],
    procedures: [ProcedureDetailSchema],
    questions: [ProcedureQuestionSchema],
    recommendations: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "in-progress", "completed"],
      default: "draft",
    },
    aiProcessingStatus: [
      {
        classification: String,
        status: { type: String, enum: ["queued", "loading", "completed", "error"] },
        error: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Procedure", ProcedureSchema);
