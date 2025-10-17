const AnalyticalReview = require('../models/AnalyticalReview');
const Engagement = require('../models/Engagement');
const mongoose = require('mongoose');

/**
 * Create Analytical Review for an engagement
 */
exports.createAnalyticalReview = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const { ratios, commentary, conclusions, keyFindings, riskAssessment } = req.body;
    const userId = req.user.id;

    // Validate engagement exists
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: 'Engagement not found' });
    }

    // Check if analytical review already exists for this engagement
    const existing = await AnalyticalReview.findOne({ engagement: engagementId });
    if (existing) {
      return res.status(400).json({ 
        message: 'Analytical review already exists for this engagement',
        analyticalReviewId: existing._id
      });
    }

    // Create analytical review
    const analyticalReview = new AnalyticalReview({
      engagement: engagementId,
      auditorId: userId,
      clientId: engagement.clientId,
      ratios: ratios || {},
      commentary: commentary || '',
      conclusions: conclusions || '',
      keyFindings: keyFindings || [],
      riskAssessment: riskAssessment || '',
      status: 'draft',
      lastEditedBy: userId,
      lastEditedAt: new Date()
    });

    await analyticalReview.save();

    res.status(201).json({
      message: 'Analytical review created successfully',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error creating analytical review:', error);
    res.status(500).json({ 
      message: 'Error creating analytical review', 
      error: error.message 
    });
  }
};

/**
 * Get analytical review by engagement ID
 */
exports.getAnalyticalReviewByEngagement = async (req, res) => {
  try {
    const { engagementId } = req.params;

    const analyticalReview = await AnalyticalReview.findOne({ engagement: engagementId })
      .populate('engagement', 'title clientId status yearEndDate');

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found for this engagement' });
    }

    res.status(200).json({
      message: 'Analytical review retrieved successfully',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error fetching analytical review:', error);
    res.status(500).json({ 
      message: 'Error fetching analytical review', 
      error: error.message 
    });
  }
};

/**
 * Get analytical review by ID
 */
exports.getAnalyticalReviewById = async (req, res) => {
  try {
    const { id } = req.params;

    const analyticalReview = await AnalyticalReview.findById(id)
      .populate('engagement', 'title clientId status yearEndDate');

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    res.status(200).json({
      message: 'Analytical review retrieved successfully',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error fetching analytical review:', error);
    res.status(500).json({ 
      message: 'Error fetching analytical review', 
      error: error.message 
    });
  }
};

/**
 * Update analytical review (auto-creates version before updating)
 */
exports.updateAnalyticalReview = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const { ratios, commentary, conclusions, keyFindings, riskAssessment, changeNote } = req.body;
    const userId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    // Check if user has permission (auditor only)
    if (analyticalReview.auditorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to edit this review' });
    }

    // Create version snapshot before updating
    analyticalReview.createVersion(userId, changeNote || 'Updated analytical review', ipAddress);

    // Update fields
    if (ratios !== undefined) analyticalReview.ratios = ratios;
    if (commentary !== undefined) analyticalReview.commentary = commentary;
    if (conclusions !== undefined) analyticalReview.conclusions = conclusions;
    if (keyFindings !== undefined) analyticalReview.keyFindings = keyFindings;
    if (riskAssessment !== undefined) analyticalReview.riskAssessment = riskAssessment;

    analyticalReview.lastEditedBy = userId;
    analyticalReview.lastEditedAt = new Date();

    await analyticalReview.save();

    res.status(200).json({
      message: 'Analytical review updated successfully',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error updating analytical review:', error);
    res.status(500).json({ 
      message: 'Error updating analytical review', 
      error: error.message 
    });
  }
};

/**
 * Delete analytical review
 */
exports.deleteAnalyticalReview = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const userId = req.user.id;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    // Check permissions
    if (analyticalReview.auditorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to delete this review' });
    }

    await AnalyticalReview.findByIdAndDelete(analyticalReview._id);

    res.status(200).json({
      message: 'Analytical review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting analytical review:', error);
    res.status(500).json({ 
      message: 'Error deleting analytical review', 
      error: error.message 
    });
  }
};

/**
 * Get all versions of an analytical review
 */
exports.getVersions = async (req, res) => {
  try {
    const { engagementId, id } = req.params;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    res.status(200).json({
      message: 'Versions retrieved successfully',
      data: {
        currentVersion: analyticalReview.currentVersion,
        totalVersions: analyticalReview.versions.length,
        versions: analyticalReview.versions.sort((a, b) => b.versionNumber - a.versionNumber)
      }
    });

  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ 
      message: 'Error fetching versions', 
      error: error.message 
    });
  }
};

/**
 * Get specific version by number
 */
exports.getVersionByNumber = async (req, res) => {
  try {
    const { engagementId, id, versionNumber } = req.params;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    const version = analyticalReview.getVersion(parseInt(versionNumber));
    
    if (!version) {
      return res.status(404).json({ message: `Version ${versionNumber} not found` });
    }

    res.status(200).json({
      message: 'Version retrieved successfully',
      data: version
    });

  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ 
      message: 'Error fetching version', 
      error: error.message 
    });
  }
};

/**
 * Restore to a specific version
 */
exports.restoreVersion = async (req, res) => {
  try {
    const { engagementId, id, versionNumber } = req.params;
    const { changeNote } = req.body;
    const userId = req.user.id;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    // Check permissions
    if (analyticalReview.auditorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to restore this review' });
    }

    analyticalReview.restoreVersion(parseInt(versionNumber), userId, changeNote);
    await analyticalReview.save();

    res.status(200).json({
      message: `Successfully restored to version ${versionNumber}`,
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ 
      message: 'Error restoring version', 
      error: error.message 
    });
  }
};

/**
 * Submit analytical review for review
 */
exports.submitForReview = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const userId = req.user.id;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    // Check permissions
    if (analyticalReview.auditorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to submit this review' });
    }

    await analyticalReview.submitForReview(userId);

    res.status(200).json({
      message: 'Analytical review submitted for review',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ 
      message: 'Error submitting review', 
      error: error.message 
    });
  }
};

/**
 * Approve analytical review
 */
exports.approveReview = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    await analyticalReview.approve(userId, comments);

    res.status(200).json({
      message: 'Analytical review approved',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ 
      message: 'Error approving review', 
      error: error.message 
    });
  }
};

/**
 * Reject analytical review
 */
exports.rejectReview = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    await analyticalReview.reject(userId, comments);

    res.status(200).json({
      message: 'Analytical review rejected',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({ 
      message: 'Error rejecting review', 
      error: error.message 
    });
  }
};

/**
 * Get all analytical reviews (for dashboard/admin)
 */
exports.getAllAnalyticalReviews = async (req, res) => {
  try {
    const { status, auditorId, clientId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (auditorId) filter.auditorId = auditorId;
    if (clientId) filter.clientId = clientId;

    const analyticalReviews = await AnalyticalReview.find(filter)
      .populate('engagement', 'title clientId status yearEndDate')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      message: 'Analytical reviews retrieved successfully',
      count: analyticalReviews.length,
      data: analyticalReviews
    });

  } catch (error) {
    console.error('Error fetching analytical reviews:', error);
    res.status(500).json({ 
      message: 'Error fetching analytical reviews', 
      error: error.message 
    });
  }
};

/**
 * Get analytical reviews by auditor
 */
exports.getReviewsByAuditor = async (req, res) => {
  try {
    const { auditorId } = req.params;
    const { status } = req.query;

    const analyticalReviews = await AnalyticalReview.getByAuditor(auditorId, status)
      .populate('engagement', 'title clientId status yearEndDate');

    res.status(200).json({
      message: 'Analytical reviews retrieved successfully',
      count: analyticalReviews.length,
      data: analyticalReviews
    });

  } catch (error) {
    console.error('Error fetching reviews by auditor:', error);
    res.status(500).json({ 
      message: 'Error fetching reviews', 
      error: error.message 
    });
  }
};

/**
 * Get analytical reviews by client
 */
exports.getReviewsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const analyticalReviews = await AnalyticalReview.getByClient(clientId)
      .populate('engagement', 'title clientId status yearEndDate');

    res.status(200).json({
      message: 'Analytical reviews retrieved successfully',
      count: analyticalReviews.length,
      data: analyticalReviews
    });

  } catch (error) {
    console.error('Error fetching reviews by client:', error);
    res.status(500).json({ 
      message: 'Error fetching reviews', 
      error: error.message 
    });
  }
};

/**
 * Update analytical review status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { engagementId, id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ['draft', 'in-progress', 'submitted', 'reviewed', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Find by engagement or by ID
    const query = engagementId ? { engagement: engagementId } : { _id: id };
    const analyticalReview = await AnalyticalReview.findOne(query);

    if (!analyticalReview) {
      return res.status(404).json({ message: 'Analytical review not found' });
    }

    // Check permissions
    if (analyticalReview.auditorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to update status' });
    }

    analyticalReview.status = status;
    await analyticalReview.save();

    res.status(200).json({
      message: 'Status updated successfully',
      data: analyticalReview
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      message: 'Error updating status', 
      error: error.message 
    });
  }
};

