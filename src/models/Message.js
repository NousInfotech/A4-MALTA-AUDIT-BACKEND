const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true
    },
    senderId: {
        type: String, // Supabase User ID
        required: true
    },
    content: {
        type: String,
        required: false,
        default: ""
    },
    attachments: [{
        url: String,
        type: { type: String, enum: ['image', 'file'] },
        name: String
    }],
    readBy: [{
        type: String // Supabase User ID
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    starredBy: [{
        type: String // Supabase User ID
    }],
    deletedFor: [{
        type: String // Supabase User ID
    }],
    pinned: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', MessageSchema);
