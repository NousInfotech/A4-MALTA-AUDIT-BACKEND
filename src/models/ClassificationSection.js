const mongoose = require("mongoose")

const classificationSectionSchema = new mongoose.Schema(
  {
    engagement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
    },
    classification: {
      type: String,
      required: true,
    },
    // In Progress → Ready for Review → Reviewed/Approved.
    status:{
      type: String,
      enum: ["in-progress", "ready-for-review", "reviewed-approved"],
      default: "in-progress",
    },
    spreadsheetId: String,
    spreadsheetUrl: String,
    workingPapersId: String,
    workingPapersUrl: String,
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)


module.exports = mongoose.model("ClassificationSection", classificationSectionSchema)
