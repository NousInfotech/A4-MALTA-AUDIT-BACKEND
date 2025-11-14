const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionToken: { type: String, required: true, unique: true, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    lastActivity: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true },
    
    // 2FA verification status for folders
    twoFactorVerified: {
      type: Map,
      of: Date, // Maps folderName to verification timestamp
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup queries
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("UserSession", UserSessionSchema);

