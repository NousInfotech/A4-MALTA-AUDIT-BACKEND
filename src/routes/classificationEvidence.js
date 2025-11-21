const router = require("express").Router();
const cec = require("../controllers/classificationEvidenceController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Create new evidence (allowed for everyone except 'user' role)
router.post("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.createEvidence);

// Get all evidence
router.get("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getAllEvidence);

// Get evidence by classification ID
router.get("/classification/:classificationId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getEvidenceByClassification);

// Get evidence with mappings (populated linkedWorkbooks and mappings)
router.get("/:evidenceId/with-mappings", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getEvidenceWithMappings);

// Add comment to evidence
router.post("/:evidenceId/comments", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.addEvidenceComment);

// Update evidence URL
router.patch("/:evidenceId/url", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.updateEvidenceUrl);

// Delete evidence
router.delete("/:evidenceId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.deleteEvidence);

// ========================================
// Workbook Linking and Mapping Endpoints
// ========================================

// Link a workbook to evidence file
router.post("/:evidenceId/linked-workbooks/:workbookId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.linkWorkbookToEvidence);

// Unlink a workbook from evidence file
router.delete("/:evidenceId/linked-workbooks/:workbookId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.unlinkWorkbookFromEvidence);

// Add a mapping to evidence file
router.post("/:evidenceId/mappings", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.addMappingToEvidence);

// Update a specific mapping
router.put("/:evidenceId/mappings/:mappingId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.updateEvidenceMapping);

// Remove a mapping from evidence file
router.delete("/:evidenceId/mappings/:mappingId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.removeMappingFromEvidence);

// Toggle mapping active status
router.patch("/:evidenceId/mappings/:mappingId/toggle", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.toggleEvidenceMappingStatus);

// Get all mappings for a specific workbook across all evidence files
router.get("/workbooks/:workbookId/mappings", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getMappingsByWorkbook);

// Get evidence files for specific cell ranges in a workbook
router.get("/workbooks/:workbookId/cell-range", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.getEvidenceByCellRange);

// Add reference file to workbook (without creating mapping)
router.post("/workbooks/:workbookId/reference-files/:evidenceId", requireAuth, requireRole(["employee", "reviewer", "partner", "admin", "senior-employee"]), cec.addReferenceFileToWorkbook);

module.exports = router;
