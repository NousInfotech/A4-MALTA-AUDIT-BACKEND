const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

router.get('/conversations', chatController.getConversations);
router.post('/conversations/direct', chatController.startDirectChat);
router.post('/conversations/group', chatController.createGroupChat);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/pin', chatController.togglePinConversation);
router.post('/messages', chatController.sendMessage);

// New Message Features
router.put('/messages/:messageId', chatController.editMessage); // Using PUT for edit
router.post('/messages/:messageId/delete', chatController.deleteMessage); // POST with body {mode}
router.post('/messages/:messageId/star', chatController.toggleStarMessage);
router.get('/search', chatController.searchMessages); // Global search or conv search
router.get('/starred', chatController.getStarredMessages); // Get starred messages
router.post('/conversations/:conversationId/archive', chatController.toggleArchiveConversation);
router.post('/conversations/:conversationId/read', chatController.markMessagesRead);
router.post('/conversations/:conversationId/leave', chatController.leaveGroup);
router.delete('/conversations/:conversationId', chatController.deleteGroup);

module.exports = router;
