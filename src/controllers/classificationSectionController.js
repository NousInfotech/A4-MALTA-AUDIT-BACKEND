const ClassificationSection = require("../models/ClassificationSection");
const { supabase } = require("../config/supabase");

// Get all classification sections for an engagement
exports.getAllClassificationSections = async (req, res) => {
  try {
    const { engagementId, classification } = req.query;

    let query = {};
    if (engagementId) {
      query.engagement = engagementId;
    }
    if (classification) {
      query.classification = classification;
    }

    const classificationSections = await ClassificationSection.find(query)
      .populate('engagement', 'title entityName industry size yearEnd')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Classification sections retrieved successfully",
      classificationSections: classificationSections,
    });
  } catch (error) {
    console.error("Error getting classification sections:", error);
    res.status(500).json({
      error: error.message || "Failed to get classification sections",
    });
  }
};

// Get a specific classification section by ID
exports.getClassificationSectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const classificationSection = await ClassificationSection.findById(id)
      .populate('engagement', 'title entityName industry size yearEnd');

    if (!classificationSection) {
      return res.status(404).json({
        error: "Classification section not found",
      });
    }

    res.status(200).json({
      message: "Classification section retrieved successfully",
      classificationSection: classificationSection,
    });
  } catch (error) {
    console.error("Error getting classification section:", error);
    res.status(500).json({
      error: error.message || "Failed to get classification section",
    });
  }
};

// Create a new classification section
exports.createClassificationSection = async (req, res) => {
  try {
    const { engagementId, classification, status = 'in-progress' } = req.body;

    // Check if classification section already exists for this engagement
    const existingSection = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: classification
    });

    if (existingSection) {
      return res.status(200).json({
        message: "Classification section already exists",
        classificationSection: existingSection,
      });
    }

    const classificationSection = new ClassificationSection({
      engagement: engagementId,
      classification: classification,
      status: status,
    });

    await classificationSection.save();

    res.status(201).json({
      message: "Classification section created successfully",
      classificationSection: classificationSection,
    });
  } catch (error) {
    console.error("Error creating classification section:", error);
    res.status(500).json({
      error: error.message || "Failed to create classification section",
    });
  }
};

// Update a classification section
exports.updateClassificationSection = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const classificationSection = await ClassificationSection.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('engagement', 'title entityName industry size yearEnd');

    if (!classificationSection) {
      return res.status(404).json({
        error: "Classification section not found",
      });
    }

    res.status(200).json({
      message: "Classification section updated successfully",
      classificationSection: classificationSection,
    });
  } catch (error) {
    console.error("Error updating classification section:", error);
    res.status(500).json({
      error: error.message || "Failed to update classification section",
    });
  }
};

// Delete a classification section
exports.deleteClassificationSection = async (req, res) => {
  try {
    const { id } = req.params;

    const classificationSection = await ClassificationSection.findByIdAndDelete(id);

    if (!classificationSection) {
      return res.status(404).json({
        error: "Classification section not found",
      });
    }

    res.status(200).json({
      message: "Classification section deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting classification section:", error);
    res.status(500).json({
      error: error.message || "Failed to delete classification section",
    });
  }
};
