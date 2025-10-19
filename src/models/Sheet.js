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
    data: {
      type: [
        {
          type: [String], // each row is an array of strings
          default: [],
        },
      ],
      default: [],
      required: true,
    },
    lastModifiedDate: { type: Date, default: Date.now },
    lastModifiedBy: { type: String },
  },
  { timestamps: true }
);

SheetSchema.index({ workbookId: 1, name: 1 }, { unique: true });

const Sheet = mongoose.model("Sheet", SheetSchema);
module.exports = Sheet;
