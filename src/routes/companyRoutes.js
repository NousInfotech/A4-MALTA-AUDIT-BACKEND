const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(requireAuth);

// Middleware to ensure a client can only access their own data
const requireSelfIfClient = (req, res, next) => {
  const clientId = req.params.clientId;
  if (req.user.role === 'client' && clientId && clientId !== req.user.id) {
    return res.status(403).json({ message: 'Insufficient permissions (Client ID mismatch)' });
  }
  next();
};

// Global search routes (must be before /:clientId routes to avoid conflicts)
// GET /api/client/company/search/global - Global search for companies (Auditors only)
router.get("/company/search/global", requireRole("employee"), companyController.searchCompaniesGlobal);

// GET /api/client/person/search/global - Global search for persons (Auditors only)
router.get("/person/search/global", requireRole("employee"), companyController.searchPersonsGlobal);

// From here onwards, routes involve :clientId

// GET /api/client/:clientId/company - Get all companies for a client
router.get(
  "/:clientId/company", 
  requireSelfIfClient,
  requireRole(["employee", "client"]), 
  companyController.getAllCompanies
);

// GET /api/client/:clientId/company/:companyId - Get a single company
router.get(
  "/:clientId/company/:companyId", 
  requireSelfIfClient,
  requireRole(["employee", "client"]), 
  companyController.getCompanyById
);

// GET /api/client/:clientId/company/:companyId/hierarchy - Get company hierarchy
router.get(
  "/:clientId/company/:companyId/hierarchy", 
  requireSelfIfClient,
  requireRole(["employee", "client"]), 
  companyController.getCompanyHierarchy
);

// For all other routes (mutations), require employee role explicitly

// POST /api/client/:clientId/company - Create a new company
router.post("/:clientId/company", requireRole("employee"), companyController.createCompany);

// PUT /api/client/:clientId/company/:companyId - Update a company
router.put("/:clientId/company/:companyId", requireRole("employee"), companyController.updateCompany);

// PUT /api/client/:clientId/company/:companyId/primary - Update a company's clientId
router.put("/:clientId/company/:companyId/primary", requireRole("employee"), companyController.updateCompanyClientId);

// DELETE /api/client/:clientId/company/:companyId - Delete a company
router.delete("/:clientId/company/:companyId", requireRole("employee"), companyController.deleteCompany);

// DELETE /api/client/:clientId/company/:companyId/representative/:personId - Remove representative only
router.delete("/:clientId/company/:companyId/representative/:personId", requireRole("employee"), companyController.removeRepresentative);

// ============================================
// 16 Routes for managing shareholders and representatives
// Base: /:clientId/company/:companyId
// ============================================

// SHARE-HOLDER / PERSON / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/share-holder/person/existing/:personId
router.put("/:clientId/company/:companyId/share-holder/person/existing/:personId", requireRole("employee"), companyController.updateShareHolderPersonExisting);

// SHARE-HOLDER / PERSON / NEW / SINGLE
// POST /:clientId/company/:companyId/share-holder/person/new
router.post("/:clientId/company/:companyId/share-holder/person/new", requireRole("employee"), companyController.addShareHolderPersonNew);

// SHARE-HOLDER / PERSON / EXISTING / BULK
// PUT /:clientId/company/:companyId/share-holder/person/existing/bulk
router.put("/:clientId/company/:companyId/share-holder/person/existing/bulk", requireRole("employee"), companyController.updateShareHolderPersonExistingBulk);

// SHARE-HOLDER / PERSON / NEW / BULK
// POST /:clientId/company/:companyId/share-holder/person/new/bulk
router.post("/:clientId/company/:companyId/share-holder/person/new/bulk", requireRole("employee"), companyController.addShareHolderPersonNewBulk);

// SHARE-HOLDER / COMPANY / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/share-holder/company/existing/:addingCompanyId
router.put("/:clientId/company/:companyId/share-holder/company/existing/:addingCompanyId", requireRole("employee"), companyController.updateShareHolderCompanyExisting);

// SHARE-HOLDER / COMPANY / NEW / SINGLE
// POST /:clientId/company/:companyId/share-holder/company/new
router.post("/:clientId/company/:companyId/share-holder/company/new", requireRole("employee"), companyController.addShareHolderCompanyNew);

// SHARE-HOLDER / COMPANY / EXISTING / BULK
// PUT /:clientId/company/:companyId/share-holder/company/existing/bulk
router.put("/:clientId/company/:companyId/share-holder/company/existing/bulk", requireRole("employee"), companyController.updateShareHolderCompanyExistingBulk);

// SHARE-HOLDER / COMPANY / NEW / BULK
// POST /:clientId/company/:companyId/share-holder/company/new/bulk
router.post("/:clientId/company/:companyId/share-holder/company/new/bulk", requireRole("employee"), companyController.addShareHolderCompanyNewBulk);

// REPRESENTATION / PERSON / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/representation/person/existing/:personId
router.put("/:clientId/company/:companyId/representation/person/existing/:personId", requireRole("employee"), companyController.updateRepresentationPersonExisting);

// REPRESENTATION / PERSON / NEW / SINGLE
// POST /:clientId/company/:companyId/representation/person/new
router.post("/:clientId/company/:companyId/representation/person/new", requireRole("employee"), companyController.addRepresentationPersonNew);

// REPRESENTATION / PERSON / EXISTING / BULK
// PUT /:clientId/company/:companyId/representation/person/existing/bulk
router.put("/:clientId/company/:companyId/representation/person/existing/bulk", requireRole("employee"), companyController.updateRepresentationPersonExistingBulk);

// REPRESENTATION / PERSON / NEW / BULK
// POST /:clientId/company/:companyId/representation/person/new/bulk
router.post("/:clientId/company/:companyId/representation/person/new/bulk", requireRole("employee"), companyController.addRepresentationPersonNewBulk);

// REPRESENTATION / COMPANY / EXISTING / SINGLE
// PUT /:clientId/company/:companyId/representation/company/existing/:addingCompanyId
router.put("/:clientId/company/:companyId/representation/company/existing/:addingCompanyId", requireRole("employee"), companyController.updateRepresentationCompanyExisting);

// REPRESENTATION / COMPANY / NEW / SINGLE
// POST /:clientId/company/:companyId/representation/company/new
router.post("/:clientId/company/:companyId/representation/company/new", requireRole("employee"), companyController.addRepresentationCompanyNew);

// REPRESENTATION / COMPANY / EXISTING / BULK
// PUT /:clientId/company/:companyId/representation/company/existing/bulk
router.put("/:clientId/company/:companyId/representation/company/existing/bulk", requireRole("employee"), companyController.updateRepresentationCompanyExistingBulk);

// REPRESENTATION / COMPANY / NEW / BULK
// POST /:clientId/company/:companyId/representation/company/new/bulk
router.post("/:clientId/company/:companyId/representation/company/new/bulk", requireRole("employee"), companyController.addRepresentationCompanyNewBulk);

module.exports = router;
