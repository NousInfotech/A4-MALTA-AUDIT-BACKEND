const Notification = require('../models/Notification');
const FCMToken = require('../models/FCMToken');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationService = require('../services/notification.service');

/**
 * Get user notifications with pagination
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      limit = 50, 
      offset = 0, 
      unreadOnly = false,
      type,
      module 
    } = req.query;
    
    const query = { userId };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (module) {
      query.module = module;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    const total = await Notification.countDocuments(query);
    
    res.json({
      notifications,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await Notification.countDocuments({
      userId,
      isRead: false
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

/**
 * Delete notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await Notification.deleteOne({ _id: id, userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

/**
 * Delete all read notifications
 */
exports.deleteAllRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await Notification.deleteMany({ 
      userId, 
      isRead: true 
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Delete all read error:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
};

/**
 * Save FCM token
 */
exports.saveFCMToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, deviceType = 'web', deviceName } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }
    
    // Check if token already exists
    const existingToken = await FCMToken.findOne({ fcmToken: token });
    
    if (existingToken) {
      // Update existing token
      existingToken.userId = userId;
      existingToken.isActive = true;
      existingToken.lastUsedAt = new Date();
      if (deviceType) existingToken.deviceType = deviceType;
      if (deviceName) existingToken.deviceName = deviceName;
      await existingToken.save();
      
      return res.json(existingToken);
    }
    
    // Create new token
    const fcmToken = await FCMToken.create({
      userId,
      fcmToken: token,
      deviceType,
      deviceName
    });
    
    res.json(fcmToken);
  } catch (error) {
    console.error('Save FCM token error:', error);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
};

/**
 * Remove FCM token
 */
exports.removeFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }
    
    await FCMToken.findOneAndUpdate(
      { fcmToken: token },
      { isActive: false }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({ error: 'Failed to remove FCM token' });
  }
};

/**
 * Get user notification preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let preferences = await NotificationPreference.findOne({ userId });
    
    if (!preferences) {
      // Create default preferences
      preferences = await NotificationPreference.create({
        userId,
        pushEnabled: true,
        engagementNotifications: true,
        documentNotifications: true,
        taskNotifications: true,
        userNotifications: true,
        systemNotifications: true
      });
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

/**
 * Update user notification preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    const preferences = await NotificationPreference.findOneAndUpdate(
      { userId },
      { ...updates, userId },
      { new: true, upsert: true }
    );
    
    res.json(preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};

/**
 * Test notification (for development/testing)
 */
exports.testNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, message } = req.body;
    
    const result = await NotificationService.send({
      userId,
      title: title || 'Test Notification',
      message: message || 'This is a test notification from the Audit Portal',
      type: 'system',
      category: 'test',
      module: 'system',
      priority: 'normal',
      data: {
        timestamp: new Date().toISOString()
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Test notification sent',
      result 
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
};

/**
 * Get notification statistics
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await Notification.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead'
            }
          }
        }
      }
    ]);
    
    const typeStats = {};
    if (stats[0]?.byType) {
      stats[0].byType.forEach(item => {
        if (!typeStats[item.type]) {
          typeStats[item.type] = { total: 0, unread: 0 };
        }
        typeStats[item.type].total++;
        if (!item.isRead) {
          typeStats[item.type].unread++;
        }
      });
    }
    
    res.json({
      total: stats[0]?.total || 0,
      unread: stats[0]?.unread || 0,
      byType: typeStats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

