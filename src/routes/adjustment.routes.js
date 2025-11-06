const express = require("express");
const router = express.Router();
const adjustmentController = require("../controllers/adjustmentController");

/**
 * @route   POST /api/adjustments
 * @desc    Create a new adjustment (draft)
 * @access  Protected
 */
router.post("/", adjustmentController.createAdjustment);

/**
 * @route   GET /api/adjustments/engagement/:engagementId
 * @desc    Get all adjustments for an engagement
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId",
  adjustmentController.getAdjustmentsByEngagement
);

/**
 * @route   GET /api/adjustments/etb/:etbId
 * @desc    Get all adjustments for an ETB
 * @access  Protected
 */
router.get("/etb/:etbId", adjustmentController.getAdjustmentsByETB);

/**
 * @route   GET /api/adjustments/:id
 * @desc    Get a single adjustment by ID
 * @access  Protected
 */
router.get("/:id", adjustmentController.getAdjustmentById);

/**
 * @route   PUT /api/adjustments/:id
 * @desc    Update a draft adjustment
 * @access  Protected
 */
router.put("/:id", adjustmentController.updateAdjustment);

/**
 * @route   POST /api/adjustments/:id/post
 * @desc    Post a draft adjustment (apply to ETB)
 * @access  Protected
 */
router.post("/:id/post", adjustmentController.postAdjustment);

/**
 * @route   POST /api/adjustments/:id/unpost
 * @desc    Unpost a posted adjustment (reverse ETB impact)
 * @access  Protected
 */
router.post("/:id/unpost", adjustmentController.unpostAdjustment);

/**
 * @route   DELETE /api/adjustments/:id
 * @desc    Delete a draft adjustment
 * @access  Protected
 */
router.delete("/:id", adjustmentController.deleteAdjustment);

module.exports = router;

