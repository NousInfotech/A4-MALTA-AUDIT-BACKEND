const mongoose = require("mongoose")
const { Schema, Types } = mongoose

const TrialBalanceSchema = new Schema({
  engagement: {
    type: Types.ObjectId,
    ref: "Engagement",
    required: true,
    unique: true,
  },
  headers: {
    type: [String],
    required: true,
  },
  rows: {
    type: [[Schema.Types.Mixed]], 
    required: true,
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("TrialBalance", TrialBalanceSchema)
