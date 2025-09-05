// src/prompts/proceduresQuestionsPrompt.js
function buildProceduresQuestionsPrompt({ framework = '', classifications = [], context = {}, oneShotExamples = [] }) {
  return `
SYSTEM:
You are an audit assistant. Generate a comprehensive list of audit fieldwork QUESTIONS only
(no answers yet), specific to the selected classifications for the ${framework} framework.

USER CONTEXT:
- Engagement artifacts: ${JSON.stringify(context ?? {}, null, 2)}

SELECTED CLASSIFICATIONS:
${Array.isArray(classifications) ? classifications.map(s => `- ${s}`).join("\n") : ''}

STYLE & SCOPE:
- Follow ISA/IFRS/GAPSME tone, fieldwork-level detail.
- Avoid duplication; group logically; be concise and actionable.

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

***IMPORTANT NOTE***
The  "classificationTag" should be only all the SELECTED CLASSIFICATIONS, nothing except those
ONE-SHOT EXAMPLES (style cues; do not copy text):
${Array.isArray(oneShotExamples) ? oneShotExamples.map(o => `- ${o.classificationTitle}: e.g., "${o.sample?.label || o.sample?.question || 'Representative step'}"`).join("\n") : ''}
`;
}
module.exports = buildProceduresQuestionsPrompt;
