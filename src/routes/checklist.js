const router = require('express').Router();
const cc     = require('../controllers/checklistController');
const { requireAuth } = require('../middlewares/auth');

// Get all checklist items for an engagement
router.get(
  '/engagement/:engagementId',
  requireAuth,
  cc.getChecklistByEngagement
);

// Update one checklist item
router.patch(
  '/:id',
  requireAuth,
  cc.updateChecklistItem
);

module.exports = router;
