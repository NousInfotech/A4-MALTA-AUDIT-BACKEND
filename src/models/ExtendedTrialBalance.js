const mongoose = require("mongoose")
const { Schema, Types } = mongoose

const ETBRowSchema = new Schema({
  _id: {
    type: String, // <-- allow your "row-..." string IDs
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
    required: true,
  },
}, { _id: false }) // important: prevents Mongoose from creating its own ObjectId
// (we're supplying _id manually as String)

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

// Update the updatedAt field before saving
ExtendedTrialBalanceSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("ExtendedTrialBalance", ExtendedTrialBalanceSchema)
