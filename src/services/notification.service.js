const { messaging } = require('../config/firebase');
const Notification = require('../models/Notification');
const FCMToken = require('../models/FCMToken');
const NotificationPreference = require('../models/NotificationPreference');

class NotificationService {
  /**
   * Send notification to user(s)
   * @param {Object} params
   * @param {string|string[]} params.userId - Single user ID or array of user IDs
   * @param {string} params.title - Notification title
   * @param {string} params.message - Notification body
   * @param {string} params.type - Notification type (engagement, document, task, user, system)
   * @param {string} params.category - Specific category from your notification list
   * @param {string} params.module - Module name
   * @param {string} params.priority - Priority level
   * @param {Object} params.data - Additional data
   * @param {string} params.actionUrl - Deep link URL
   * @param {string} params.engagementId - Related engagement ID
   * @param {string} params.documentId - Related document ID
   * @param {string} params.taskId - Related task ID
   */
  static async send({
    userId,
    title,
    message,
    type,
    category,
    module = type,
    priority = 'normal',
    data = {},
    actionUrl = null,
    engagementId = null,
    documentId = null,
    taskId = null
  }) {
    const userIds = Array.isArray(userId) ? userId : [userId];
    const results = [];

    for (const uid of userIds) {
      try {
        // 1. Check user notification preferences
        const preferences = await this.getUserPreferences(uid);
        if (!this.shouldSendNotification(preferences, module, category)) {
          console.log(`Notification skipped for user ${uid} due to preferences`);
          results.push({ 
            success: false, 
            userId: uid, 
            reason: 'User preferences disabled' 
          });
          continue;
        }

        // 2. Create notification in database
        const notification = await Notification.create({
          userId: uid,
          title,
          message,
          type,
          category,
          module,
          priority,
          data,
          actionUrl,
          engagementId,
          documentId,
          taskId
        });

        console.log(`✅ Notification created in DB: ${notification._id}`);

        // 3. Send FCM push notification if enabled
        if (preferences.pushEnabled) {
          const tokens = await this.getUserTokens(uid);
          
          if (tokens.length > 0) {
            try {
              await this.sendFCMNotification({
                tokens,
                title,
                message,
                data: {
                  ...data,
                  notificationId: notification._id.toString(),
                  actionUrl: actionUrl || '/',
                  type,
                  category,
                  module
                }
              });

              // Mark as sent
              notification.isSent = true;
              notification.sentAt = new Date();
              await notification.save();
              
              console.log(`📤 FCM sent to ${tokens.length} device(s) for user ${uid}`);
            } catch (fcmError) {
              console.error(`FCM send error for user ${uid}:`, fcmError);
              // Continue even if FCM fails - notification is still in DB
            }
          } else {
            console.log(`⚠️ No FCM tokens found for user ${uid}`);
          }
        }

        results.push({ 
          success: true, 
          userId: uid, 
          notificationId: notification._id 
        });
      } catch (error) {
        console.error(`❌ Error sending notification to user ${uid}:`, error);
        results.push({ 
          success: false, 
          userId: uid, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Send FCM push notification
   */
  static async sendFCMNotification({ tokens, title, message, data = {} }) {
    const payload = {
      notification: {
        title,
        body: message
      },
      data: Object.keys(data).reduce((acc, key) => {
        // FCM data payload must be strings
        acc[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        return acc;
      }, {}),
      webpush: {
        fcmOptions: {
          link: data.actionUrl || '/'
        },
        notification: {
          icon: '/logo.png',
          badge: '/logo.png'
        }
      }
    };

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        ...payload
      });

      console.log(`✅ FCM Success: ${response.successCount}/${tokens.length}`);

      // Handle failed tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Failed to send to token ${tokens[idx].substring(0, 20)}...:`, resp.error?.code);
            
            // Deactivate invalid tokens
            if (resp.error?.code === 'messaging/invalid-registration-token' ||
                resp.error?.code === 'messaging/registration-token-not-registered') {
              this.deactivateToken(tokens[idx]);
            }
          }
        });
      }

      return response;
    } catch (error) {
      console.error('❌ FCM send error:', error);
      throw error;
    }
  }

  /**
   * Get user FCM tokens
   */
  static async getUserTokens(userId) {
    try {
      const tokenDocs = await FCMToken.find({ 
        userId, 
        isActive: true 
      }).select('fcmToken');
      
      return tokenDocs.map(doc => doc.fcmToken);
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return [];
    }
  }

  /**
   * Deactivate invalid token
   */
  static async deactivateToken(fcmToken) {
    try {
      await FCMToken.findOneAndUpdate(
        { fcmToken },
        { isActive: false }
      );
      console.log(`🔇 Token deactivated: ${fcmToken.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error deactivating token:', error);
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  static shouldSendNotification(preferences, module, category) {
    if (!preferences.pushEnabled) return false;
    
    // Check module preference
    const moduleKey = `${module}Notifications`;
    if (preferences[moduleKey] === false) return false;
    
    // Check if category is disabled
    if (preferences.disabledCategories && 
        preferences.disabledCategories.includes(category)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(userId) {
    try {
      const preferences = await NotificationPreference.findOne({ userId });
      
      if (!preferences) {
        // Return default preferences
        return {
          pushEnabled: true,
          engagementNotifications: true,
          documentNotifications: true,
          taskNotifications: true,
          userNotifications: true,
          systemNotifications: true,
          disabledCategories: []
        };
      }
      
      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      // Return permissive defaults on error
      return {
        pushEnabled: true,
        engagementNotifications: true,
        documentNotifications: true,
        taskNotifications: true,
        userNotifications: true,
        systemNotifications: true,
        disabledCategories: []
      };
    }
  }

  /**
   * Bulk send notifications (for admins, team notifications, etc.)
   */
  static async bulkSend(notifications) {
    const results = await Promise.allSettled(
      notifications.map(notif => this.send(notif))
    );
    
    return results.map((result, idx) => ({
      index: idx,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : result.reason
    }));
  }
}

module.exports = NotificationService;

