// src/prompts/proceduresAnswersPrompt.js
function buildProceduresAnswersPrompt({ framework, context, questions, classifications }) {
  return `
SYSTEM:
You are an audit assistant. Provide DETAILED fieldwork ANSWERS and RECOMMENDATIONS
for the ${framework} framework, strictly using the provided context, ETB, WPs.

INPUT:
- CONTEXT: ${JSON.stringify(context ?? {}, null, 2)}
- QUESTIONS: ${JSON.stringify(questions ?? [], null, 2)}
- CLASSIFICATIONS: ${JSON.stringify(classifications ?? [], null, 2)}

FORMAT:
{
  "answers": [
    { "key": "<same question key>", "answer": "..." }
  ],
  "recommendations": "A plain-text string where:
    1. Classification lines MUST match exactly from INPUT (e.g., 'Assets > Current Assets', 'Expenses').
    2. NEVER use Markdown (#, *, _) or bullets in classification lines.
    3. Place each classification on its own line, followed by its recommendations.
    4. Recommendations under each classification should use '-' bullets and natural language.
    5. Separate classifications with a single newline.
  "
}

GUIDELINES:
- Be specific: tie to ETB refs, sample sizes, dates/thresholds.
- Recommendations should be actionable (e.g., 'Update control documentation for X').
- NEVER add/remove/merge classifications—use EXACTLY those provided.
`;
}
module.exports = buildProceduresAnswersPrompt;