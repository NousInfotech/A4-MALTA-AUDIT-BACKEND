const mongoose = require('mongoose');
const { Schema } = mongoose;

const PDFAnnotationSchema = new Schema({
    engagementId: {
        type: Schema.Types.ObjectId,
        ref: 'Engagement',
        required: true,
        index: true
    },
    fileId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true
    },
    // Type can distinguish if it's GlobalDocument or EngagementLibrary/Folder file
    fileType: {
        type: String,
        enum: ['global', 'engagement'],
        default: 'engagement'
    },
    pageNumber: {
        type: Number,
        required: true
    },
    // The content of the review point / comment
    content: {
        type: String,
        required: true
    },
    // Position data for the highlighter
    rect: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
    },
    // Who created this point
    author: {
        id: String,
        name: String,
        role: String
    },
    // Status of the review point
    isResolved: {
        type: Boolean,
        default: false,
        index: true
    },
    resolvedBy: {
        id: String,
        name: String,
        date: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PDFAnnotation', PDFAnnotationSchema);
