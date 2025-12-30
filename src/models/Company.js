const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const ShareClassEnum = ["A", "B", "C", "Ordinary"];
const ShareTypeEnum = ["Ordinary"];

const ShareDataSchema = new Schema(
  {
    totalShares: { type: Number },
    class: { type: String, enum: ShareClassEnum },
    type: { type: String, enum: ShareTypeEnum, default: "Ordinary" }
  },
  { _id: false }
);

// Helper function to create default sharesData array (6 combinations: 3 classes × 2 types)
const createDefaultSharesData = () => {
  const combinations = [];
  ShareClassEnum.forEach((shareClass) => {
    ShareTypeEnum.forEach((shareType) => {
      combinations.push({
        totalShares: 0,
        class: shareClass,
        type: shareType,
      });
    });
  });
  return combinations;
};

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
    authorizedShares: { type: Number },
    issuedShares: { type: Number },
    perShareValue: { value: { type: Number }, currency: { type: String, default: "EUR" } },
    totalShares: { type: [ShareDataSchema] },
      // Shareholding by other companies
    shareHoldingCompanies: [
      {
        companyId: { type: Types.ObjectId, ref: "Company", required: true },
        sharesData: {
          type: [ShareDataSchema],
          required: true,
          default: createDefaultSharesData,
          validate: {
            validator: function(v) {
              return Array.isArray(v) && v.length >= 1;
            },
            message: "sharesData must be an array with at least 1 item"
          }
        },
        paidUpSharesPercentage: { type: Number },
      },
      
    ],

    // Direct shareholders (persons)
    shareHolders: [
      {
        personId: { type: Types.ObjectId, ref: "Person", required: true },
        paidUpSharesPercentage: { type: Number },
        sharesData: {
          type: [ShareDataSchema],
          required: true,
          default: createDefaultSharesData,
          validate: {
            validator: function(v) {
              return Array.isArray(v) && v.length >= 1;
            },
            message: "sharesData must be an array with at least 1 item"
          }
        },
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



// Export the helper function for use in controllers
CompanySchema.statics.createDefaultSharesData = createDefaultSharesData;

module.exports = mongoose.model("Company", CompanySchema);

