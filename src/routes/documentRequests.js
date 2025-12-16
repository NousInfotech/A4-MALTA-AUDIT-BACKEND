const router = require('express').Router();
const drc = require('../controllers/documentRequestController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const upload  = require('../middlewares/upload');
const { downloadLimiter } = require('../middlewares/rateLimiter');

router.post(
  '/',
  requireAuth,
  requireRole('employee'),
  drc.createRequest
);

router.get(
  '/engagement/:engagementId',
  requireAuth,
  drc.getRequestsByEngagement
);

router.get(
  '/company/:companyId',
  requireAuth,
  drc.getRequestsByCompany
);

// Download all documents
router.get(
  '/download-all',
  requireAuth,
  downloadLimiter,
  drc.downloadAllDocuments
);

// Delete entire document request
router.delete(
  '/:id',
  requireAuth,
  drc.deleteRequest
);

router.patch(
  '/:id',
  requireAuth,
  drc.updateRequest
);

// Add documents to existing document request
router.post(
  '/:id/documents/add',
  requireAuth,
  requireRole('employee'),
  drc.addDocumentsToRequest
);

// Bulk upload documents
router.post(
  '/:id/documents',
  requireAuth,
  upload.array('files'),    
  drc.uploadDocuments
);

// Upload single document
router.post(
  '/:id/document',
  requireAuth,
  upload.single('file'),
  drc.uploadSingleDocument
);

router.post(
  "/clear/:requestId/:docIndex",
  requireAuth,
  drc.clearSingleDocument
);


// Update individual document status
router.patch(
  '/:id/documents/:documentIndex/status',
  requireAuth,
  requireRole('employee'), // Only auditors can change document status
  drc.updateDocumentStatus
);

// Bulk update document statuses
router.patch(
  '/:id/documents/bulk-status',
  requireAuth,
  requireRole('employee'), // Only auditors can bulk update statuses
  drc.bulkUpdateDocumentStatuses
);

// Get document request statistics
router.get(
  '/engagement/:engagementId/stats',
  requireAuth,
  drc.getDocumentRequestStats
);

// Upload template file
router.post(
  '/template/upload',
  requireAuth,
  requireRole('employee'),
  upload.single('file'),
  drc.uploadTemplate
);

// Download template file
router.get(
  '/template/download',
  requireAuth,
  drc.downloadTemplate
);

// Delete a document from document request
router.delete(
  '/:id/documents/:documentIndex',
  requireAuth,
  drc.deleteDocument
);

// Clear a multiple document item (clear file only)
router.post(
  '/:id/multiple/:multipleDocumentId/items/:itemIndex/clear',
  requireAuth,
  drc.clearMultipleDocumentItem
);

// Delete a specific item from a multiple document group
router.delete(
  '/:id/multiple/:multipleDocumentId/items/:itemIndex',
  requireAuth,
  drc.deleteMultipleDocumentItem
);

// Upload files to multiple document items
router.post(
  '/:id/multiple/:multipleDocumentId/upload',
  requireAuth,
  upload.array('files'),
  drc.uploadMultipleDocuments
);

// Delete entire multiple document group
router.delete(
  '/:id/multiple/:multipleDocumentId',
  requireAuth,
  drc.deleteMultipleDocumentGroup
);

// Clear all files in a multiple document group
router.post(
  '/:id/multiple/:multipleDocumentId/clear',
  requireAuth,
  drc.clearMultipleDocumentGroup
);

module.exports = router;
