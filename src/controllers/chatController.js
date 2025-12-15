const { supabase } = require("../config/supabase");
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

exports.startDirectChat = async (req, res) => {
    try {
        const { otherUserId } = req.body;
        const currentUserId = req.user.id;

        if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

        // Check for existing direct conversation
        let conversation = await Conversation.findOne({
            type: 'direct',
            participants: { $all: [currentUserId, otherUserId] }
        }).populate('lastMessage');

        if (!conversation) {
            conversation = await Conversation.create({
                type: 'direct',
                participants: [currentUserId, otherUserId],
                participants: [currentUserId, otherUserId],
                createdBy: currentUserId,
                organizationId: req.user.organizationId
            });
        }

        res.json(conversation);
    } catch (err) {
        console.error('startDirectChat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createGroupChat = async (req, res) => {
    try {
        const { name, userIds } = req.body; // userIds includes other participants
        const currentUserId = req.user.id;

        const participants = [currentUserId, ...userIds];

        const conversation = await Conversation.create({
            type: 'group',
            name,
            participants,
            admins: [currentUserId],
            admins: [currentUserId],
            createdBy: currentUserId,
            organizationId: req.user.organizationId
        });

        res.json(conversation);
    } catch (err) {
        console.error('createGroupChat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const conversations = await Conversation.find({
            participants: currentUserId
        })
            .sort({ lastMessageAt: -1 })
            .populate('lastMessage')
            .lean();

        // Collect all participant IDs that are not me
        const otherUserIds = new Set();
        conversations.forEach(c => {
            c.participants.forEach(p => {
                if (p !== currentUserId) otherUserIds.add(p);
            });
        });

        // Fetch profiles
        const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, name, role")
            .in("user_id", Array.from(otherUserIds));

        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.user_id] = p);
        }

        // Attach computed name/role to conversation
        const enriched = conversations.map(c => {
            if (c.type === 'group') return c;

            const otherId = c.participants.find(p => p !== currentUserId);
            const otherProfile = profileMap[otherId];
            return {
                ...c,
                name: otherProfile ? otherProfile.name : 'Unknown User',
                role: otherProfile ? otherProfile.role : undefined,
                otherUserId: otherId
            };
        });

        res.json(enriched);
    } catch (err) {
        console.error('getConversations error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.id;

        const messages = await Message.find({
            conversationId,
            deletedFor: { $ne: currentUserId }
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error('getMessages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, content, attachments } = req.body;
        const senderId = req.user.id;

        const message = await Message.create({
            conversationId,
            senderId,
            content,
            attachments
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            lastMessageAt: message.createdAt
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${conversationId}`).emit('newMessage', message);

            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                conversation.participants.forEach(participantId => {
                    if (participantId !== senderId) {
                        io.to(`user_${participantId}`).emit('notification', {
                            type: 'message',
                            conversationId: conversationId,
                            senderId: senderId,
                            messageId: message._id
                        });
                    }
                });
            }
        }

        res.json(message);
    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- New Features ---

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const message = await Message.findOne({ _id: messageId, senderId: userId });
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        message.content = content;
        message.isEdited = true;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${message.conversationId}`).emit('messageUpdated', message);
        }

        res.json(message);
    } catch (err) {
        console.error('editMessage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { mode } = req.body; // 'me' or 'everyone'
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (mode === 'everyone') {
            if (message.senderId !== userId) return res.status(403).json({ error: 'Unauthorized' });
            message.isDeleted = true;
            message.content = 'This message was deleted';
            message.attachments = [];
        } else {
            // Delete for me
            if (!message.deletedFor.includes(userId)) {
                message.deletedFor.push(userId);
            }
        }

        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${message.conversationId}`).emit('messageUpdated', message);
        }

        res.json(message);
    } catch (err) {
        console.error('deleteMessage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.togglePinConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const index = conversation.pinnedBy.indexOf(userId);
        if (index === -1) {
            conversation.pinnedBy.push(userId);
        } else {
            conversation.pinnedBy.splice(index, 1);
        }

        await conversation.save();
        res.json(conversation);
    } catch (err) {
        console.error('togglePinConversation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.toggleArchiveConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const index = conversation.archivedBy.indexOf(userId);
        if (index === -1) {
            conversation.archivedBy.push(userId);
            // If archived, unpin? Usually archiving hides it, so maybe doesn't matter, but let's keep it simple.
        } else {
            conversation.archivedBy.splice(index, 1);
        }

        await conversation.save();
        res.json(conversation);
    } catch (err) {
        console.error('toggleArchiveConversation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.markMessagesRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id; // The user who is READING

        // Update all unread messages in this conversation
        // "Unread" means userId is NOT in readBy array
        // And senderId is NOT userId (we don't read our own messages in this context, or maybe we do for sync?)
        // Standard: Mark all messages where I am not sender and not in readBy

        const result = await Message.updateMany(
            {
                conversationId,
                senderId: { $ne: userId },
                readBy: { $ne: userId }
            },
            { $addToSet: { readBy: userId } }
        );

        if (result.nModified > 0) {
            const io = req.app.get('io');
            if (io) {
                // Notify the other user that their messages were read
                // We need to know who the other user is.
                const conversation = await Conversation.findById(conversationId);
                if (conversation) {
                    conversation.participants.forEach(p => {
                        if (p !== userId) {
                            io.to(`user_${p}`).emit('messagesRead', { conversationId, readBy: userId });
                        }
                    });
                }
            }
        }

        res.json({ success: true, count: result.nModified });
    } catch (err) {
        console.error('markMessagesRead error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStarredMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const messages = await Message.find({
            starredBy: userId,
            deletedFor: { $ne: userId }
        })
            .sort({ createdAt: -1 })
            .populate('conversationId', 'name type participants'); // Optional: populate convo details

        res.json(messages);
    } catch (err) {
        console.error('getStarredMessages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.toggleStarMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        const index = message.starredBy.indexOf(userId);
        if (index === -1) {
            message.starredBy.push(userId);
        } else {
            message.starredBy.splice(index, 1);
        }

        await message.save();
        res.json(message); // Socket update not strictly necessary for private action but good for sync
    } catch (err) {
        console.error('toggleStarMessage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { query, conversationId } = req.query;
        const userId = req.user.id;

        // Basic text search
        const filter = {
            conversationId,
            content: { $regex: query, $options: 'i' },
            deletedFor: { $ne: userId }
        };

        const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(50);
        res.json(messages);
    } catch (err) {
        console.error('searchMessages error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};


