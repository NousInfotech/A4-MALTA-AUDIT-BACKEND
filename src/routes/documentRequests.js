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

router.post(
  '/:id/documents',
  requireAuth,
  upload.array('files'),    
  drc.uploadDocuments
);

module.exports = router;
