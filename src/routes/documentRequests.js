// routes/documentRequests.js
const router = require('express').Router();
const drc = require('../controllers/documentRequestController');
const { requireAuth, requireRole } = require('../middlewares/auth');

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

module.exports = router;
