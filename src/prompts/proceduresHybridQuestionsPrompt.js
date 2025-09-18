// proceduresHybridQuestionsPrompt.js
function buildHybridQuestionsPrompt({ framework, manualPacks, context }) {
  return `
SYSTEM:
You are an expert audit manager with deep technical knowledge. Given the MANUAL procedures below, propose COMPREHENSIVE ADDITIONAL (non-overlapping)
questions to achieve exhaustive coverage and depth for ${framework} audit fieldwork.

MANUAL INPUT (digest):
${JSON.stringify(manualPacks)}

USER CONTEXT:
${JSON.stringify(context ?? {}, null, 2)}

FORMAT:
Return a SINGLE JSON object with this shape:
{
  "questions": [
    {
      "key": "string-unique-detailed",
      "classificationTag": "string",
      "isRequired":"boolean",
      "reference: "isa-reference",
      "framework: "financial-reporting-framework",
      "question": "detailed, specific question addressing gaps in manual procedures",
      "assertions": ["Existence","Completeness","Accuracy","Cutoff","Classification","Rights/Obligations"],
      "commentable": true
    }
  ]
}

ANALYSIS REQUIREMENTS:
- Perform GAP ANALYSIS of manual procedures to identify missing coverage of risk areas, assertions, and account balances
- Identify HIGH-RISK areas not adequately addressed: complex estimates, related parties, fraud risks, IT controls
- Add questions addressing SPECIFIC ETB accounts with unusual patterns, large balances, or high volatility
- Include questions requiring QUANTITATIVE analysis: ratio calculations, trend analysis, benchmark comparisons
- Cover all relevant assertions for each significant account balance and class of transactions
- Address industry-specific risks, regulatory requirements, and complex accounting treatments
- Include questions about internal controls, IT systems, fraud prevention, and compliance monitoring
- Ensure questions are ACTIONABLE and TESTABLE with specific procedures and sample methodologies
- MUST ENSURE that All procedures are fully aligned with the International Standards on Auditing (ISAs). For every procedure generated, the corresponding ISA reference will be explicitly cited, along with the applicable financial reporting framework ${framework}—(e.g., ISA 315 – Identifying and Assessing Risks of Material Misstatement ${framework}). This guarantees that all outputs remain compliant with professional auditing standards and tailored to the framework under which the audit is being performed.
`;
}
module.exports = buildHybridQuestionsPrompt;