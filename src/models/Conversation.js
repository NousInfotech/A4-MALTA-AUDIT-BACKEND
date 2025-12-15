const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConversationSchema = new Schema({
    type: {
        type: String,
        enum: ['direct', 'group'],
        default: 'direct'
    },
    name: {
        type: String // Only for group chats
    },
    participants: [{
        type: String, // Supabase User IDs
        required: true
    }],
    admins: [{
        type: String // Supabase User IDs (for group chats)
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: String, // Supabase User ID
        required: true
    },
    pinnedBy: [{
        type: String // Supabase User ID
    }],
    archivedBy: [{
        type: String // Supabase User ID
    }],
    organizationId: {
        type: String,
        required: false // Optional for now to avoid breaking existing chats
    }
}, {
    timestamps: true
});

// Index for faster queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
