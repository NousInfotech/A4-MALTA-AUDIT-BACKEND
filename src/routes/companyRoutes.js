const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(requireAuth);
router.use(requireRole("employee"));

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

// ============================================
// 16 Routes for managing shareholders and representatives
// Base: /:clientId/company/:companyId
// ============================================

// SHARE-HOLDER / PERSON / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/share-holder/person/existing/:personId
router.put("/:clientId/company/:companyId/share-holder/person/existing/:personId", companyController.updateShareHolderPersonExisting);

// SHARE-HOLDER / PERSON / NEW / SINGLE
// POST /:clientId/company/:companyId/share-holder/person/new
router.post("/:clientId/company/:companyId/share-holder/person/new", companyController.addShareHolderPersonNew);

// SHARE-HOLDER / PERSON / EXISTING / BULK
// PUT /:clientId/company/:companyId/share-holder/person/existing/bulk
router.put("/:clientId/company/:companyId/share-holder/person/existing/bulk", companyController.updateShareHolderPersonExistingBulk);

// SHARE-HOLDER / PERSON / NEW / BULK
// POST /:clientId/company/:companyId/share-holder/person/new/bulk
router.post("/:clientId/company/:companyId/share-holder/person/new/bulk", companyController.addShareHolderPersonNewBulk);

// SHARE-HOLDER / COMPANY / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/share-holder/company/existing/:addingCompanyId
router.put("/:clientId/company/:companyId/share-holder/company/existing/:addingCompanyId", companyController.updateShareHolderCompanyExisting);

// SHARE-HOLDER / COMPANY / NEW / SINGLE
// POST /:clientId/company/:companyId/share-holder/company/new
router.post("/:clientId/company/:companyId/share-holder/company/new", companyController.addShareHolderCompanyNew);

// SHARE-HOLDER / COMPANY / EXISTING / BULK
// PUT /:clientId/company/:companyId/share-holder/company/existing/bulk
router.put("/:clientId/company/:companyId/share-holder/company/existing/bulk", companyController.updateShareHolderCompanyExistingBulk);

// SHARE-HOLDER / COMPANY / NEW / BULK
// POST /:clientId/company/:companyId/share-holder/company/new/bulk
router.post("/:clientId/company/:companyId/share-holder/company/new/bulk", companyController.addShareHolderCompanyNewBulk);

// REPRESENTATION / PERSON / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/representation/person/existing/:personId
router.put("/:clientId/company/:companyId/representation/person/existing/:personId", companyController.updateRepresentationPersonExisting);

// REPRESENTATION / PERSON / NEW / SINGLE
// POST /:clientId/company/:companyId/representation/person/new
router.post("/:clientId/company/:companyId/representation/person/new", companyController.addRepresentationPersonNew);

// REPRESENTATION / PERSON / EXISTING / BULK
// PUT /:clientId/company/:companyId/representation/person/existing/bulk
router.put("/:clientId/company/:companyId/representation/person/existing/bulk", companyController.updateRepresentationPersonExistingBulk);

// REPRESENTATION / PERSON / NEW / BULK
// POST /:clientId/company/:companyId/representation/person/new/bulk
router.post("/:clientId/company/:companyId/representation/person/new/bulk", companyController.addRepresentationPersonNewBulk);

// REPRESENTATION / COMPANY / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/representation/company/existing/:addingCompanyId
router.put("/:clientId/company/:companyId/representation/company/existing/:addingCompanyId", companyController.updateRepresentationCompanyExisting);

// REPRESENTATION / COMPANY / NEW / SINGLE
// POST /:clientId/company/:companyId/representation/company/new
router.post("/:clientId/company/:companyId/representation/company/new", companyController.addRepresentationCompanyNew);

// REPRESENTATION / COMPANY / EXISTING / BULK
// PUT /:clientId/company/:companyId/representation/company/existing/bulk
router.put("/:clientId/company/:companyId/representation/company/existing/bulk", companyController.updateRepresentationCompanyExistingBulk);

// REPRESENTATION / COMPANY / NEW / BULK
// POST /:clientId/company/:companyId/representation/company/new/bulk
router.post("/:clientId/company/:companyId/representation/company/new/bulk", companyController.addRepresentationCompanyNewBulk);

module.exports = router;
