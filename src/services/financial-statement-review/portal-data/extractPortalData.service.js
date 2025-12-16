// extractPortalData.service.js

const Engagement = require("../../../models/Engagement");
const Company = require("../../../models/Company");
const ETB = require("../../../models/ExtendedTrialBalance");
const Adjustment = require("../../../models/Adjustment");
const Reclassification = require("../../../models/Reclassification");

//
const {
  applyAdjustmentsAndReclassifications,
} = require("./trial-balance/applyAdjustmentsAndReclassifications");

const { extractETBData } = require("./trial-balance/extractETBData");

exports.extractPortalData = async (engagementId) => {
  const engagement = await Engagement.findById(engagementId).lean();
  if (!engagement) throw new Error("Engagement not found");

  const company = await Company.findById(engagement.companyId)
    .populate({
      path: "representationalSchema.personId",
      select: "name nationality address",
      model: "Person",
    })
    .lean();

  if (!company) throw new Error("Company not found.");

  // Directors
  const directors = (company.representationalSchema || [])
    .filter((r) => r.role?.includes("Director"))
    .map((r) => ({
      personId: r.personId?._id,
      name: r.personId?.name || null,
      nationality: r.personId?.nationality || null,
      address: r.personId?.address || null,
      role: r.role,
    }));

  const etbDoc = await ETB.findOne({
    engagement: engagement._id,
  }).lean();
  if (!etbDoc) throw new Error("ETB not found");

  const adjustments = await Adjustment.find({
    engagementId: engagement._id,
    etbId: etbDoc._id,
  }).lean();

  const reclassifications = await Reclassification.find({
    engagementId: engagement._id,
    etbId: etbDoc._id,
  }).lean();

  const appliedETB = applyAdjustmentsAndReclassifications({
    etbRows: etbDoc.rows,
    adjustments,
    reclassifications,
  });

  const fs = extractETBData(
    appliedETB.etb,
    engagement.yearEndDate.getFullYear()
  );

  return {
    engagement: {
      title: engagement.title,
      yearEndDate: engagement.yearEndDate,
    },
    company: {
      name: company.name,
      registrationNumber: company.registrationNumber,
      address: company.address,
      directors: directors,
    },
    etb: appliedETB.etb,
    adjustments: appliedETB.adjustments,
    reclassifications: appliedETB.reclassifications,
    profit_and_loss: fs.income_statement,
    balance_sheet: fs.balance_sheet,
    lead_sheets: fs.lead_sheets,
  };
};
