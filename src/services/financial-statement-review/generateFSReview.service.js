const { extractPortalData } = require('./portal-data/extractPortalData.service');
const { fsPdfDataExtractor } = require('./pdf-data/fsPdfDataExtractor');
const { convertImagesToBase64 } = require('./pdf-data/imageUtils');
const { aiFsReviewConfig } = require('./ai-config/aiFSReviewConfig');
const fs = require('fs');
const path = require('path');

/**
 * Generate Financial Statement Review
 * Orchestrates the complete review process:
 * 1. Extract portal data (engagement, company, ETB, P&L, BS, lead sheets)
 * 2. Extract PDF data (text and images per page)
 * 3. Convert images to base64
 * 4. Main Flow: Analyze with GPT-5.2 using portal data + PDF text + images in unified call
 * 5. Return structured review results
 * 
 * @param {string} engagementId - Engagement ID from database
 * @param {Object} file - Multer file object from frontend (must be PDF)
 * @returns {Promise<Object>} Review results in A/B/C/D/E JSON structure
 */
exports.generateFinancialStatementReview = async (engagementId, file) => {
  try {
    // Validate inputs
    if (!engagementId) {
      throw new Error("Engagement ID is required");
    }

    if (!file) {
      throw new Error("PDF file is required");
    }

    // Validate file is PDF
    const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'pdf') {
      throw new Error("File must be a PDF document");
    }

    // Validate file buffer exists
    if (!file.buffer) {
      throw new Error("File buffer is missing. Ensure file was uploaded correctly.");
    }

    // Step 1: Extract portal data
    console.log(`[FS Review] Extracting portal data for engagement: ${engagementId}`);
    const portalData = await extractPortalData(engagementId);
    
    if (!portalData) {
      throw new Error("Failed to extract portal data");
    }

    // Validate essential portal data exists
    if (!portalData.engagement || !portalData.company || !portalData.etb) {
      throw new Error("Portal data is incomplete. Missing essential fields.");
    }

    // Step 2: Extract PDF data
    console.log(`[FS Review] Extracting PDF data from file: ${file.originalname}`);
    const pdfBuffer = file.buffer;
    
    // Generate unique session ID for this request to prevent filename conflicts
    // Format: engagementId_timestamp_random
    const sessionId = `${engagementId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Extract PDF data (text and images per page)
    let pdfExtractionResult;
    let imageFiles = [];
    
    try {
      pdfExtractionResult = await fsPdfDataExtractor(pdfBuffer, sessionId);
      
      if (!pdfExtractionResult || !pdfExtractionResult.pageDataArray || !Array.isArray(pdfExtractionResult.pageDataArray) || pdfExtractionResult.pageDataArray.length === 0) {
        // Cleanup images if extraction failed
        if (pdfExtractionResult?.imageFiles) {
          cleanupImages(pdfExtractionResult.imageFiles);
        }
        throw new Error("Failed to extract PDF data or PDF is empty");
      }
      
      imageFiles = pdfExtractionResult.imageFiles || [];
    } catch (extractionError) {
      // Cleanup any images that might have been created before the error
      if (pdfExtractionResult?.imageFiles) {
        cleanupImages(pdfExtractionResult.imageFiles);
      }
      throw extractionError;
    }

    const pdfData = pdfExtractionResult.pageDataArray;

    console.log(`[FS Review] Extracted ${pdfData.length} pages from PDF`);
    console.log(`[FS Review] Session ID: ${sessionId} (${imageFiles.length} images created)`);

    // Step 3: Convert images to base64 for unified GPT-5.2 call
    console.log(`[FS Review] Converting images to base64...`);
    let base64Images;
    try {
      base64Images = await convertImagesToBase64(imageFiles, pdfData);
      
      if (base64Images.length === 0) {
        console.warn(`[FS Review] Warning: No images converted to base64, proceeding with text-only analysis`);
      } else {
        console.log(`[FS Review] Converted ${base64Images.length} images to base64`);
      }
    } catch (imageError) {
      console.error("[FS Review] Image conversion failed:", imageError);
      cleanupImages(imageFiles);
      throw new Error(`Image conversion failed: ${imageError.message}`);
    }

    // Step 4: Main Flow - Generate AI prompt and call OpenAI for review with unified GPT-5.2 call
    console.log(`[FS Review] Starting main flow (GPT-5.2 unified financial review)...`);
    let reviewResults;
    try {
      reviewResults = await aiFsReviewConfig(portalData, pdfData, base64Images);
    } catch (aiError) {
      // Cleanup images before throwing error
      cleanupImages(imageFiles);
      throw aiError;
    }

    // Cleanup images after main flow completes
    console.log(`[FS Review] Cleaning up ${imageFiles.length} temporary images after main flow...`);
    cleanupImages(imageFiles);
    console.log(`[FS Review] Image cleanup completed`);

    // Validate review results structure
    if (!reviewResults || typeof reviewResults !== 'object') {
      throw new Error("AI review returned invalid results");
    }

    // Ensure all required sections exist
    const requiredSections = ['A', 'B', 'C', 'D', 'E'];
    for (const section of requiredSections) {
      if (!(section in reviewResults)) {
        throw new Error(`AI review results missing required section: ${section}`);
      }
    }

    console.log(`[FS Review] Main flow completed successfully`);
    console.log(`[FS Review] Section A (Confirmed): ${reviewResults.A?.items?.length || 0} items`);
    console.log(`[FS Review] Section B (Critical Errors): ${reviewResults.B?.items?.length || 0} items`);
    console.log(`[FS Review] Section C (Disclosure Breaches): ${reviewResults.C?.items?.length || 0} items`);
    console.log(`[FS Review] Final Verdict: ${reviewResults.E?.verdict || 'Unknown'}`);

    // Step 5: Return review results
    return reviewResults;

  } catch (err) {
    console.error("[FS Review] Error in generateFinancialStatementReview:", err);
    // Note: Image cleanup is handled in try-catch blocks above
    throw new Error(`Financial Statement Review failed: ${err.message}`);
  }
};

/**
 * Cleanup function to delete temporary image files
 * @param {string[]} imageFiles - Array of image file paths to delete
 */
function cleanupImages(imageFiles) {
  if (!imageFiles || !Array.isArray(imageFiles) || imageFiles.length === 0) {
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;

  imageFiles.forEach((imagePath) => {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        deletedCount++;
      }
    } catch (error) {
      console.error(`[FS Review] Failed to delete image: ${imagePath}`, error);
      errorCount++;
    }
  });

  if (deletedCount > 0) {
    console.log(`[FS Review] Deleted ${deletedCount} temporary image(s)`);
  }
  if (errorCount > 0) {
    console.warn(`[FS Review] Failed to delete ${errorCount} image(s)`);
  }
}
