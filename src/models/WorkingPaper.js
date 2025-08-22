const mongoose = require("mongoose");

const WorkingPaperRowSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    code: { type: String, default: "" },
    accountName: { type: String, default: "" },
    currentYear: { type: Number, default: 0 },
    priorYear: { type: Number, default: 0 },
    adjustments: { type: Number, default: 0 },
    finalBalance: { type: Number, default: 0 },
    classification: { type: String, default: "" },
    reference: { type: mongoose.Schema.Types.Mixed, default: "" },
    referenceData: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { _id: false }
);

const WorkingPaperSchema = new mongoose.Schema(
  {
    engagement: { type: mongoose.Schema.Types.ObjectId, ref: "Engagement", index: true },
    classification: { type: String, index: true },
    rows: { type: [WorkingPaperRowSchema], default: [] },
  },
  { timestamps: true }
);

WorkingPaperSchema.index({ engagement: 1, classification: 1 }, { unique: true });

module.exports = mongoose.model("WorkingPaper", WorkingPaperSchema);
