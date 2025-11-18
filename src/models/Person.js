const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const PersonSchema = new Schema(
  {
    clientId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    phoneNumber: { type: String },
    nationality: { type: String, required: true },
    address: { type: String },
    organizationId: { type: Types.ObjectId, ref: "Organization", required: true },
    supportingDocuments: [{ type: String }],
    shareHoldingCompanies: [{ type: Types.ObjectId, ref: "Company" }],
    representingCompanies: [{ type: Types.ObjectId, ref: "Company" }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("Person", PersonSchema);