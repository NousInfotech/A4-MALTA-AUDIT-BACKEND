const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ISQMSupportingDocumentSchema = new Schema({
  parentId: { 
    type: Types.ObjectId, 
    ref: 'ISQMParent', 
    required: true,
    index: true 
  },
  
  // Document metadata
  category: { 
    type: String, 
    required: true, 
    index: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  
  // Document status
  status: {
    type: String,
    enum: ['pending', 'uploaded', 'reviewed', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Document files
  documents: [{
    name: { 
      type: String, 
      required: true 
    },
    url: { 
      type: String, 
      required: true 
    }, // Supabase file URL
    uploadedAt: { 
      type: Date, 
      default: Date.now 
    },
    uploadedBy: { 
      type: String, 
      required: true 
    },
    fileSize: { 
      type: Number 
    },
    mimeType: { 
      type: String 
    },
    version: { 
      type: String, 
      default: '1.0' 
    },
    isLatest: { 
      type: Boolean, 
      default: true 
    }
  }],
  
  // Review and approval
  reviewedBy: { 
    type: String 
  },
  reviewedAt: { 
    type: Date 
  },
  reviewComments: { 
    type: String 
  },
  
  approvedBy: { 
    type: String 
  },
  approvedAt: { 
    type: Date 
  },
  
  // Request tracking
  requestedAt: { 
    type: Date, 
    default: Date.now 
  },
  requestedBy: { 
    type: String, 
    required: true 
  },
  dueDate: { 
    type: Date 
  },
  
  // Priority and importance
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  isMandatory: { 
    type: Boolean, 
    default: false 
  },
  
  // Tags for categorization
  tags: [{ 
    type: String 
  }],
  
  // Additional metadata
  framework: { 
    type: String 
  }, // IFRS, GAPSME, etc.
  jurisdiction: { 
    type: String 
  },
  
  // Completion tracking
  completionPercentage: { 
    type: Number, 
    default: 0 
  },
  
  // Notes and comments
  notes: [{ 
    text: String,
    addedBy: String,
    addedAt: { 
      type: Date, 
      default: Date.now 
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for parent reference
ISQMSupportingDocumentSchema.virtual('parent', {
  ref: 'ISQMParent',
  localField: 'parentId',
  foreignField: '_id',
  justOne: true
});

// Indexes for better query performance
ISQMSupportingDocumentSchema.index({ parentId: 1, category: 1 });
ISQMSupportingDocumentSchema.index({ status: 1 });
ISQMSupportingDocumentSchema.index({ priority: 1 });
ISQMSupportingDocumentSchema.index({ requestedBy: 1 });
ISQMSupportingDocumentSchema.index({ dueDate: 1 });
ISQMSupportingDocumentSchema.index({ tags: 1 });

// Pre-save middleware to calculate completion percentage
ISQMSupportingDocumentSchema.pre('save', function(next) {
  if (this.documents && this.documents.length > 0) {
    const uploadedDocs = this.documents.filter(doc => doc.url && doc.url.trim() !== '');
    this.completionPercentage = Math.round((uploadedDocs.length / this.documents.length) * 100);
    
    // Update status based on completion
    if (this.completionPercentage === 100) {
      if (this.status === 'pending') {
        this.status = 'uploaded';
      }
    }
  } else {
    this.completionPercentage = 0;
  }
  
  next();
});

// Static method to get documents by parent and category
ISQMSupportingDocumentSchema.statics.getByParentAndCategory = function(parentId, category) {
  return this.find({ parentId, category }).sort({ createdAt: -1 });
};

// Static method to get pending documents
ISQMSupportingDocumentSchema.statics.getPendingDocuments = function(parentId) {
  return this.find({ 
    parentId, 
    status: { $in: ['pending', 'uploaded'] },
    dueDate: { $gte: new Date() }
  }).sort({ priority: -1, dueDate: 1 });
};

// Instance method to add document
ISQMSupportingDocumentSchema.methods.addDocument = function(documentData) {
  // Mark previous documents as not latest
  this.documents.forEach(doc => {
    doc.isLatest = false;
  });
  
  // Add new document as latest
  this.documents.push({
    ...documentData,
    isLatest: true,
    uploadedAt: new Date()
  });
  
  return this.save();
};

// Instance method to get latest document
ISQMSupportingDocumentSchema.methods.getLatestDocument = function() {
  return this.documents.find(doc => doc.isLatest) || this.documents[this.documents.length - 1];
};

module.exports = mongoose.model('ISQMSupportingDocument', ISQMSupportingDocumentSchema);
