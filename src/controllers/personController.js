const mongoose = require("mongoose");
const Person = require("../models/Person");
const Company = require("../models/Company");
const DocumentRequest = require("../models/DocumentRequest");
const KnowYourClient = require("../models/KnowYourClient");

/**
 * Get all persons for a client (optionally filtered by companyId)
 * GET /api/client/:clientId/person
 * GET /api/client/:clientId/company/:companyId/person (for backward compatibility)
 */
exports.getAllPersons = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;

    // Build query - persons are now decoupled, so we query by clientId
    let persons = [];
    
    // If companyId is provided, filter to only persons associated with that company
    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        // Get person IDs from shareHolders and representationalSchema
        const personIdsInCompany = new Set();
        
        // Get person IDs from shareHolders
        company.shareHolders?.forEach(sh => {
          if (sh.personId) personIdsInCompany.add(sh.personId.toString());
        });
        
        // Get person IDs from representationalSchema
        company.representationalSchema?.forEach(rs => {
          if (rs.personId) personIdsInCompany.add(rs.personId.toString());
        });

        // Fetch only persons associated with this company
        if (personIdsInCompany.size > 0) {
          const personObjectIds = Array.from(personIdsInCompany).map(id => new mongoose.Types.ObjectId(id));
          persons = await Person.find({
            clientId,
            _id: { $in: personObjectIds }
          }).sort({ createdAt: -1 });

          // Add relationship info to persons
          persons = persons.map(person => {
            const personObj = person.toObject();
            const personIdStr = person._id.toString();
            
            // Find shareholding info
            const shareHolder = company.shareHolders?.find(
              sh => sh.personId?.toString() === personIdStr
            );
            
            // Find role info - role is now an array of strings
            const roleEntries = company.representationalSchema
              ?.filter(rs => rs.personId?.toString() === personIdStr) || [];
            
            // Flatten roles from all entries (should only be one entry per person now)
            const roles = roleEntries.reduce((acc, rs) => {
              const roleArray = Array.isArray(rs.role) ? rs.role : (rs.role ? [rs.role] : []);
              return [...acc, ...roleArray];
            }, []);
            
            return {
              ...personObj,
              sharePercentage: shareHolder?.sharesData?.percentage,
              roles: roles,
            };
          });
        }
      }
    } else {
      // If no companyId, return all persons for the client
      persons = await Person.find({ clientId }).sort({ createdAt: -1 });
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
      clientId,
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
          sh => sh.personId?.toString() === personIdStr
        );
        
        // Find role info - role is now an array of strings
        const roleEntries = company.representationalSchema
          ?.filter(rs => rs.personId?.toString() === personIdStr) || [];
        
        // Flatten roles from all entries (should only be one entry per person now)
        const roles = roleEntries.reduce((acc, rs) => {
          const roleArray = Array.isArray(rs.role) ? rs.role : (rs.role ? [rs.role] : []);
          return [...acc, ...roleArray];
        }, []);
        
        personObj.sharePercentage = shareHolder?.sharesData?.percentage;
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
    });

    await person.save();

    // If companyId is provided and roles/sharePercentage are in body,
    // update the company's shareHolders and representationalSchema
    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        const { roles, sharePercentage, shareClass } = req.body;

        // Update representationalSchema if roles are provided
        if (roles && Array.isArray(roles) && roles.length > 0) {
          // Remove existing entries for this person
          company.representationalSchema = company.representationalSchema?.filter(
            rs => rs.personId?.toString() !== person._id.toString()
          ) || [];
          
          // Add single entry with array of roles
          company.representationalSchema.push({
            personId: person._id,
            role: roles, // Store as array of strings
          });
        }

        // Update shareHolders if sharePercentage is provided
        if (sharePercentage !== undefined && sharePercentage !== null && sharePercentage > 0) {
          // Remove existing shareholding for this person
          company.shareHolders = company.shareHolders?.filter(
            sh => sh.personId?.toString() !== person._id.toString()
          ) || [];
          
          // Calculate actual number of shares based on percentage
          const companyTotalShares = company.totalShares || 0;
          const actualShares = (sharePercentage / 100) * companyTotalShares;
          
            
          // Add new shareholding
          company.shareHolders.push({
            personId: person._id,
            sharesData: {
              percentage: sharePercentage,
              totalShares: Math.round(actualShares), // Round to nearest whole number
              class: shareClass || "A",
            },
          });
        }

        await company.save();
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
    const { clientId, companyId, personId, } = req.params;
    const updateData = { ...req.body };

    // Separate person fields from company relationship fields
    const { roles, sharePercentage, shareClass, ...personFields } = updateData;

    // Remove fields that shouldn't be directly updated
    delete personFields.clientId;
    delete personFields.createdAt;
    personFields.updatedAt = new Date();

    // Update person
    const person = await Person.findOneAndUpdate(
      { _id: personId, clientId },
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
    if (companyId && (roles !== undefined || sharePercentage !== undefined)) {
      const company = await Company.findById(companyId);
      if (company) {
        const personIdStr = person._id.toString();

        // Update representationalSchema if roles are provided
        if (roles !== undefined) {
          // Find existing entry to preserve companyId if it exists
          const existingEntry = company.representationalSchema?.find(
            rs => rs.personId?.toString() === personIdStr
          );
          const existingCompanyId = existingEntry?.companyId || null;
          
          // Remove existing entries for this person
          company.representationalSchema = company.representationalSchema?.filter(
            rs => rs.personId?.toString() !== personIdStr
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

        // Update shareHolders if sharePercentage is provided
        if (sharePercentage !== undefined) {
          // Remove existing shareholding for this person
          company.shareHolders = company.shareHolders?.filter(
            sh => sh.personId?.toString() !== personIdStr
          ) || [];
          
          // Add new shareholding if sharePercentage > 0
          if (sharePercentage !== null && sharePercentage > 0) {
            // Calculate actual number of shares based on percentage
            const companyTotalShares = company.totalShares || 0;
            const actualShares = (sharePercentage / 100) * companyTotalShares;
            
             company.shareHolders.push({
              personId: person._id,
              sharesData: {
                percentage: sharePercentage,
                totalShares: Math.round(actualShares), // Round to nearest whole number
                class: shareClass || "A",
              },
            });
          }
        }

        await company.save();
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

    const person = await Person.findOneAndDelete({
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
        company.shareHolders = company.shareHolders?.filter(
          sh => sh.personId?.toString() !== personId
        ) || [];
        company.representationalSchema = company.representationalSchema?.filter(
          rs => rs.personId?.toString() !== personId
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

