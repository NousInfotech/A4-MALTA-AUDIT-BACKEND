const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Get user's tour progress
router.get('/', requireAuth, tourController.getTourProgress);

// Complete a tour
router.post('/complete', requireAuth, tourController.completeTour);

// Skip a tour
router.post('/skip', requireAuth, tourController.skipTour);

// Reset a tour (admin only - allow replay)
router.post('/reset', requireAuth, requireRole('admin'), tourController.resetTour);

module.exports = router;

