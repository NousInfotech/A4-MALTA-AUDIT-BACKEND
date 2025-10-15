// models/PlanningProcedure.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Add this schema near the top with other schemas
const RecommendationItemSchema = new Schema(
  {
    id: { type: String },
    text: { type: String },
    checked: { type: Boolean, default: false },
    section: { type: String } // For section-specific recommendations
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
    sectionRecommendations: { 
      type: [RecommendationItemSchema], // CHANGED: Now array of checklist items
      default: [] 
    },
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
    recommendations: { 
      type: [RecommendationItemSchema], // CHANGED: Now array of checklist items
      default: [],
      validate: {
        validator: function(v) {
          // Ensure it's always an array
          return Array.isArray(v);
        },
        message: 'Recommendations must be an array'
      }
    },
    recommendationsBySection: {
      type: Map,
      of: [RecommendationItemSchema], // CHANGED: Now arrays of checklist items
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
  },
  { 
    timestamps: true, 
    strict: false,
    // Add pre-save middleware to ensure data integrity
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add pre-save middleware to clean up data
PlanningProcedureSchema.pre('save', function(next) {
  // Ensure recommendations is always an array
  if (typeof this.recommendations === 'string') {
    this.recommendations = [];
  } else if (!Array.isArray(this.recommendations)) {
    this.recommendations = [];
  }
  
  // Ensure recommendationsBySection is always an object
  if (typeof this.recommendationsBySection === 'string') {
    this.recommendationsBySection = {};
  } else if (!this.recommendationsBySection || typeof this.recommendationsBySection !== 'object') {
    this.recommendationsBySection = {};
  }
  
  next();
});
function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

PlanningProcedureSchema.pre('validate', function(next) {
  // procedures
  if (!Array.isArray(this.procedures)) this.procedures = [];
  this.procedures = this.procedures.filter(isPlainObject);

  for (const sec of this.procedures) {
    if (!Array.isArray(sec.fields)) sec.fields = [];
    else sec.fields = sec.fields.filter(isPlainObject);

    if (!Array.isArray(sec.sectionRecommendations)) sec.sectionRecommendations = [];
    else sec.sectionRecommendations = sec.sectionRecommendations.filter(isPlainObject);
  }

  // top-level recommendations
  if (!Array.isArray(this.recommendations)) this.recommendations = [];
  else this.recommendations = this.recommendations.filter(isPlainObject);

  // recommendationsBySection as plain object of arrays of objects
  let rbs = this.recommendationsBySection;
  if (!rbs || typeof rbs !== 'object') rbs = {};
  rbs = rbs instanceof Map ? Object.fromEntries(rbs.entries()) : rbs;
  for (const k of Object.keys(rbs)) {
    rbs[k] = Array.isArray(rbs[k]) ? rbs[k].filter(isPlainObject) : [];
  }
  this.recommendationsBySection = rbs;

  // files
  if (!Array.isArray(this.files)) this.files = [];
  else this.files = this.files.filter(isPlainObject);

  // selectedSections
  if (!Array.isArray(this.selectedSections)) this.selectedSections = [];
  else this.selectedSections = this.selectedSections.filter(s => typeof s === 'string');

  next();
});

module.exports =
  mongoose.models.PlanningProcedure ||
  mongoose.model("PlanningProcedure", PlanningProcedureSchema);