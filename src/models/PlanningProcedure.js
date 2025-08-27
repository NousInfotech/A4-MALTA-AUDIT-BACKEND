// models/PlanningProcedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/** One field/question inside a section */
const FieldSchema = new Schema(
  {
    key: { type: String, required: true },
    type: { type: String, required: true }, // text, textarea, number, checkbox, select, multiselect, table, group, file, user, markdown...
    label: { type: String, default: "" },
    required: { type: Boolean, default: false },
    help: { type: String, default: "" },

    // editor configs – allow anything the UI sends
    options: { type: [String], default: undefined },   // select/multiselect
    columns: { type: [String], default: undefined },   // table
    fields:  { type: Schema.Types.Mixed, default: undefined }, // group config (children etc.)
    content: { type: String, default: "" },            // markdown content

    // conditional visibility of any shape
    visibleIf: { type: Schema.Types.Mixed, default: undefined },

    // answers can be string/number/boolean/object/array
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

    // IMPORTANT: allow string OR object { type, content }
    footer: { type: Schema.Types.Mixed, default: null },
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
      unique: true, // single doc per engagement
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

    // support manual / ai / hybrid
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

    // timestamps like questionsGeneratedAt / answersGeneratedAt can be added ad-hoc
  },
  { timestamps: true, strict: false }
);

module.exports =
  mongoose.models.PlanningProcedure ||
  mongoose.model("PlanningProcedure", PlanningProcedureSchema);
