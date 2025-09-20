const router = require("express").Router();
const uc = require("../controllers/userController");
const ec = require("../controllers/employeeController");
const { requireAuth, requireRole } = require("../middlewares/auth");

router.post("/create", requireAuth, requireRole("employee"), uc.createUser);
// router.post("/create/:role", requireAuth, requireRole("admin"), ec.createEmployee);
// router.post("/create/:role", ec.createEmployee);
router.patch("/classification/:id/status", requireAuth,requireRole(["senior-employee","partner"]), uc.updateClassificationStatus);
router.get("/", requireAuth, requireRole(["employee", "reviewer", "partner", "admin"]), uc.getAllUsers);
router.get("/email/:id", requireAuth, uc.getEmail);
router.delete("/:id", requireAuth, requireRole("admin"), uc.deleteUser);

module.exports = router;
