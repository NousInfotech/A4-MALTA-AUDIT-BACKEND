// models/Workbook.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const MappingSchema = new Schema({
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
}, { _id: true });

const NamedRangeSchema = new Schema({
  name: { type: String, required: true },
  range: { type: String, required: true },
}, { _id: true });

const WorkbookSchema = new Schema({
  engagementId: { type: String, required: true },
  classification: { type: String },
  name: { type: String, required: true },
  webUrl: { type: String },
  uploadedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  uploadedDate: { type: Date, default: Date.now },
  lastModifiedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  lastModifiedDate: { type: Date, default: Date.now },
  version: { type: String, default: 'v1' },
  // rawFileBuffer: { type: Buffer }, // Optional: uncomment if storing raw file
  mappings: { type: [MappingSchema], default: [] },
  namedRanges: { type: [NamedRangeSchema], default: [] },
}, { timestamps: true });

const Workbook = mongoose.model('Workbook', WorkbookSchema);
module.exports = Workbook;
