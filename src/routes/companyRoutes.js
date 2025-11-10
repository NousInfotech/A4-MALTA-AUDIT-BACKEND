const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { requireAuth } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(requireAuth);

// GET /api/client/:clientId/company - Get all companies for a client
router.get("/:clientId/company", companyController.getAllCompanies);

// GET /api/client/:clientId/company/:companyId - Get a single company
router.get("/:clientId/company/:companyId", companyController.getCompanyById);

// POST /api/client/:clientId/company - Create a new company
router.post("/:clientId/company", companyController.createCompany);

// PUT /api/client/:clientId/company/:companyId - Update a company
router.put("/:clientId/company/:companyId", companyController.updateCompany);

// DELETE /api/client/:clientId/company/:companyId - Delete a company
router.delete("/:clientId/company/:companyId", companyController.deleteCompany);

// DELETE /api/client/:clientId/company/:companyId/representative/:personId - Remove representative only
router.delete("/:clientId/company/:companyId/representative/:personId", companyController.removeRepresentative);

// GET /api/client/:clientId/company/:companyId/hierarchy - Get company hierarchy
router.get("/:clientId/company/:companyId/hierarchy", companyController.getCompanyHierarchy);

module.exports = router;

