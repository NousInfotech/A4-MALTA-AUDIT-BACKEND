const mongoose = require("mongoose")
const { Schema, Types } = mongoose

// Schema for storing mappings from ExcelWorkbook to ETBRowSchema fields
const ETBMappingSchema = new Schema({
  workbookId: {
    type: Schema.Types.ObjectId,
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
}, { _id: true })

const ETBRowSchema = new Schema({
  _id: {
    type: String,
  },
  code: {
    type: String,
    required: true,
  },
  accountName: {
    type: String,
    required: true,
  },
  currentYear: {
    type: Number,
    required: true,
    default: 0,
  },
  priorYear: {
    type: Number,
    required: true,
    default: 0,
  },
  adjustments: {
    type: Number,
    default: 0,
  },
  finalBalance: {
    type: Number,
    required: true,
  },
  classification: {
    type: String,
  },
  linkedExcelFiles: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workbook" }],
    default: []
  },
  mappings: {
    type: [ETBMappingSchema],
    default: []
  },
}, { _id: false })

const ExtendedTrialBalanceSchema = new Schema({
  engagement: {
    type: Types.ObjectId,
    ref: "Engagement",
    required: true,
    unique: true,
  },
  rows: [ETBRowSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

ExtendedTrialBalanceSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("ExtendedTrialBalance", ExtendedTrialBalanceSchema)
