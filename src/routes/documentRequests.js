// routes/documentRequests.js
const router = require('express').Router();
const drc = require('../controllers/documentRequestController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const upload  = require('../middlewares/upload');

// Auditor creates a new request
router.post(
  '/',
  requireAuth,
  requireRole('employee'),
  drc.createRequest
);

// Client or auditor lists requests for an engagement
router.get(
  '/engagement/:engagementId',
  requireAuth,
  drc.getRequestsByEngagement
);

// Client uploads or auditor marks as completed
router.patch(
  '/:id',
  requireAuth,
  drc.updateRequest
);

router.post(
  '/:id/documents',
  requireAuth,
  upload.array('files'),      // expecting form-data key "files"
  drc.uploadDocuments
);

module.exports = router;
