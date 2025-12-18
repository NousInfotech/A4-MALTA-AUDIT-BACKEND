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

    // ✅ CRITICAL: Find the evidence first to get linked workbooks before deletion
    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        error: "Evidence not found",
      });
    }

    // ✅ CRITICAL: Remove evidence ID from all workbook referenceFiles before deleting evidence
    // Find all workbooks that reference this evidence in their referenceFiles
    const workbooksWithEvidence = await Workbook.find({
      "referenceFiles.evidence": evidenceId
    });

    console.log('Backend: Deleting evidence, found workbooks with references:', {
      evidenceId,
      workbooksCount: workbooksWithEvidence.length,
      workbookIds: workbooksWithEvidence.map(wb => wb._id.toString())
    });

    // Update each workbook to remove the evidence ID from referenceFiles
    for (const workbook of workbooksWithEvidence) {
      if (!workbook.referenceFiles || !Array.isArray(workbook.referenceFiles)) {
        continue;
      }

      // Clean up old format entries first
      workbook.referenceFiles = workbook.referenceFiles.filter((ref) => {
        return ref && typeof ref === 'object' && ref.details && ref.details.sheet;
      });

      // Remove evidence ID from each reference file entry
      let hasChanges = false;
      workbook.referenceFiles = workbook.referenceFiles.map((ref) => {
        if (!ref.evidence || !Array.isArray(ref.evidence)) {
          return ref;
        }

        // Remove the evidence ID from this reference entry
        const originalLength = ref.evidence.length;
        ref.evidence = ref.evidence.filter(
          (evId) => evId.toString() !== evidenceId.toString()
        );

        if (ref.evidence.length !== originalLength) {
          hasChanges = true;
        }

        return ref;
      });

      // Remove reference file entries that have no evidence IDs left
      const originalRefFilesCount = workbook.referenceFiles.length;
      workbook.referenceFiles = workbook.referenceFiles.filter(
        (ref) => ref.evidence && ref.evidence.length > 0
      );

      if (workbook.referenceFiles.length !== originalRefFilesCount) {
        hasChanges = true;
      }

      // Save the workbook if there were changes
      if (hasChanges) {
        await workbook.save();
        console.log('Backend: Updated workbook after evidence deletion:', {
          workbookId: workbook._id.toString(),
          remainingReferenceFilesCount: workbook.referenceFiles.length
        });
      }
    }

    // ✅ Now delete the evidence
    await ClassificationEvidence.findByIdAndDelete(evidenceId);

    res.status(200).json({
      message: "Evidence deleted successfully",
      workbooksUpdated: workbooksWithEvidence.length,
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
    const { evidenceId, classificationId } = req.params;

    console.log('Backend: getEvidenceWithMappings called for identifiers:', {
      evidenceId,
      classificationId,
    });

    let filter = {};
    if (evidenceId) {
      filter = { _id: evidenceId };
    } else if (classificationId) {
      filter = { classificationId };
    }

    const evidenceQuery = ClassificationEvidence.find(filter)
      .populate({
        path: 'linkedWorkbooks',
        model: 'Workbook',
        select: 'name cloudFileId webUrl classification category',
      })
      .populate({
        path: 'mappings.workbookId',
        model: 'Workbook',
        select: 'name cloudFileId webUrl classification category',
      })
      .populate('classificationId', 'classification status')
      .sort({ createdAt: -1 });

    const evidence = await evidenceQuery.exec();

    console.log('Backend: Found', evidence.length, 'evidence files');

    res.status(200).json({
      success: true,
      message: 'Evidence retrieved successfully',
      evidence,
    });
  } catch (error) {
    console.error('Error getting evidence with mappings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get evidence',
    });
  }
};

// Link workbook to evidence
exports.linkWorkbookToEvidence = async (req, res) => {
  try {
    const { evidenceId, workbookId: workbookIdParam } = req.params;
    const workbookId = req.body?.workbookId || workbookIdParam;

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
    const alreadyLinked = evidence.linkedWorkbooks.some(
      (linkedId) => linkedId.toString() === workbookId.toString()
    );

    if (!alreadyLinked) {
      // Add workbook to evidence's linkedWorkbooks
      evidence.linkedWorkbooks.push(workbookId);
      await evidence.save();
    } else {
      console.log('Backend: Workbook already linked to evidence, returning existing state');
    }

    // Note: referenceFiles are now managed via mappings in addMappingToEvidence
    // This method just ensures the bidirectional link exists

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
      message: alreadyLinked
        ? "Workbook already linked to this evidence"
        : "Workbook linked successfully",
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

// Add reference file to workbook (without creating mapping)
// This is separate from mappings - reference files are just linked to cell ranges
exports.addReferenceFileToWorkbook = async (req, res) => {
  try {
    const { workbookId, evidenceId } = req.params;
    const { sheet, start, end, notes } = req.body; // Cell range details and notes

    console.log('Backend: Adding reference file to workbook:', {
      workbookId,
      evidenceId,
      sheet,
      start,
      end
    });

    if (!workbookId || !evidenceId) {
      return res.status(400).json({
        success: false,
        message: "workbookId and evidenceId are required"
      });
    }

    if (!sheet || !start || !start.row || start.col === undefined) {
      return res.status(400).json({
        success: false,
        message: "sheet, start.row, and start.col are required"
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

    // Verify evidence exists
    const evidence = await ClassificationEvidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found"
      });
    }

    // Initialize referenceFiles if needed
    if (!workbook.referenceFiles) {
      workbook.referenceFiles = [];
    }

    // Clean up old format entries
    workbook.referenceFiles = workbook.referenceFiles.filter((ref) => {
      return ref && typeof ref === 'object' && ref.details && ref.details.sheet;
    });

    // Normalize end coordinates
    const normalizedEnd = {
      row: end?.row ?? start.row,
      col: end?.col ?? start.col,
    };

    // Find existing reference file entry for this exact cell range
    let refFileEntry = workbook.referenceFiles.find((ref) => {
      if (!ref.details) return false;
      return (
        ref.details.sheet === sheet &&
        ref.details.start.row === start.row &&
        ref.details.start.col === start.col &&
        ref.details.end.row === normalizedEnd.row &&
        ref.details.end.col === normalizedEnd.col
      );
    });

    if (refFileEntry) {
      // Add evidence ID to existing entry if not already present
      if (!refFileEntry.evidence) {
        refFileEntry.evidence = [];
      }
      if (!refFileEntry.evidence.some(
        (evId) => evId.toString() === evidenceId.toString()
      )) {
        refFileEntry.evidence.push(evidenceId);
      }
    } else {
      // Create new reference file entry
      refFileEntry = {
        details: {
          sheet: sheet,
          start: {
            row: start.row,
            col: start.col,
          },
          end: {
            row: normalizedEnd.row,
            col: normalizedEnd.col,
          },
        },
        evidence: [evidenceId],
        notes: notes || undefined, // ✅ NEW: Include notes in reference file entry
      };
      workbook.referenceFiles.push(refFileEntry);
    }

    await workbook.save();

    // Also ensure workbook is in evidence's linkedWorkbooks (bidirectional relationship)
    if (!evidence.linkedWorkbooks.some(
      (linkedId) => linkedId.toString() === workbookId.toString()
    )) {
      evidence.linkedWorkbooks.push(workbookId);
      await evidence.save();
    }

    // Populate and return updated workbook
    const updatedWorkbook = await Workbook.findById(workbookId)
      .populate('referenceFiles.evidence', 'evidenceUrl uploadedBy createdAt');

    res.status(200).json({
      success: true,
      message: "Reference file added to workbook successfully",
      workbook: updatedWorkbook,
    });
  } catch (error) {
    console.error("Error adding reference file to workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add reference file",
    });
  }
};

// Unlink workbook from evidence
exports.unlinkWorkbookFromEvidence = async (req, res) => {
  try {
    const { evidenceId, workbookId } = req.params;

    // Remove evidence from workbook's referenceFiles (new schema with details)
    const workbook = await Workbook.findById(workbookId);
    if (workbook && workbook.referenceFiles) {
      // ✅ CRITICAL FIX: Clean up old format referenceFiles (ObjectIds) before processing
      // Filter out any entries that don't have the required details structure
      workbook.referenceFiles = workbook.referenceFiles.filter((ref) => {
        // Keep only entries that have the new schema structure (with details)
        return ref && typeof ref === 'object' && ref.details && ref.details.sheet;
      });

      // Remove evidence ID from all reference file entries
      workbook.referenceFiles = workbook.referenceFiles.map((ref) => {
        if (ref.evidence && Array.isArray(ref.evidence)) {
          ref.evidence = ref.evidence.filter(
            (evId) => evId.toString() !== evidenceId.toString()
          );
        }
        return ref;
      }).filter((ref) => {
        // Remove reference entries that have no evidence left
        return ref.evidence && ref.evidence.length > 0;
      });
      await workbook.save();
    }

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
    const { workbookId, color, details, referenceFiles, notes } = req.body; // ✅ NEW: Include notes

    console.log('Backend: Adding mapping to evidence:', { evidenceId, workbookId, color, details, referenceFilesCount: referenceFiles?.length || 0 });

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
      isActive: true,
      referenceFiles: referenceFiles && Array.isArray(referenceFiles) ? referenceFiles : [],
      notes: notes || undefined // ✅ NEW: Include notes in mapping
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

    // Ensure evidence is in workbook's referenceFiles using new ReferenceSchema
    // Find or create a reference file entry for this mapping's cell range
    if (!workbook.referenceFiles) {
      workbook.referenceFiles = [];
    }

    // ✅ CRITICAL FIX: Clean up old format referenceFiles (ObjectIds) before processing
    // Filter out any entries that don't have the required details structure
    workbook.referenceFiles = workbook.referenceFiles.filter((ref) => {
      // Keep only entries that have the new schema structure (with details)
      return ref && typeof ref === 'object' && ref.details && ref.details.sheet;
    });

    const mappingDetails = newMapping.details;
    const { sheet, start, end } = mappingDetails;

    // Normalize end coordinates (use start if end is missing)
    const normalizedEnd = {
      row: end?.row ?? start.row,
      col: end?.col ?? start.col,
    };

    // Find existing reference file entry for this exact cell range
    let refFileEntry = workbook.referenceFiles.find((ref) => {
      if (!ref.details) return false;
      return (
        ref.details.sheet === sheet &&
        ref.details.start.row === start.row &&
        ref.details.start.col === start.col &&
        ref.details.end.row === normalizedEnd.row &&
        ref.details.end.col === normalizedEnd.col
      );
    });

    if (refFileEntry) {
      // Add evidence ID to existing entry if not already present
      if (!refFileEntry.evidence) {
        refFileEntry.evidence = [];
      }
      if (!refFileEntry.evidence.some(
        (evId) => evId.toString() === evidenceId.toString()
      )) {
        refFileEntry.evidence.push(evidenceId);
      }
    } else {
      // Create new reference file entry with proper structure
      refFileEntry = {
        details: {
          sheet: sheet,
          start: {
            row: start.row,
            col: start.col,
          },
          end: {
            row: normalizedEnd.row,
            col: normalizedEnd.col,
          },
        },
        evidence: [evidenceId],
      };
      workbook.referenceFiles.push(refFileEntry);
    }

    await workbook.save();

    // Also ensure workbook is in evidence's linkedWorkbooks
    if (!evidence.linkedWorkbooks.some(
      (linkedId) => linkedId.toString() === workbookId.toString()
    )) {
      evidence.linkedWorkbooks.push(workbookId);
      await evidence.save();
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
    const updatedMapping = {
      ...evidence.mappings[mappingIndex].toObject(),
      ...updateData,
      _id: mappingId
    };
    
    // ✅ NEW: If notes is undefined or empty string, remove it from the mapping
    if (updateData.notes === undefined || updateData.notes === null || (typeof updateData.notes === 'string' && updateData.notes.trim() === '')) {
      delete updatedMapping.notes;
    }
    
    evidence.mappings[mappingIndex] = updatedMapping;
    
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

    // ✅ CRITICAL: Validate workbookId before using it
    if (!workbookId || workbookId === 'undefined' || workbookId === 'null') {
      console.error('❌ Invalid workbookId in getMappingsByWorkbook:', workbookId);
      return res.status(400).json({
        success: false,
        error: 'Invalid workbookId provided'
      });
    }

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
        mapping.workbookId &&
        mapping.workbookId._id &&
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

// Get evidence files for specific cell ranges in a workbook
exports.getEvidenceByCellRange = async (req, res) => {
  try {
    const { workbookId } = req.params;
    const { sheet, startRow, startCol, endRow, endCol } = req.query;

    if (!workbookId || !sheet || startRow === undefined || startCol === undefined || endRow === undefined || endCol === undefined) {
      return res.status(400).json({
        success: false,
        error: "workbookId, sheet, startRow, startCol, endRow, and endCol are required"
      });
    }

    const startRowNum = parseInt(startRow);
    const startColNum = parseInt(startCol);
    const endRowNum = parseInt(endRow);
    const endColNum = parseInt(endCol);

    // Find all evidence files that have mappings to this workbook
    const evidenceList = await ClassificationEvidence.find({
      "mappings.workbookId": workbookId
    })
    .populate({
      path: "mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .populate('classificationId', 'classification status')
    .lean();

    // Filter evidence files where mappings overlap with the requested cell range
    const matchingEvidence = [];
    
    evidenceList.forEach(evidence => {
      const relevantMappings = evidence.mappings.filter(mapping => {
        // Check if mapping is for the same workbook and sheet
        if (!mapping.workbookId || 
            mapping.workbookId._id.toString() !== workbookId ||
            !mapping.details ||
            mapping.details.sheet !== sheet) {
          return false;
        }

        // Check if mapping overlaps with requested range
        const mappingStartRow = mapping.details.start.row;
        const mappingEndRow = mapping.details.end.row;
        const mappingStartCol = mapping.details.start.col;
        const mappingEndCol = mapping.details.end.col;

        // Check for overlap
        const rowOverlap = !(mappingEndRow < startRowNum || mappingStartRow > endRowNum);
        const colOverlap = !(mappingEndCol < startColNum || mappingStartCol > endColNum);

        return rowOverlap && colOverlap && mapping.isActive !== false;
      });

      if (relevantMappings.length > 0) {
        matchingEvidence.push({
          _id: evidence._id,
          evidenceUrl: evidence.evidenceUrl,
          uploadedBy: evidence.uploadedBy,
          createdAt: evidence.createdAt,
          updatedAt: evidence.updatedAt,
          mappings: relevantMappings
        });
      }
    });

    res.status(200).json({
      success: true,
      data: matchingEvidence
    });
  } catch (error) {
    console.error("Error fetching evidence by cell range:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch evidence",
    });
  }
};