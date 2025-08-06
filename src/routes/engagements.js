const router = require('express').Router();
const ec = require('../controllers/engagementController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post('/', requireAuth,
   requireRole('employee'), 
   ec.createEngagement);
router.get('/', requireAuth, ec.getAllEngagements);
router.get('/getClientEngagements', requireAuth, ec.getClientEngagements);
router.get('/:id', requireAuth, ec.getEngagementById);
router.patch('/:id', requireAuth, requireRole('employee'), ec.updateEngagement);

// fetch & store a fresh copy from Google Sheets
router.post(
  '/:id/fetch-trial-balance',
  requireAuth,
  // requireRole('employee'),
  ec.fetchTrialBalance
);

// retrieve the stored table
router.get(
  '/:id/trial-balance',
  requireAuth,
  ec.getTrialBalance
);

module.exports = router;
