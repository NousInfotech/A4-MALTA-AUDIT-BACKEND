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
 * AI FS Review Engine Config
 * @param {Object} portalData - Portal data from extractPortalData service
 * @param {Array} pdfData - PDF page data array with text per page
 * @param {Array} base64Images - Array of { page_no, base64Image } objects
 * @returns {Promise<Object>} Review results in A/B/C/D/E JSON structure
 */
exports.aiFsReviewConfig = async (portalData, pdfData, base64Images = []) => {
  try {
    // Generate the complete system prompt
    const systemPrompt = generateAiPrompt(portalData, pdfData);

    // Build content array for vision API (text + images)
    const contentArray = [];

    // Add portal data as text
    contentArray.push({
      type: "text",
      text: `Portal Data:\n${JSON.stringify(portalData, null, 2)}\n\nPDF Text Data:\n${JSON.stringify(pdfData.map(page => ({ page_no: page.page_no, text: page.text })), null, 2)}\n\nAnalyze the financial statements using the portal data, PDF text content, and images provided below. Perform all tests T1-T26 and return results in the required JSON format.`
    });

    // Add images in page order
    // Create a map of page_no to base64Image for efficient lookup
    const imageMap = {};
    if (base64Images && Array.isArray(base64Images)) {
      base64Images.forEach(img => {
        if (img.page_no !== null && img.base64Image) {
          imageMap[img.page_no] = img.base64Image;
        }
      });
    }

    // Add images in page order matching pdfData
    if (pdfData && Array.isArray(pdfData)) {
      // Sort pdfData by page_no for consistency
      const sortedPdfData = [...pdfData].sort((a, b) => (a.page_no || 0) - (b.page_no || 0));
      
      for (const page of sortedPdfData) {
        const pageNo = page.page_no;
        const base64Image = imageMap[pageNo];
        
        if (base64Image) {
          contentArray.push({
            type: "image_url",
            image_url: {
              url: base64Image
            }
          });
        }
      }
    }

    // Save systemPrompt and contentArray to files
    try {
      const backendDir = path.join(__dirname, "../../../../");
      const systemPromptPath = path.join(backendDir, "systemPrompt.txt");
      const contentArrayPath = path.join(backendDir, "contentArray.txt");

      // Save systemPrompt as text file
      fs.writeFileSync(systemPromptPath, systemPrompt, "utf8");
      console.log(`[FS Review] systemPrompt saved to: ${systemPromptPath}`);

      // Save contentArray as JSON file (with pretty formatting)
      // Note: base64 images in contentArray will be included in the JSON
      const contentArrayJson = JSON.stringify(contentArray, null, 2);
      fs.writeFileSync(contentArrayPath, contentArrayJson, "utf8");
      console.log(`[FS Review] contentArray saved to: ${contentArrayPath}`);
    } catch (fileError) {
      console.error("[FS Review] Error saving systemPrompt/contentArray to files:", fileError);
      // Don't throw - continue with the API call even if file saving fails
    }

    // Use fixed seed for determinism (42 is a common choice)
    const DETERMINISTIC_SEED = 42;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      temperature: 0,
      seed: DETERMINISTIC_SEED,
      max_completion_tokens: 8000,
      response_format: { type: "json_object" },

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: contentArray,
        },
      ],
    });

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


