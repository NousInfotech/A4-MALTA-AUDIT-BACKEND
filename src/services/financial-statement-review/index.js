// Import all services from the financial-statement-review folder
const generateTestOutput = require("./tests/generateTestOutput");
const generateFSReview = require("./generateFSReview.service");
const extractETBData = require("./portal-data/trial-balance/extractETBData");
const fsPdfDataExtractor = require("./pdf-data/fsPdfDataExtractor");
const aiFSReviewConfig = require("./ai-config/aiFSReviewConfig");
const extractPortalData = require("./portal-data/extractPortalData.service");

// Export all services as a single object
module.exports = {
  // Main service functions
  generateTestOutput: generateTestOutput.generateTestOutput,
  generateFinancialStatementReview: generateFSReview.generateFinancialStatementReview,
  extractPortalData: extractPortalData.extractPortalData,
  
  // ETB data extraction
  extractETBData: extractETBData.extractETBData,
  deriveIncomeStatement: extractETBData.deriveIncomeStatement,
  deriveBalanceSheet: extractETBData.deriveBalanceSheet,
  deriveLeadSheets: extractETBData.deriveLeadSheets,
  
  // PDF extraction
  fsPdfTextExtractor: fsPdfDataExtractor.fsPdfTextExtractor,
  fsPdfImageExtractor: fsPdfDataExtractor.fsPdfImageExtractor,
  
  // AI services
  aiFsReviewConfig: aiFSReviewConfig.aiFsReviewConfig,
};