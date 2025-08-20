const router = require('express').Router();
const uc = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post("/", requireAuth, requireRole("employee"),uc.createUser )
app.get("/email/:id", requireAuth,uc.getEmail)

module.exports = router;
