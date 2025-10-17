// models/Sheet.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SheetSchema = new Schema({
  workbookId: { type: mongoose.Types.ObjectId, ref: 'Workbook', required: true },
  name: { type: String, required: true },
  data: { type: [[String]], required: true }, // 2D array of strings
  lastModifiedDate: { type: Date, default: Date.now },
  lastModifiedBy: { type: mongoose.Types.ObjectId, ref: 'User' }, // Assuming a User model
}, { timestamps: true });

// Add an index for faster lookup of sheets by workbook and name
SheetSchema.index({ workbookId: 1, name: 1 }, { unique: true });

const Sheet = mongoose.model('Sheet', SheetSchema);
module.exports = Sheet;
