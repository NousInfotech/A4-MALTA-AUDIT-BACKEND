const router = require("express").Router();
const settingsController = require("../controllers/settingsController");
const { requireAuth, requireRole, organizationScope } = require("../middlewares/auth");

// Organization Settings
// GET: Available to all authenticated users (Employees/Clients need to see compliance info/defaults)
router.get("/org", requireAuth, organizationScope, settingsController.getOrgSettings);
// PUT: Admin only
router.put("/org", requireAuth, requireRole(["admin", "super-admin"]), organizationScope, settingsController.updateOrgSettings);

// User Personal Settings (Profile, Security, Reminders)
// Available to all authenticated users (Client, Employee, Admin, etc.)
router.get("/user", requireAuth, settingsController.getUserSettings);
router.put("/user", requireAuth, settingsController.updateUserSettings);

module.exports = router;
