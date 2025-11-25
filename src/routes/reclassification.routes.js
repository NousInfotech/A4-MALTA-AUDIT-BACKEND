const express = require("express");
const router = express.Router();
const reclassificationController = require("../controllers/reclassificationController");
const { requireAuth } = require("../middlewares/auth");

/**
 * @route   POST /api/reclassifications
 * @desc    Create a new reclassification (draft)
 * @access  Protected
 */
router.post("/", requireAuth, reclassificationController.createReclassification);

/**
 * @route   GET /api/reclassifications/engagement/:engagementId
 * @desc    Get all reclassifications for an engagement
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId",
  requireAuth,
  reclassificationController.getReclassificationsByEngagement
);

/**
 * @route   GET /api/reclassifications/etb/:etbId
 * @desc    Get all reclassifications for an ETB
 * @access  Protected
 */
router.get("/etb/:etbId", requireAuth, reclassificationController.getReclassificationsByETB);

/**
 * @route   GET /api/reclassifications/engagement/:engagementId/export
 * @desc    Export reclassifications to Excel
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId/export",
  requireAuth,
  reclassificationController.exportReclassifications
);

/**
 * @route   GET /api/reclassifications/:id
 * @desc    Get a single reclassification by ID
 * @access  Protected
 */
router.get("/:id", requireAuth, reclassificationController.getReclassificationById);

/**
 * @route   PUT /api/reclassifications/:id
 * @desc    Update a reclassification
 * @access  Protected
 */
router.put("/:id", requireAuth, reclassificationController.updateReclassification);

/**
 * @route   POST /api/reclassifications/:id/post
 * @desc    Post a draft reclassification (apply to ETB)
 * @access  Protected
 */
router.post("/:id/post", requireAuth, reclassificationController.postReclassification);

/**
 * @route   POST /api/reclassifications/:id/unpost
 * @desc    Unpost a posted reclassification (reverse ETB impact)
 * @access  Protected
 */
router.post("/:id/unpost", requireAuth, reclassificationController.unpostReclassification);

/**
 * @route   DELETE /api/reclassifications/:id
 * @desc    Delete a reclassification
 * @access  Protected
 */
router.delete("/:id", requireAuth, reclassificationController.deleteReclassification);

/**
 * @route   GET /api/reclassifications/:id/history
 * @desc    Get history for a specific reclassification
 * @access  Protected
 */
router.get("/:id/history", requireAuth, reclassificationController.getReclassificationHistory);

/**
 * @route   POST /api/reclassifications/:id/evidence
 * @desc    Add evidence file to a reclassification
 * @access  Protected
 */
router.post("/:id/evidence", requireAuth, reclassificationController.addEvidenceFile);

/**
 * @route   DELETE /api/reclassifications/:id/evidence/:evidenceId
 * @desc    Remove evidence file from a reclassification
 * @access  Protected
 */
router.delete("/:id/evidence/:evidenceId", requireAuth, reclassificationController.removeEvidenceFile);

module.exports = router;

