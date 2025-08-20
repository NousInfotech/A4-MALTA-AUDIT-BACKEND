const router = require("express").Router();
const uc = require("../controllers/userController");
const { requireAuth, requireRole } = require("../middlewares/auth");

router.post("/", requireAuth, requireRole("employee"), uc.createUser);
router.get("/email/:id", requireAuth, uc.getEmail);
router.delete("/:id", requireAuth, requireRole("admin"), uc.deleteUser);

module.exports = router;
