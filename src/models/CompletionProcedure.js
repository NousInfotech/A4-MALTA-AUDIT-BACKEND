// models/CompletionProcedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Recommendation checklist item schema
const RecommendationItemSchema = new Schema(
  {
    id: { type: String },
    text: { type: String },
    checked: { type: Boolean, default: false },
    section: { type: String }
  },
  { _id: false }
);

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

/** One completion section */
const SectionSchema = new Schema(
  {
    id: { type: String },
    sectionId: { type: String },
    title: { type: String },
    standards: { type: [String], default: undefined },
    currency: { type: String, default: undefined },
    fields: { type: [FieldSchema], default: [] },
    footer: { type: Schema.Types.Mixed, default: null },
    sectionRecommendations: { 
      type: [RecommendationItemSchema],
      default: [] 
    },
  },
  { _id: false, strict: false }
);

/** Top-level document (one per engagement) */
const CompletionProcedureSchema = new Schema(
  {
    engagement: {
      type: Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
      unique: true,
    },
    procedureType: { type: String, default: "completion" },
    materiality: { type: Number, default: undefined },
    selectedSections: { type: [String], default: [] },
    procedures: { type: [SectionSchema], default: [] },
    recommendations: { 
      type: [RecommendationItemSchema],
      default: [],
      validate: {
        validator: function(v) {
          return Array.isArray(v);
        },
        message: 'Recommendations must be an array'
      }
    },
    recommendationsBySection: {
      type: Map,
      of: [RecommendationItemSchema],
      default: {}
    },
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

    // Review and Sign-off fields
    reviewStatus: {
      type: String,
      enum: ['in-progress', 'ready-for-review', 'under-review', 'approved', 'rejected', 'signed-off', 're-opened'],
      default: 'in-progress'
    },
    reviewerId: {
      type: String
    },
    reviewedAt: {
      type: Date
    },
    reviewComments: {
      type: String
    },
    approvedBy: {
      type: String
    },
    approvedAt: {
      type: Date
    },
    signedOffBy: {
      type: String
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
      type: String
    },
    reopenedAt: {
      type: Date
    },
    reopenedBy: {
      type: String
    },
    reopenReason: {
      type: String
    },
    reviewVersion: {
      type: Number,
      default: 1
    }
  },
  { 
    timestamps: true, 
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add pre-save middleware to clean up data
CompletionProcedureSchema.pre('save', function(next) {
  if (typeof this.recommendations === 'string') {
    this.recommendations = [];
  } else if (!Array.isArray(this.recommendations)) {
    this.recommendations = [];
  }
  
  if (typeof this.recommendationsBySection === 'string') {
    this.recommendationsBySection = {};
  } else if (!this.recommendationsBySection || typeof this.recommendationsBySection !== 'object') {
    this.recommendationsBySection = {};
  }
  
  next();
});

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

CompletionProcedureSchema.pre('validate', function(next) {
  if (!Array.isArray(this.procedures)) this.procedures = [];
  this.procedures = this.procedures.filter(isPlainObject);

  for (const sec of this.procedures) {
    if (!Array.isArray(sec.fields)) sec.fields = [];
    else sec.fields = sec.fields.filter(isPlainObject);

    if (!Array.isArray(sec.sectionRecommendations)) sec.sectionRecommendations = [];
    else sec.sectionRecommendations = sec.sectionRecommendations.filter(isPlainObject);
  }

  if (!Array.isArray(this.recommendations)) this.recommendations = [];
  else this.recommendations = this.recommendations.filter(isPlainObject);

  let rbs = this.recommendationsBySection;
  if (!rbs || typeof rbs !== 'object') rbs = {};
  rbs = rbs instanceof Map ? Object.fromEntries(rbs.entries()) : rbs;
  for (const k of Object.keys(rbs)) {
    rbs[k] = Array.isArray(rbs[k]) ? rbs[k].filter(isPlainObject) : [];
  }
  this.recommendationsBySection = rbs;

  if (!Array.isArray(this.files)) this.files = [];
  else this.files = this.files.filter(isPlainObject);

  if (!Array.isArray(this.selectedSections)) this.selectedSections = [];
  else this.selectedSections = this.selectedSections.filter(s => typeof s === 'string');

  next();
});

module.exports =
  mongoose.models.CompletionProcedure ||
  mongoose.model("CompletionProcedure", CompletionProcedureSchema);