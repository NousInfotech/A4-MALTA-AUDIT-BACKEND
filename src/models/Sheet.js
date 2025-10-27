const mongoose = require("mongoose");
const { Schema } = mongoose;

const SheetSchema = new Schema(
  {
    workbookId: {
      type: mongoose.Types.ObjectId,
      ref: "Workbook",
      required: true,
    },
    name: { type: String, required: true },
    // Store metadata only, not the actual cell data
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    address: { type: String }, // Excel address like "Sheet1!A1:D10"
    // Remove the large 'data' field that was causing size issues
    // Data will be fetched on-demand from MS Drive
    lastModifiedDate: { type: Date, default: Date.now },
    lastModifiedBy: { type: String },
  },
  { timestamps: true }
);

SheetSchema.index({ workbookId: 1, name: 1 }, { unique: true });

// Virtual for getting sheet dimensions
SheetSchema.virtual('dimensions').get(function() {
  return `${this.rowCount} rows x ${this.columnCount} cols`;
});

// Method to check if sheet needs data fetched (always true now)
SheetSchema.methods.needsDataFetch = function() {
  return true; // Always fetch from MS Drive now
};

const Sheet = mongoose.model("Sheet", SheetSchema);
module.exports = Sheet;
