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
    default: "",
  },
  accountName: {
    type: String,
    default: "",
  },
  currentYear: {
    type: Number,
    default: 0,
  },
  priorYear: {
    type: Number,
    default: 0,
  },
  adjustments: {
    type: Number,
    default: 0,
  },
  finalBalance: {
    type: Number,
    default: 0,
  },
  classification: {
    type: String,
  },
  // Optional grouping columns from Trial Balance
  grouping1: {
    type: String,
    default: "",
  },
  grouping2: {
    type: String,
    default: "",
  },
  grouping3: {
    type: String,
    default: "",
  },
  grouping4: {
    type: String,
    default: "",
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
