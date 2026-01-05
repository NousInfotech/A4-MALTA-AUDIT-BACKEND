const ReviewWorkflow = require('../models/ReviewWorkflow');
const ReviewHistory = require('../models/ReviewHistory');
const { Log, Action } = require('../models/EmployeeLog');
const { supabase } = require('../config/supabase');
const NotificationService = require('../services/notification.service');

// Helper function to get user info from Supabase
async function getUserInfo(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, email, role')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      return { name: 'Unknown User', email: 'unknown@example.com', role: 'unknown' };
    }
    
    return {
      name: profile.name || 'Unknown User',
      email: profile.email || 'unknown@example.com',
      role: profile.role || 'unknown'
    };
  } catch (err) {
    console.error('Error getting user info:', err);
    return { name: 'Unknown User', email: 'unknown@example.com', role: 'unknown' };
  }
}

// Helper function to log employee activity
async function logEmployeeActivity(userId, action, details, req = null) {
  try {
    const userInfo = await getUserInfo(userId);
    
    await Log.create({
      employeeId: userId,
      employeeName: userInfo.name,
      employeeEmail: userInfo.email,
      action: action,
      details: details,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      location: req?.headers?.['x-forwarded-for'] || 'Unknown',
      deviceInfo: req?.headers?.['user-agent'] || 'Unknown',
      status: 'SUCCESS',
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log employee activity:', err);
  }
}

// Helper function to create review history entry
async function createReviewHistory(data) {
  try {
    await ReviewHistory.createEntry({
      itemType: data.itemType,
      itemId: data.itemId,
      engagement: data.engagement,
      action: data.action,
      performedBy: data.performedBy,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      comments: data.comments,
      metadata: data.metadata || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      location: data.location,
      sessionId: data.sessionId
    });
  } catch (err) {
    console.error('Failed to create review history:', err);
  }
}

// Helper function to get or create review workflow
async function getOrCreateReviewWorkflow(itemType, itemId, engagementId) {
  let workflow = await ReviewWorkflow.findOne({ itemType, itemId });
  
  if (!workflow) {
    workflow = await ReviewWorkflow.create({
      itemType,
      itemId,
      engagement: engagementId,
      status: 'in-progress'
    });
  }
  
  return workflow;
}

// Submit item for review
exports.submitForReview = async (req, res, next) => {
  try {
    const { itemType, itemId } = req.params;
    const { engagementId, comments } = req.body;
    const userId = req.user.id;

    // Validate item type
    const validItemTypes = ['procedure', 'planning-procedure', 'document-request', 'checklist-item', 'pbc', 'kyc', 'isqm-document', 'working-paper', 'classification-section', 'library-document'];
    if (!validItemTypes.includes(itemType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid item type' 
      });
    }

    // Get or create review workflow
    const workflow = await getOrCreateReviewWorkflow(itemType, itemId, engagementId);

    // Check if already submitted for review
    if (workflow.status === 'ready-for-review' || workflow.status === 'under-review') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is already submitted for review' 
      });
    }

    // Check if signed off and locked
    if (workflow.isLocked) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is signed off and locked. Cannot submit for review.' 
      });
    }

    // Update workflow
    const previousStatus = workflow.status;
    workflow.status = 'ready-for-review';
    workflow.submittedForReviewAt = new Date();
    workflow.submittedBy = userId;
    await workflow.save();

    // Create review history
    await createReviewHistory({
      itemType,
      itemId,
      engagement: engagementId,
      action: 'submitted-for-review',
      performedBy: userId,
      previousStatus,
      newStatus: 'ready-for-review',
      comments,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      location: req.headers['x-forwarded-for']
    });

    // Log employee activity
    await logEmployeeActivity(userId, Action.SUBMIT_FOR_REVIEW, `Submitted ${itemType} for review`, req);

    // Send notification to reviewers/managers
    try {
      const { data: managers } = await supabase
        .from('profiles')
        .select('user_id')
        .in('role', ['manager', 'partner', 'reviewer']);
      
      if (managers && managers.length > 0) {
        const managerIds = managers.map(m => m.user_id);
        await NotificationService.send({
          userId: managerIds,
          title: 'New Item for Review',
          message: `A ${itemType.replace('-', ' ')} has been submitted for review`,
          type: 'document',
          category: 'review-submitted',
          module: 'document',
          priority: 'normal',
          data: {
            itemType,
            itemId,
            engagementId,
            workflowId: workflow._id.toString()
          },
          actionUrl: `/review/queue`,
          documentId: itemType === 'library-document' ? itemId : undefined
        });
      }
    } catch (notifErr) {
      console.error('Failed to send notification:', notifErr);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: 'Item submitted for review successfully',
      workflow
    });

  } catch (err) {
    console.error('Error submitting for review:', err);
    next(err);
  }
};

// Assign reviewer to item
exports.assignReviewer = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { reviewerId, comments } = req.body;
    const userId = req.user.id;

    // All authenticated users can assign reviewers for now
    const workflow = await ReviewWorkflow.findById(itemId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check if item is ready for review
    if (workflow.status !== 'ready-for-review') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is not ready for review' 
      });
    }

    // Update workflow
    const previousStatus = workflow.status;
    workflow.assignedReviewer = reviewerId;
    workflow.assignedAt = new Date();
    workflow.status = 'under-review';
    await workflow.save();

    // Create review history
    await createReviewHistory({
      itemType: workflow.itemType,
      itemId: workflow.itemId,
      engagement: workflow.engagement,
      action: 'assigned-reviewer',
      performedBy: userId,
      previousStatus,
      newStatus: 'under-review',
      comments,
      metadata: { assignedReviewer: reviewerId }
    });

    // Log employee activity
    await logEmployeeActivity(userId, Action.ASSIGN_REVIEWER, `Assigned reviewer to ${workflow.itemType}`, req);

    // Send notification to assigned reviewer
    try {
      await NotificationService.send({
        userId: reviewerId,
        title: 'Review Assignment',
        message: `You have been assigned to review a ${workflow.itemType.replace('-', ' ')}`,
        type: 'document',
        category: 'review-assigned',
        module: 'document',
        priority: 'high',
        data: {
          itemType: workflow.itemType,
          itemId: workflow.itemId.toString(),
          engagementId: workflow.engagement.toString(),
          workflowId: workflow._id.toString()
        },
        actionUrl: `/review/${workflow._id}`,
        documentId: workflow.itemType === 'library-document' ? workflow.itemId.toString() : undefined
      });
    } catch (notifErr) {
      console.error('Failed to send notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Reviewer assigned successfully',
      workflow
    });

  } catch (err) {
    console.error('Error assigning reviewer:', err);
    next(err);
  }
};

// Perform review (approve/reject)
exports.performReview = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { approved, comments } = req.body;
    const userId = req.user.id;

    // All authenticated users can perform reviews for now
    const workflow = await ReviewWorkflow.findById(itemId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check if item is under review
    if (workflow.status !== 'under-review') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is not under review' 
      });
    }

    // Update workflow
    const previousStatus = workflow.status;
    const newStatus = approved ? 'approved' : 'rejected';
    workflow.status = newStatus;
    workflow.reviewedAt = new Date();
    workflow.reviewedBy = userId;
    workflow.reviewComments = comments;
    await workflow.save();

    // Create review history
    await createReviewHistory({
      itemType: workflow.itemType,
      itemId: workflow.itemId,
      engagement: workflow.engagement,
      action: approved ? 'review-approved' : 'review-rejected',
      performedBy: userId,
      previousStatus,
      newStatus,
      comments,
      metadata: { approved }
    });

    // Log employee activity
    const action = approved ? Action.REVIEW_APPROVED : Action.REVIEW_REJECTED;
    await logEmployeeActivity(userId, action, `${approved ? 'Approved' : 'Rejected'} ${workflow.itemType}`, req);

    // Send notification to submitter
    try {
      if (workflow.submittedBy) {
        await NotificationService.send({
          userId: workflow.submittedBy,
          title: approved ? 'Review Approved' : 'Review Rejected',
          message: approved 
            ? `Your ${workflow.itemType.replace('-', ' ')} has been approved`
            : `Your ${workflow.itemType.replace('-', ' ')} needs changes`,
          type: 'document',
          category: approved ? 'review-approved' : 'review-rejected',
          module: 'document',
          priority: approved ? 'normal' : 'high',
          data: {
            itemType: workflow.itemType,
            itemId: workflow.itemId.toString(),
            engagementId: workflow.engagement.toString(),
            workflowId: workflow._id.toString(),
            comments
          },
          actionUrl: workflow.itemType === 'library-document' 
            ? `/library?reviewId=${workflow._id}`
            : `/review/${workflow._id}`,
          documentId: workflow.itemType === 'library-document' ? workflow.itemId.toString() : undefined
        });
      }
    } catch (notifErr) {
      console.error('Failed to send notification:', notifErr);
    }

    res.json({
      success: true,
      message: `Item ${approved ? 'approved' : 'rejected'} successfully`,
      workflow
    });

  } catch (err) {
    console.error('Error performing review:', err);
    next(err);
  }
};

// Sign off on item (final approval)
exports.signOff = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // All authenticated users can sign off for now
    const workflow = await ReviewWorkflow.findById(itemId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check if item is approved
    if (workflow.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item must be approved before sign-off' 
      });
    }

    // Update workflow
    const previousStatus = workflow.status;
    workflow.status = 'signed-off';
    workflow.signedOffAt = new Date();
    workflow.signedOffBy = userId;
    workflow.signOffComments = comments;
    workflow.isLocked = true;
    workflow.lockedAt = new Date();
    workflow.lockedBy = userId;
    await workflow.save();

    // Create review history
    await createReviewHistory({
      itemType: workflow.itemType,
      itemId: workflow.itemId,
      engagement: workflow.engagement,
      action: 'signed-off',
      performedBy: userId,
      previousStatus,
      newStatus: 'signed-off',
      comments,
      metadata: { isLocked: true }
    });

    // Log employee activity
    await logEmployeeActivity(userId, Action.SIGN_OFF, `Signed off on ${workflow.itemType}`, req);

    res.json({
      success: true,
      message: 'Item signed off successfully',
      workflow
    });

  } catch (err) {
    console.error('Error signing off:', err);
    next(err);
  }
};

// Reopen item for changes
exports.reopenItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // All authenticated users can reopen items for now
    const workflow = await ReviewWorkflow.findById(itemId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check if item is signed off
    if (workflow.status !== 'signed-off') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only signed-off items can be reopened' 
      });
    }

    // Update workflow
    const previousStatus = workflow.status;
    workflow.status = 're-opened';
    workflow.reopenedAt = new Date();
    workflow.reopenedBy = userId;
    workflow.reopenReason = reason;
    workflow.isLocked = false;
    workflow.lockedAt = undefined;
    workflow.lockedBy = undefined;
    workflow.version += 1;
    workflow.previousVersion = workflow.version - 1;
    await workflow.save();

    // Create review history
    await createReviewHistory({
      itemType: workflow.itemType,
      itemId: workflow.itemId,
      engagement: workflow.engagement,
      action: 'reopened',
      performedBy: userId,
      previousStatus,
      newStatus: 're-opened',
      comments: reason,
      metadata: { reopenReason: reason, newVersion: workflow.version }
    });

    // Log employee activity
    await logEmployeeActivity(userId, Action.REOPEN_ITEM, `Reopened ${workflow.itemType} for changes`, req);

    res.json({
      success: true,
      message: 'Item reopened successfully',
      workflow
    });

  } catch (err) {
    console.error('Error reopening item:', err);
    next(err);
  }
};

// Get review queue
exports.getReviewQueue = async (req, res, next) => {
  try {
    const { reviewerId, status } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = {};
    
    // If specific reviewer requested, check permissions
    if (reviewerId) {
      if (reviewerId !== userId && !['partner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions to view other reviewers\' queues' 
        });
      }
      filter.assignedReviewer = reviewerId;
    } else if (['reviewer', 'partner', 'admin'].includes(req.user.role)) {
      // If user is a reviewer, show their assigned items
      filter.assignedReviewer = userId;
    }

    // Filter by status if provided
    if (status) {
      filter.status = status;
    } else {
      // Default to items needing review
      filter.status = { $in: ['ready-for-review', 'under-review'] };
    }

    const workflows = await ReviewWorkflow.find(filter)
      .sort({ priority: -1, dueDate: 1, createdAt: 1 })
      .populate('engagement', 'title yearEndDate clientId');

    res.json({
      success: true,
      workflows,
      count: workflows.length
    });

  } catch (err) {
    console.error('Error getting review queue:', err);
    next(err);
  }
};

// Get review history for an item
exports.getReviewHistory = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { limit = 50 } = req.query;

    const workflow = await ReviewWorkflow.findById(itemId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    const history = await ReviewHistory.find({
      itemType: workflow.itemType,
      itemId: workflow.itemId
    })
    .sort({ performedAt: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      history,
      count: history.length
    });

  } catch (err) {
    console.error('Error getting review history:', err);
    next(err);
  }
};

// Get review statistics
exports.getReviewStats = async (req, res, next) => {
  try {
    const { engagementId } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = {};
    if (engagementId) filter.engagement = engagementId;

    // All authenticated users can view stats for now
    const stats = await ReviewWorkflow.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalItems = await ReviewWorkflow.countDocuments(filter);
    const signedOffItems = await ReviewWorkflow.countDocuments({ ...filter, status: 'signed-off' });
    const pendingReview = await ReviewWorkflow.countDocuments({ 
      ...filter, 
      status: { $in: ['ready-for-review', 'under-review'] } 
    });

    res.json({
      success: true,
      stats: {
        totalItems,
        signedOffItems,
        pendingReview,
        statusBreakdown: stats
      }
    });

  } catch (err) {
    console.error('Error getting review stats:', err);
    next(err);
  }
};

// Get all review workflows for a specific engagement
exports.getReviewsWorkflowsForEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;
    const { status, limit = 100, page = 1 } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = { engagement: engagementId };
    if (status) filter.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get workflows with pagination
    const workflows = await ReviewWorkflow.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('engagement', 'title yearEndDate clientId');

    // Get total count for pagination
    const totalCount = await ReviewWorkflow.countDocuments(filter);

    res.json({
      success: true,
      workflows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + workflows.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error('Error getting review workflows for engagement:', err);
    next(err);
  }
};

// Get all review workflows across all engagements
exports.getAllReviewWorkFlows = async (req, res, next) => {
  try {
    const { status, engagementId, reviewerId, limit = 100, page = 1 } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (engagementId) filter.engagement = engagementId;
    if (reviewerId) filter.assignedReviewer = reviewerId;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get workflows with pagination
    const workflows = await ReviewWorkflow.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('engagement', 'title yearEndDate clientId');

    // Get total count for pagination
    const totalCount = await ReviewWorkflow.countDocuments(filter);

    res.json({
      success: true,
      workflows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + workflows.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error('Error getting all review workflows:', err);
    next(err);
  }
};

// Get all review history entries
exports.getAllReviews = async (req, res, next) => {
  try {
    const { action, engagementId, performedBy, limit = 100, page = 1 } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = {};
    if (action) filter.action = action;
    if (engagementId) filter.engagement = engagementId;
    if (performedBy) filter.performedBy = performedBy;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get review history with pagination
    const reviews = await ReviewHistory.find(filter)
      .sort({ performedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('engagement', 'title yearEndDate clientId');

    // Get total count for pagination
    const totalCount = await ReviewHistory.countDocuments(filter);

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reviews.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error('Error getting all reviews:', err);
    next(err);
  }
};

// Get all review history for a specific engagement
exports.getReviewsForEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;
    const { action, performedBy, limit = 100, page = 1 } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = { engagement: engagementId };
    if (action) filter.action = action;
    if (performedBy) filter.performedBy = performedBy;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get review history with pagination
    const reviews = await ReviewHistory.find(filter)
      .sort({ performedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('engagement', 'title yearEndDate clientId');

    // Get total count for pagination
    const totalCount = await ReviewHistory.countDocuments(filter);

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + reviews.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error('Error getting reviews for engagement:', err);
    next(err);
  }
};

// Update a review workflow (only by the user who created it)
exports.updateReviewWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const workflow = await ReviewWorkflow.findById(workflowId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check ownership - user must be the one who performed the action
    const isOwner = 
      workflow.reviewedBy === userId ||
      workflow.approvedBy === userId ||
      workflow.signedOffBy === userId ||
      workflow.reopenedBy === userId ||
      workflow.assignedReviewer === userId;

    if (!isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only update your own reviews' 
      });
    }

    // Only allow updating certain fields
    const allowedFields = ['status', 'reviewComments', 'signOffComments', 'reopenReason'];
    const updateFields = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    // Always set reviewedBy to current user when updating (the user who made the update)
    updateFields.reviewedBy = userId;
    updateFields.assignedReviewer = userId;

    // Set status-specific fields based on new status
    const newStatus = updateData.status || workflow.status;
    if (newStatus === 'approved') {
      updateFields.approvedBy = userId;
      updateFields.approvedAt = new Date();
    } else if (newStatus === 'signed-off') {
      updateFields.signedOffBy = userId;
      updateFields.signedOffAt = new Date();
      updateFields.isLocked = true;
      updateFields.lockedAt = new Date();
      updateFields.lockedBy = userId;
    } else if (newStatus === 're-opened') {
      updateFields.reopenedBy = userId;
      updateFields.reopenedAt = new Date();
      updateFields.isLocked = false;
    } else if (newStatus === 'in-progress' || newStatus === 'ready-for-review' || newStatus === 'under-review' || newStatus === 'rejected') {
      updateFields.reviewedAt = new Date();
    }

    const updatedWorkflow = await ReviewWorkflow.findByIdAndUpdate(
      workflowId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      workflow: updatedWorkflow
    });
  } catch (err) {
    console.error('Error updating review workflow:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Delete a review workflow (only by the user who created it)
exports.deleteReviewWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.user.id;

    const workflow = await ReviewWorkflow.findById(workflowId);
    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review workflow not found' 
      });
    }

    // Check ownership - user must be the one who performed the action
    const isOwner = 
      workflow.reviewedBy === userId ||
      workflow.approvedBy === userId ||
      workflow.signedOffBy === userId ||
      workflow.reopenedBy === userId ||
      workflow.assignedReviewer === userId;

    if (!isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own reviews' 
      });
    }

    await ReviewWorkflow.findByIdAndDelete(workflowId);

    res.json({
      success: true,
      message: 'Review workflow deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting review workflow:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};