const mongoose = require('mongoose');
const { Schema } = mongoose;

const FCMTokenSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
  },
  deviceType: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web'
  },
  deviceName: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
FCMTokenSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('FCMToken', FCMTokenSchema);

