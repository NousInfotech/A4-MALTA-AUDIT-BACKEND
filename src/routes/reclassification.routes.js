const express = require("express");
const router = express.Router();
const reclassificationController = require("../controllers/reclassificationController");

/**
 * @route   POST /api/reclassifications
 * @desc    Create a new reclassification (draft)
 * @access  Protected
 */
router.post("/", reclassificationController.createReclassification);

/**
 * @route   GET /api/reclassifications/engagement/:engagementId
 * @desc    Get all reclassifications for an engagement
 * @access  Protected
 */
router.get(
  "/engagement/:engagementId",
  reclassificationController.getReclassificationsByEngagement
);

/**
 * @route   GET /api/reclassifications/etb/:etbId
 * @desc    Get all reclassifications for an ETB
 * @access  Protected
 */
router.get("/etb/:etbId", reclassificationController.getReclassificationsByETB);

/**
 * @route   GET /api/reclassifications/:id
 * @desc    Get a single reclassification by ID
 * @access  Protected
 */
router.get("/:id", reclassificationController.getReclassificationById);

/**
 * @route   PUT /api/reclassifications/:id
 * @desc    Update a reclassification
 * @access  Protected
 */
router.put("/:id", reclassificationController.updateReclassification);

/**
 * @route   POST /api/reclassifications/:id/post
 * @desc    Post a draft reclassification (apply to ETB)
 * @access  Protected
 */
router.post("/:id/post", reclassificationController.postReclassification);

/**
 * @route   POST /api/reclassifications/:id/unpost
 * @desc    Unpost a posted reclassification (reverse ETB impact)
 * @access  Protected
 */
router.post("/:id/unpost", reclassificationController.unpostReclassification);

/**
 * @route   DELETE /api/reclassifications/:id
 * @desc    Delete a reclassification
 * @access  Protected
 */
router.delete("/:id", reclassificationController.deleteReclassification);

module.exports = router;

