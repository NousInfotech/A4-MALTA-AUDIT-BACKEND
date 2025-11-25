const mongoose = require("mongoose")
const { Schema } = mongoose

const EngagementFolderSchema = new Schema({
  name: { type: String, required: true, trim: true },
  path: { type: String, required: true },
  parentId: { type: Schema.Types.ObjectId, ref: "EngagementFolder", default: null },
  engagement: { type: Schema.Types.ObjectId, ref: "Engagement", required: true },
  category: { type: String, required: true }, // Keep category for backward compatibility
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String },
})

// Compound index to ensure unique folder names within the same parent and engagement
EngagementFolderSchema.index({ name: 1, parentId: 1, engagement: 1 }, { unique: true })

const EngagementFolder = mongoose.model("EngagementFolder", EngagementFolderSchema)

module.exports = EngagementFolder

