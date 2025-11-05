const mongoose = require("mongoose");
const { Schema } = mongoose;

const PersonSchema = new Schema(
  {
    clientId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    phoneNumber: { type: String },
    nationality: { type: String, required: true },
    address: { type: String },
    supportingDocuments: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("Person", PersonSchema);