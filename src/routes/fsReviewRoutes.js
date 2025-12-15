const router = require('express').Router();
const fsReviewController = require("../controllers/fsReviewController");

// Test endpoint for generating test output format
router.get("/test-output-format", fsReviewController.generateTestOutput);

// Extract portal data endpoint
router.get("/extract-portal-data/:engagementId", fsReviewController.extractPortalData);

// Generate financial statement review endpoint
// Note: Add file upload middleware (multer) if file upload is needed
router.post("/generate-review/:engagementId", fsReviewController.generateFinancialStatementReview);

module.exports = router;