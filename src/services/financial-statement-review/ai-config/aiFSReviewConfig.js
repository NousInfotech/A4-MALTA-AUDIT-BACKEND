const { openai } = require("../../../config/openai");
const { generateAiPrompt } = require("./aiPromptGenerator");

/**
 * AI FS Review Engine Config
 * @param {Object} portalData - Portal data from extractPortalData service
 * @param {Array} pdfData - PDF page data array from fsPdfDataExtractor
 * @returns {Promise<Object>} Review results in A/B/C/D/E JSON structure
 */
exports.aiFsReviewConfig = async (portalData, pdfData) => {
  try {
    // Generate the complete system prompt
    const systemPrompt = generateAiPrompt(portalData, pdfData);

    // Prepare user message with the actual data
    const userMessage = JSON.stringify({
      portalData: portalData,
      pdfData: pdfData
    });

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      temperature: 0,
      max_completion_tokens: 8000,
      response_format: { type: "json_object" },

      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const raw = response.choices?.[0]?.message?.content;

    if (!raw) throw new Error("No response from AI.");

    const result = JSON.parse(raw);

    // Validate that result has the required structure (A, B, C, D, E)
    if (!result.A || !result.B || !result.C || !result.D || !result.E) {
      throw new Error("AI response does not match required A/B/C/D/E structure.");
    }

    return result;

  } catch (err) {
    console.error("FS Review AI Error:", err);
    throw new Error("AI FS Review failed. " + err.message);
  }
};
