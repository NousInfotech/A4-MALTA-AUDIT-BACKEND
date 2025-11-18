const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const ShareClassEnum = ["A", "B", "C"];
const ShareTypeEnum = ["Ordinary", "Preferred"];

const ShareDataSchema = new Schema(
  {
    percentage: { type: Number, required: true, min: 0, max: 100 },
    totalShares: { type: Number, required: true, min: 0 },
    class: { type: String, enum: ShareClassEnum, required: true },
    type: { type:String, enum:ShareTypeEnum, required:true, default: "Ordinary"}
  },
  { _id: false }
);

const CompanySchema = new Schema(
  {
    clientId: { type: String, required: true },
    organizationId: { type: Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    registrationNumber: { type: String, required: true},
    address: { type: String, required: true},
    supportingDocuments: [{ type: String }], // URLs or file keys
    industry: { type: String },
    description: { type: String },
    companyStartedAt: { type: Date },
    totalShares: { type: Number, min: 100 },

    // Shareholding by other companies
    shareHoldingCompanies: [
      {
        companyId: { type: Types.ObjectId, ref: "Company", required: true },
        sharesData: { type: ShareDataSchema, required: true },
      },
    ],

    // Direct shareholders (persons)
    shareHolders: [
      {
        personId: { type: Types.ObjectId, ref: "Person", required: true },
        sharesData: { type: ShareDataSchema, required: true },
      },
    ],

    // Board/representative schema
    representationalSchema: [
      {
        personId: { type: Types.ObjectId, ref: "Person", required: true },
        role: {
          type: [String],
          enum: [
            "Shareholder",
            "Director",
            "Judicial Representative",
            "Legal Representative",
            "Secretary",
          ],
          required: true,
        },
        // Optional: companyId for persons from shareholding companies (outsiders)
        // Only store if person is from a different company
        companyId: { type: Types.ObjectId, ref: "Company", required: false },
      },
    ],

    representationalCompany:[
      {
        companyId: { type: Types.ObjectId, ref: "Company", required: true },
        role: {
          type: [String],
          enum: [
            "Shareholder",
            "Director",
            "Judicial Representative",
            "Legal Representative",
            "Secretary",
          ],
          required: true,
        },
      },
    ],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔹 Virtuals
CompanySchema.virtual("shareHolderDetails", {
  ref: "Person",
  localField: "shareHolders.personId",
  foreignField: "_id",
  justOne: false,
});

CompanySchema.virtual("shareHoldingCompanyDetails", {
  ref: "Company",
  localField: "shareHoldingCompanies.companyId",
  foreignField: "_id",
  justOne: false,
});



module.exports = mongoose.model("Company", CompanySchema);

