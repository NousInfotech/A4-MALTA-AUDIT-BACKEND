const mongoose = require("mongoose");
const Company = require("../models/Company");
const Person = require("../models/Person");

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Helper function to create default sharesData array (6 combinations: 3 classes × 2 types)
const createDefaultSharesData = () => {
  const ShareClassEnum = ["A", "B", "C"];
  const ShareTypeEnum = ["Ordinary", "Preferred"];
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

// Helper function to calculate sharePercentage from sharesData array
// Formula: sharePercentage = (sum of all sharesData.totalShares / company.totalShares) * 100
const calculateSharePercentage = (sharesDataArray, companyTotalShares = 0) => {
  if (!Array.isArray(sharesDataArray) || companyTotalShares === 0) {
    return 0;
  }
  const totalShares = sharesDataArray.reduce((sum, item) => sum + (Number(item.totalShares) || 0), 0);
  return (totalShares / companyTotalShares) * 100;
};

// Helper functions to update Person's company references
const updatePersonShareHoldingCompanies = async (personId, companyId, action = 'add') => {
  try {
    const person = await Person.findById(personId);
    if (!person) return;

    const companyObjectId = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;
    
    if (action === 'add') {
      // Add companyId if not already present
      if (!person.shareHoldingCompanies || !person.shareHoldingCompanies.some(
        id => id.toString() === companyObjectId.toString()
      )) {
        person.shareHoldingCompanies = person.shareHoldingCompanies || [];
        person.shareHoldingCompanies.push(companyObjectId);
        person.updatedAt = new Date();
        await person.save();
      }
    } else if (action === 'remove') {
      // Check if person is still a shareholder in this company
      const company = await Company.findById(companyId);
      if (company) {
        const isStillShareholder = company.shareHolders?.some(
          sh => sh.personId?.toString() === personId.toString()
        );
        
        // Only remove if person is no longer a shareholder in this company
        if (!isStillShareholder) {
          person.shareHoldingCompanies = (person.shareHoldingCompanies || []).filter(
            id => id.toString() !== companyObjectId.toString()
          );
          person.updatedAt = new Date();
          await person.save();
        }
      }
    }
  } catch (error) {
    console.error(`Error updating person shareHoldingCompanies for person ${personId}:`, error);
    // Don't throw - this is a background update
  }
};

const updatePersonRepresentingCompanies = async (personId, companyId, action = 'add') => {
  try {
    const person = await Person.findById(personId);
    if (!person) return;

    const companyObjectId = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;
    
    if (action === 'add') {
      // Add companyId if not already present
      if (!person.representingCompanies || !person.representingCompanies.some(
        id => id.toString() === companyObjectId.toString()
      )) {
        person.representingCompanies = person.representingCompanies || [];
        person.representingCompanies.push(companyObjectId);
        person.updatedAt = new Date();
        await person.save();
      }
    } else if (action === 'remove') {
      // Check if person is still a representative in this company
      const company = await Company.findById(companyId);
      if (company) {
        const isStillRepresentative = company.representationalSchema?.some(
          rs => rs.personId?.toString() === personId.toString()
        );
        
        // Only remove if person is no longer a representative in this company
        if (!isStillRepresentative) {
          person.representingCompanies = (person.representingCompanies || []).filter(
            id => id.toString() !== companyObjectId.toString()
          );
          person.updatedAt = new Date();
          await person.save();
        }
      }
    }
  } catch (error) {
    console.error(`Error updating person representingCompanies for person ${personId}:`, error);
    // Don't throw - this is a background update
  }
};

// Helper function to convert old sharesData format to new array format
const convertToSharesDataArray = (sharesData, totalSharesValue = 0) => {
  // If already an array and has 6 items, return as is (but ensure it's valid, remove percentage if present)
  if (Array.isArray(sharesData) && sharesData.length === 6) {
    return sharesData.map((item) => ({
      totalShares: Number(item.totalShares) || 0,
      class: item.class || "A",
      type: item.type || "Ordinary",
    }));
  }

  // If it's a single object (old format), convert to array
  if (sharesData && typeof sharesData === "object" && !Array.isArray(sharesData)) {
    const defaultArray = createDefaultSharesData();
    const classIndex = ["A", "B", "C"].indexOf(sharesData.class || "A");
    const typeIndex = ["Ordinary", "Preferred"].indexOf(sharesData.type || "Ordinary");
    const index = classIndex * 2 + typeIndex;
    
    if (index >= 0 && index < 6) {
      // Calculate totalShares from percentage if needed
      const totalShares = sharesData.totalShares !== undefined 
        ? Number(sharesData.totalShares) 
        : (sharesData.percentage ? Math.round((Number(sharesData.percentage) || 0) / 100 * totalSharesValue) : 0);
      
      defaultArray[index] = {
        totalShares: totalShares,
        class: sharesData.class || "A",
        type: sharesData.type || "Ordinary",
      };
    }
    return defaultArray;
  }

  // Default: return empty array of 6 items
  return createDefaultSharesData();
};

// Helper function to merge sharesData from input into array format
// Frontend sends: {totalShares, shareClass}[] - sharePercentage is calculated separately
const mergeSharesData = (inputSharesData, totalIssuedShares = 0, existingSharesData = null) => {
  const defaultArray = existingSharesData 
    ? convertToSharesDataArray(existingSharesData, totalIssuedShares)
    : createDefaultSharesData();

  // If input is an array (new frontend format: {totalShares, shareClass}[])
  if (Array.isArray(inputSharesData)) {
    inputSharesData.forEach((item) => {
      if (item && (item.shareClass || item.class)) {
        // Support both shareClass (frontend) and class (backend)
        const shareClass = item.shareClass || item.class;
        // Support both shareType (frontend) and type (backend), default to "Ordinary"
        const shareType = item.shareType || item.type || "Ordinary";
        
        const classIndex = ["A", "B", "C"].indexOf(shareClass);
        const typeIndex = ["Ordinary", "Preferred"].indexOf(shareType);
        const index = classIndex * 2 + typeIndex;
        
        if (index >= 0 && index < 6) {
          const totalShares = Number(item.totalShares) || 0;
          
          defaultArray[index] = {
            totalShares: totalShares,
            class: shareClass,
            type: shareType,
          };
        }
      }
    });
    return defaultArray;
  }

  // If input is a single object (backward compatibility)
  return convertToSharesDataArray(inputSharesData, totalIssuedShares);
};

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
        path: "representationalCompany.companyId",
        select: "name registrationNumber status clientId",
        model: "Company",
      })
      .populate({
        path: "shareHoldingCompanies.companyId",
        select: "name registrationNumber status clientId",
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
      shareHoldingCompanies,
      totalShares,                 // ✅ <-- add
      industry,
      description,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    // Default totalShares to 100 if not provided or is 0 (minimum required by model)
    const finalTotalShares = totalShares && Number(totalShares) > 0 ? Number(totalShares) : 100;
    const totalIssuedShares = finalTotalShares;

    // Normalize shareHoldingCompanies to use sharesData array structure
    // Frontend sends sharesData as {totalShares, shareClass}[] - sharePercentage calculated from totalIssuedShares
    const formattedShareholdings = Array.isArray(shareHoldingCompanies)
      ? shareHoldingCompanies.map((s) => {
          const companyId = typeof s.companyId === 'object' ? s.companyId._id : s.companyId;
          
          // Convert sharesData to array format
          // Frontend format: {totalShares, shareClass}[] or {totalShares, shareClass, shareType}[]
          const sharesDataArray = mergeSharesData(
            s.sharesData || s,
            totalIssuedShares
          );

          // Calculate sharePercentage: (sum of all sharesData.totalShares / company.totalShares) * 100
          const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);

          return {
            companyId: companyId,
            sharePercentage: sharePercentage,
            sharesData: sharesDataArray,
          };
        })
      : [];

    const normalizedIndustry = normalizeOptionalString(industry);
    const trimmedDescription = normalizeOptionalString(description);

    const company = new Company({
      clientId,
      name,
      registrationNumber,
      organizationId: req.user.organizationId,
      address,
      supportingDocuments: supportingDocuments || [],
      companyStartedAt: timelineStart ? new Date(timelineStart) : undefined,
      totalShares: finalTotalShares,
      industry: normalizedIndustry,
      description: trimmedDescription,
      shareHoldingCompanies: formattedShareholdings,
      shareHolders: [], // Will be populated separately when persons are added
      representationalSchema: [], // Will be populated separately when persons are added
      representationalCompany: [], // Will be populated separately when companies are added
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

    if (Object.prototype.hasOwnProperty.call(updateData, "industry")) {
      const normalizedIndustry = normalizeOptionalString(updateData.industry);
      if (normalizedIndustry === undefined) {
        delete updateData.industry;
      } else {
        updateData.industry = normalizedIndustry;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "description")) {
      const normalizedDescription = normalizeOptionalString(updateData.description);
      if (normalizedDescription === undefined) {
        delete updateData.description;
      } else {
        updateData.description = normalizedDescription;
      }
    }

    // Handle representationalCompany update if provided
    if (updateData.representationalCompany) {
      updateData.representationalCompany = Array.isArray(updateData.representationalCompany)
        ? updateData.representationalCompany.map((rc) => ({
            companyId: typeof rc.companyId === 'object' ? rc.companyId._id : rc.companyId,
            role: Array.isArray(rc.role) ? rc.role : [rc.role],
          }))
        : [];
    }

    // Handle shareHoldingCompanies update if provided
    // Frontend sends sharesData as {totalShares, shareClass}[] - sharePercentage calculated from totalIssuedShares
    if (updateData.shareHoldingCompanies) {
      // Get existing company to preserve sharesData if not changing
      const existingCompany = await Company.findOne({ _id: companyId, clientId });
      const totalIssuedShares = Number(updateData.totalShares) || Number(existingCompany?.totalShares) || 0;
      
      updateData.shareHoldingCompanies = Array.isArray(updateData.shareHoldingCompanies)
        ? updateData.shareHoldingCompanies.map((s) => {
            const companyId = typeof s.companyId === 'object' ? s.companyId._id : s.companyId;
            
            // Get existing sharesData if available
            let existingSharesData = null;
            if (existingCompany) {
              const existingShare = existingCompany.shareHoldingCompanies?.find(
                (sh) => (typeof sh.companyId === 'object' ? sh.companyId?._id?.toString() : sh.companyId?.toString()) === companyId?.toString()
              );
              existingSharesData = existingShare?.sharesData;
            }
            
            // Merge input sharesData with existing or create new
            // Frontend format: {totalShares, shareClass}[] or {totalShares, shareClass, shareType}[]
            const sharesDataArray = mergeSharesData(
              s.sharesData || s,
              totalIssuedShares,
              existingSharesData
            );
            
            // Calculate sharePercentage: (sum of all sharesData.totalShares / company.totalShares) * 100
            const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);
            
            return {
              companyId: companyId,
              sharePercentage: sharePercentage,
              sharesData: sharesDataArray,
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
        path: "representationalCompany.companyId",
        select: "name registrationNumber status clientId",
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

    // Sync Person references if shareHolders or representationalSchema were updated
    if (updateData.shareHolders !== undefined || updateData.representationalSchema !== undefined) {
      // Get all person IDs from the updated company
      const shareholderPersonIds = new Set();
      const representativePersonIds = new Set();
      
      if (company.shareHolders) {
        company.shareHolders.forEach((sh) => {
          const personId = sh?.personId?._id || sh?.personId?.id || sh?.personId;
          if (personId) {
            shareholderPersonIds.add(String(personId));
          }
        });
      }
      
      if (company.representationalSchema) {
        company.representationalSchema.forEach((rs) => {
          const personId = rs?.personId?._id || rs?.personId?.id || rs?.personId;
          if (personId) {
            representativePersonIds.add(String(personId));
          }
        });
      }
      
      // Get all person IDs that need to be checked (current + previous)
      const allPersonIds = new Set([...shareholderPersonIds, ...representativePersonIds]);
      
      // If shareHolders was updated, check previous shareholders
      if (updateData.shareHolders !== undefined) {
        const previousCompany = await Company.findById(companyId).select('shareHolders').lean();
        if (previousCompany?.shareHolders) {
          previousCompany.shareHolders.forEach((sh) => {
            const personId = sh?.personId?._id || sh?.personId?.id || sh?.personId;
            if (personId) {
              allPersonIds.add(String(personId));
            }
          });
        }
      }
      
      // If representationalSchema was updated, check previous representatives
      if (updateData.representationalSchema !== undefined) {
        const previousCompany = await Company.findById(companyId).select('representationalSchema').lean();
        if (previousCompany?.representationalSchema) {
          previousCompany.representationalSchema.forEach((rs) => {
            const personId = rs?.personId?._id || rs?.personId?.id || rs?.personId;
            if (personId) {
              allPersonIds.add(String(personId));
            }
          });
        }
      }
      
      // Update only relevant persons
      for (const personIdStr of allPersonIds) {
        try {
          const person = await Person.findById(personIdStr).select('shareHoldingCompanies representingCompanies');
          if (!person) continue;
          
          const wasShareholder = person.shareHoldingCompanies?.some(
            id => id.toString() === companyId.toString()
          );
          const wasRepresentative = person.representingCompanies?.some(
            id => id.toString() === companyId.toString()
          );
          const isNowShareholder = shareholderPersonIds.has(personIdStr);
          const isNowRepresentative = representativePersonIds.has(personIdStr);
          
          // Update shareHoldingCompanies
          if (wasShareholder && !isNowShareholder) {
            person.shareHoldingCompanies = (person.shareHoldingCompanies || []).filter(
              id => id.toString() !== companyId.toString()
            );
            person.updatedAt = new Date();
            await person.save();
          } else if (!wasShareholder && isNowShareholder) {
            person.shareHoldingCompanies = person.shareHoldingCompanies || [];
            if (!person.shareHoldingCompanies.some(id => id.toString() === companyId.toString())) {
              person.shareHoldingCompanies.push(companyId);
              person.updatedAt = new Date();
              await person.save();
            }
          }
          
          // Update representingCompanies
          if (wasRepresentative && !isNowRepresentative) {
            person.representingCompanies = (person.representingCompanies || []).filter(
              id => id.toString() !== companyId.toString()
            );
            person.updatedAt = new Date();
            await person.save();
          } else if (!wasRepresentative && isNowRepresentative) {
            person.representingCompanies = person.representingCompanies || [];
            if (!person.representingCompanies.some(id => id.toString() === companyId.toString())) {
              person.representingCompanies.push(companyId);
              person.updatedAt = new Date();
              await person.save();
            }
          }
        } catch (error) {
          console.error(`Error syncing person ${personIdStr} references:`, error);
          // Continue with other persons
        }
      }
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

    // Remove this company from representationalCompany in other companies
    await Company.updateMany(
      {
        clientId,
        "representationalCompany.companyId": companyId,
      },
      {
        $pull: {
          representationalCompany: { companyId },
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
        const sharesDataArray = Array.isArray(sh?.sharesData) ? sh.sharesData : [];
        const totalSharesValue = sharesDataArray.reduce((sum, item) => sum + (Number(item.totalShares) || 0), 0);
        
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
        const roleArray = Array.isArray(rs.role) ? rs.role : (rs.role ? [rs.role] : []);
        
        if (mergedNodesMap.has(personIdStr)) {
          // Merge: add roles to existing node
          const existingNode = mergedNodesMap.get(personIdStr);
          roleArray.forEach(role => existingNode.roles.add(role));
        } else {
          // New person from representationalSchema only (no shares)
          mergedNodesMap.set(personIdStr, {
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
        const sharesDataArray = Array.isArray(sh?.sharesData) ? sh.sharesData : [];
        const totalSharesValue = sharesDataArray.reduce((sum, item) => sum + (Number(item.totalShares) || 0), 0);
        
        // Recursively fetch sub-company hierarchy
        const subCompany = await getHierarchy(sh.companyId._id, depth + 1);
        
        mergedNodesMap.set(companyIdStr, {
          id: sh.companyId._id,
          name: sh.companyId.name,
          type: "company",
          address: subCompany?.address ?? sh.companyId.address,
          sharesData: sharesDataArray,
          totalShares: totalSharesValue,
          roles: new Set(),
          children: subCompany?.shareholders || [],
        });
      }

      // 4. Process representationalCompany (companies with roles, may or may not have shares)
      for (const rc of company.representationalCompany || []) {
        if (!rc?.companyId?._id) continue;
        
        const companyIdStr = rc.companyId._id.toString();
        const roleArray = Array.isArray(rc.role) ? rc.role : (rc.role ? [rc.role] : []);
        
        if (mergedNodesMap.has(companyIdStr)) {
          // Merge: add roles to existing node
          const existingNode = mergedNodesMap.get(companyIdStr);
          roleArray.forEach(role => existingNode.roles.add(role));
        } else {
          // New company from representationalCompany only (no shares)
          // Need to fetch company data for address
          const repCompany = await Company.findById(rc.companyId._id).select("name address totalShares").lean();
          const subCompany = await getHierarchy(rc.companyId._id, depth + 1);
          
          mergedNodesMap.set(companyIdStr, {
            id: rc.companyId._id,
            name: repCompany?.name || rc.companyId.name,
            type: "company",
            address: repCompany?.address || subCompany?.address,
            sharesData: [],
            totalShares: 0,
            roles: new Set(roleArray),
            children: subCompany?.shareholders || [],
          });
        }
      }

      // Convert merged nodes to final array and calculate percentages
      const parentTotalShares = company.totalShares || 0;
      
      for (const [nodeId, nodeData] of mergedNodesMap.entries()) {
        // Add "Shareholder" role if node has shares
        if (nodeData.totalShares > 0 && !nodeData.roles.has("Shareholder")) {
          nodeData.roles.add("Shareholder");
        }
        
        // Calculate share percentage
        const sharePercentage = parentTotalShares > 0 
          ? (nodeData.totalShares / parentTotalShares) * 100 
          : 0;
        
        // Convert Set to Array for roles
        const rolesArray = Array.from(nodeData.roles);
        
        const finalNode = {
          id: nodeData.id,
          name: nodeData.name,
          type: nodeData.type,
          address: nodeData.address,
          sharesData: nodeData.sharesData,
          totalShares: nodeData.totalShares,
          sharePercentage: sharePercentage,
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
    return res.status(200).json({ success: true, data: hierarchy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch hierarchy" });
  }
};

// ============================================
// 16 Controller functions for managing shareholders and representatives
// ============================================

/**
 * Update existing person shareholder (single)
 * PUT /:clientId/company/:companyId/share-holder/person/existing/:personId
 */
exports.updateShareHolderPersonExisting = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;
    const { sharesData } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const personIdStr = personId.toString();
    const totalIssuedShares = company.totalShares || 0;
    const sharesDataArray = mergeSharesData(sharesData, totalIssuedShares);
    const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);

    // Remove existing and add updated
    company.shareHolders = company.shareHolders?.filter(
      sh => sh.personId?.toString() !== personIdStr
    ) || [];

    if (sharesDataArray.some(item => item.totalShares > 0)) {
      company.shareHolders.push({
        personId: personId,
        sharePercentage: sharePercentage,
        sharesData: sharesDataArray,
      });

      // Add "Shareholder" role to representationalSchema
      const existingRepIndex = company.representationalSchema?.findIndex(
        rs => rs.personId?.toString() === personIdStr
      ) ?? -1;

      if (existingRepIndex >= 0) {
        // Person already in representatives - add "Shareholder" role if not present
        const existingRoles = company.representationalSchema[existingRepIndex].role || [];
        if (!existingRoles.includes("Shareholder")) {
          company.representationalSchema[existingRepIndex].role = [...existingRoles, "Shareholder"];
        }
      } else {
        // Person not in representatives - add to representationalSchema with "Shareholder" role
        if (!company.representationalSchema) {
          company.representationalSchema = [];
        }
        company.representationalSchema.push({
          personId: personId,
          role: ["Shareholder"],
        });
        // Update Person's representingCompanies reference
        await updatePersonRepresentingCompanies(personId, companyId, 'add');
      }
    } else {
      // Remove "Shareholder" role if shares are 0
      const existingRepIndex = company.representationalSchema?.findIndex(
        rs => rs.personId?.toString() === personIdStr
      ) ?? -1;

      if (existingRepIndex >= 0) {
        const existingRoles = company.representationalSchema[existingRepIndex].role || [];
        const filteredRoles = existingRoles.filter(r => r !== "Shareholder");
        if (filteredRoles.length === 0) {
          // Remove from representationalSchema if no roles left
          company.representationalSchema = company.representationalSchema.filter(
            (_, idx) => idx !== existingRepIndex
          );
          await updatePersonRepresentingCompanies(personId, companyId, 'remove');
        } else {
          company.representationalSchema[existingRepIndex].role = filteredRoles;
        }
      }
    }

    company.updatedAt = new Date();
    await company.save();

    // Update Person's shareHoldingCompanies reference
    if (sharesDataArray.some(item => item.totalShares > 0)) {
      await updatePersonShareHoldingCompanies(personId, companyId, 'add');
    } else {
      await updatePersonShareHoldingCompanies(personId, companyId, 'remove');
    }

    res.status(200).json({ success: true, message: "Shareholder updated successfully", data: company });
  } catch (error) {
    console.error("Error updating shareholder:", error);
    res.status(500).json({ success: false, message: "Failed to update shareholder", error: error.message });
  }
};

/**
 * Add new person shareholder (single)
 * POST /:clientId/company/:companyId/share-holder/person/new
 */
exports.addShareHolderPersonNew = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { personId, sharesData } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const totalIssuedShares = company.totalShares || 0;
    const sharesDataArray = mergeSharesData(sharesData, totalIssuedShares);
    const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);

    // Remove if exists, then add
    company.shareHolders = company.shareHolders?.filter(
      sh => sh.personId?.toString() !== personId?.toString()
    ) || [];

    if (sharesDataArray.some(item => item.totalShares > 0)) {
      company.shareHolders.push({
        personId: personId,
        sharePercentage: sharePercentage,
        sharesData: sharesDataArray,
      });
    }

    // Add "Shareholder" role to representationalSchema if person is added as shareholder
    if (sharesDataArray.some(item => item.totalShares > 0)) {
      // Check if person already exists in representationalSchema
      const existingRepIndex = company.representationalSchema?.findIndex(
        rs => rs.personId?.toString() === personId?.toString()
      ) ?? -1;

      if (existingRepIndex >= 0) {
        // Person already in representatives - add "Shareholder" role if not present
        const existingRoles = company.representationalSchema[existingRepIndex].role || [];
        if (!existingRoles.includes("Shareholder")) {
          company.representationalSchema[existingRepIndex].role = [...existingRoles, "Shareholder"];
        }
      } else {
        // Person not in representatives - add to representationalSchema with "Shareholder" role
        if (!company.representationalSchema) {
          company.representationalSchema = [];
        }
        company.representationalSchema.push({
          personId: personId,
          role: ["Shareholder"],
        });
        // Update Person's representingCompanies reference
        await updatePersonRepresentingCompanies(personId, companyId, 'add');
      }
    }

    company.updatedAt = new Date();
    await company.save();

    // Update Person's shareHoldingCompanies reference
    if (sharesDataArray.some(item => item.totalShares > 0)) {
      await updatePersonShareHoldingCompanies(personId, companyId, 'add');
    }

    res.status(200).json({ success: true, message: "Shareholder added successfully", data: company });
  } catch (error) {
    console.error("Error adding shareholder:", error);
    res.status(500).json({ success: false, message: "Failed to add shareholder", error: error.message });
  }
};

/**
 * Update existing person shareholders (bulk)
 * PUT /:clientId/company/:companyId/share-holder/person/existing/bulk
 */
exports.updateShareHolderPersonExistingBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { personIds } = req.body; // Array of person IDs

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk update logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies for each personId
    // to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk update not yet implemented" });
  } catch (error) {
    console.error("Error bulk updating shareholders:", error);
    res.status(500).json({ success: false, message: "Failed to bulk update shareholders", error: error.message });
  }
};

/**
 * Add new person shareholders (bulk)
 * POST /:clientId/company/:companyId/share-holder/person/new/bulk
 */
exports.addShareHolderPersonNewBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { persons } = req.body; // Array of { personId, sharesData }

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk add logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies(personId, companyId, 'add')
    // for each person to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk add not yet implemented" });
  } catch (error) {
    console.error("Error bulk adding shareholders:", error);
    res.status(500).json({ success: false, message: "Failed to bulk add shareholders", error: error.message });
  }
};

/**
 * Update existing company shareholder (single)
 * PUT /:clientId/company/:companyId/share-holder/company/existing/:addingCompanyId
 */
exports.updateShareHolderCompanyExisting = async (req, res) => {
  try {
    const { clientId, companyId, addingCompanyId } = req.params;
    const { sharesData } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const totalIssuedShares = company.totalShares || 0;
    const sharesDataArray = mergeSharesData(sharesData, totalIssuedShares);
    const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);

    // Remove existing and add updated
    company.shareHoldingCompanies = company.shareHoldingCompanies?.filter(
      sh => sh.companyId?.toString() !== addingCompanyId?.toString()
    ) || [];

    if (sharesDataArray.some(item => item.totalShares > 0)) {
      company.shareHoldingCompanies.push({
        companyId: addingCompanyId,
        sharePercentage: sharePercentage,
        sharesData: sharesDataArray,
      });

      // Add "Shareholder" role to representationalCompany
      const existingRepIndex = company.representationalCompany?.findIndex(
        rc => rc.companyId?.toString() === addingCompanyId?.toString()
      ) ?? -1;

      if (existingRepIndex >= 0) {
        // Company already in representatives - add "Shareholder" role if not present
        const existingRoles = company.representationalCompany[existingRepIndex].role || [];
        if (!existingRoles.includes("Shareholder")) {
          company.representationalCompany[existingRepIndex].role = [...existingRoles, "Shareholder"];
        }
      } else {
        // Company not in representatives - add to representationalCompany with "Shareholder" role
        if (!company.representationalCompany) {
          company.representationalCompany = [];
        }
        company.representationalCompany.push({
          companyId: addingCompanyId,
          role: ["Shareholder"],
        });
      }
    } else {
      // Remove "Shareholder" role if shares are 0
      const existingRepIndex = company.representationalCompany?.findIndex(
        rc => rc.companyId?.toString() === addingCompanyId?.toString()
      ) ?? -1;

      if (existingRepIndex >= 0) {
        const existingRoles = company.representationalCompany[existingRepIndex].role || [];
        const filteredRoles = existingRoles.filter(r => r !== "Shareholder");
        if (filteredRoles.length === 0) {
          // Remove from representationalCompany if no roles left
          company.representationalCompany = company.representationalCompany.filter(
            (_, idx) => idx !== existingRepIndex
          );
        } else {
          company.representationalCompany[existingRepIndex].role = filteredRoles;
        }
      }
    }

    company.updatedAt = new Date();
    await company.save();

    res.status(200).json({ success: true, message: "Company shareholder updated successfully", data: company });
  } catch (error) {
    console.error("Error updating company shareholder:", error);
    res.status(500).json({ success: false, message: "Failed to update company shareholder", error: error.message });
  }
};

/**
 * Add new company shareholder (single)
 * POST /:clientId/company/:companyId/share-holder/company/new
 */
exports.addShareHolderCompanyNew = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companyId: addingCompanyId, sharesData } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const totalIssuedShares = company.totalShares || 0;
    const sharesDataArray = mergeSharesData(sharesData, totalIssuedShares);
    const sharePercentage = calculateSharePercentage(sharesDataArray, totalIssuedShares);

    // Remove if exists, then add
    company.shareHoldingCompanies = company.shareHoldingCompanies?.filter(
      sh => sh.companyId?.toString() !== addingCompanyId?.toString()
    ) || [];

    if (sharesDataArray.some(item => item.totalShares > 0)) {
      company.shareHoldingCompanies.push({
        companyId: addingCompanyId,
        sharePercentage: sharePercentage,
        sharesData: sharesDataArray,
      });
    }

    // Add "Shareholder" role to representationalCompany if company is added as shareholder
    if (sharesDataArray.some(item => item.totalShares > 0)) {
      // Check if company already exists in representationalCompany
      const existingRepIndex = company.representationalCompany?.findIndex(
        rc => rc.companyId?.toString() === addingCompanyId?.toString()
      ) ?? -1;

      if (existingRepIndex >= 0) {
        // Company already in representatives - add "Shareholder" role if not present
        const existingRoles = company.representationalCompany[existingRepIndex].role || [];
        if (!existingRoles.includes("Shareholder")) {
          company.representationalCompany[existingRepIndex].role = [...existingRoles, "Shareholder"];
        }
      } else {
        // Company not in representatives - add to representationalCompany with "Shareholder" role
        if (!company.representationalCompany) {
          company.representationalCompany = [];
        }
        company.representationalCompany.push({
          companyId: addingCompanyId,
          role: ["Shareholder"],
        });
      }
    }

    company.updatedAt = new Date();
    await company.save();

    res.status(200).json({ success: true, message: "Company shareholder added successfully", data: company });
  } catch (error) {
    console.error("Error adding company shareholder:", error);
    res.status(500).json({ success: false, message: "Failed to add company shareholder", error: error.message });
  }
};

/**
 * Update existing company shareholders (bulk)
 * PUT /:clientId/company/:companyId/share-holder/company/existing/bulk
 */
exports.updateShareHolderCompanyExistingBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companyIds } = req.body; // Array of company IDs

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk update logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies for each personId
    // to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk update not yet implemented" });
  } catch (error) {
    console.error("Error bulk updating company shareholders:", error);
    res.status(500).json({ success: false, message: "Failed to bulk update company shareholders", error: error.message });
  }
};

/**
 * Add new company shareholders (bulk)
 * POST /:clientId/company/:companyId/share-holder/company/new/bulk
 */
exports.addShareHolderCompanyNewBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companies } = req.body; // Array of { companyId, sharesData }

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk add logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies(personId, companyId, 'add')
    // for each person to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk add not yet implemented" });
  } catch (error) {
    console.error("Error bulk adding company shareholders:", error);
    res.status(500).json({ success: false, message: "Failed to bulk add company shareholders", error: error.message });
  }
};

/**
 * Update existing person representation (single)
 * PUT /:clientId/company/:companyId/representation/person/existing/:personId
 */
exports.updateRepresentationPersonExisting = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;
    const { role } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const personIdStr = personId.toString();
    company.representationalSchema = company.representationalSchema?.filter(
      rs => rs.personId?.toString() !== personIdStr
    ) || [];

    if (Array.isArray(role) && role.length > 0) {
      company.representationalSchema.push({
        personId: personId,
        role: role,
      });
    }

    company.updatedAt = new Date();
    await company.save();

    // Update Person's representingCompanies reference
    if (Array.isArray(role) && role.length > 0) {
      await updatePersonRepresentingCompanies(personId, companyId, 'add');
    } else {
      await updatePersonRepresentingCompanies(personId, companyId, 'remove');
    }

    res.status(200).json({ success: true, message: "Representation updated successfully", data: company });
  } catch (error) {
    console.error("Error updating representation:", error);
    res.status(500).json({ success: false, message: "Failed to update representation", error: error.message });
  }
};

/**
 * Add new person representation (single)
 * POST /:clientId/company/:companyId/representation/person/new
 */
exports.addRepresentationPersonNew = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { personId, role } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // Remove if exists, then add
    company.representationalSchema = company.representationalSchema?.filter(
      rs => rs.personId?.toString() !== personId?.toString()
    ) || [];

    if (Array.isArray(role) && role.length > 0) {
      company.representationalSchema.push({
        personId: personId,
        role: role,
      });
    }

    company.updatedAt = new Date();
    await company.save();

    // Update Person's representingCompanies reference
    if (Array.isArray(role) && role.length > 0) {
      await updatePersonRepresentingCompanies(personId, companyId, 'add');
    }

    res.status(200).json({ success: true, message: "Representation added successfully", data: company });
  } catch (error) {
    console.error("Error adding representation:", error);
    res.status(500).json({ success: false, message: "Failed to add representation", error: error.message });
  }
};

/**
 * Update existing person representations (bulk)
 * PUT /:clientId/company/:companyId/representation/person/existing/bulk
 */
exports.updateRepresentationPersonExistingBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { personIds } = req.body; // Array of person IDs

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk update logic
    // When implementing, ensure to call updatePersonRepresentingCompanies for each personId
    // to maintain Person.representingCompanies references
    res.status(200).json({ success: true, message: "Bulk update not yet implemented" });
  } catch (error) {
    console.error("Error bulk updating representations:", error);
    res.status(500).json({ success: false, message: "Failed to bulk update representations", error: error.message });
  }
};

/**
 * Add new person representations (bulk)
 * POST /:clientId/company/:companyId/representation/person/new/bulk
 */
exports.addRepresentationPersonNewBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { persons } = req.body; // Array of { personId, role }

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk add logic
    // When implementing, ensure to call updatePersonRepresentingCompanies(personId, companyId, 'add')
    // for each person to maintain Person.representingCompanies references
    res.status(200).json({ success: true, message: "Bulk add not yet implemented" });
  } catch (error) {
    console.error("Error bulk adding representations:", error);
    res.status(500).json({ success: false, message: "Failed to bulk add representations", error: error.message });
  }
};

/**
 * Update existing company representation (single)
 * PUT /:clientId/company/:companyId/representation/company/existing/:addingCompanyId
 */
exports.updateRepresentationCompanyExisting = async (req, res) => {
  try {
    const { clientId, companyId, addingCompanyId } = req.params;
    const { role } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const companyIdStr = addingCompanyId.toString();
    company.representationalCompany = company.representationalCompany?.filter(
      rc => rc.companyId?.toString() !== companyIdStr
    ) || [];

    if (Array.isArray(role) && role.length > 0) {
      company.representationalCompany.push({
        companyId: addingCompanyId,
        role: role,
      });
    }

    company.updatedAt = new Date();
    await company.save();

    res.status(200).json({ success: true, message: "Company representation updated successfully", data: company });
  } catch (error) {
    console.error("Error updating company representation:", error);
    res.status(500).json({ success: false, message: "Failed to update company representation", error: error.message });
  }
};

/**
 * Add new company representation (single)
 * POST /:clientId/company/:companyId/representation/company/new
 */
exports.addRepresentationCompanyNew = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companyId: addingCompanyId, role } = req.body;

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // Remove if exists, then add
    company.representationalCompany = company.representationalCompany?.filter(
      rc => rc.companyId?.toString() !== addingCompanyId?.toString()
    ) || [];

    if (Array.isArray(role) && role.length > 0) {
      company.representationalCompany.push({
        companyId: addingCompanyId,
        role: role,
      });
    }

    company.updatedAt = new Date();
    await company.save();

    res.status(200).json({ success: true, message: "Company representation added successfully", data: company });
  } catch (error) {
    console.error("Error adding company representation:", error);
    res.status(500).json({ success: false, message: "Failed to add company representation", error: error.message });
  }
};

/**
 * Update existing company representations (bulk)
 * PUT /:clientId/company/:companyId/representation/company/existing/bulk
 */
exports.updateRepresentationCompanyExistingBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companyIds } = req.body; // Array of company IDs

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk update logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies for each personId
    // to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk update not yet implemented" });
  } catch (error) {
    console.error("Error bulk updating company representations:", error);
    res.status(500).json({ success: false, message: "Failed to bulk update company representations", error: error.message });
  }
};

/**
 * Add new company representations (bulk)
 * POST /:clientId/company/:companyId/representation/company/new/bulk
 */
exports.addRepresentationCompanyNewBulk = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const { companies } = req.body; // Array of { companyId, role }

    const company = await Company.findOne({ _id: companyId, clientId });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // TODO: Implement bulk add logic
    // When implementing, ensure to call updatePersonShareHoldingCompanies(personId, companyId, 'add')
    // for each person to maintain Person.shareHoldingCompanies references
    res.status(200).json({ success: true, message: "Bulk add not yet implemented" });
  } catch (error) {
    console.error("Error bulk adding company representations:", error);
    res.status(500).json({ success: false, message: "Failed to bulk add company representations", error: error.message });
  }
};

/**
 * Global search for companies within organization
 * GET /api/client/:clientId/company/search/global
 * Query params: search, page, limit
 */
exports.searchCompaniesGlobal = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Add text search if provided
    if (search && search.trim().length > 0) {
      searchQuery = {
          organizationId: req.user.organizationId,
          name: { $regex: search.trim(), $options: "i" }
      }
    }

    // Execute query with pagination
    const [companies, total] = await Promise.all([
      Company.find(searchQuery)
        .select("_id name registrationNumber")
        .sort({ name: 1 }) // Alphabetical order
        // .skip(skip)
        // .limit(limitNumber)
        .lean(),
      Company.countDocuments(searchQuery),
    ]);

    res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error searching companies globally:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search companies",
      error: error.message,
    });
  }
};

/**
 * Global search for persons within organization
 * GET /api/client/:clientId/person/search/global
 * Query params: search, page, limit
 */
exports.searchPersonsGlobal = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Get all companies in the organization to find associated persons
    const organizationCompanies = await Company.find({ organizationId })
      .select("shareHolders representationalSchema")
      .lean();

    // Extract all personIds from companies in the organization
    const personIds = new Set();
    organizationCompanies.forEach((company) => {
      // From shareHolders
      if (Array.isArray(company.shareHolders)) {
        company.shareHolders.forEach((sh) => {
          if (sh.personId) {
            // personId can be ObjectId or populated object
            const personId = sh.personId._id || sh.personId;
            if (personId) {
              personIds.add(personId.toString());
            }
          }
        });
      }
      // From representationalSchema
      if (Array.isArray(company.representationalSchema)) {
        company.representationalSchema.forEach((rep) => {
          if (rep.personId) {
            // personId can be ObjectId or populated object
            const personId = rep.personId._id || rep.personId;
            if (personId) {
              personIds.add(personId.toString());
            }
          }
        });
      }
    });

    // If no persons found in organization, return empty result
    if (personIds.size === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Build search query - search all persons associated with companies in the organization
    const personIdsArray = Array.from(personIds).map(id => new mongoose.Types.ObjectId(id));
    let searchQuery = {
      _id: { $in: personIdsArray },
    };

    // Add text search if provided
    if (search && search.trim().length > 0) {
      searchQuery = {
        $and: [
          { _id: { $in: personIdsArray } },
          {
            $or: [
              { name: { $regex: search.trim(), $options: "i" } },
              { email: { $regex: search.trim(), $options: "i" } },
              { phoneNumber: { $regex: search.trim(), $options: "i" } },
              { address: { $regex: search.trim(), $options: "i" } },
              { nationality: { $regex: search.trim(), $options: "i" } },
            ],
          },
        ],
      };
    }

    // Execute query with pagination
    const [persons, total] = await Promise.all([
      Person.find(searchQuery)
        .select("_id name email phoneNumber nationality address clientId")
        .sort({ name: 1 }) // Alphabetical order
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Person.countDocuments(searchQuery),
    ]);

    res.status(200).json({
      success: true,
      data: persons,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error searching persons globally:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search persons",
      error: error.message,
    });
  }
};



