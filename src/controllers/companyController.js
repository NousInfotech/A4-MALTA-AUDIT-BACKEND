const Company = require("../models/Company");
const Person = require("../models/Person");

/**
 * Get all companies for a client
 * GET /api/client/:clientId/company
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const { clientId } = req.params;

    const companies = await Company.find({ clientId })
      .populate("personDetails")
      .populate({
        path: "shareHoldingCompanyDetails",
        select: "name registrationNumber",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
      error: error.message,
    });
  }
};

/**
 * Get a single company by ID
 * GET /api/client/:clientId/company/:companyId
 */
exports.getCompanyById = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;

    const company = await Company.findOne({
      _id: companyId,
      clientId,
    })
      .populate("personDetails")
      .populate({
        path: "shareHoldingCompanies.companyId",
        select: "name registrationNumber status",
        model: "Company",
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Get the representative person (highest share holder)
    const representative = await company.getRepresentative();

    res.status(200).json({
      success: true,
      data: {
        ...company.toObject(),
        representative,
      },
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company",
      error: error.message,
    });
  }
};

/**
 * Create a new company
 * POST /api/client/:clientId/company
 */
exports.createCompany = async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      name,
      registrationNumber,
      address,
      supportingDocuments,
      timelineStart,
      timelineEnd,
      status,
      shareHoldingCompanies,
      createdBy,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    const company = new Company({
      clientId,
      name,
      registrationNumber,
      address,
      supportingDocuments: supportingDocuments || [],
      timelineStart,
      timelineEnd,
      status: status || "active",
      shareHoldingCompanies: shareHoldingCompanies || [],
      createdBy: createdBy || req.user?.id || "system",
    });

    await company.save();

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create company",
      error: error.message,
    });
  }
};

/**
 * Update a company
 * PUT /api/client/:clientId/company/:companyId
 */
exports.updateCompany = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be directly updated
    delete updateData.clientId;
    delete updateData.createdBy;
    delete updateData.createdAt;
    updateData.updatedAt = new Date();

    const company = await Company.findOneAndUpdate(
      { _id: companyId, clientId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("personDetails")
      .populate({
        path: "shareHoldingCompanyDetails",
        select: "name registrationNumber status",
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update company",
      error: error.message,
    });
  }
};

/**
 * Delete a company
 * DELETE /api/client/:clientId/company/:companyId
 */
exports.deleteCompany = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;

    // First, delete all persons associated with this company
    await Person.deleteMany({ companyId });

    // Then delete the company
    const company = await Company.findOneAndDelete({
      _id: companyId,
      clientId,
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company deleted successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete company",
      error: error.message,
    });
  }
};

/**
 * Add a person to a company
 * This updates the company's persons array
 */
exports.addPersonToCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { personId } = req.body;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Add personId to persons array if not already present
    if (!company.persons.includes(personId)) {
      company.persons.push(personId);
      await company.save();
    }

    res.status(200).json({
      success: true,
      message: "Person added to company successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error adding person to company:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add person to company",
      error: error.message,
    });
  }
};

