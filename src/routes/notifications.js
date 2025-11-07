const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/auth');

// All routes require authentication
router.use(requireAuth);

// Notification CRUD
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/stats', notificationController.getStats);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/read/all', notificationController.deleteAllRead);

// FCM token management
router.post('/fcm-token', notificationController.saveFCMToken);
router.delete('/fcm-token', notificationController.removeFCMToken);

// Preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Test notification
router.post('/test', notificationController.testNotification);

module.exports = router;

