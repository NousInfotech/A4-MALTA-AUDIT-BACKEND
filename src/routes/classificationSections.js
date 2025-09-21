const router = require("express").Router();
const csc = require("../controllers/classificationSectionController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Get all classification sections (with optional filters)
router.get("/", requireAuth, csc.getAllClassificationSections);

// Get a specific classification section by ID
router.get("/:id", requireAuth, csc.getClassificationSectionById);

// Create a new classification section
router.post("/", requireAuth, requireRole("employee"), csc.createClassificationSection);

// Update a classification section
router.patch("/:id", requireAuth, requireRole("employee"), csc.updateClassificationSection);

// Delete a classification section
router.delete("/:id", requireAuth, requireRole("employee"), csc.deleteClassificationSection);

module.exports = router;
