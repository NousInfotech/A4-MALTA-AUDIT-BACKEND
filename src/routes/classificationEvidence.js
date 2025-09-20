const router = require("express").Router();
const cec = require("../controllers/classificationEvidenceController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Create new evidence (allowed for everyone except 'user' role)
router.post("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.createEvidence);

// Get all evidence
router.get("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getAllEvidence);

// Get evidence by classification ID
router.get("/classification/:classificationId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getEvidenceByClassification);

// Add comment to evidence
router.post("/:evidenceId/comments", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.addEvidenceComment);

// Update evidence URL
router.patch("/:evidenceId/url", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.updateEvidenceUrl);

// Delete evidence
router.delete("/:evidenceId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.deleteEvidence);

module.exports = router;
