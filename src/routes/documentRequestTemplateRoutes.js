const router = require("express").Router();
const c = require("../controllers/documentRequestTemplateController");

// Single CRUD

// CREATE (no id)
router.post("/single", c.createSingle);

// GET, UPDATE, DELETE (with id)
router.route("/single/:id")
  .get(c.getSingle)
  .put(c.updateSingle)
  .patch(c.updateSingle)
  .delete(c.deleteSingle);


// Bulk CRUD

router.route("/bulk")
  .get(c.getAllBulk) 
  .post(c.bulkCreate)
  .put(c.bulkUpdate)
  .patch(c.bulkUpdate)
  .delete(c.bulkDelete);

module.exports = router;
