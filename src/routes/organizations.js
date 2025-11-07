const express = require("express");
const router = express.Router();
const orgController = require("../controllers/organizationController");
const { requireAuth, requireSuperAdmin } = require("../middlewares/auth");

// All organization routes require super-admin access except single org detail which can be accessed by org admin
router.post("/", requireAuth, requireSuperAdmin, orgController.createOrganization);
router.get("/", requireAuth, requireSuperAdmin, orgController.getAllOrganizations);
router.get("/analytics", requireAuth, requireSuperAdmin, orgController.getOrganizationAnalytics);
router.get("/:id", requireAuth, orgController.getOrganizationById);
router.put("/:id", requireAuth, orgController.updateOrganization);

module.exports = router;

