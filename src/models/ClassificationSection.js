const mongoose = require("mongoose")
const { Schema, Types } = mongoose

const ClassificationSectionSchema = new Schema({
  engagement: {
    type: Types.ObjectId,
    ref: "Engagement",
    required: true,
  },
  classification: {
    type: String,
    required: true,
  },
  spreadsheetId: {
    type: String,
    default: null,
  },
  spreadsheetUrl: {
    type: String,
    default: null,
  },
  lastSyncAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Compound index to ensure unique classification per engagement
ClassificationSectionSchema.index({ engagement: 1, classification: 1 }, { unique: true })

module.exports = mongoose.model("ClassificationSection", ClassificationSectionSchema)
