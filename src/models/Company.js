const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const CompanySchema = new Schema(
  {
    clientId: { type: String, required: true },
    name: { type: String, required: true },
    registrationNumber: { type: String },
    address: { type: String },
    persons: [{ type: Types.ObjectId, ref: "Person" }],
    supportingDocuments: [{ type: String }], // Array of document URLs
    timelineStart: { type: Date },
    timelineEnd: { type: Date },
    status: {
      type: String,
      enum: ["active", "record"],
      default: "active",
    },
    shareHoldingCompanies: [
      {
        companyId: { type: Types.ObjectId, ref: "Company", required: true },
        sharePercentage: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to get persons with details
CompanySchema.virtual("personDetails", {
  ref: "Person",
  localField: "persons",
  foreignField: "_id",
  justOne: false,
});

// Virtual to get shareholding companies with details
CompanySchema.virtual("shareHoldingCompanyDetails", {
  ref: "Company",
  localField: "shareHoldingCompanies.companyId",
  foreignField: "_id",
  justOne: false,
});

// Method to get the representative person(s) and company(s) (highest share holder)
CompanySchema.methods.getRepresentative = async function () {
  await this.populate("personDetails");
  
  // Get person shareholders
  const personShareholders = this.personDetails.filter((person) =>
    person.roles.includes("ShareHolder")
  ).map(p => ({ type: 'person', name: p.name, sharePercentage: p.sharePercentage || 0 }));
  
  // Get company shareholders (they're already in shareHoldingCompanies array)
  const companyShareholders = (this.shareHoldingCompanies || []).map(sh => ({
    type: 'company',
    name: typeof sh.companyId === 'object' && sh.companyId.name 
      ? sh.companyId.name 
      : 'Unknown Company',
    sharePercentage: sh.sharePercentage || 0
  }));
  
  // Combine all shareholders
  const allShareholders = [...personShareholders, ...companyShareholders];
  
  if (allShareholders.length === 0) return null;
  
  // Find the maximum percentage
  const maxPercentage = Math.max(...allShareholders.map(s => s.sharePercentage));
  
  // Get all shareholders with the maximum percentage
  const representatives = allShareholders.filter(s => s.sharePercentage === maxPercentage);
  
  // Sort by name alphabetically for consistent display
  representatives.sort((a, b) => a.name.localeCompare(b.name));
  
  // Return single shareholder if only one, array if multiple
  return representatives.length === 1 ? representatives[0] : representatives;
};

module.exports = mongoose.model("Company", CompanySchema);

