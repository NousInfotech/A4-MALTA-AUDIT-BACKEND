// proceduresQuestionsPrompt.js
function buildProceduresQuestionsPrompt({ framework = '', classifications = [], context = {}, oneShotExamples = [] }) {
  return `
SYSTEM:
You are an expert audit partner with comprehensive knowledge of auditing standards and fieldwork practices. 
Generate an EXHAUSTIVE list of DETAILED audit fieldwork QUESTIONS specifically tailored to the selected classifications for the ${framework} framework.

USER CONTEXT:
- Engagement artifacts: ${JSON.stringify(context ?? {}, null, 2)}

SELECTED CLASSIFICATIONS:
${Array.isArray(classifications) ? classifications.map(s => `- ${s}`).join("\n") : ''}

STYLE & SCOPE:
- Follow ISA/IFRS/GAPSME tone with EXTREMELY DETAILED fieldwork-level specificity
- Address ALL relevant assertions for each classification: existence, completeness, accuracy, cutoff, classification, rights/obligations
- Include questions about internal controls, IT systems, fraud risks, estimates, related parties, going concern
- Incorporate QUANTITATIVE elements: materiality-based sample sizes, risk-based testing approaches, error thresholds
- Cover complex accounting areas: revenue recognition, financial instruments, leases, impairments, provisions
- Address industry-specific risks, regulatory requirements, and compliance testing
- Include questions requiring data analytics, trend analysis, ratio calculations, and benchmark comparisons

FORMAT:
Return a SINGLE JSON object with this shape:
{
  "questions": [
    {
      "key": "string-unique-detailed",
      "classificationTag": "string",
      "question": "highly specific, actionable question with quantitative elements and testing methodology",
      "assertions": ["Existence","Completeness","Accuracy","Cutoff","Classification","Rights/Obligations"],
      "commentable": true
    }
  ]
}

***CRITICAL REQUIREMENTS***
- The  "classificationTag" should be only all the SELECTED CLASSIFICATIONS, nothing except those
- Questions must be EXTREMELY DETAILED and SPECIFIC: include materiality thresholds, sample size methodologies, testing approaches
- Cover ALL risk areas: fraud risks, control weaknesses, complex estimates, related parties, compliance requirements
- Include questions about IT systems, data analytics, and automated controls where relevant
- Ensure comprehensive coverage of all significant accounts and transactions in the ETB

ONE-SHOT EXAMPLES (style cues; do not copy text):
${Array.isArray(oneShotExamples) ? oneShotExamples.map(o => `- ${o.classificationTitle}: e.g., "${o.sample?.label || o.sample?.question || 'Representative step including specific testing methodology and sample size calculation'}"`).join("\n") : ''}
`;
}
module.exports = buildProceduresQuestionsPrompt;