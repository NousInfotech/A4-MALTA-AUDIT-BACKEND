const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const EngagementSchema = new Schema({
  clientId: {
    type: String,
    required: true,
  },
  title:        { type: String, required: true },
  yearEndDate:  { type: Date,   required: true },
  status: {
    type: String,
    enum: ['draft','active','completed'],
    default: 'draft'
  },

  trialBalanceUrl:   { type: String, default:'' },

  // ← Replace trialBalanceData subdocs with a single ref:
  trialBalance: {
    type: Types.ObjectId,
    ref: 'TrialBalance'
  },

  createdAt:   { type: Date,   default: Date.now },
  createdBy:   { type: String, required: true },
}, {
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// virtual to populate full TrialBalance doc
EngagementSchema.virtual('trialBalanceDoc', {
  ref: 'TrialBalance',
  localField: 'trialBalance',
  foreignField: '_id',
  justOne: true
});

EngagementSchema.virtual('documentRequests', {
  ref: 'DocumentRequest',
  localField: '_id',
  foreignField: 'engagement',
});
EngagementSchema.virtual('procedures', {
  ref: 'Procedure',
  localField: '_id',
  foreignField: 'engagement',
});

module.exports = mongoose.model('Engagement', EngagementSchema);
