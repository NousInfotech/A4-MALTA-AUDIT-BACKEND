const router = require("express").Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");

router.post("/2fa/setup", requireAuth, authController.setup2FA);
router.post("/2fa/verify", requireAuth, authController.verify2FA);
router.post("/2fa/validate", requireAuth, authController.validate2FA);
router.post("/2fa/disable", requireAuth, authController.disable2FA);

module.exports = router;
