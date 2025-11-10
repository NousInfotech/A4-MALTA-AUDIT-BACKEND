const mongoose = require("mongoose");
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
      .populate({
        path: "shareHolders.personId",
        select: "name email phoneNumber nationality address",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.personId",
        select: "name email phoneNumber nationality address",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.companyId",
        select: "name",
        model: "Company",
      })
      .populate({
        path: "shareHoldingCompanies.companyId",
        select: "name registrationNumber status",
        model: "Company",
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
      .populate({
        path: "shareHolders.personId",
        select: "name email phoneNumber nationality address supportingDocuments",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.personId",
        select: "name email phoneNumber nationality address supportingDocuments",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.companyId",
        select: "name",
        model: "Company",
      })
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

    res.status(200).json({
      success: true,
      data: company,
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
      totalShares,                 // ✅ <-- add
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    // Normalize shareHoldingCompanies to use sharesData structure
    const formattedShareholdings = Array.isArray(shareHoldingCompanies)
      ? shareHoldingCompanies.map((s) => {
          const companyId = typeof s.companyId === 'object' ? s.companyId._id : s.companyId;
          const sharePercentage =
            s.sharePercentage !== undefined && s.sharePercentage !== null
              ? Number(s.sharePercentage)
              : Number(s?.sharesData?.percentage) || 0;
          const totalSharesValue = Number(totalShares) || 0;
          
          // Calculate share class
          let shareClass = "General";
          if (sharePercentage >= 50) shareClass = "A";
          else if (sharePercentage >= 30) shareClass = "B";
          else if (sharePercentage >= 20) shareClass = "Ordinary";

          return {
            companyId: companyId,
            sharesData: {
              percentage: sharePercentage,
              totalShares: Math.round((sharePercentage / 100) * totalSharesValue),
              class: shareClass,
            },
          };
        })
      : [];

    const company = new Company({
      clientId,
      name,
      registrationNumber,
      address,
      supportingDocuments: supportingDocuments || [],
      companyStartedAt: timelineStart ? new Date(timelineStart) : undefined,
      totalShares: Number(totalShares) || 0,
      shareHoldingCompanies: formattedShareholdings,
      shareHolders: [], // Will be populated separately when persons are added
      representationalSchema: [], // Will be populated separately when persons are added
      // Note: status and timelineEnd are not in the model, ignoring them
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

    // Handle shareHoldingCompanies update if provided
    if (updateData.shareHoldingCompanies) {
      const totalSharesValue = Number(updateData.totalShares) || 0;
      updateData.shareHoldingCompanies = Array.isArray(updateData.shareHoldingCompanies)
        ? updateData.shareHoldingCompanies.map((s) => {
            const companyId = typeof s.companyId === 'object' ? s.companyId._id : s.companyId;
            const sharePercentage =
              s.sharePercentage !== undefined && s.sharePercentage !== null
                ? Number(s.sharePercentage)
                : Number(s?.sharesData?.percentage) || 0;
            
            // Calculate share class
            let shareClass = "General";
            if (sharePercentage >= 50) shareClass = "A";
            else if (sharePercentage >= 30) shareClass = "B";
            else if (sharePercentage >= 20) shareClass = "Ordinary";

            return {
              companyId: companyId,
              sharesData: {
                percentage: sharePercentage,
                totalShares: Math.round((sharePercentage / 100) * totalSharesValue),
                class: shareClass,
              },
            };
          })
        : [];
    }

    const company = await Company.findOneAndUpdate(
      { _id: companyId, clientId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate({
        path: "shareHolders.personId",
        select: "name email phoneNumber nationality address",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.personId",
        select: "name email phoneNumber nationality address",
        model: "Person",
      })
      .populate({
        path: "representationalSchema.companyId",
        select: "name",
        model: "Company",
      })
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

    // Find the company first
    const company = await Company.findOne({
      _id: companyId,
      clientId,
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const personIdsSet = new Set();
    const extractId = (value) => {
      if (!value) return null;
      if (typeof value === "string") return value;
      if (value._id) return value._id.toString();
      if (value.id) return value.id.toString();
      try {
        return value.toString();
      } catch (err) {
        return null;
      }
    };

    (company.shareHolders || []).forEach((shareholder) => {
      const id = extractId(shareholder?.personId);
      if (id) personIdsSet.add(id);
    });

    (company.representationalSchema || []).forEach((representative) => {
      const id = extractId(representative?.personId);
      if (id) personIdsSet.add(id);
    });

    const personObjectIds = Array.from(personIdsSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    // Remove this company from any shareholding relationships in other companies
    await Company.updateMany(
      {
        clientId,
        "shareHoldingCompanies.companyId": companyId,
      },
      {
        $pull: {
          shareHoldingCompanies: { companyId },
        },
      }
    );

    if (personObjectIds.length > 0) {
      // Remove these persons from representational schemas in other companies
      await Company.updateMany(
        {
          clientId,
          _id: { $ne: companyId },
        },
        {
          $pull: {
            representationalSchema: {
              personId: { $in: personObjectIds },
            },
          },
        }
      );

      // Remove these persons from shareHolders in other companies
      await Company.updateMany(
        {
          clientId,
          _id: { $ne: companyId },
        },
        {
          $pull: {
            shareHolders: {
              personId: { $in: personObjectIds },
            },
          },
        }
      );
    }

    // Delete the company
    await Company.findByIdAndDelete(companyId);

    if (personObjectIds.length > 0) {
      const removablePersonIds = [];

      for (const personObjectId of personObjectIds) {
        const stillReferenced = await Company.exists({
          clientId,
          $or: [
            { "shareHolders.personId": personObjectId },
            { "representationalSchema.personId": personObjectId },
          ],
        });

        if (!stillReferenced) {
          removablePersonIds.push(personObjectId);
        }
      }

      if (removablePersonIds.length > 0) {
        await Person.deleteMany({
          clientId,
          _id: { $in: removablePersonIds },
        });
      }
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
 * Remove a representative from a company (only removes from representationalSchema)
 * DELETE /api/client/:clientId/company/:companyId/representative/:personId
 */
exports.removeRepresentative = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;

    const company = await Company.findOne({
      _id: companyId,
      clientId,
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Verify person exists
    const person = await Person.findOne({
      _id: personId,
      clientId,
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    // Remove only from representationalSchema (not from shareHolders)
    const beforeCount = company.representationalSchema?.length || 0;
    company.representationalSchema = company.representationalSchema?.filter(
      (rs) => rs.personId?.toString() !== personId
    ) || [];

    const removed = beforeCount > (company.representationalSchema?.length || 0);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Representative relationship not found",
      });
    }

    company.updatedAt = new Date();
    await company.save();

    res.status(200).json({
      success: true,
      message: "Representative removed successfully",
      data: {
        person: person,
        company: company,
      },
    });
  } catch (error) {
    console.error("Error removing representative:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove representative",
      error: error.message,
    });
  }
};

exports.getCompanyHierarchy = async (req, res) => {
  try {
    const { companyId } = req.params;

    const getHierarchy = async (companyId, depth = 0) => {
      if (depth > 3) return null; // avoid infinite loops

      const company = await Company.findById(companyId)
        .populate("shareHolders.personId", "name nationality address")
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

      // Direct persons
      for (const sh of company.shareHolders || []) {
        if (!sh?.personId?._id) continue;
        node.shareholders.push({
          id: sh.personId._id,
          name: sh.personId.name,
          type: "person",
          percentage: sh?.sharesData?.percentage ?? 0,
          class: sh?.sharesData?.class,
          totalShares: sh?.sharesData?.totalShares,
          address: sh.personId.address,
        });
      }

      // Shareholding companies (recursively fetch)
      for (const sh of company.shareHoldingCompanies || []) {
        if (!sh?.companyId?._id) continue;
        const subCompany = await getHierarchy(sh.companyId._id, depth + 1);
        node.shareholders.push({
          id: sh.companyId._id,
          name: sh.companyId.name,
          type: "company",
          percentage: sh?.sharesData?.percentage ?? sh?.sharePercentage ?? 0,
          class: sh?.sharesData?.class,
          totalShares: sh?.sharesData?.totalShares,
          address: subCompany?.address ?? sh.companyId.address,
          children: subCompany?.shareholders || [],
        });
      }

      return node;
    };

    const hierarchy = await getHierarchy(companyId);
    return res.status(200).json({ success: true, data: hierarchy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch hierarchy" });
  }
};



