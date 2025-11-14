const express = require("express");
const router = express.Router();
const workingPaperController = require("../controllers/WorkingPaperController");
const { requireAuth } = require("../middlewares/auth");

/**
 * @route   GET /api/working-papers/:engagementId/:classification
 * @desc    Get or create Working Paper for a specific engagement and classification
 * @access  Protected
 */
router.get(
  "/:engagementId/:classification",
  requireAuth,
  workingPaperController.getOrCreateWorkingPaper
);

/**
 * @route   POST /api/working-papers/:engagementId/:classification
 * @desc    Create or update Working Paper rows
 * @access  Protected
 */
router.post(
  "/:engagementId/:classification",
  requireAuth,
  workingPaperController.createOrUpdateWorkingPaper
);

/**
 * @route   POST /api/working-papers/:engagementId/:classification/rows/:rowCode/mappings
 * @desc    Add a mapping to a specific Working Paper row
 * @access  Protected
 */
router.post(
  "/:engagementId/:classification/rows/:rowCode/mappings",
  requireAuth,
  workingPaperController.addMappingToRow
);

/**
 * @route   PUT /api/working-papers/:engagementId/:classification/rows/:rowCode/mappings/:mappingId
 * @desc    Update a specific mapping
 * @access  Protected
 */
router.put(
  "/:engagementId/:classification/rows/:rowCode/mappings/:mappingId",
  requireAuth,
  workingPaperController.updateMapping
);

/**
 * @route   DELETE /api/working-papers/:engagementId/:classification/rows/:rowCode/mappings/:mappingId
 * @desc    Remove a mapping from a Working Paper row
 * @access  Protected
 */
router.delete(
  "/:engagementId/:classification/rows/:rowCode/mappings/:mappingId",
  requireAuth,
  workingPaperController.removeMapping
);

/**
 * @route   PATCH /api/working-papers/:engagementId/:classification/rows/:rowCode/mappings/:mappingId/toggle
 * @desc    Toggle mapping active status
 * @access  Protected
 */
router.patch(
  "/:engagementId/:classification/rows/:rowCode/mappings/:mappingId/toggle",
  requireAuth,
  workingPaperController.toggleMappingStatus
);

/**
 * @route   GET /api/working-papers/:engagementId/:classification/workbooks/:workbookId/mappings
 * @desc    Get all mappings for a specific workbook
 * @access  Protected
 */
router.get(
  "/:engagementId/:classification/workbooks/:workbookId/mappings",
  requireAuth,
  workingPaperController.getMappingsByWorkbook
);

/**
 * @route   PUT /api/working-papers/:engagementId/:classification/rows/:rowCode/linked-files
 * @desc    Update linkedExcelFiles array for a Working Paper row
 * @access  Protected
 */
router.put(
  "/:engagementId/:classification/rows/:rowCode/linked-files",
  requireAuth,
  workingPaperController.updateLinkedExcelFiles
);

/**
 * @route   DELETE /api/working-papers/:engagementId/:classification/rows/:rowCode/linked-files/:workbookId
 * @desc    Remove a workbook from linkedExcelFiles array
 * @access  Protected
 */
router.delete(
  "/:engagementId/:classification/rows/:rowCode/linked-files/:workbookId",
  requireAuth,
  workingPaperController.deleteWorkbookFromLinkedFiles
);

module.exports = router;

