const router = require('express').Router();
const kycController = require('../controllers/kycController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * KYC Workflow Routes
 */

// Create KYC workflow
router.post(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can create KYC workflows
  kycController.createKYC
);

// Get KYC by engagement ID
router.get(
  '/engagement/:engagementId',
  requireAuth,
  kycController.getKYCByEngagement
);

// Get KYC by company ID
router.get(
  '/company/:companyId',
  requireAuth,
  kycController.getKYCByCompany
);

// Get KYC by ID
router.get(
  '/:id',
  requireAuth,
  kycController.getKYCById
);

// Update KYC workflow
router.patch(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can update KYC workflows
  kycController.updateKYC
);

// Delete KYC workflow
router.delete(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can delete KYC workflows
  kycController.deleteKYC
);

// Get all KYC workflows (for dashboard)
router.get(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can view all KYCs
  kycController.getAllKYCs
);

/**
 * KYC Discussion Routes
 */

// Add discussion to KYC
router.post(
  '/:id/discussions',
  requireAuth,
  kycController.addDiscussion
);

// Update discussion
router.patch(
  '/:id/discussions/:discussionId',
  requireAuth,
  kycController.updateDiscussion
);

// Delete discussion
router.delete(
  '/:id/discussions/:discussionId',
  requireAuth,
  kycController.deleteDiscussion
);

// Get discussions for a specific document
router.get(
  '/discussions/document/:documentRequestId/:documentIndex',
  requireAuth,
  kycController.getDiscussionsByDocument
);

// Update KYC status
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('employee'), // Only auditors can update KYC status
  kycController.updateKYCStatus
);

// Add DocumentRequest to KYC
router.post(
  '/:id/document-requests',
  requireAuth,
  requireRole('employee'), // Only auditors can add document requests
  kycController.addDocumentRequestToKYC
);

// Get all discussions for a KYC
router.get(
  '/:id/discussions',
  requireAuth,
  kycController.getAllDiscussions
);

// Get client's own KYCs
router.get(
  '/my',
  requireAuth,
  requireRole('client'), // Only clients can access their own KYCs
  kycController.getMyKYCs
);

module.exports = router;
