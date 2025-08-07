// models/EngadementLibrary.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const EngagementLibrarySchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  category: {type:String, required:true},
  url: {type:String},
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('EngagementLibrary', EngagementLibrarySchema);
