const router = require('express').Router();
const drc = require('../controllers/documentRequestController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const upload  = require('../middlewares/upload');

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

router.patch(
  '/:id',
  requireAuth,
  drc.updateRequest
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
  requireRole('employee'),
  drc.deleteDocument
);

module.exports = router;
