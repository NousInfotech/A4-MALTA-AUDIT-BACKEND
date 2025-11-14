const router = require("express").Router();
const c = require("../controllers/documentRequestTemplateController");
const { requireAuth, requireRole } = require("../middlewares/auth");
const upload  = require('../middlewares/upload');
// Single CRUD

// CREATE (no id)
router.use(requireAuth);
router.post("/single", requireRole('employee'), c.createSingle);
router.post(
  '/template/upload',
  requireRole('employee'),
  upload.single('file'),
  c.uploadTemplate
);

// GET, UPDATE, DELETE (with id)
router.route("/single/:id")
  .get(requireRole('employee'), c.getSingle)
  .put(requireRole('employee'), c.updateSingle)
  .patch(requireRole('employee'), c.updateSingle)
  .delete(requireRole('employee'), c.deleteSingle)



// Bulk CRUD

router.route("/bulk")
  .get(requireRole('employee'), c.getAllBulk) 
  .post(requireRole('employee'), c.bulkCreate)
  .put(requireRole('employee'), c.bulkUpdate)
  .patch(requireRole('employee'), c.bulkUpdate)
  .delete(requireRole('employee'), c.bulkDelete);



module.exports = router;
