const express = require('express');
const router = express.Router();
const accountingPortalMiddleware = require('./accountingPortal.middleware');
const {
  adjustmentController,
  reclassificationController,
  companyController,
  extendedTrialBalanceController,
  documentRequestController,
  kycController,
  engagementController,
  userController,
} = require('./accountingPortal.controller');
const upload = require('../../middlewares/upload');

/**
 * @route   POST /api/accounting-portal/register-client
 * @desc    Register a new client (public route)
 * @access  Public
 */
router.post('/register-client', userController.registerClient);

// Apply middleware to all routes below
router.use(accountingPortalMiddleware);

/**
 * @route   GET /api/accounting-portal/engagements
 * @desc    Get engagements by client ID (from middleware)
 * @access  Protected
 */
router.get('/engagements', engagementController.getEngagementsByClientId);

/**
 * @route   GET /api/accounting-portal/engagements/:id
 * @desc    Get engagement by ID
 * @access  Protected
 */
router.get('/engagements/:id', engagementController.getEngagementsById);

/**
 * @route   GET /api/accounting-portal/adjustments
 * @desc    Get adjustments by ETB ID (query param: etbId)
 * @access  Protected
 */
router.get('/adjustments', adjustmentController.getAdjustments);

/**
 * @route   GET /api/accounting-portal/adjustments/:id
 * @desc    Get adjustment by ID
 * @access  Protected
 */
router.get('/adjustments/:id', adjustmentController.getAdjustmentById);

/**
 * @route   GET /api/accounting-portal/reclassifications
 * @desc    Get reclassifications by ETB ID (query param: etbId)
 * @access  Protected
 */
router.get('/reclassifications', reclassificationController.getReclassifications);

/**
 * @route   GET /api/accounting-portal/reclassifications/:id
 * @desc    Get reclassification by ID
 * @access  Protected
 */
router.get('/reclassifications/:id', reclassificationController.getReclassificationById);

/**
 * @route   GET /api/accounting-portal/companies
 * @desc    Get companies by client ID (from middleware)
 * @access  Protected
 */
router.get('/companies', companyController.getCompaniesClientId);

/**
 * @route   GET /api/accounting-portal/companies/:id
 * @desc    Get company by ID
 * @access  Protected
 */
router.get('/companies/:id', companyController.getCompanyById);

/**
 * @route   GET /api/accounting-portal/companies/:id
 * @desc    Get company hierarchy by ID
 * @access  Protected
 */
router.get('/companies/:companyId/hierarchy', companyController.getCompanyHierarchy);

/**
 * @route   GET /api/accounting-portal/etb
 * @desc    Get ETB by engagement ID (query param: engagementId)
 * @access  Protected
 */
router.get('/etb', extendedTrialBalanceController.getEtb);

/**
 * @route   GET /api/accounting-portal/document-requests
 * @desc    Get document requests by engagement ID (query param: engagementId)
 * @access  Protected
 */
router.get('/document-requests', documentRequestController.getDocumentRequestsByEngagementId);

/**
 * @route   POST /api/accounting-portal/document-requests/:id/documents
 * @desc    Upload documents to document request
 * @access  Protected
 */
router.post(
  '/document-requests/:id/documents',
  upload.array('files'),
  documentRequestController.uploadDocumentRequestDocument
);

/**
 * @route   POST /api/accounting-portal/document-requests/:requestId/clear/:docIndex
 * @desc    Clear single document from document request
 * @access  Protected
 */
router.post(
  '/document-requests/:requestId/clear/:docIndex',
  documentRequestController.clearSingleDocument
);

/**
 * @route   GET /api/accounting-portal/kyc
 * @desc    Get KYC by company ID (query param: companyId)
 * @access  Protected
 */
router.get('/kyc', kycController.getKycByCompanyId);

module.exports = router;

