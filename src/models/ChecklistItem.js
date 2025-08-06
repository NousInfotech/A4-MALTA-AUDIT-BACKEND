// models/ChecklistItem.js
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ChecklistItemSchema = new Schema({
  engagement: { 
    type: Types.ObjectId, 
    ref: 'Engagement', 
    required: true,
    index: true 
  },
  key: { 
    type: String, 
    required: true, 
    index: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  completed: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChecklistItem', ChecklistItemSchema);
