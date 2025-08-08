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
  subcategory: {
    type: String,
    required: true
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  // Field type determines the input type
  fieldType: {
    type: String,
    enum: ['checkbox', 'text', 'date', 'select'],
    default: 'checkbox'
  },
  // For text field
  textValue: {
    type: String,
    default: ''
  },
  // For date field
  dateValue: {
    type: Date,
    default: null
  },
  // For select field
  selectValue: {
    type: String,
    default: ''
  },
  selectOptions: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChecklistItem', ChecklistItemSchema);
