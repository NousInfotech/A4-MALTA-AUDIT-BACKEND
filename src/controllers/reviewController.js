const ReviewWorkflow = require('../models/ReviewWorkflow');
const ReviewHistory = require('../models/ReviewHistory');
const { Log, Action } = require('../models/EmployeeLog');
const { supabase } = require('../config/supabase');

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
    const validItemTypes = ['procedure', 'planning-procedure', 'document-request', 'checklist-item', 'pbc', 'kyc', 'isqm-document', 'working-paper'];
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
