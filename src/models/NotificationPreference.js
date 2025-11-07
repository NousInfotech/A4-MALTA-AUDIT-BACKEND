const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationPreferenceSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Module preferences
  engagementNotifications: {
    type: Boolean,
    default: true
  },
  documentNotifications: {
    type: Boolean,
    default: true
  },
  taskNotifications: {
    type: Boolean,
    default: true
  },
  userNotifications: {
    type: Boolean,
    default: true
  },
  systemNotifications: {
    type: Boolean,
    default: true
  },
  
  // Channel preferences
  pushEnabled: {
    type: Boolean,
    default: true
  },
  emailEnabled: {
    type: Boolean,
    default: true
  },
  inAppEnabled: {
    type: Boolean,
    default: true
  },
  soundEnabled: {
    type: Boolean,
    default: true
  },
  soundVolume: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 1
  },
  
  // Specific notification categories to disable
  disabledCategories: {
    type: [String],
    default: []
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
NotificationPreferenceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('NotificationPreference', NotificationPreferenceSchema);

