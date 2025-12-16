const router = require('express').Router();
// @import: Financial Statement Review Controller
// @controller: backend/src/controllers/fsReviewController.js
const fsReviewController = require("../controllers/fsReviewController");
// @import: Specialized multer upload middleware for PDF files
// @middleware: backend/src/middlewares/upload.js - fsReviewUpload
const { fsReviewUpload } = require("../middlewares/upload");
const multer = require('multer');

/**
 * Generate Financial Statement Review Route
 * @route POST /generate-review/:engagementId
 * @description Main endpoint for generating comprehensive financial statement reviews
 * @middleware: fsReviewUpload - Specialized multer middleware for PDF-only uploads
 *   - Validates PDF file type
 *   - Limits file size to 50MB
 *   - Stores file in memory for processing
 * @controller: generateFinancialStatementReview in fsReviewController.js
 * @service: Uses generateFSReview.service.js which orchestrates:
 *   - Portal data extraction (engagement, company, ETB, P&L, BS, lead sheets)
 *   - PDF data extraction (text and images per page)
 *   - AI review generation via OpenAI
 * @param {string} engagementId - Engagement ID from URL params
 * @body {File} file - PDF file upload (form-data field name: 'file')
 * @returns {Object} JSON response with structured review results (A/B/C/D/E format)
 */
/**
 * Error handling middleware for multer upload errors
 * @middleware: Catches multer errors before they reach the controller
 * @error: Handles file type, size, and count limit errors
 */
const handleMulterError = (err, req, res, next) => {
  // @error: Handle multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: "File too large",
        message: "PDF file size exceeds the maximum limit of 50MB"
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: "Too many files",
        message: "Only one PDF file is allowed per request"
      });
    }
    return res.status(400).json({
      error: "File upload error",
      message: err.message
    });
  }
  
  // @error: Handle file filter errors (non-PDF files)
  if (err.message && err.message.includes('Only PDF files are allowed')) {
    return res.status(400).json({
      error: "Invalid file type",
      message: "Only PDF files are allowed for financial statement review"
    });
  }
  
  // @error: Pass other errors to next middleware
  next(err);
};

// @middleware: fsReviewUpload.single('file') - Handles single PDF file upload
router.post(
  "/generate-review/:engagementId",
  fsReviewUpload.single('file'), // @config: Accepts single file with field name 'file'
  handleMulterError, // @middleware: Error handling for multer errors
  fsReviewController.generateFinancialStatementReview
);




module.exports = router;