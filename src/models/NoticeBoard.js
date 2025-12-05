const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * NoticeBoard Schema
 * Central announcement and notification system for organizations
 */
const NoticeBoardSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    roles: {
      type: [
        {
          type: String,
          enum: ["admin", "employee", "client"],
        },
      ],
      required: true,
      default: [],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "At least one role must be specified",
      },
    },
    createdBy: {
      type: String,
      enum: ["admin", "super-admin"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "emergency",
        "warning",
        "update",
        "announcement",
        "reminder",
        "info",
        "success",
      ],
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Portal notification tracking
    portalNotificationId: {
      type: String,
      default: null,
      index: true,
    },
    
    // Additional metadata
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    
    // User who created the notice (user ID)
    createdByUserId: {
      type: String,
      required: true,
    },
    
    // Track user interactions (views and acknowledgments)
    userInteractions: {
      type: [
        {
          userId: String,
          isViewed: { type: Boolean, default: false },
          viewedAt: { type: Date, default: null },
          isAcknowledged: { type: Boolean, default: false },
          acknowledgedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
NoticeBoardSchema.index({ organizationId: 1, isActive: 1 });
NoticeBoardSchema.index({ organizationId: 1, type: 1 });
NoticeBoardSchema.index({ organizationId: 1, roles: 1 });
NoticeBoardSchema.index({ organizationId: 1, createdAt: -1 });
NoticeBoardSchema.index({ expiresAt: 1 });
NoticeBoardSchema.index({ title: "text", description: "text" });

// Pre-save middleware to check expiration
NoticeBoardSchema.pre("save", function (next) {
  // Auto-deactivate if expired
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isActive = false;
  }
  next();
});

// Static methods
NoticeBoardSchema.statics.getActiveNotices = function (organizationId, role) {
  const filter = {
    organizationId,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  
  if (role) {
    filter.roles = role;
  }
  
  return this.find(filter).sort({ priority: -1, createdAt: -1 });
};

NoticeBoardSchema.statics.getByType = function (organizationId, type) {
  return this.find({
    organizationId,
    type,
    isActive: true,
  }).sort({ createdAt: -1 });
};

// Instance methods
NoticeBoardSchema.methods.markAsViewed = function (userId) {
  const userInteraction = this.userInteractions.find(
    (u) => u.userId.toString() === userId.toString()
  );
  
  if (userInteraction) {
    // User exists, update view status
    userInteraction.isViewed = true;
    userInteraction.viewedAt = new Date();
  } else {
    // Add new user interaction
    this.userInteractions.push({
      userId,
      isViewed: true,
      viewedAt: new Date(),
      isAcknowledged: false,
      acknowledgedAt: null,
    });
  }
  
  return this.save();
};

NoticeBoardSchema.methods.markAsAcknowledged = function (userId) {
  const userInteraction = this.userInteractions.find(
    (u) => u.userId.toString() === userId.toString()
  );
  
  if (userInteraction) {
    // User exists, update acknowledgment status
    userInteraction.isAcknowledged = true;
    userInteraction.acknowledgedAt = new Date();
  } else {
    // Add new user interaction
    this.userInteractions.push({
      userId,
      isViewed: false,
      viewedAt: null,
      isAcknowledged: true,
      acknowledgedAt: new Date(),
    });
  }
  
  return this.save();
};

NoticeBoardSchema.methods.isExpired = function () {
  return this.expiresAt && this.expiresAt < new Date();
};

NoticeBoardSchema.methods.getUserInteraction = function (userId) {
  return this.userInteractions.find(
    (u) => u.userId.toString() === userId.toString()
  );
};

NoticeBoardSchema.methods.hasUserViewed = function (userId) {
  const interaction = this.getUserInteraction(userId);
  return interaction ? interaction.isViewed : false;
};

NoticeBoardSchema.methods.hasUserAcknowledged = function (userId) {
  const interaction = this.getUserInteraction(userId);
  return interaction ? interaction.isAcknowledged : false;
};

NoticeBoardSchema.methods.getInteractionStats = function () {
  return {
    totalUsers: this.userInteractions.length,
    viewedCount: this.userInteractions.filter((u) => u.isViewed).length,
    acknowledgedCount: this.userInteractions.filter((u) => u.isAcknowledged).length,
    viewedPercentage: this.userInteractions.length > 0 
      ? Math.round((this.userInteractions.filter((u) => u.isViewed).length / this.userInteractions.length) * 100)
      : 0,
    acknowledgedPercentage: this.userInteractions.length > 0
      ? Math.round((this.userInteractions.filter((u) => u.isAcknowledged).length / this.userInteractions.length) * 100)
      : 0,
  };
};

module.exports = mongoose.model("NoticeBoard", NoticeBoardSchema);

