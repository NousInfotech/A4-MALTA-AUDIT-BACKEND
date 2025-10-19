const router = require('express').Router();
const analyticalReviewController = require('../controllers/analyticalReviewController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * Module-Based Analytical Review Routes
 * Prefix: /api/analytical-review
 */

// Get all analytical reviews (admin/dashboard view)
router.get(
  '/',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.getAllAnalyticalReviews
);

// Get analytical review by ID
router.get(
  '/:id',
  requireAuth,
  analyticalReviewController.getAnalyticalReviewById
);

// Update analytical review by ID
router.put(
  '/:id',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.updateAnalyticalReview
);

// Delete analytical review by ID
router.delete(
  '/:id',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.deleteAnalyticalReview
);

// Get analytical review by engagement ID
router.get(
  '/engagement/:engagementId',
  requireAuth,
  analyticalReviewController.getAnalyticalReviewByEngagement
);

// Get reviews by auditor
router.get(
  '/auditor/:auditorId',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.getReviewsByAuditor
);

// Get reviews by client
router.get(
  '/client/:clientId',
  requireAuth,
  analyticalReviewController.getReviewsByClient
);

// Version management routes

// Get all versions of a review
router.get(
  '/:id/versions',
  requireAuth,
  analyticalReviewController.getVersions
);

// Get specific version by number
router.get(
  '/:id/versions/:versionNumber',
  requireAuth,
  analyticalReviewController.getVersionByNumber
);

// Restore to a specific version
router.post(
  '/:id/versions/:versionNumber/restore',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.restoreVersion
);

// Workflow routes

// Submit for review
router.post(
  '/:id/submit',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.submitForReview
);

// Approve review
router.post(
  '/:id/approve',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.approveReview
);

// Reject review
router.post(
  '/:id/reject',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.rejectReview
);

// Update status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(['employee', 'admin']),
  analyticalReviewController.updateStatus
);

module.exports = router;

