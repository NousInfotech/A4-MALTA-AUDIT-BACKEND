const router = require('express').Router();
const cc     = require('../controllers/checklistController');
const { requireAuth } = require('../middlewares/auth');

// Get all checklist items for an engagement
// GET /api/checklist/engagement/:engagementId
router.get(
  '/engagement/:engagementId',
  requireAuth,
  cc.getChecklistByEngagement
);

// Update one checklist item’s completed flag
// PATCH /api/checklist/:id
router.patch(
  '/:id',
  requireAuth,
  cc.updateChecklistItem
);

module.exports = router;
