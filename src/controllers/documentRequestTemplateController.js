const DocumentRequestTemplate = require("../models/DocumentRequestTemplate");

// Single CRUD

// CREATE SINGLE
exports.createSingle = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      category: "kyc",
      organizationId: req.user.organizationId
    };

    const newTemplate = await DocumentRequestTemplate.create(payload);

    return res.status(201).json({
      success: true,
      data: newTemplate
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// READ SINGLE
exports.getSingle = async (req, res) => {
  try {
    const { _id } = req.body;

    const template = await DocumentRequestTemplate.findById(_id);

    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: "Document not found"
    });
  }
};

// UPDATE SINGLE
exports.updateSingle = async (req, res) => {
  try {
    const { _id, ...rest } = req.body;

    const updated = await DocumentRequestTemplate.findByIdAndUpdate(
      _id,
      {
        ...rest,
        category: "kyc"
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE SINGLE (soft delete)
exports.deleteSingle = async (req, res) => {
  try {
    const { _id } = req.body;

    const deleted = await DocumentRequestTemplate.findByIdAndUpdate(
      _id,
      { isActive: false },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Template deactivated",
      data: deleted
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

 
// Bulk CRUD

// GET ALL (bulk read)
exports.getAllBulk = async (req, res) => {
  try {
    const filters = {};

    // Optional filters (if you want later)
    // if (req.query.isActive) {
    //   filters.isActive = req.query.isActive === "true";
    // }
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.organizationId) {
      filters.organizationId = req.query.organizationId;
    }

    const templates = await DocumentRequestTemplate.find(filters);

    return res.status(200).json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// BULK CREATE
exports.bulkCreate = async (req, res) => {
  try {
    const payload = req.body.map((item) => ({
      ...item,
      category: "kyc",
      organizationId: req.user.organizationId
    }));

    const created = await DocumentRequestTemplate.insertMany(payload);

    return res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// BULK UPDATE
exports.bulkUpdate = async (req, res) => {
  try {
    const updates = req.body;

    const results = await Promise.all(
      updates.map((item) =>
        DocumentRequestTemplate.findByIdAndUpdate(
          item._id,
          {
            ...item,
            category: "kyc"
          },
          { new: true }
        )
      )
    );

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// BULK DELETE (soft delete)
exports.bulkDelete = async (req, res) => {
  try {
    const ids = req.body; // array of _id

    const result = await DocumentRequestTemplate.deleteMany(
      { _id: { $in: ids } },
    );

    return res.status(200).json({
      success: true,
      message: "Bulk templates deactivated",
      modified: result.modifiedCount
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
