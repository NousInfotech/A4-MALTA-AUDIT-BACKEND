const router = require("express").Router();
const crc = require("../controllers/classificationReviewController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Create a new review (allowed for everyone except 'user' role)
router.post("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), crc.createReview);

// Get all reviews
router.get("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), crc.getAllReviews);

// Get reviews by classification ID
router.get("/classification/:classificationId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), crc.getReviewsByClassification);

// Update review status
router.patch("/:reviewId/status", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), crc.updateReviewStatus);

// Delete a review
router.delete("/:reviewId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), crc.deleteReview);

module.exports = router;
