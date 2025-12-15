const { openai } = require("../../../config/openai");
// const fsReviewSystemPrompt = require("./fsReviewSystemPrompt"); // your T1–T26 rules here

/**
 * AI FS Review Engine Config
 * @param {Object} payload - Unified object containing:
 * {
 *   engagement, company, etb, adjustments, reclassifications,
 *   profit_and_loss, balance_sheet, lead_sheets,
 *   fs_text, fs_images
 * }
 */
exports.aiFsReviewConfig = async (payload) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1", // or gpt-5.1-pro if available
      temperature: 0,
      max_tokens: 8000,
      response_format: { type: "json_object" },

      messages: [
        {
          role: "system",
          content: "this is ai" // contains all instructions & T1–T26 tests
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ]
    });

    const raw = response.choices?.[0]?.message?.content;

    if (!raw) throw new Error("No response from AI.");

    return JSON.parse(raw);

  } catch (err) {
    console.error("FS Review AI Error:", err);
    throw new Error("AI FS Review failed. " + err.message);
  }
};
