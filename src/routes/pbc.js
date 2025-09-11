const router = require('express').Router();
const pbcController = require('../controllers/pbcController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * PBC Workflow Routes
 */

// Create PBC workflow
router.post(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can create PBC workflows
  pbcController.createPBC
);

// Get PBC by engagement ID
router.get(
  '/engagement/:engagementId',
  requireAuth,
  pbcController.getPBCByEngagement
);

// Update PBC workflow
router.patch(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can update PBC workflows
  pbcController.updatePBC
);

// Delete PBC workflow
router.delete(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can delete PBC workflows
  pbcController.deletePBC
);

// Get all PBC workflows (for dashboard)
router.get(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can view all PBCs
  pbcController.getAllPBCs
);

/**
 * QnA Category Routes
 */

// Create QnA category
router.post(
  '/categories',
  requireAuth,
  requireRole('employee'), // Only auditors can create categories
  pbcController.createCategory
);

router.post(
  '/:pbcId/generate-qna-ai',
  requireAuth,
  requireRole('employee'),
  pbcController.generateQnAUsingAI
);

// Get categories by PBC ID
router.get(
  '/categories/pbc/:pbcId',
  requireAuth,
  pbcController.getCategoriesByPBC
);

// Add question to category
router.post(
  '/categories/:categoryId/questions',
  requireAuth,
  requireRole('employee'), // Only auditors can add questions
  pbcController.addQuestionToCategory
);

// Update question status
router.patch(
  '/categories/:categoryId/questions/:questionIndex',
  requireAuth,
  pbcController.updateQuestionStatus
);

// Add discussion to question (for doubt resolution)
router.post(
  '/categories/:categoryId/questions/:questionIndex/discussions',
  requireAuth,
  pbcController.addDiscussion
);

// Delete category
router.delete(
  '/categories/:categoryId',
  requireAuth,
  requireRole('employee'), // Only auditors can delete categories
  pbcController.deleteCategory
);

/**
 * PBC Document Request Routes
 */

// Create PBC document request
router.post(
  '/document-requests',
  requireAuth,
  pbcController.createPBCDocumentRequest
);

// Get PBC document requests by engagement
router.get(
  '/document-requests/engagement/:engagementId',
  requireAuth,
  pbcController.getPBCDocumentRequests
);

// Update PBC document request
router.patch(
  '/document-requests/:requestId',
  requireAuth,
  pbcController.updatePBCDocumentRequest
);

// Delete PBC document request
router.delete(
  '/document-requests/:requestId',
  requireAuth,
  requireRole('employee'), // Only auditors can delete requests
  pbcController.deletePBCDocumentRequest
);

// Bulk upload documents to PBC document request
router.post(
  '/document-requests/:requestId/documents',
  requireAuth,
  require('multer')().array('files'),
  pbcController.uploadPBCDocuments
);

// Upload single document to PBC document request
router.post(
  '/document-requests/:requestId/document',
  requireAuth,
  require('multer')().single('file'),
  pbcController.uploadSinglePBCDocument
);

// Update individual PBC document status
router.patch(
  '/document-requests/:requestId/documents/:documentIndex/status',
  requireAuth,
  requireRole('employee'), // Only auditors can change document status
  pbcController.updatePBCDocumentStatus
);

// Bulk update PBC document statuses
router.patch(
  '/document-requests/:requestId/documents/bulk-status',
  requireAuth,
  requireRole('employee'), // Only auditors can bulk update statuses
  pbcController.bulkUpdatePBCDocumentStatuses
);

// Get PBC document request statistics
router.get(
  '/document-requests/engagement/:engagementId/stats',
  requireAuth,
  pbcController.getPBCDocumentRequestStats
);

module.exports = router;
