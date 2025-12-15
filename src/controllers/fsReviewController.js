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
      note: "Check the output.json file in the service folder"
    });
  } catch (error) {
    console.error("Error generating test output:", error);
    res.status(500).json({ 
      error: "Failed to generate test output",
      message: error.message 
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
    
    const result = await fsReviewServices.generateFinancialStatementReview(engagementId, file);
    res.status(200).json({ 
      message: "Financial statement review generated successfully",
      data: result 
    });
  } catch (error) {
    console.error("Error generating financial statement review:", error);
    res.status(500).json({ 
      error: "Failed to generate financial statement review",
      message: error.message 
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
      data 
    });
  } catch (error) {
    console.error("Error extracting portal data:", error);
    res.status(500).json({ 
      error: "Failed to extract portal data",
      message: error.message 
    });
  }
};
