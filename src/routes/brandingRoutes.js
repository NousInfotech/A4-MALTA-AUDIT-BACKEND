const express = require('express');
const router = express.Router();
const brandingController = require('../controllers/brandingController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Route requires authentication to get organizationId
// All users can view their organization's branding
router.get('/', requireAuth, brandingController.getBrandingSettings);

// Admin-only routes
router.put('/', requireAuth, requireRole('admin'), brandingController.updateBrandingSettings);
router.post('/upload-logo', requireAuth, requireRole('admin'), upload.single('logo'), brandingController.uploadLogo);
router.post('/reset', requireAuth, requireRole('admin'), brandingController.resetBrandingSettings);

module.exports = router;

