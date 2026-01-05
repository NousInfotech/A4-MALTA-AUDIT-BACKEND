const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(requireAuth);

// Middleware to ensure a client can only access their own data
const requireSelfIfClient = (req, res, next) => {
  const clientId = req.params.clientId;
  if (req.user.role === 'client' && clientId && clientId !== req.user.id) {
    // Adding diagnostic message to help identify where it fails
    return res.status(403).json({ message: 'Insufficient permissions (Client ID mismatch)' });
  }
  next();
};

// GET /api/client/:clientId/person - Get all persons for a client
router.get(
  "/:clientId/person",
  requireSelfIfClient,
  requireRole(["employee", "client"]),
  personController.getAllPersons
);

// GET /api/client/:clientId/company/:companyId/person - Get all persons for a company
router.get(
  "/:clientId/company/:companyId/person",
  requireSelfIfClient,
  requireRole(["employee", "client"]),
  personController.getAllPersons
);

// GET /api/client/:clientId/company/:companyId/person/:personId - Get a single person
router.get(
  "/:clientId/company/:companyId/person/:personId",
  requireSelfIfClient,
  requireRole(["employee", "client"]),
  personController.getPersonById
);

// For all other routes (mutations), require employee role
// Use explicit requireRole("employee") for clarity on each route

// POST /api/client/:clientId/company/:companyId/person - Create a new person
router.post(
  "/:clientId/company/:companyId/person",
  requireRole("employee"),
  personController.createPerson
);

// PUT /api/client/:clientId/company/:companyId/person/:personId - Update a person
router.put(
  "/:clientId/company/:companyId/person/:personId",
  requireRole("employee"),
  personController.updatePerson
);

// DELETE /api/client/:clientId/company/:companyId/person/:personId - Delete a person
router.delete(
  "/:clientId/company/:companyId/person/:personId",
  requireRole("employee"),
  personController.deletePerson
);

module.exports = router;

