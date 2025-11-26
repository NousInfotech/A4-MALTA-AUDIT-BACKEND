const mongoose = require("mongoose");
const Person = require("../models/Person");
const Company = require("../models/Company");
const KnowYourClient = require("../models/KnowYourClient");

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
  const totalShares = sharesDataArray.reduce(
    (sum, item) => sum + (Number(item.totalShares) || 0),
    0
  );
  return (totalShares / companyTotalShares) * 100;
};

// Helper function to convert sharesData from frontend format {totalShares, shareClass}[] to array format
// Frontend sends: {totalShares, shareClass}[] - percentage is calculated from totalIssuedShares
const convertSharesDataToArray = (inputSharesData, totalIssuedShares = 0) => {
  const defaultArray = createDefaultSharesData();

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
  if (
    inputSharesData &&
    typeof inputSharesData === "object" &&
    !Array.isArray(inputSharesData)
  ) {
    const shareClass =
      inputSharesData.shareClass || inputSharesData.class || "A";
    const shareType =
      inputSharesData.shareType || inputSharesData.type || "Ordinary";
    const classIndex = ["A", "B", "C"].indexOf(shareClass);
    const typeIndex = ["Ordinary", "Preferred"].indexOf(shareType);
    const index = classIndex * 2 + typeIndex;

    if (index >= 0 && index < 6) {
      const totalShares =
        inputSharesData.totalShares !== undefined
          ? Number(inputSharesData.totalShares)
          : inputSharesData.percentage
            ? Math.round(
              ((Number(inputSharesData.percentage) || 0) / 100) *
              totalIssuedShares
            )
            : 0;

      defaultArray[index] = {
        totalShares: totalShares,
        class: shareClass,
        type: shareType,
      };
    }
    return defaultArray;
  }

  // Default: return empty array of 6 items
  return defaultArray;
};

/**
 * Get all persons for a client (optionally filtered by companyId)
 * GET /api/client/:clientId/person
 * GET /api/client/:clientId/company/:companyId/person (for backward compatibility)
 */
exports.getAllPersons = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const organizationId = req.user.organizationId;

    // Build query - persons are now decoupled, so we query by clientId
    let persons = [];

    // If companyId is provided, filter to only persons associated with that company
    if (companyId) {
      const company = await Company.findOne({
        _id: companyId,
        organizationId: organizationId,
      });
      if (company) {
        // Get person IDs from shareHolders and representationalSchema
        const personIdsInCompany = new Set();

        // Get person IDs from shareHolders
        company.shareHolders?.forEach((sh) => {
          if (sh.personId) personIdsInCompany.add(sh.personId.toString());
        });

        // Get person IDs from representationalSchema
        company.representationalSchema?.forEach((rs) => {
          if (rs.personId) personIdsInCompany.add(rs.personId.toString());
        });

        // Fetch only persons associated with this company
        if (personIdsInCompany.size > 0) {
          const personObjectIds = Array.from(personIdsInCompany).map(
            (id) => new mongoose.Types.ObjectId(id)
          );
          persons = await Person.find({
            organizationId: organizationId,
            _id: { $in: personObjectIds },
          }).sort({ createdAt: -1 });

          // Add relationship info to persons
          persons = persons.map((person) => {
            const personObj = person.toObject();
            const personIdStr = person._id.toString();

            // Find shareholding info
            const shareHolder = company.shareHolders?.find(
              (sh) => sh.personId?.toString() === personIdStr
            );

            // Find role info - role is now an array of strings
            const roleEntries =
              company.representationalSchema?.filter(
                (rs) => rs.personId?.toString() === personIdStr
              ) || [];

            // Flatten roles from all entries (should only be one entry per person now)
            const roles = roleEntries.reduce((acc, rs) => {
              const roleArray = Array.isArray(rs.role)
                ? rs.role
                : rs.role
                  ? [rs.role]
                  : [];
              return [...acc, ...roleArray];
            }, []);

            return {
              ...personObj,
              sharePercentage: shareHolder?.sharePercentage || 0,
              roles: roles,
            };
          });
        }
      }
    } else {
      // If no companyId, return all persons for the client
      persons = await Person.find({ organizationId }).sort({
        createdAt: -1,
      });
    }

    res.status(200).json({
      success: true,
      data: persons,
    });
  } catch (error) {
    console.error("Error fetching persons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch persons",
      error: error.message,
    });
  }
};

/**
 * Get a single person by ID
 * GET /api/client/:clientId/person/:personId
 * GET /api/client/:clientId/company/:companyId/person/:personId (for backward compatibility)
 */
exports.getPersonById = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;

    const person = await Person.findOne({
      _id: personId,
      organizationId: req.user.organizationId,
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    const personObj = person.toObject();

    // If companyId is provided, add relationship info
    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        const personIdStr = person._id.toString();

        // Find shareholding info
        const shareHolder = company.shareHolders?.find(
          (sh) => sh.personId?.toString() === personIdStr
        );

        // Find role info - role is now an array of strings
        const roleEntries =
          company.representationalSchema?.filter(
            (rs) => rs.personId?.toString() === personIdStr
          ) || [];

        // Flatten roles from all entries (should only be one entry per person now)
        const roles = roleEntries.reduce((acc, rs) => {
          const roleArray = Array.isArray(rs.role)
            ? rs.role
            : rs.role
              ? [rs.role]
              : [];
          return [...acc, ...roleArray];
        }, []);

        personObj.sharePercentage = shareHolder?.sharePercentage || 0;
        personObj.roles = roles;
      }
    }

    res.status(200).json({
      success: true,
      data: personObj,
    });
  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch person",
      error: error.message,
    });
  }
};

/**
 * Create a new person
 * POST /api/client/:clientId/person
 * POST /api/client/:clientId/company/:companyId/person (for backward compatibility)
 */
exports.createPerson = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const {
      name,
      address,
      email,
      phoneNumber,
      supportingDocuments,
      nationality,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Person name is required",
      });
    }

    if (!nationality) {
      return res.status(400).json({
        success: false,
        message: "Nationality is required",
      });
    }

    // Create person (decoupled from company)
    const person = new Person({
      clientId,
      name,
      address,
      email,
      phoneNumber,
      supportingDocuments: supportingDocuments || [],
      nationality,
      organizationId: req.user.organizationId,
    });

    await person.save();

    // If companyId is provided and roles/sharesData are in body,
    // update the company's shareHolders and representationalSchema
    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        const { roles, sharesData } = req.body;

        // Update representationalSchema if roles are provided
        if (roles && Array.isArray(roles) && roles.length > 0) {
          // Remove existing entries for this person
          company.representationalSchema =
            company.representationalSchema?.filter(
              (rs) => rs.personId?.toString() !== person._id.toString()
            ) || [];

          // Add single entry with array of roles
          company.representationalSchema.push({
            personId: person._id,
            role: roles, // Store as array of strings
          });
          company.updatedAt = new Date();
        }

        // Update shareHolders if sharesData is provided
        // Frontend sends sharesData as {totalShares, shareClass}[] - sharePercentage calculated from totalIssuedShares
        if (sharesData !== undefined && sharesData !== null) {
          // Remove existing shareholding for this person
          company.shareHolders =
            company.shareHolders?.filter(
              (sh) => sh.personId?.toString() !== person._id.toString()
            ) || [];

          // Convert sharesData to array format
          const totalIssuedShares = company.totalShares || 0;
          const sharesDataArray = convertSharesDataToArray(
            sharesData,
            totalIssuedShares
          );

          // Calculate sharePercentage: (sum of all sharesData.totalShares / company.totalShares) * 100
          const sharePercentage = calculateSharePercentage(
            sharesDataArray,
            totalIssuedShares
          );

          // Only add if there are actual shares (non-zero totalShares)
          // If sharesData is empty array or all zeros, person will be removed from shareHolders
          const hasShares = sharesDataArray.some(
            (item) => item.totalShares > 0
          );
          if (hasShares) {
            company.shareHolders.push({
              personId: person._id,
              sharePercentage: sharePercentage,
              sharesData: sharesDataArray,
            });
          }

          // Update company's updatedAt timestamp
          company.updatedAt = new Date();
        }

        // Save company if any changes were made
        if (
          (roles && Array.isArray(roles) && roles.length > 0) ||
          (sharesData !== undefined && sharesData !== null)
        ) {
          await company.save();

          // Update Person's company references
          if (roles && Array.isArray(roles) && roles.length > 0) {
            person.representingCompanies = person.representingCompanies || [];
            if (
              !person.representingCompanies.some(
                (id) => id.toString() === companyId.toString()
              )
            ) {
              person.representingCompanies.push(companyId);
              person.updatedAt = new Date();
              await person.save();
            }
          }

          if (sharesData !== undefined && sharesData !== null) {
            const totalIssuedShares = company.totalShares || 0;
            const sharesDataArray = convertSharesDataToArray(
              sharesData,
              totalIssuedShares
            );
            const hasShares = sharesDataArray.some(
              (item) => item.totalShares > 0
            );

            if (hasShares) {
              person.shareHoldingCompanies = person.shareHoldingCompanies || [];
              if (
                !person.shareHoldingCompanies.some(
                  (id) => id.toString() === companyId.toString()
                )
              ) {
                person.shareHoldingCompanies.push(companyId);
                person.updatedAt = new Date();
                await person.save();
              }
            } else {
              // Remove if no shares
              person.shareHoldingCompanies = (
                person.shareHoldingCompanies || []
              ).filter((id) => id.toString() !== companyId.toString());
              person.updatedAt = new Date();
              await person.save();
            }
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Person created successfully",
      data: person,
    });
  } catch (error) {
    console.error("Error creating person:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create person",
      error: error.message,
    });
  }
};

/**
 * Update a person
 * PUT /api/client/:clientId/person/:personId
 * PUT /api/client/:clientId/company/:companyId/person/:personId (for backward compatibility)
 */
exports.updatePerson = async (req, res) => {
  try {
    const { companyId, personId } = req.params;
    const updateData = { ...req.body };

    // Separate person fields from company relationship fields
    const { roles, sharesData, ...personFields } = updateData;

    // Remove fields that shouldn't be directly updated
    delete personFields.createdAt;
    personFields.updatedAt = new Date();

    // Update person
    const person = await Person.findOneAndUpdate(
      { _id: personId },
      { $set: personFields },
      { new: true, runValidators: true }
    );

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    // If companyId is provided, update company relationships
    // Frontend sends sharesData as {totalShares, shareClass}[] - percentage calculated from totalIssuedShares
    if (companyId && (roles !== undefined || sharesData !== undefined)) {
      const company = await Company.findById(companyId);
      if (company) {
        const personIdStr = person._id.toString();

        // Update representationalSchema if roles are provided
        if (roles !== undefined) {
          // Find existing entry to preserve companyId if it exists
          const existingEntry = company.representationalSchema?.find(
            (rs) => rs.personId?.toString() === personIdStr
          );
          const existingCompanyId = existingEntry?.companyId || null;

          // Remove existing entries for this person
          company.representationalSchema =
            company.representationalSchema?.filter(
              (rs) => rs.personId?.toString() !== personIdStr
            ) || [];

          // Add single entry with array of roles if roles array is provided
          if (Array.isArray(roles) && roles.length > 0) {
            const newEntry = {
              personId: person._id,
              role: roles, // Store as array of strings
            };
            // Preserve companyId if it existed
            if (existingCompanyId) {
              newEntry.companyId = existingCompanyId;
            }
            company.representationalSchema.push(newEntry);
          }
        }

        // Update shareHolders if sharesData is provided
        // Frontend sends sharesData as {totalShares, shareClass}[] - sharePercentage calculated from totalIssuedShares
        if (sharesData !== undefined) {
          // Remove existing shareholding for this person
          company.shareHolders =
            company.shareHolders?.filter(
              (sh) => sh.personId?.toString() !== personIdStr
            ) || [];

          // Convert sharesData to array format
          const totalIssuedShares = company.totalShares || 0;
          const sharesDataArray = convertSharesDataToArray(
            sharesData,
            totalIssuedShares
          );

          // Calculate sharePercentage: (sum of all sharesData.totalShares / company.totalShares) * 100
          const sharePercentage = calculateSharePercentage(
            sharesDataArray,
            totalIssuedShares
          );

          // Only add if there are actual shares (non-zero totalShares)
          // If sharesData is empty array or all zeros, person will be removed from shareHolders
          const hasShares = sharesDataArray.some(
            (item) => item.totalShares > 0
          );
          if (hasShares) {
            company.shareHolders.push({
              personId: person._id,
              sharePercentage: sharePercentage,
              sharesData: sharesDataArray,
            });
          }

          // Update company's updatedAt timestamp
          company.updatedAt = new Date();
        }

        // Save company if any changes were made
        if (roles !== undefined || sharesData !== undefined) {
          await company.save();

          // Update Person's company references
          if (roles !== undefined) {
            if (Array.isArray(roles) && roles.length > 0) {
              person.representingCompanies = person.representingCompanies || [];
              if (
                !person.representingCompanies.some(
                  (id) => id.toString() === companyId.toString()
                )
              ) {
                person.representingCompanies.push(companyId);
                person.updatedAt = new Date();
                await person.save();
              }
            } else {
              // Remove if no roles
              person.representingCompanies = (
                person.representingCompanies || []
              ).filter((id) => id.toString() !== companyId.toString());
              person.updatedAt = new Date();
              await person.save();
            }
          }

          if (sharesData !== undefined) {
            const totalIssuedShares = company.totalShares || 0;
            const sharesDataArray = convertSharesDataToArray(
              sharesData,
              totalIssuedShares
            );
            const hasShares = sharesDataArray.some(
              (item) => item.totalShares > 0
            );

            if (hasShares) {
              person.shareHoldingCompanies = person.shareHoldingCompanies || [];
              if (
                !person.shareHoldingCompanies.some(
                  (id) => id.toString() === companyId.toString()
                )
              ) {
                person.shareHoldingCompanies.push(companyId);
                person.updatedAt = new Date();
                await person.save();
              }
            } else {
              // Remove if no shares
              person.shareHoldingCompanies = (
                person.shareHoldingCompanies || []
              ).filter((id) => id.toString() !== companyId.toString());
              person.updatedAt = new Date();
              await person.save();
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: person,
    });
  } catch (error) {
    console.error("Error updating person:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update person",
      error: error.message,
    });
  }
};

/**
 * Delete a person
 * DELETE /api/client/:clientId/person/:personId
 * DELETE /api/client/:clientId/company/:companyId/person/:personId (for backward compatibility)
 */
exports.deletePerson = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;

    // Find person first (before deletion) to get company references
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

    // Remove person from all companies' shareHolders and representationalSchema
    if (companyId) {
      // Remove from specific company
      const company = await Company.findById(companyId);
      if (company) {
        company.shareHolders =
          company.shareHolders?.filter(
            (sh) => sh.personId?.toString() !== personId
          ) || [];
        company.representationalSchema =
          company.representationalSchema?.filter(
            (rs) => rs.personId?.toString() !== personId
          ) || [];
        await company.save();
      }
    } else {
      // Remove from all companies
      await Company.updateMany(
        {},
        {
          $pull: {
            shareHolders: { personId: personId },
            representationalSchema: { personId: personId },
          },
        }
      );
    }

    // Now delete the person (Person's arrays will be deleted with the document)
    await Person.findOneAndDelete({
      _id: personId,
      clientId,
    });

    await KnowYourClient.updateMany(
      { "documentRequests.person": person._id },
      { $pull: { documentRequests: { person: person._id } } }
    );

    res.status(200).json({
      success: true,
      message: "Person deleted successfully",
      data: person,
    });
  } catch (error) {
    console.error("Error deleting person:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete person",
      error: error.message,
    });
  }
};
