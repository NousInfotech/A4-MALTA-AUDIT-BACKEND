const express = require("express");
const router = express.Router();
const noticeBoardController = require("../controllers/noticeBoardController");
const { requireAuth, requireRole } = require("../middlewares/auth");

/**
 * NoticeBoard Routes
 * All routes require authentication
 * Organization filtering is handled automatically via req.user.organizationId
 */

// Apply authentication to all routes
router.use(requireAuth);

// Public read endpoints (all authenticated users can access)
// Get active notices for current user (client/employee only)
router.get(
  "/active",
  requireRole(["client", "employee"]),
  noticeBoardController.getActiveNotices
);

// Get all notices with filtering, sorting, pagination, search (all authenticated users)
router.get("/", noticeBoardController.getAllNotices);

// Get notice statistics (admin/super-admin only) - must come before /:id
router.get(
  "/stats",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.getNoticeStats
);

// Get notices by type (all authenticated users) - must come before /:id
router.get("/type/:type", noticeBoardController.getNoticesByType);

// Get single notice by ID (all authenticated users)
router.get("/:id", noticeBoardController.getNoticeById);

// Mark notice as viewed (all authenticated users)
router.post("/:id/view", noticeBoardController.markAsViewed);

// Mark notice as acknowledged (all authenticated users)
router.post("/:id/acknowledge", noticeBoardController.markAsAcknowledged);

// Admin-only endpoints
// Create a new notice (admin/super-admin only)
router.post(
  "/",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.createNotice
);

// Update notice (admin/super-admin only)
router.put(
  "/:id",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.updateNotice
);

// Delete notice (admin/super-admin only)
router.delete(
  "/:id",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.deleteNotice
);

// Soft delete - deactivate notice (admin/super-admin only)
router.patch(
  "/:id/deactivate",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.deactivateNotice
);

// Bulk delete notices (admin/super-admin only)
router.post(
  "/bulk-delete",
  requireRole(["admin", "super-admin"]),
  noticeBoardController.bulkDeleteNotices
);

module.exports = router;
