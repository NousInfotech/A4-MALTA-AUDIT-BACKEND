const Company = require("../../../models/Company");
const Person = require("../../../models/Person");
const mongoose = require("mongoose");

/**
 * Get companies by client ID
 * @param {String} clientId - Client ID
 * @returns {Promise<Array>} Array of companies with _id, name, registrationNumber
 */
async function getCompaniesClientId(clientId) {
  try {
    const companies = await Company.find({ clientId: clientId })
      .select("_id name registrationNumber")
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
      .populate({
        path: "shareHolders.personId",
        select:
          "name email phoneNumber nationality address supportingDocuments",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.personId",
        select:
          "name email phoneNumber nationality address supportingDocuments",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.companyId",
        select: "name",
        model: "Company",
      })
      .populate({
        path: "representationalCompany.companyId",
        select: "name registrationNumber status clientId",
        model: "Company",
      })
      .populate({
        path: "shareHoldingCompanies.companyId",
        select: "name registrationNumber status clientId",
        model: "Company",
      });

    if (!company) {
      throw new Error("Company not found");
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
        paidUpSharesPercentage: shareHolderData?.paidUpSharesPercentage ?? 100,
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

const sumShareTotals = (sharesDataArray = []) => {
  if (!Array.isArray(sharesDataArray)) {
    return Number(sharesDataArray) || 0;
  }
  return sharesDataArray.reduce(
    (sum, item) => sum + (Number(item?.totalShares) || 0),
    0
  );
};

const getTotalIssuedSharesValue = (totalSharesField) => {
  return sumShareTotals(totalSharesField);
};

async function getCompanyHierarchy(companyId) {
  try {
    const getHierarchy = async (companyId, depth = 0) => {
      // Limit recursion depth to prevent infinite loops
      if (depth > 10) return null;

      // Fetch shareholders and representatives for this company
      const company = await Company.findById(companyId)
        .populate("shareHolders.personId", "name nationality address")
        .populate({
          path: "representationalSchema.personId",
          select: "name nationality address",
          model: "Person",
        })
        .populate({
          path: "representationalCompany.companyId",
          select: "name totalShares address",
          model: "Company",
        })
        .populate({
          path: "shareHoldingCompanies.companyId",
          select: "name totalShares address",
        })
        .lean();

      if (!company) return null;

      // Represent the company node
      const node = {
        id: company._id,
        name: company.name,
        totalShares: company.totalShares,
        type: "company",
        address: company.address,
        shareholders: [],
      };

      // Map to store merged nodes by ID (to remove duplicates)
      const mergedNodesMap = new Map();

      // 1. Process shareHolders (persons with shares)
      for (const sh of company.shareHolders || []) {
        if (!sh?.personId?._id) continue;

        const personIdStr = sh.personId._id.toString();
        const sharesDataArray = Array.isArray(sh?.sharesData)
          ? sh.sharesData.filter((item) => Number(item.totalShares) > 0) // Only include shares with value > 0
          : [];
        const totalSharesValue = sharesDataArray.reduce(
          (sum, item) => sum + (Number(item.totalShares) || 0),
          0
        );

        mergedNodesMap.set(personIdStr, {
          id: sh.personId._id,
          name: sh.personId.name,
          type: "person",
          address: sh.personId.address,
          nationality: sh.personId.nationality,
          sharesData: sharesDataArray,
          totalShares: totalSharesValue,
          roles: new Set(), // Use Set to avoid duplicate roles
        });
      }

      // 2. Process representationalSchema (persons with roles, may or may not have shares)
      for (const rs of company.representationalSchema || []) {
        if (!rs?.personId?._id) continue;

        const personIdStr = rs.personId._id.toString();
        const roleArray = Array.isArray(rs.role)
          ? rs.role
          : rs.role
          ? [rs.role]
          : [];

        if (mergedNodesMap.has(personIdStr)) {
          // Merge: add roles to existing node
          const existingNode = mergedNodesMap.get(personIdStr);
          roleArray.forEach((role) => existingNode.roles.add(role));
        } else {
          // New person from representationalSchema only (no shares)
          mergedNodesMap.set(personIdStr, {
            id: rs.personId._id,
            id: rs.personId._id,
            name: rs.personId.name,
            type: "person",
            address: rs.personId.address,
            nationality: rs.personId.nationality,
            sharesData: [],
            totalShares: 0,
            roles: new Set(roleArray),
          });
        }
      }

      // 3. Process shareHoldingCompanies (companies with shares)
      for (const sh of company.shareHoldingCompanies || []) {
        if (!sh?.companyId?._id) continue;

        const companyIdStr = sh.companyId._id.toString();
        const sharesDataArray = Array.isArray(sh?.sharesData)
          ? sh.sharesData.filter((item) => Number(item.totalShares) > 0) // Only include shares with value > 0
          : [];
        const totalSharesValue = sharesDataArray.reduce(
          (sum, item) => sum + (Number(item.totalShares) || 0),
          0
        );

        // Recursively fetch sub-company hierarchy
        const subCompany = await getHierarchy(sh.companyId._id, depth + 1);

        mergedNodesMap.set(companyIdStr, {
          id: sh.companyId._id,
          name: sh.companyId.name,
          type: "company",
          address: sh.companyId.address,
          sharesData: sharesDataArray,
          totalShares: totalSharesValue,
          roles: new Set(),
          children: subCompany ? subCompany.shareholders : [],
        });
      }

      // 4. Process representationalCompany (companies with roles, may or may not have shares)
      for (const rc of company.representationalCompany || []) {
        if (!rc?.companyId?._id) continue;

        const companyIdStr = rc.companyId._id.toString();
        const roleArray = Array.isArray(rc.role)
          ? rc.role
          : rc.role
          ? [rc.role]
          : [];

        if (mergedNodesMap.has(companyIdStr)) {
          // Merge: add roles to existing node
          const existingNode = mergedNodesMap.get(companyIdStr);
          roleArray.forEach((role) => existingNode.roles.add(role));
        } else {
          // New company from representationalCompany only (no shares)
          // Need to fetch company data for address
          const repCompany = await Company.findById(rc.companyId._id)
            .select("name address totalShares")
            .lean();
          const subCompany = await getHierarchy(rc.companyId._id, depth + 1);

          mergedNodesMap.set(companyIdStr, {
            id: rc.companyId._id,
            name: repCompany?.name || rc.companyId.name,
            type: "company",
            address: repCompany?.address,
            sharesData: [],
            totalShares: 0,
            roles: new Set(roleArray),
            children: subCompany ? subCompany.shareholders : [],
          });
        }
      }

      // Convert merged nodes to final array and calculate percentages
      const parentTotalShares = getTotalIssuedSharesValue(company.totalShares);

      for (const [nodeId, nodeData] of mergedNodesMap.entries()) {
        // Add "Shareholder" role if node has shares
        if (nodeData.totalShares > 0 && !nodeData.roles.has("Shareholder")) {
          nodeData.roles.add("Shareholder");
        }

        // Convert Set to Array for roles
        const rolesArray = Array.from(nodeData.roles);

        const finalNode = {
          id: nodeData.id,
          name: nodeData.name,
          type: nodeData.type,
          address: nodeData.address,
          sharesData: nodeData.sharesData,
          totalShares: nodeData.totalShares,
          roles: rolesArray.length > 0 ? rolesArray : undefined,
        };

        // Add type-specific fields
        if (nodeData.type === "person" && nodeData.nationality) {
          finalNode.nationality = nodeData.nationality;
        }

        if (nodeData.type === "company" && nodeData.children) {
          finalNode.children = nodeData.children;
        }

        node.shareholders.push(finalNode);
      }

      return node;
    };

    const hierarchy = await getHierarchy(companyId);
    return hierarchy;
  } catch (err) {
    console.error(err);
    throw new Error({ message: "Failed to fetch hierarchy" });
  }
}

module.exports = {
  getCompaniesClientId,
  getCompanyById,
  createCompany,
  getCompanyHierarchy,
  assignCompanyToClient,
};
