const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  // User reference
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Notification content
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  
  // Classification
  type: {
    type: String,
    required: true,
    enum: ['engagement', 'document', 'task', 'user', 'system']
  },
  category: {
    type: String,
    required: true
  },
  module: {
    type: String,
    enum: ['engagement', 'document', 'task', 'user', 'system']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Related entities
  engagementId: {
    type: Schema.Types.ObjectId,
    ref: 'Engagement'
  },
  documentId: {
    type: Schema.Types.ObjectId
  },
  taskId: {
    type: Schema.Types.ObjectId
  },
  
  // Additional data
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  actionUrl: {
    type: String
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  isSent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
NotificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);

