const fsReviewServices = require("../services/financial-statement-review");

/**
 * Controller for Financial Statement Review endpoints
 */

// Test output generation endpoint
exports.generateTestOutput = async (req, res) => {
  try {
    await fsReviewServices.generateTestOutput();
    res.status(200).json({
      message: "Test output generated successfully",
      note: "Check the output.json file in the service folder",
    });
  } catch (error) {
    console.error("Error generating test output:", error);
    res.status(500).json({
      error: "Failed to generate test output",
      message: error.message,
    });
  }
};

// Extract portal data endpoint
exports.extractPortalData = async (req, res) => {
  try {
    const { engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }

    const data = await fsReviewServices.extractPortalData(engagementId);
    res.status(200).json({
      message: "Portal data extracted successfully",
      data,
    });
  } catch (error) {
    console.error("Error extracting portal data:", error);
    res.status(500).json({
      error: "Failed to extract portal data",
      message: error.message,
    });
  }
};

// geneate pdf
exports.extractFsPdfDataTestOutput = async (req, res) => {
  try {
    const data = await fsReviewServices.extractFsPdfDataTestOutput();

    return res.status(200).json({
      success: true,
      message: "PDF test output generated successfully",
      data,
    });
  } catch (error) {
    console.error("Error generating pdf test output:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate PDF test output",
    });
  }
};

exports.testFsReview = async (req, res) => {
  try {
    const output = await fsReviewServices.fsTestReview();
    return res.status(200).json({
      success: true,
      message: "Financial statement review generated successfully",
      data: output,
    });
  } catch (error) {
    console.error("Error generating financial statement review:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate financial statement review",
    });
  }
};

// Generate Financial Statement Review endpoint
exports.generateFinancialStatementReview = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const file = req.file; // Assuming file upload middleware is used

    if (!engagementId) {
      return res.status(400).json({ error: "Engagement ID is required" });
    }

    // Extract request body parameters
    // Handle FormData - fields come as strings, need to parse
    let includeTests = req.body?.includeTests;
    let includePortalData = req.body?.includePortalData;
    
    // Parse includeTests if it's a JSON string (from FormData)
    if (includeTests && typeof includeTests === 'string') {
      try {
        includeTests = JSON.parse(includeTests);
      } catch (e) {
        // If parsing fails, try to split by comma or treat as single value
        includeTests = includeTests.split(',').map(s => s.trim());
      }
    }
    
    // Parse includePortalData if it's a string (from FormData)
    if (typeof includePortalData === 'string') {
      includePortalData = includePortalData === 'true';
    }
    
    // Validate includeTests if provided
    const validCategories = ['AUDIT_REPORT', 'BALANCE_SHEET', 'INCOME_STATEMENT', 'GENERAL', 'NOTES_AND_POLICY', 'CROSS_STATEMENT', 'PRESENTATION', 'ALL'];
    const defaultIncludeTests = ['ALL'];
    
    let finalIncludeTests = defaultIncludeTests;
    if (includeTests) {
      // Ensure it's an array
      const testsArray = Array.isArray(includeTests) ? includeTests : [includeTests];
      // Validate all values are valid categories
      const invalidCategories = testsArray.filter(cat => !validCategories.includes(cat));
      if (invalidCategories.length > 0) {
        return res.status(400).json({ 
          error: `Invalid categories in includeTests: ${invalidCategories.join(', ')}. Valid options: ${validCategories.join(', ')}` 
        });
      }
      finalIncludeTests = testsArray;
    }

    // Default includePortalData to false if not provided
    const finalIncludePortalData = includePortalData === true || includePortalData === 'true';

    const result = await fsReviewServices.generateFinancialStatementReview(
      engagementId,
      file,
      finalIncludeTests,
      finalIncludePortalData
    );
    
    res.status(200).json({
      message: "Financial statement review generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error generating financial statement review:", error);
    res.status(500).json({
      error: "Failed to generate financial statement review",
      message: error.message,
    });
  }
};
