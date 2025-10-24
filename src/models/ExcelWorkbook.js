const mongoose = require("mongoose");
const { Schema } = mongoose;

const MappingSchema = new Schema(
  {
    destinationField: { type: String, required: true },
    transform: { type: String, required: true },
    color: { type: String, required: true },
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
  },
  { _id: true }
);

const NamedRangeSchema = new Schema(
  {
    name: { type: String, required: true },
    range: { type: String, required: true },
  },
  { _id: true }
);

const WorkbookSchema = new Schema(
  {
    engagementId: { type: String, required: true },
    classification: { type: String },
    cloudFileId: { type: String, required: true },
    name: { type: String, required: true },
    webUrl: { type: String },

    uploadedBy: { type: String, required: true },
    uploadedDate: { type: Date, default: Date.now },
    lastModifiedBy: { type: String },
    lastModifiedDate: { type: Date, default: Date.now },

    category: { type: String },

    sheets: [{ type: Schema.Types.ObjectId, ref: "Sheet" }],
    mappings: { type: [MappingSchema], default: [] },
    namedRanges: { type: [NamedRangeSchema], default: [] },

    customFields: {
      type: Schema.Types.Mixed,
      default: {}, // Default to an empty object
    },
  },
  { timestamps: true }
);
const Workbook = mongoose.model("Workbook", WorkbookSchema);

module.exports = { Workbook };
