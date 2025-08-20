const router = require('express').Router();
const cc     = require('../controllers/checklistController');
const { requireAuth } = require('../middlewares/auth');

router.get(
  '/engagement/:engagementId',
  requireAuth,
  cc.getChecklistByEngagement
);

router.patch(
  '/:id',
  requireAuth,
  cc.updateChecklistItem
);

module.exports = router;
