const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

// =======================
// SINGLE DOCUMENT SCHEMA
// =======================
const DocumentRequestSingleDocumentSchema = new Schema({
  name: { type: String, required: true },

  type: {
    type: String,
    enum: ["direct", "template", "multiple"],
    default: "direct",
  },

  template: {
    url: { type: String },
    instruction: { type: String },
  },

  url: { type: String },
  uploadedFileName: { type: String },
  uploadedAt: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ["pending", "uploaded", "in-review", "approved", "rejected"],
    default: "pending",
  },

  comment: { type: String, default: "" },
});

// =======================
// MULTIPLE DOCUMENT ITEM
// =======================

const MultipleDocumentItemSchema = new Schema({
  template: {
    url: { type: String },
    instruction: { type: String },
  },

  url: { type: String },
  uploadedFileName: { type: String },
  uploadedAt: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ["pending", "uploaded", "in-review", "approved", "rejected"],
    default: "pending",
  },

  comment: { type: String, default: "" },
});

// =======================
// MULTIPLE DOCUMENT SCHEMA
// =======================

const DocumentRequestMultipleDocumentSchema = new Schema({
  name: { type: String, required: true },

  type: {
    type: String,
    enum: ["direct", "template", "multiple"],
    default: "multiple",
  },

  // Each required page/file is a separate object
  multiple: [MultipleDocumentItemSchema],
});

// =======================
// ROOT DOCUMENT REQUEST SCHEMA
// =======================

const DocumentRequestSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: "Engagement", required: true },
  clientId: { type: String, required: true },

  name: { type: String },
  category: { type: String, required: true, index: true },
  description: { type: String, required: true },

  comment: { type: String, default: "" },

  status: {
    type: String,
    enum: ["pending", "submitted", "completed"],
    default: "pending",
  },

  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },

  // Single document requests (e.g., PAN card, single PDF uploads)
  documents: [DocumentRequestSingleDocumentSchema],

  // Multiple document requests (Passport front/back, Form16 pages)
  multipleDocuments: [DocumentRequestMultipleDocumentSchema],

  // ======================
  // Review & Approval Flow
  // ======================
  reviewStatus: {
    type: String,
    enum: [
      "in-progress",
      "ready-for-review",
      "under-review",
      "approved",
      "rejected",
      "signed-off",
      "re-opened",
    ],
    default: "in-progress",
  },

  reviewerId: { type: String },
  reviewedAt: { type: Date },
  reviewComments: { type: String },

  approvedBy: { type: String },
  approvedAt: { type: Date },

  signedOffBy: { type: String },
  signedOffAt: { type: Date },
  signOffComments: { type: String },

  isSignedOff: { type: Boolean, default: false },

  // Locking system
  isLocked: { type: Boolean, default: false },
  lockedAt: { type: Date },
  lockedBy: { type: String },

  reopenedAt: { type: Date },
  reopenedBy: { type: String },
  reopenReason: { type: String },

  reviewVersion: { type: Number, default: 1 },
});

module.exports = mongoose.model("DocumentRequest", DocumentRequestSchema);
