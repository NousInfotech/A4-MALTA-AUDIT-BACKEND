const express = require("express");
const router = express.Router();
const noticeBoardController = require("../controllers/noticeBoardController");
const { requireAuth, requireRole } = require("../middlewares/auth");

/**
 * NoticeBoard Routes
 * All routes require authentication
 * Organization filtering is handled automatically via req.user.organizationId
 */

// Create a new notice (admin/super-admin only)
router.use(requireAuth);
router.use(requireRole(["admin", "super-admin"]));

router.post("/", noticeBoardController.createNotice);

// Get all notices with filtering, sorting, pagination, search
router.get("/", noticeBoardController.getAllNotices);

// Get active notices for current user
router.get(
  "/active",
  requireRole(["client", "employee"]),
  noticeBoardController.getActiveNotices
);

// Get notice statistics
router.get("/stats", noticeBoardController.getNoticeStats);

// Get notices by type
router.get("/type/:type", noticeBoardController.getNoticesByType);

// Get single notice by ID
router.get("/:id", noticeBoardController.getNoticeById);

// Update notice (admin/super-admin only)
router.put("/:id", noticeBoardController.updateNotice);

// Delete notice (admin/super-admin only)
router.delete("/:id", noticeBoardController.deleteNotice);

// Soft delete - deactivate notice
router.patch("/:id/deactivate", noticeBoardController.deactivateNotice);

// Mark notice as viewed
router.post("/:id/view", noticeBoardController.markAsViewed);

// Mark notice as acknowledged
router.post("/:id/acknowledge", noticeBoardController.markAsAcknowledged);

// Bulk delete notices
router.post("/bulk-delete", noticeBoardController.bulkDeleteNotices);

module.exports = router;
