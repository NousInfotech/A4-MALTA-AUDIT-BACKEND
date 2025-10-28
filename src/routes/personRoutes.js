const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { requireAuth } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(requireAuth);

// GET /api/client/:clientId/company/:companyId/person - Get all persons for a company
router.get(
  "/:clientId/company/:companyId/person",
  personController.getAllPersons
);

// GET /api/client/:clientId/company/:companyId/person/:personId - Get a single person
router.get(
  "/:clientId/company/:companyId/person/:personId",
  personController.getPersonById
);

// POST /api/client/:clientId/company/:companyId/person - Create a new person
router.post(
  "/:clientId/company/:companyId/person",
  personController.createPerson
);

// PUT /api/client/:clientId/company/:companyId/person/:personId - Update a person
router.put(
  "/:clientId/company/:companyId/person/:personId",
  personController.updatePerson
);

// DELETE /api/client/:clientId/company/:companyId/person/:personId - Delete a person
router.delete(
  "/:clientId/company/:companyId/person/:personId",
  personController.deletePerson
);

module.exports = router;

