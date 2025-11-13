const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const ShareClassEnum = ["A", "B", "Ordinary", "General"];

const ShareDataSchema = new Schema(
  {
    percentage: { type: Number, required: true, min: 0, max: 100 },
    totalShares: { type: Number, required: true, min: 0 },
    class: { type: String, enum: ShareClassEnum, required: true },
    // Ultimate Beneficial Owner (only for shareHoldingCompanies)
    ubo: { type: Types.ObjectId, ref: "Person" },
  },
  { _id: false }
);

const CompanySchema = new Schema(
  {
    clientId: { type: String, required: true },
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

// 🔹 Utility method to classify share class automatically
CompanySchema.methods.getShareClass = function (percentage) {
  if (percentage >= 50) return "A";
  if (percentage >= 30) return "B";
  if (percentage >= 20) return "Ordinary";
  return "General";
};

// 🔹 Pre-save hook to auto-assign share classes if not provided
CompanySchema.pre("save", function (next) {
  this.shareHolders?.forEach((holder) => {
    if (!holder.sharesData.class) {
      holder.sharesData.class = this.getShareClass(holder.sharesData.percentage);
    }
  });

  this.shareHoldingCompanies?.forEach((sh) => {
    if (!sh.sharesData.class) {
      sh.sharesData.class = this.getShareClass(sh.sharesData.percentage);
    }
  });

  next();
});

// 🔹 Method to get ultimate beneficial owners (UBOs)
CompanySchema.methods.getUBOs = async function () {
  await this.populate({
    path: "shareHoldingCompanies.companyId",
    populate: {
      path: "shareHolders.personId",
      select: "name nationality",
    },
  });

  const ubos = [];

  this.shareHoldingCompanies.forEach((sh) => {
    const company = sh.companyId;
    if (!company) return;

    // Find top shareholder (class A or highest percentage)
    const topShareholder = company.shareHolders.reduce((max, curr) =>
      curr.sharesData.percentage > (max?.sharesData?.percentage || 0)
        ? curr
        : max,
      null
    );

    if (topShareholder && topShareholder.personId) {
      ubos.push({
        company: company.name,
        person: topShareholder.personId.name,
        percentage: topShareholder.sharesData.percentage,
      });
    }
  });

  return ubos;
};

module.exports = mongoose.model("Company", CompanySchema);

