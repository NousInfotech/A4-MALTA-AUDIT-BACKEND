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
