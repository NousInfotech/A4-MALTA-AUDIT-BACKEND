const router = require('express').Router();
const ec = require('../controllers/engagementController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const upload = require("../middlewares/upload")

router.post('/', requireAuth,
   requireRole('employee'), 
   ec.createEngagement);
router.get('/', requireAuth, ec.getAllEngagements);
router.get('/getClientEngagements', requireAuth, ec.getClientEngagements);
router.get('/:id', requireAuth, ec.getEngagementById);
router.patch('/:id', requireAuth, requireRole('employee'), ec.updateEngagement);
// routes/engagements.js (or wherever)
router.post(
  '/:id/library',
  requireAuth,
  requireRole('employee'),
  upload.single('file'),
  ec.uploadToLibrary
);

router.post(
  '/:id/library/change',
  requireAuth,
  requireRole('employee'),
  ec.changeFolders
);

router.delete(
  '/:id/library',
  requireAuth,
  requireRole('employee'),
  ec.deleteFile
);
// In routes/engagements.js
router.get('/:id/library', requireAuth,requireRole("employee"), ec.getLibraryFiles);
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
