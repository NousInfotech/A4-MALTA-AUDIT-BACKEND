// src/prompts/proceduresHybridQuestionsPrompt.js
function buildHybridQuestionsPrompt({ framework, manualPacks, context }) {
  return `
SYSTEM:
You are an audit assistant. Given the MANUAL procedures below, propose ADDITIONAL (non-overlapping)
questions to broaden coverage and depth for ${framework}.

MANUAL INPUT (digest):
${JSON.stringify(manualPacks.map(p => ({
    title: p.title,
    fields: p.fields.slice(0, 8).map(f => ({ key: f.key, label: f.label }))
})), null, 2)}

USER CONTEXT:
${JSON.stringify(context ?? {}, null, 2)}

FORMAT:
Return a SINGLE JSON object with this shape:
{
  "questions": [
    {
      "key": "string-unique",
      "classificationTag": "string",
      "question": "clear question",
      "assertions": ["Existence","Completeness", "..."],
      "commentable": true
    }
  ]
}
`;
}
module.exports = buildHybridQuestionsPrompt;
