const mongoose = require("mongoose")

const ProcedureQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, default: "" },
    isRequired: { type: Boolean, default: false },
    classification: { type: String, default: "" },
  },
  { _id: false },
)

const ProcedureSchema = new mongoose.Schema(
  {
    engagement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
      unique: true,
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
    selectedClassifications: [
      {
        type: String,
      },
    ],
    validitySelections: [
      {
        rowId: String,
        code: String,
        accountName: String,
        finalBalance: Number,
        isValid: Boolean,
      },
    ],
    questions: [ProcedureQuestionSchema],
    recommendations: {
      type: String,
      default: "",
    },
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
  {
    timestamps: true,
  },
)

ProcedureSchema.index({ engagement: 1 })

module.exports = mongoose.model("Procedure", ProcedureSchema)
