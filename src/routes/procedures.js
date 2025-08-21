const router = require("express").Router()
const pc = require("../controllers/procedureController")
const { requireAuth, requireRole } = require("../middlewares/auth")

// Get procedure for engagement
router.get("/:engagementId", requireAuth, pc.getProcedure)

// Create or update procedure
router.post("/:engagementId", requireAuth, requireRole("employee"), pc.saveProcedure)

// Generate procedures (AI/Hybrid modes)
router.post("/:engagementId/generate", requireAuth, requireRole("employee"), pc.generateProcedures)

// Update procedure status
router.patch("/:engagementId/status", requireAuth, requireRole("employee"), pc.updateProcedureStatus)

// Delete procedure
router.delete("/:engagementId", requireAuth, requireRole("employee"), pc.deleteProcedure)

module.exports = router
