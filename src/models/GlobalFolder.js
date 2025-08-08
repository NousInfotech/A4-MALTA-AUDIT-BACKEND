// models/GlobalFolder.js
const mongoose = require("mongoose")
const { Schema } = mongoose

const GlobalFolderSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  path: { type: String, required: true }, // e.g. "My Folder/"
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }, // optional, user id/email if needed
})

module.exports = mongoose.model("GlobalFolder", GlobalFolderSchema)
