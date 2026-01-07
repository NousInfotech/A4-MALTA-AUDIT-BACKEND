const adjustmentService = require('./services/adjusments.service');
const reclassificationService = require('./services/reclassification.service');
const companyService = require('./services/company.service');
const extendedTrialBalanceService = require('./services/extendedTrialBalance.service');
const documentRequestService = require('./services/documentRequest.service');
const kycService = require('./services/kyc.service');
const engagementService = require('./services/engagement.service');

/**
 * Adjustment Controller
 */
exports.adjustmentController = {
  /**
   * Get adjustments by ETB ID
   */
  getAdjustments: async (req, res, next) => {
    try {
      const { etbId } = req.query;
      if (!etbId) {
        return res.status(400).json({ error: 'etbId query parameter is required' });
      }
      const adjustments = await adjustmentService.getAdjustments(etbId);
      return res.json(adjustments);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get adjustment by ID
   */
  getAdjustmentById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adjustment = await adjustmentService.getAdjustmentById(id);
      return res.json(adjustment);
    } catch (error) {
      if (error.message === 'Adjustment not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

/**
 * Reclassification Controller
 */
exports.reclassificationController = {
  /**
   * Get reclassifications by ETB ID
   */
  getReclassifications: async (req, res, next) => {
    try {
      const { etbId } = req.query;
      if (!etbId) {
        return res.status(400).json({ error: 'etbId query parameter is required' });
      }
      const reclassifications = await reclassificationService.getReclassifications(etbId);
      return res.json(reclassifications);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get reclassification by ID
   */
  getReclassificationById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const reclassification = await reclassificationService.getReclassificationById(id);
      return res.json(reclassification);
    } catch (error) {
      if (error.message === 'Reclassification not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

/**
 * Company Controller
 */
exports.companyController = {
  /**
   * Get companies by client ID
   */
  getCompaniesClientId: async (req, res, next) => {
    try {
      const clientId = req.clientId;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID not found in request' });
      }
      const companies = await companyService.getCompaniesClientId(clientId);
      return res.json(companies);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get company by ID
   */
  getCompanyById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const company = await companyService.getCompanyById(id);
      return res.json(company);
    } catch (error) {
      if (error.message === 'Company not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

/**
 * Extended Trial Balance Controller
 */
exports.extendedTrialBalanceController = {
  /**
   * Get ETB by engagement ID
   */
  getEtb: async (req, res, next) => {
    try {
      const { engagementId } = req.query;
      if (!engagementId) {
        return res.status(400).json({ error: 'engagementId query parameter is required' });
      }
      const etb = await extendedTrialBalanceService.getEtb(engagementId);
      return res.json(etb);
    } catch (error) {
      if (error.message === 'Extended Trial Balance not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

/**
 * Document Request Controller
 */
exports.documentRequestController = {
  /**
   * Get document requests by engagement ID
   */
  getDocumentRequestsByEngagementId: async (req, res, next) => {
    try {
      const { engagementId } = req.query;
      if (!engagementId) {
        return res.status(400).json({ error: 'engagementId query parameter is required' });
      }
      const documentRequests = await documentRequestService.getDocumentRequestsByEngagementId(engagementId);
      return res.json(documentRequests);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload document request document
   */
  uploadDocumentRequestDocument: async (req, res, next) => {
    try {
      const { id } = req.params;
      const files = req.files || [];
      const body = req.body;
      const user = req.user;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const documentRequest = await documentRequestService.uploadDocumentRequestDocument(
        id,
        files,
        body,
        user
      );

      return res.json({
        success: true,
        message: `${files.length} document(s) uploaded successfully and added to both library and evidence`,
        documentRequest,
      });
    } catch (error) {
      if (error.message === 'Request not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  /**
   * Clear single document
   */
  clearSingleDocument: async (req, res, next) => {
    try {
      const { requestId, docIndex } = req.params;
      const docIndexNum = parseInt(docIndex);

      if (isNaN(docIndexNum)) {
        return res.status(400).json({ error: 'Invalid document index' });
      }

      const document = await documentRequestService.clearSingleDocument(requestId, docIndexNum);

      return res.json({
        success: true,
        message: 'Uploaded file cleared successfully',
        document,
      });
    } catch (error) {
      if (error.message === 'Document request not found' || error.message === 'Document not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

/**
 * KYC Controller
 */
exports.kycController = {
  /**
   * Get KYC by company ID
   */
  getKycByCompanyId: async (req, res, next) => {
    try {
      const { companyId } = req.query;
      if (!companyId) {
        return res.status(400).json({ error: 'companyId query parameter is required' });
      }
      const kyc = await kycService.getKycByCompanyId(companyId);
      return res.json(kyc);
    } catch (error) {
      next(error);
    }
  },
};

/**
 * Engagement Controller
 */
exports.engagementController = {
  /**
   * Get engagements by client ID
   */
  getEngagementsByClientId: async (req, res, next) => {
    try {
      const clientId = req.clientId;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID not found in request' });
      }
      const engagements = await engagementService.getEngagementsByClientId(clientId);
      return res.json(engagements);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get engagement by ID
   */
  getEngagementsById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const engagement = await engagementService.getEngagementsById(id);
      return res.json(engagement);
    } catch (error) {
      if (error.message === 'Engagement not found') {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },
};

