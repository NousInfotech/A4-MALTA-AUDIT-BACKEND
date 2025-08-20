const mongoose = require("mongoose")
const { Schema } = mongoose

const GlobalFolderSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }, 
})

module.exports = mongoose.model("GlobalFolder", GlobalFolderSchema)
