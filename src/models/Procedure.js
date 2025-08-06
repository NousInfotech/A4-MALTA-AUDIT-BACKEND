// models/Procedure.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Each engagement has a fixed checklist of procedures → tasks.
 * Use Socket.IO in your controllers to emit updates when `tasks[i].completed` changes.
 */
const ProcedureTaskSchema = new Schema({
  description: { type: String, required: true },
  category:    { type: String, required: true },
  completed:   { type: Boolean, default: false },
}, { _id: true });

const ProcedureSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  title:      { type: String, required: true },
  status: {
    type: String,
    enum: ['draft','completed'],
    default: 'draft'
  },
  tasks:      [ ProcedureTaskSchema ],
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Procedure', ProcedureSchema);
