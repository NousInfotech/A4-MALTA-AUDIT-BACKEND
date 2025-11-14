const mongoose = require("mongoose");
const { Schema } = mongoose;

const DocumentActivitySchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "GlobalDocument", required: true, index: true },
    fileName: { type: String, required: true },
    folderName: { type: String, required: true },
    
    // Activity type
    action: {
      type: String,
      enum: ["upload", "download", "view", "delete", "move", "rename", "approve", "restore"],
      required: true,
      index: true,
    },
    
    // User info
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    
    // Additional details
    details: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

DocumentActivitySchema.index({ documentId: 1, timestamp: -1 });
DocumentActivitySchema.index({ userId: 1, timestamp: -1 });
DocumentActivitySchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model("DocumentActivity", DocumentActivitySchema);

