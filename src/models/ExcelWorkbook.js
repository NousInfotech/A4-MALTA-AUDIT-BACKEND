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

// 🔹 For storing historical versions
const VersionSchema = new Schema(
  {
    version: { type: String, required: true },
    savedAt: { type: Date, default: Date.now },
    savedBy: { type: String }, // user ID who created the version
    name: String,
    classification: String,
    webUrl: String,
    sheets: [{ type: Schema.Types.ObjectId, ref: "Sheet" }],
    mappings: [MappingSchema],
    namedRanges: [NamedRangeSchema],
  },
  { _id: true }
);

const HistoricalSheetSchema = new Schema(
  {
    workbookVersionId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    data: {
      type: [
        {
          type: [String],
          default: [],
        },
      ],
      default: [],
      required: true,
    },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);
const HistoricalSheet = mongoose.model(
  "HistoricalSheet",
  HistoricalSheetSchema
);

const WorkbookSchema = new Schema(
  {
    engagementId: { type: String, required: true },
    classification: { type: String },
    name: { type: String, required: true },
    webUrl: { type: String },

    uploadedBy: { type: String, required: true },
    uploadedDate: { type: Date, default: Date.now },
    lastModifiedBy: { type: String },
    lastModifiedDate: { type: Date, default: Date.now },

    version: { type: String, default: "v1" },

    // Sheets and mappings
    sheets: [{ type: Schema.Types.ObjectId, ref: "Sheet" }],
    mappings: { type: [MappingSchema], default: [] },
    namedRanges: { type: [NamedRangeSchema], default: [] },

    // 🔹 History of previous versions
    versions: { type: [VersionSchema], default: [] },
    customFields: {
      type: Schema.Types.Mixed,
      default: {}, // Default to an empty object
    },
  },
  { timestamps: true }
);
const Workbook = mongoose.model("Workbook", WorkbookSchema);

module.exports = { Workbook, HistoricalSheet };
