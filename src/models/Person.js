const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const PersonSchema = new Schema(
  {
    clientId: { type: String, required: true },
    companyId: { type: Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    address: { type: String },
    roles: [
      {
        type: String,
        enum: [
          "ShareHolder",
          "Director",
          "Judicial",
          "Representative",
          "LegalRepresentative",
          "Secretary",
        ],
      },
    ],
    email: { type: String },
    phoneNumber: { type: String },
    sharePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    supportingDocuments: [{ type: String }], // Array of document URLs
    nationality: { type: String },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to get company details
PersonSchema.virtual("companyDetails", {
  ref: "Company",
  localField: "companyId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("Person", PersonSchema);

