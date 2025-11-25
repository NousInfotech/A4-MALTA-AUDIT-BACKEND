const express = require("express");
const router = express.Router();
const adjustmentController = require("../controllers/adjustmentController");
const { requireAuth } = require("../middlewares/auth");

/**
 * @route   POST /api/adjustments
 * @desc    Create a new adjustment (draft)
 * @access  Protected
 */
router.post("/", requireAuth, adjustmentController.createAdjustment);

/**
 * @route   GET /api/adjustments/engagement/:engagementId
 * @desc    Get all adjustments for an engagement
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId",
  requireAuth,
  adjustmentController.getAdjustmentsByEngagement
);

/**
 * @route   GET /api/adjustments/etb/:etbId
 * @desc    Get all adjustments for an ETB
 * @access  Protected
 */
router.get("/etb/:etbId", requireAuth, adjustmentController.getAdjustmentsByETB);

/**
 * @route   GET /api/adjustments/engagement/:engagementId/export
 * @desc    Export adjustments to Excel
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId/export",
  requireAuth,
  adjustmentController.exportAdjustments
);

/**
 * @route   GET /api/adjustments/:id
 * @desc    Get a single adjustment by ID
 * @access  Protected
 */
router.get("/:id", requireAuth, adjustmentController.getAdjustmentById);

/**
 * @route   PUT /api/adjustments/:id
 * @desc    Update a draft adjustment
 * @access  Protected
 */
router.put("/:id", requireAuth, adjustmentController.updateAdjustment);

/**
 * @route   POST /api/adjustments/:id/post
 * @desc    Post a draft adjustment (apply to ETB)
 * @access  Protected
 */
router.post("/:id/post", requireAuth, adjustmentController.postAdjustment);

/**
 * @route   POST /api/adjustments/:id/unpost
 * @desc    Unpost a posted adjustment (reverse ETB impact)
 * @access  Protected
 */
router.post("/:id/unpost", requireAuth, adjustmentController.unpostAdjustment);

/**
 * @route   DELETE /api/adjustments/:id
 * @desc    Delete a draft adjustment
 * @access  Protected
 */
router.delete("/:id", requireAuth, adjustmentController.deleteAdjustment);

/**
 * @route   GET /api/adjustments/:id/history
 * @desc    Get history for a specific adjustment
 * @access  Protected
 */
router.get("/:id/history", requireAuth, adjustmentController.getAdjustmentHistory);

/**
 * @route   POST /api/adjustments/:id/evidence
 * @desc    Add evidence file to an adjustment
 * @access  Protected
 */
router.post("/:id/evidence", requireAuth, adjustmentController.addEvidenceFile);

/**
 * @route   DELETE /api/adjustments/:id/evidence/:evidenceId
 * @desc    Remove evidence file from an adjustment
 * @access  Protected
 */
router.delete("/:id/evidence/:evidenceId", requireAuth, adjustmentController.removeEvidenceFile);

module.exports = router;

