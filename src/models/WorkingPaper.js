const mongoose = require("mongoose");

// Schema for storing mappings from ExcelWorkbook to WorkingPaper fields (same as ETB)
const WorkingPaperMappingSchema = new mongoose.Schema({
  workbookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workbook",
    required: true
  },
  color: {
    type: String,
    required: true
  },
  details: {
    sheet: { type: String, required: true },
    start: {
      row: { type: Number, required: true },
      col: { type: Number, required: true },
    },
    end: {
      row: { type: Number, required: true },
      col: { type: Number, required: true },
    },
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

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
    linkedExcelFiles: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workbook" }], default: [] },
    mappings: { type: [WorkingPaperMappingSchema], default: [] }, // NEW: Add mappings like ETB
    grouping1: { type: String, default: "" },
    grouping2: { type: String, default: "" },
    grouping3: { type: String, default: "" },
    grouping4: { type: String, default: "" },
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
