const mongoose = require("mongoose")
const { Schema, Types } = mongoose

const EngagementLibrarySchema = new Schema({
  engagement: { type: Types.ObjectId, ref: "Engagement", required: true },
  category: { type: String, required: true },
  folderId: { type: Types.ObjectId, ref: "EngagementFolder", default: null }, // Optional folder reference
  url: { type: String },
  fileName: { type: String }, // Optional: stored file name
  fileType: { type: String }, // Optional: stored file type (e.g., "xlsx", "pdf")
  fileId: { type: String, default: null }, // Reference ID for MBR/Tax documents or other linked entities
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("EngagementLibrary", EngagementLibrarySchema)
