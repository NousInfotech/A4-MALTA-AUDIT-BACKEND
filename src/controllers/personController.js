const Person = require("../models/Person");
const Company = require("../models/Company");

/**
 * Get all persons for a company
 * GET /api/client/:clientId/company/:companyId/person
 */
exports.getAllPersons = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;

    const persons = await Person.find({
      companyId,
      clientId,
    })
      .populate("companyDetails")
      .sort({ createdAt: -1 });

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
 * GET /api/client/:clientId/company/:companyId/person/:personId
 */
exports.getPersonById = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;

    const person = await Person.findOne({
      _id: personId,
      companyId,
      clientId,
    }).populate("companyDetails");

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    res.status(200).json({
      success: true,
      data: person,
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
 * POST /api/client/:clientId/company/:companyId/person
 */
exports.createPerson = async (req, res) => {
  try {
    const { clientId, companyId } = req.params;
    const {
      name,
      address,
      roles,
      email,
      phoneNumber,
      sharePercentage,
      supportingDocuments,
      nationality,
      createdBy,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Person name is required",
      });
    }

    // Validate that company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const person = new Person({
      clientId,
      companyId,
      name,
      address,
      roles: roles || [],
      email,
      phoneNumber,
      sharePercentage: sharePercentage || 0,
      supportingDocuments: supportingDocuments || [],
      nationality,
      createdBy: createdBy || req.user?.id || "system",
    });

    await person.save();

    // Add person to company's persons array
    if (!company.persons.includes(person._id)) {
      company.persons.push(person._id);
      await company.save();
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
 * PUT /api/client/:clientId/company/:companyId/person/:personId
 */
exports.updatePerson = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be directly updated
    delete updateData.clientId;
    delete updateData.companyId;
    delete updateData.createdBy;
    delete updateData.createdAt;
    updateData.updatedAt = new Date();

    const person = await Person.findOneAndUpdate(
      { _id: personId, companyId, clientId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("companyDetails");

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
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
 * DELETE /api/client/:clientId/company/:companyId/person/:personId
 */
exports.deletePerson = async (req, res) => {
  try {
    const { clientId, companyId, personId } = req.params;

    const person = await Person.findOneAndDelete({
      _id: personId,
      companyId,
      clientId,
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: "Person not found",
      });
    }

    // Remove person from company's persons array
    const company = await Company.findById(companyId);
    if (company) {
      company.persons = company.persons.filter(
        (p) => p.toString() !== personId
      );
      await company.save();
    }

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

