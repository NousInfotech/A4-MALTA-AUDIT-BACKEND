const ClassificationEvidence = require("../models/ClassificationEvidence");
const ClassificationSection = require("../models/ClassificationSection");
const { Workbook } = require("../models/ExcelWorkbook");
const { supabase } = require("../config/supabase");

// Get user profile from Supabase
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      throw new Error('Profile not found');
    }
    
    return profile;
  } catch (error) {
    throw new Error('Failed to fetch user profile');
  }
}

// Create a new classification evidence
exports.createEvidence = async (req, res) => {
  try {
    const { engagementId, classificationId, evidenceUrl } = req.body;
    const userId = req.user.id;

    // Get user profile details
    const userProfile = await getUserProfile(userId);

    const evidence = new ClassificationEvidence({
      engagementId,
      classificationId,
      uploadedBy: {
        userId: userId,
        name: userProfile.name,
        email: req.user.email || '', // You might need to get email from auth
        role: userProfile.role,
      },
      evidenceUrl,
      evidenceComments: [],
    });

    await evidence.save();

    res.status(201).json({
      message: "Evidence created successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error creating evidence:", error);
    res.status(500).json({
      error: error.message || "Failed to create evidence",
    });
  }
};

// Get all evidence for a classification
exports.getEvidenceByClassification = async (req, res) => {
  try {
    const { classificationId } = req.params;

    const evidence = await ClassificationEvidence.find({ classificationId })
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Evidence retrieved successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error getting evidence:", error);
    res.status(500).json({
      error: error.message || "Failed to get evidence",
    });
  }
};

// Add comment to evidence
exports.addEvidenceComment = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    // Get user profile details
    const userProfile = await getUserProfile(userId);

    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        error: "Evidence not found",
      });
    }

    const newComment = {
      commentor: {
        userId: userId,
        name: userProfile.name,
        email: req.user.email || '',
      },
      comment: comment,
      timestamp: new Date(),
    };

    evidence.evidenceComments.push(newComment);
    await evidence.save();

    res.status(200).json({
      message: "Comment added successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      error: error.message || "Failed to add comment",
    });
  }
};

// Get all evidence
exports.getAllEvidence = async (req, res) => {
  try {
    const { engagementId, classificationId } = req.query;
    
    let filter = {};
    if (engagementId) filter.engagementId = engagementId;
    if (classificationId) filter.classificationId = classificationId;

    const evidence = await ClassificationEvidence.find(filter)
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Evidence retrieved successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error getting all evidence:", error);
    res.status(500).json({
      error: error.message || "Failed to get evidence",
    });
  }
};

// Update evidence URL
exports.updateEvidenceUrl = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { evidenceUrl } = req.body;

    const evidence = await ClassificationEvidence.findByIdAndUpdate(
      evidenceId,
      { evidenceUrl: evidenceUrl },
      { new: true }
    );

    if (!evidence) {
      return res.status(404).json({
        error: "Evidence not found",
      });
    }

    res.status(200).json({
      message: "Evidence URL updated successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error updating evidence URL:", error);
    res.status(500).json({
      error: error.message || "Failed to update evidence URL",
    });
  }
};

// Delete evidence
exports.deleteEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await ClassificationEvidence.findByIdAndDelete(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        error: "Evidence not found",
      });
    }

    res.status(200).json({
      message: "Evidence deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting evidence:", error);
    res.status(500).json({
      error: error.message || "Failed to delete evidence",
    });
  }
};

// ==================== NEW: Workbook & Mapping Methods ====================

// Get evidence with linked workbooks and mappings
exports.getEvidenceWithMappings = async (req, res) => {
  try {
    const { classificationId } = req.params;

    console.log('Backend: getEvidenceWithMappings called for classificationId:', classificationId);

    const evidence = await ClassificationEvidence.find({ classificationId })
      .populate({
        path: "linkedWorkbooks",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate({
        path: "mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    console.log('Backend: Found', evidence.length, 'evidence files');

    res.status(200).json({
      success: true,
      message: "Evidence retrieved successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error getting evidence with mappings:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get evidence",
    });
  }
};

// Link workbook to evidence
exports.linkWorkbookToEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { workbookId } = req.body;

    console.log('Backend: Linking workbook to evidence:', { evidenceId, workbookId });

    if (!workbookId) {
      return res.status(400).json({
        success: false,
        message: "workbookId is required"
      });
    }

    // Verify workbook exists
    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res.status(404).json({
        success: false,
        message: "Workbook not found"
      });
    }

    // Find evidence and add workbook if not already linked
    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    // Check if already linked
    if (evidence.linkedWorkbooks.includes(workbookId)) {
      return res.status(400).json({
        success: false,
        message: "Workbook is already linked to this evidence"
      });
    }

    evidence.linkedWorkbooks.push(workbookId);
    await evidence.save();

    // Populate and return
    const populatedEvidence = await ClassificationEvidence.findById(evidenceId)
      .populate({
        path: "linkedWorkbooks",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate({
        path: "mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      });

    res.status(200).json({
      success: true,
      message: "Workbook linked successfully",
      evidence: populatedEvidence,
    });
  } catch (error) {
    console.error("Error linking workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to link workbook",
    });
  }
};

// Unlink workbook from evidence
exports.unlinkWorkbookFromEvidence = async (req, res) => {
  try {
    const { evidenceId, workbookId } = req.params;

    const evidence = await ClassificationEvidence.findByIdAndUpdate(
      evidenceId,
      { $pull: { linkedWorkbooks: workbookId } },
      { new: true }
    )
    .populate({
      path: "linkedWorkbooks",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate({
      path: "mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Workbook unlinked successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error unlinking workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to unlink workbook",
    });
  }
};

// Add mapping to evidence
exports.addMappingToEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { workbookId, color, details } = req.body;

    console.log('Backend: Adding mapping to evidence:', { evidenceId, workbookId, color, details });

    if (!workbookId || !color || !details) {
      return res.status(400).json({
        success: false,
        message: "workbookId, color, and details are required"
      });
    }

    // Verify workbook exists
    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res.status(404).json({
        success: false,
        message: "Workbook not found"
      });
    }

    const newMapping = {
      workbookId,
      color,
      details,
      isActive: true
    };

    const evidence = await ClassificationEvidence.findByIdAndUpdate(
      evidenceId,
      { 
        $push: { mappings: newMapping },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    )
    .populate({
      path: "linkedWorkbooks",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate({
      path: "mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping added successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error adding mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add mapping",
    });
  }
};

// Update mapping in evidence
exports.updateEvidenceMapping = async (req, res) => {
  try {
    const { evidenceId, mappingId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.workbookId;

    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    // Find and update the mapping
    const mappingIndex = evidence.mappings.findIndex(m => m._id.toString() === mappingId);
    
    if (mappingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Mapping not found"
      });
    }

    // Update the mapping
    evidence.mappings[mappingIndex] = {
      ...evidence.mappings[mappingIndex].toObject(),
      ...updateData,
      _id: mappingId
    };
    
    evidence.updatedAt = new Date();
    await evidence.save();

    // Populate and return
    const populatedEvidence = await ClassificationEvidence.findById(evidenceId)
      .populate({
        path: "linkedWorkbooks",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate({
        path: "mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      });

    res.status(200).json({
      success: true,
      message: "Mapping updated successfully",
      evidence: populatedEvidence,
    });
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update mapping",
    });
  }
};

// Remove mapping from evidence
exports.removeMappingFromEvidence = async (req, res) => {
  try {
    const { evidenceId, mappingId } = req.params;

    const evidence = await ClassificationEvidence.findByIdAndUpdate(
      evidenceId,
      { 
        $pull: { mappings: { _id: mappingId } },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    )
    .populate({
      path: "linkedWorkbooks",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate({
      path: "mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping removed successfully",
      evidence: evidence,
    });
  } catch (error) {
    console.error("Error removing mapping:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to remove mapping",
    });
  }
};

// Toggle mapping active status in evidence
exports.toggleEvidenceMappingStatus = async (req, res) => {
  try {
    const { evidenceId, mappingId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value"
      });
    }

    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    // Find and update the mapping
    const mapping = evidence.mappings.find(m => m._id.toString() === mappingId);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: "Mapping not found"
      });
    }

    mapping.isActive = isActive;
    evidence.updatedAt = new Date();
    await evidence.save();

    // Populate and return
    const populatedEvidence = await ClassificationEvidence.findById(evidenceId)
      .populate({
        path: "linkedWorkbooks",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate({
        path: "mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      });

    res.status(200).json({
      success: true,
      message: `Mapping ${isActive ? 'activated' : 'deactivated'} successfully`,
      evidence: populatedEvidence,
    });
  } catch (error) {
    console.error("Error toggling mapping status:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to toggle mapping status",
    });
  }
};

// Get all mappings for a specific workbook across all evidence
exports.getMappingsByWorkbook = async (req, res) => {
  try {
    const { workbookId } = req.params;

    const evidenceList = await ClassificationEvidence.find({
      $or: [
        { linkedWorkbooks: workbookId },
        { "mappings.workbookId": workbookId }
      ]
    })
    .populate({
      path: "linkedWorkbooks",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate({
      path: "mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate('classificationId', 'classification status')
    .lean();

    // Filter and format mappings for the specific workbook
    const workbookMappings = [];
    evidenceList.forEach(evidence => {
      const relevantMappings = evidence.mappings.filter(mapping => 
        mapping.workbookId._id.toString() === workbookId
      );
      relevantMappings.forEach(mapping => {
        workbookMappings.push({
          evidenceId: evidence._id,
          evidenceUrl: evidence.evidenceUrl,
          engagementId: evidence.engagementId,
          classificationId: evidence.classificationId,
          mapping: mapping
        });
      });
    });

    res.status(200).json({
      success: true,
      data: workbookMappings
    });
  } catch (error) {
    console.error("Error fetching mappings by workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch mappings",
    });
  }
};
