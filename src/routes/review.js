const router = require('express').Router();
const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Submit item for review
router.post('/submit/:itemType/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.submitForReview
);

// Assign reviewer to item
router.post('/assign/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.assignReviewer
);

// Perform review (approve/reject)
router.post('/perform/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.performReview
);

// Sign off on item (final approval)
router.post('/signoff/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.signOff
);

// Reopen item for changes
router.post('/reopen/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.reopenItem
);

// Get review queue
router.get('/queue', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getReviewQueue
);

// Get review history for an item
router.get('/history/:itemId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getReviewHistory
);

// Get review statistics
router.get('/stats', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getReviewStats
);

// Get all review workflows for a specific engagement
router.get('/workflows/engagement/:engagementId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getReviewsWorkflowsForEngagement
);

// Get all review workflows across all engagements
router.get('/workflows', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getAllReviewWorkFlows
);

// Get all review history entries
router.get('/history', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getAllReviews
);

// Get all review history for a specific engagement
router.get('/engagement/:engagementId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.getReviewsForEngagement
);

// Update a review workflow (only by owner)
router.put('/workflows/:workflowId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.updateReviewWorkflow
);

// Delete a review workflow (only by owner)
router.delete('/workflows/:workflowId', 
  requireAuth, 
  requireRole(['employee', 'reviewer', 'partner', 'admin']), 
  reviewController.deleteReviewWorkflow
);

module.exports = router;
