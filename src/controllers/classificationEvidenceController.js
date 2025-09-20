const ClassificationEvidence = require("../models/ClassificationEvidence");
const ClassificationSection = require("../models/ClassificationSection");
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
