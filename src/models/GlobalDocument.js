const mongoose = require("mongoose");
const { Schema } = mongoose;

const GlobalDocumentSchema = new Schema(
  {
    fileName: { type: String, required: true },
    originalFileName: { type: String, required: true },
    folderName: { type: String, required: true, index: true },
    folderPath: { type: String, required: true },
    filePath: { type: String, required: true, unique: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    mimeType: { type: String },
    publicUrl: { type: String },
    
    // Version tracking
    version: { type: Number, default: 1, required: true },
    isLatest: { type: Boolean, default: true, index: true },
    previousVersionId: { type: Schema.Types.ObjectId, ref: "GlobalDocument" },
    restoredFromVersion: { type: Number }, // Track which version was restored (if this is a restored version)
    
    // Uploader info
    uploadedBy: { type: String, required: true }, // user ID
    uploadedByName: { type: String, required: true },
    uploadedByRole: { type: String, required: true },
    
    // Metadata
    description: { type: String },
    tags: [{ type: String, index: true }],
    engagementId: { type: String, index: true }, // Optional: link to engagement
    clientId: { type: String, index: true }, // Optional: link to client
    
    // Access & Permissions
    permissions: {
      view: [{ type: String }], // Array of role names or user IDs
      upload: [{ type: String }],
      delete: [{ type: String }],
      approve: [{ type: String }],
    },
    
    // Status
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "archived"],
      default: "pending",
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    
    // Activity tracking
    downloadCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    lastDownloadedAt: { type: Date },
    lastViewedAt: { type: Date },
    
    // Timestamps
    uploadedAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
GlobalDocumentSchema.index({ folderName: 1, isLatest: 1 });
GlobalDocumentSchema.index({ uploadedBy: 1 });
GlobalDocumentSchema.index({ tags: 1 });
GlobalDocumentSchema.index({ engagementId: 1 });
GlobalDocumentSchema.index({ clientId: 1 });
GlobalDocumentSchema.index({ uploadedAt: -1 });
GlobalDocumentSchema.index({ fileName: "text", description: "text", tags: "text" });

module.exports = mongoose.model("GlobalDocument", GlobalDocumentSchema);

