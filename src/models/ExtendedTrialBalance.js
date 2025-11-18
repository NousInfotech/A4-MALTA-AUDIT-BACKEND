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
  reclassification: {
    type: Number,
    default: 0,
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
  adjustmentRefs: {
    type: [String],
    default: []
  },
  reclassificationRefs: {
    type: [String],
    default: [],
  },
  // Flag to indicate this account code is new (not present in previous year)
  isNewAccount: {
    type: Boolean,
    default: false,
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

  if (Array.isArray(this.rows)) {
    this.rows = this.rows.map((row = {}) => {
      const mutableRow = row

      mutableRow._id = mutableRow._id || mutableRow.id || mutableRow.code || `row_${Math.random().toString(36).slice(2, 11)}`
      
      // Round all numeric values
      mutableRow.currentYear = Math.round(Number(mutableRow.currentYear) || 0)
      mutableRow.adjustments = Math.round(Number(mutableRow.adjustments) || 0)
      mutableRow.priorYear = Math.round(Number(mutableRow.priorYear) || 0)
      
      // Handle string reclassification values from old data - convert to 0
      if (typeof mutableRow.reclassification === "string") {
        const parsed = parseFloat(mutableRow.reclassification)
        mutableRow.reclassification = isNaN(parsed) ? 0 : Math.round(parsed)
      } else {
        mutableRow.reclassification = Math.round(Number(mutableRow.reclassification) || 0)
      }
      
      // Calculate finalBalance from rounded values
      mutableRow.finalBalance = Math.round((mutableRow.currentYear || 0) + (mutableRow.adjustments || 0) + (mutableRow.reclassification || 0))

      if (!Array.isArray(mutableRow.adjustmentRefs)) {
        mutableRow.adjustmentRefs = []
      }

      if (!Array.isArray(mutableRow.reclassificationRefs)) {
        mutableRow.reclassificationRefs = []
      }

      return mutableRow
    })
  }

  next()
})

module.exports = mongoose.model("ExtendedTrialBalance", ExtendedTrialBalanceSchema)
