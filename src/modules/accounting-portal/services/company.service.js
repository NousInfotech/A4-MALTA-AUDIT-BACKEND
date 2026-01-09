const Company = require('../../../models/Company');
const Person = require('../../../models/Person');
const mongoose = require('mongoose');

/**
 * Get companies by client ID
 * @param {String} clientId - Client ID
 * @returns {Promise<Array>} Array of companies with _id, name, registrationNumber
 */
async function getCompaniesClientId(clientId) {
  try {
    const companies = await Company.find({ clientId })
      .select('_id name registrationNumber')
      .sort({ name: 1 });
    return companies;
  } catch (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }
}

/**
 * Get company by ID
 * @param {String} id - Company ID
 * @returns {Promise<Object>} Full company document with populated virtuals
 */
async function getCompanyById(id) {
  try {
    const company = await Company.findById(id)
      .populate('shareHolderDetails')
      .populate('shareHoldingCompanyDetails');
    
    if (!company) {
      throw new Error('Company not found');
    }
    return company;
  } catch (error) {
    throw new Error(`Failed to fetch company: ${error.message}`);
  }
}

/**
 * Create a new company with owner and shareholders
 * @param {Object} params - Company creation parameters
 * @param {String} params.clientId - Client ID (user ID)
 * @param {String} params.organizationId - Organization ID
 * @param {String} params.companyName - Company name
 * @param {String} params.companyNumber - Company registration number
 * @param {String} params.address - Company address
 * @param {String} params.industry - Industry
 * @param {String} params.summary - Company description
 * @param {String} params.name - Owner name
 * @param {String} params.email - Owner email
 * @param {String} params.nationality - Owner nationality
 * @param {Object} params.shareHolderData - Shareholder data
 * @param {Array} params.representationalSchema - Representational schema
 * @param {Number} params.authorizedShares - Authorized shares
 * @param {Number} params.issuedShares - Issued shares
 * @param {Number} params.perShareValue - Per share value
 * @returns {Promise<Object>} Created company
 */
async function createCompany({
  clientId,
  organizationId,
  companyName,
  companyNumber,
  address,
  industry,
  summary,
  name,
  email,
  nationality,
  shareHolderData,
  representationalSchema,
  authorizedShares,
  issuedShares,
  perShareValue,
}) {
  try {
    // Validate required fields
    if (!companyName || !companyNumber || !address || !nationality) {
      throw new Error(
        "Company name, company number, address, and nationality are required"
      );
    }

    // Validate totalShares if provided
    let totalSharesValue = shareHolderData?.totalShares;

    // If totalSharesArray is provided, use that instead and calculate sum
    if (
      shareHolderData?.totalSharesArray &&
      Array.isArray(shareHolderData.totalSharesArray) &&
      shareHolderData.totalSharesArray.length > 0
    ) {
      totalSharesValue = shareHolderData.totalSharesArray.reduce(
        (sum, item) => sum + (Number(item.totalShares) || 0),
        0
      );
    }

    if (
      totalSharesValue !== undefined &&
      totalSharesValue !== null &&
      (isNaN(totalSharesValue) || totalSharesValue < 0)
    ) {
      throw new Error("Company total shares must be a valid positive number");
    }

    // Create the company owner (Person)
    const companyOwner = await Person.create({
      clientId: clientId,
      name: name,
      email: email,
      nationality: nationality,
      address: address,
      organizationId: organizationId,
    });

    // Determine totalShares - use array if provided, otherwise use number or default
    let companyTotalShares = 100; // default
    if (
      shareHolderData?.totalSharesArray &&
      Array.isArray(shareHolderData.totalSharesArray) &&
      shareHolderData.totalSharesArray.length > 0
    ) {
      companyTotalShares = shareHolderData.totalSharesArray;
    } else if (
      shareHolderData?.totalShares &&
      !isNaN(shareHolderData.totalShares) &&
      shareHolderData.totalShares > 0
    ) {
      // Convert number to array format for backward compatibility
      companyTotalShares = [
        {
          totalShares: Number(shareHolderData.totalShares),
          class: "Ordinary",
          type: "Ordinary",
        },
      ];
    }

    // Create the company
    const newCompany = await Company.create({
      clientId: clientId,
      organizationId: organizationId,
      name: companyName,
      registrationNumber: companyNumber,
      address: address,
      industry: industry,
      description: summary,
      totalShares: companyTotalShares,
      authorizedShares,
      issuedShares,
      perShareValue,
    });

    // Prepare shareholders array
    const shareholders = [];
    // Calculate company total shares sum for percentage calculations
    let companyTotalSharesSum = 100;
    if (
      Array.isArray(newCompany.totalShares) &&
      newCompany.totalShares.length > 0
    ) {
      companyTotalSharesSum = newCompany.totalShares.reduce(
        (sum, item) => sum + (Number(item.totalShares) || 0),
        0
      );
    } else if (typeof newCompany.totalShares === "number") {
      companyTotalSharesSum = newCompany.totalShares;
    }

    // Add company owner as shareholder if shareHolderData exists
    if (
      shareHolderData &&
      shareHolderData.shares &&
      Array.isArray(shareHolderData.shares) &&
      shareHolderData.shares.length > 0
    ) {
      // Use provided shares data
      shareholders.push({
        personId: companyOwner._id,
        sharesData: shareHolderData.shares.map((share) => ({
          totalShares: share.totalShares || 0,
          class: share.class || "A",
          type: share.type || "Ordinary",
        })),
        paidUpSharesPercentage: shareHolderData.paidUpSharesPercentage,
      });
    } else {
      // Default: 100% ownership with default shares data
      const defaultSharesData = Company.createDefaultSharesData();
      if (defaultSharesData.length > 0 && companyTotalShares > 0) {
        defaultSharesData[0].totalShares = companyTotalShares;
      }
      shareholders.push({
        personId: companyOwner._id,
        sharesData: defaultSharesData,
        paidUpSharesPercentage:
          shareHolderData?.paidUpSharesPercentage ?? 100,
      });
    }

    // Prepare representational schema
    const representationalSchemaData = [];

    if (
      representationalSchema &&
      Array.isArray(representationalSchema) &&
      representationalSchema.length > 0
    ) {
      // Use provided representational schema
      representationalSchemaData.push(
        ...representationalSchema.map((item) => ({
          personId: item.personId
            ? mongoose.Types.ObjectId(item.personId)
            : companyOwner._id,
          role: item.role || ["Shareholder"],
          companyId: item.companyId
            ? mongoose.Types.ObjectId(item.companyId)
            : undefined,
        }))
      );
    } else {
      // Default: company owner as shareholder
      representationalSchemaData.push({
        personId: companyOwner._id,
        role: ["Shareholder"],
      });
    }

    // Update company with shareholders and representational schema
    newCompany.shareHolders = shareholders;
    newCompany.representationalSchema = representationalSchemaData;
    await newCompany.save();

    // Update person with company references
    companyOwner.shareHoldingCompanies = [newCompany._id];
    companyOwner.representingCompanies = [newCompany._id];
    await companyOwner.save();

    return newCompany;
  } catch (error) {
    throw new Error(`Failed to create company: ${error.message}`);
  }
}

/**
 * Assign existing company to client
 * @param {String} companyId - Company ID
 * @param {String} clientId - Client ID (user ID)
 * @returns {Promise<Object>} Updated company
 */
async function assignCompanyToClient(companyId, clientId) {
  try {
    const company = await Company.findByIdAndUpdate(companyId, {
      clientId: clientId,
    });

    if (!company) {
      throw new Error("Company not found");
    }

    return company;
  } catch (error) {
    throw new Error(`Failed to assign company: ${error.message}`);
  }
}

module.exports = {
  getCompaniesClientId,
  getCompanyById,
  createCompany,
  assignCompanyToClient,
};

