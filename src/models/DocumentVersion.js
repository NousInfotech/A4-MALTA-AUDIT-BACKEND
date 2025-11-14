const mongoose = require("mongoose");
const { Schema } = mongoose;

const DocumentVersionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "GlobalDocument", required: true, index: true },
    fileName: { type: String, required: true },
    version: { type: Number, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    publicUrl: { type: String },
    
    // Who created this version
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, required: true },
    
    // Change tracking
    changeReason: { type: String },
    isRestored: { type: Boolean, default: false },
    restoredAt: { type: Date },
    restoredBy: { type: String },
    
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

DocumentVersionSchema.index({ documentId: 1, version: -1 });

module.exports = mongoose.model("DocumentVersion", DocumentVersionSchema);

