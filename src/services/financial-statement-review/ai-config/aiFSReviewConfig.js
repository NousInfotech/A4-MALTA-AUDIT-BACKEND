const { openai } = require("../../../config/openai");
const { generateAiPrompt } = require("./aiPromptGenerator");
const fs = require("fs");
const path = require("path");

/**
 * Deduplicates test_ids across sections A, B, and C
 * Priority: Section B > Section C > Section A
 * If a test_id appears in multiple sections, keep it only in the highest priority section
 * @param {Object} result - AI review results with sections A, B, C, D, E
 * @returns {Object} Deduplicated results
 */
function deduplicateTestIds(result) {
  // Extract test_ids from each section
  const testIdsInB = new Set();
  const testIdsInC = new Set();
  const testIdsInA = new Set();

  // Collect test_ids from Section B (highest priority)
  if (result.B && Array.isArray(result.B.items)) {
    result.B.items.forEach((item) => {
      if (item.test_id) {
        testIdsInB.add(item.test_id);
      }
    });
  }

  // Collect test_ids from Section C (medium priority)
  if (result.C && Array.isArray(result.C.items)) {
    result.C.items.forEach((item) => {
      if (item.test_id) {
        testIdsInC.add(item.test_id);
      }
    });
  }

  // Collect test_ids from Section A (lowest priority)
  if (result.A && Array.isArray(result.A.items)) {
    result.A.items.forEach((item) => {
      if (item.test_id) {
        testIdsInA.add(item.test_id);
      }
    });
  }

  // Remove duplicates: if a test_id is in B, remove it from A and C
  // If a test_id is in C (but not B), remove it from A
  const testIdsToRemoveFromA = new Set([...testIdsInB, ...testIdsInC]);
  const testIdsToRemoveFromC = new Set([...testIdsInB]);

  // Filter Section A: remove items whose test_id appears in B or C
  const originalACount = result.A?.items?.length || 0;
  if (result.A && Array.isArray(result.A.items)) {
    result.A.items = result.A.items.filter((item) => {
      if (!item.test_id) return true; // Keep items without test_id (shouldn't happen but be safe)
      return !testIdsToRemoveFromA.has(item.test_id);
    });
  }
  const removedFromA = originalACount - (result.A?.items?.length || 0);

  // Filter Section C: remove items whose test_id appears in B
  const originalCCount = result.C?.items?.length || 0;
  if (result.C && Array.isArray(result.C.items)) {
    result.C.items = result.C.items.filter((item) => {
      if (!item.test_id) return true; // Keep items without test_id
      return !testIdsToRemoveFromC.has(item.test_id);
    });
  }
  const removedFromC = originalCCount - (result.C?.items?.length || 0);

  // Log deduplication if any items were removed
  if (removedFromA > 0 || removedFromC > 0) {
    console.log(
      `[FS Review] Deduplicated test_ids: removed ${removedFromA} from Section A, ${removedFromC} from Section C`
    );
  }

  return result;
}

/**
 * Helper function to extract page number from image filename
 * @param {string} imageName - Image filename
 * @returns {number|null} Page number if found, null otherwise
 */
function extractPageNoFromFilename(imageName) {
  const match = imageName.match(/_page_(\d+)\.png$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * AI FS Review Engine Config
 * @param {Object|null} portalData - Portal data from extractPortalData service (null if not included)
 * @param {Array} pdfData - PDF page data array with text per page
 * @param {Array<string>} imageFiles - Array of image file paths (will be converted to base64 one at a time)
 * @param {Array<string>} includeTests - Array of test categories to include (default: ["ALL"])
 * @param {boolean} includePortalData - Whether portal data is included (default: false)
 * @returns {Promise<Object>} Review results in A/B/C/D/E JSON structure
 */
exports.aiFsReviewConfig = async (portalData, pdfData, imageFiles = [], includeTests = ['ALL'], includePortalData = false) => {
  try {
    // Build text content for OpenAI API (portal data + instruction) - must do before portalData cleanup
    let textContent = '';
    if (includePortalData && portalData) {
      textContent = `Portal Data:\n${JSON.stringify(portalData, null, 2)}\n\nAnalyze the financial statements using the portal data, PDF text content, and images provided below. Perform the selected tests and return results in the required JSON format.`;
    } else {
      textContent = `Analyze the financial statements using the PDF text content and images provided below. Perform the selected tests and return results in the required JSON format.`;
    }

    // Generate the complete system prompt
    const systemPrompt = generateAiPrompt(portalData, pdfData, includeTests, includePortalData);
    
    // Early cleanup: portal data is now serialized in prompt and textContent, can be GC'd
    portalData = null;

    // Build content array for vision API (text + images)
    const apiContentArray = [];

    // Add portal data and instruction as first text block for API
    apiContentArray.push({
      type: "text",
      text: textContent
    });

    // Process images one at a time in sorted page order: read, convert, add to array
    // This ensures only ONE base64 image exists in memory at any time (plus those already in apiContentArray)
    if (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0 && pdfData && Array.isArray(pdfData)) {
      // Sort PDF data by page number to process images in correct order
      const sortedPdfData = [...pdfData].sort((a, b) => (a.page_no || 0) - (b.page_no || 0));
      
      // Process images in page order matching pdfData
      for (const page of sortedPdfData) {
        const pageNo = page.page_no;
        const imageName = page.imageName ? path.basename(page.imageName) : null;
        
        if (!imageName) continue;
        
        // Find corresponding image file
        const imagePath = imageFiles.find(imgPath => path.basename(imgPath) === imageName);
        if (!imagePath) continue;
        
        try {
          if (!fs.existsSync(imagePath)) {
            console.warn(`[FS Review] Image file not found: ${imagePath}`);
            continue;
          }

          // Read, convert, and add immediately (one at a time)
          // Only this image's buffer and base64 string exist in memory at this moment
          const imageBuffer = fs.readFileSync(imagePath);
          const base64String = imageBuffer.toString('base64');
          const base64Image = `data:image/png;base64,${base64String}`;
          
          // Add to content array immediately
          apiContentArray.push({
            type: "image_url",
            image_url: {
              url: base64Image
            }
          });
          
          // imageBuffer and base64String will be GC'd after this iteration completes
          // base64Image persists in apiContentArray until API call completes
          // This ensures we never have more than one image's data in temporary variables
          
        } catch (error) {
          console.error(`[FS Review] Failed to process image: ${imagePath}`, error);
          // Continue with other images instead of failing completely
        }
      }
    }

    // Use fixed seed for determinism (42 is a common choice)
    const DETERMINISTIC_SEED = 42;

    console.log('[FS Review] Starting AI API call...');
    console.log(`[FS Review] Model: gpt-5.2, Max completion tokens: 16000`);
    console.log(`[FS Review] System prompt length: ${systemPrompt.length} characters`);
    
    // Calculate counts safely to avoid stringifying large arrays in logs
    const textCount = apiContentArray.filter(item => item.type === 'text').length;
    const imageCount = apiContentArray.filter(item => item.type === 'image_url').length;
    console.log(`[FS Review] Content array items: ${apiContentArray.length} (${textCount} text, ${imageCount} images)`);

    // Create a promise with timeout wrapper
    const apiCallPromise = openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0,
      seed: DETERMINISTIC_SEED,
      max_completion_tokens: 16000, // Increased from 8000 to allow for larger responses
      response_format: { type: "json_object" },

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: apiContentArray,
        },
      ],
    });

    // Add timeout wrapper (10 minutes = 600000ms)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('AI API call timed out after 10 minutes'));
      }, 600000); // 10 minutes
    });

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    console.log('[FS Review] AI API call completed successfully');

    const raw = response.choices?.[0]?.message?.content;


    if (!raw) throw new Error("No response from AI.");

    const result = JSON.parse(raw);

    // Validate that result has the required structure (A, B, C, D, E)
    if (!result.A || !result.B || !result.C || !result.D || !result.E) {
      throw new Error(
        "AI response does not match required A/B/C/D/E structure."
      );
    }

    // Deduplicate test_ids: ensure each test_id appears in only ONE section
    // Priority: Section B (critical errors) > Section C (regulatory breaches) > Section A (confirmed correct)
    const output = deduplicateTestIds(result);

    return output;
  } catch (err) {
    console.error("FS Review AI Error:", err);
    throw new Error("AI FS Review failed. " + err.message);
  }
};


