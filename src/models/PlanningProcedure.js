// models/PlanningProcedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/** One field/question inside a section */
const FieldSchema = new Schema(
  {
    key: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, default: "" },
    required: { type: Boolean, default: false },
    help: { type: String, default: "" },
    options: { type: [String], default: undefined },
    columns: { type: [String], default: undefined },
    fields:  { type: Schema.Types.Mixed, default: undefined },
    content: { type: String, default: "" },
    visibleIf: { type: Schema.Types.Mixed, default: undefined },
    answer: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false, strict: false }
);

/** One planning section */
const SectionSchema = new Schema(
  {
    id: { type: String },
    sectionId: { type: String },
    title: { type: String },
    standards: { type: [String], default: undefined },
    currency: { type: String, default: undefined },
    fields: { type: [FieldSchema], default: [] },
    footer: { type: Schema.Types.Mixed, default: null },
    sectionRecommendations: { type: String, default: "" }, // NEW: Section-specific recommendations
  },
  { _id: false, strict: false }
);

/** Top-level document (one per engagement) */
const PlanningProcedureSchema = new Schema(
  {
    engagement: {
      type: Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
      unique: true,
    },
    procedureType: { type: String, default: "planning" },
    materiality: { type: Number, default: undefined },
    selectedSections: { type: [String], default: [] },
    procedures: { type: [SectionSchema], default: [] },
    recommendations: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "in-progress", "completed"],
      default: "in-progress",
    },
    mode: {
      type: String,
      enum: ["manual", "ai", "hybrid"],
      default: "manual",
    },
    files: {
      type: [
        {
          name: String,
          url: String,
          size: Number,
          mimetype: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true, strict: false }
);

module.exports =
  mongoose.models.PlanningProcedure ||
  mongoose.model("PlanningProcedure", PlanningProcedureSchema);