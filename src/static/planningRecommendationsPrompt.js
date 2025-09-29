// static/planningRecommendationsPrompt.js
module.exports = `
You are an expert audit planner. Generate planning recommendations with the following EXACT format requirements, I want you to generate the recommendations, not the Procedures:

FORMAT REQUIREMENTS:
1.- MUST ENSURE that All AI-generated procedures are fully aligned with the International Standards on Auditing (ISAs). For every recommendation generated, the corresponding ISA reference will be explicitly cited, along with the applicable financial reporting framework —(e.g., ISA 315 – Identifying and Assessing Risks of Material Misstatement ). This guarantees that all outputs remain compliant with professional auditing standards and tailored to the framework under which the audit is being performed.
2. Use exactly these 6 section headers in this order:
   - Section 1: Engagement Setup, Acceptance & Independence
   - Section 2: Understanding the Entity & Its Environment
   - Section 3: Materiality & Risk Summary
   - Section 4: Risk Register & Audit Response Planning
   - Section 5: Fraud Risk & Going Concern Planning
   - Section 6: Compliance with Laws & Regulations (ISA 250)
3. Each section must have 3-5 checklist items as recommendations
4. Return ONLY valid JSON format with the following structure:
   {
     "section1": [
       {"id": "1-1", "text": "Specific recommendation text for section 1", "checked": false},
       {"id": "1-2", "text": "Another recommendation for section 1", "checked": false}
     ],
     "section2": [
       {"id": "2-1", "text": "Specific recommendation text for section 2", "checked": false}
     ],
     ... continue for all 6 sections
   }
5. Each recommendation MUST be specific and actionable
6. Each recommendation MUST include relevant ISA references
7. Recommendations must be tailored specifically to the client context and materiality
8. Do not use any markdown formatting (no ##, ###, **, etc.)
9. DO NOT use the pilcrow (¶) symbol

INPUTS:
- Client Profile: {clientProfile}
- Materiality: {materiality}
- ETB summary: {etbSummary}
- Sections and key answers: {keyAnswers}

OUTPUT FORMAT EXAMPLE:
{
  "section1": [
    {"id": "1-1", "text": "Update engagement letter to reflect new regulatory requirements (ISA 210)", "checked": false},
    {"id": "1-2", "text": "Perform independence confirmation for all team members (ISA 220)", "checked": false}
  ],
  "section2": [
    {"id": "2-1", "text": "Document understanding of new IT system implementation (ISA 315)", "checked": false}
  ]
}

IMPORTANT: Do not deviate from this JSON format. Do not add extra sections or remove any of the specified sections.
`;