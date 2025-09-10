/**
 * ISQM Policy and Procedure Generation Prompts
 * 
 * This file contains prompts for generating ISQM policies and procedures
 * based on completed ISQM questionnaire data.
 * 
 * Usage:
 * 1. Send completed ISQM questionnaire data as JSON
 * 2. Use appropriate prompt template
 * 3. Generate formal policy or procedure documents
 */

const ISQM_PROMPTS = {
  
  /**
   * Policy Generation Prompt
   * Generates formal quality management policies based on ISQM questionnaire responses
   */
  POLICY_GENERATOR: `
You are an expert in International Standard on Quality Management (ISQM 1) and audit firm quality management systems.

TASK: Generate a formal quality management policy based on the completed ISQM questionnaire data provided.

CONTEXT: You will receive JSON data containing:
- ISQM questionnaire responses
- Component information (e.g., "Acceptance and Continuance of Client Relationships")
- Firm-specific details and responses
- Risk assessments and control measures

REQUIREMENTS: Generate a comprehensive policy document that includes:

1. **Policy Title and Purpose**
   - Clear, professional title matching the ISQM component
   - Explicit statement of what the policy covers
   - Clear objective and intended outcomes

2. **Scope**
   - Which engagements, staff, or activities the policy applies to
   - Geographic or jurisdictional considerations
   - Size thresholds or materiality considerations
   - Any exclusions or special circumstances

3. **Responsibilities**
   - Specific roles and responsibilities (e.g., engagement partner, quality reviewer, managing partner)
   - Clear delegation of authority
   - Escalation procedures
   - Accountability measures

4. **Key Principles and Requirements**
   - Essential rules and standards based on ISQM 1 requirements
   - Risk-based approach considerations
   - Ethical requirements and independence considerations
   - Quality control measures

5. **Review Frequency and Version Control**
   - When the policy will be reviewed and by whom
   - Version control procedures
   - Approval authority for updates
   - Communication of changes

6. **References**
   - ISQM 1 component references
   - Related ethical standards (IESBA Code)
   - Applicable laws and regulations
   - Internal firm standards

FORMAT REQUIREMENTS:
- Use clear, professional language suitable for audit portal inclusion
- Structure with numbered sections and subsections
- Include specific, actionable requirements
- Ensure compliance with ISQM 1 standards
- Tailor language to mid-sized audit firm context

INPUT DATA FORMAT:
The questionnaire data will be provided as JSON with the following structure:
{
  "componentName": "Component Name",
  "questionnaire": {
    "key": "ISQM_1",
    "heading": "Component Heading",
    "sections": [
      {
        "heading": "Section Title",
        "qna": [
          {
            "question": "Question text",
            "answer": "Response text",
            "state": true/false
          }
        ]
      }
    ]
  },
  "firmDetails": {
    "size": "mid-sized",
    "jurisdiction": "UK",
    "specializations": ["audit", "tax", "advisory"]
  }
}

Generate the policy document based on this data, ensuring it reflects the specific responses and firm context provided.
`,

  /**
   * Procedure Generation Prompt
   * Generates detailed implementation procedures based on ISQM policies and questionnaire data
   */
  PROCEDURE_GENERATOR: `
You are an expert in International Standard on Quality Management (ISQM 1) and audit firm operational procedures.

TASK: Generate detailed implementation procedures based on the ISQM policy and completed questionnaire data provided.

CONTEXT: You will receive JSON data containing:
- ISQM questionnaire responses
- Policy information and requirements
- Component details and risk assessments
- Firm-specific operational context

REQUIREMENTS: Generate comprehensive procedures that include:

1. **Procedure Title**
   - Clear title matching the policy and ISQM component
   - Brief description of what the procedure accomplishes

2. **Step-by-Step Actions**
   - Detailed actions in logical sequence
   - Start with risk identification and assessment
   - Include control implementation steps
   - End with documentation and approval requirements
   - Include decision points and branching logic

3. **Roles and Responsibilities**
   - Who performs each specific step
   - Who approves or reviews each action
   - Clear delegation of authority
   - Escalation procedures for exceptions

4. **Inputs and Required Documents**
   - Forms, checklists, or templates needed
   - Evidence and documentation requirements
   - Information sources and data requirements
   - Pre-requisite conditions or approvals

5. **Outputs and Deliverables**
   - What should exist at the end of the procedure
   - Documentation requirements
   - Sign-off and approval documentation
   - Communication requirements

6. **Monitoring and Review**
   - How compliance with the procedure will be checked
   - Review frequency and responsible parties
   - Performance indicators and metrics
   - Continuous improvement processes

FORMAT REQUIREMENTS:
- Use numbered steps and bullet points for easy import into audit portal
- Include specific timelines and deadlines
- Provide clear decision criteria
- Ensure practical applicability for mid-sized audit firms
- Include quality control checkpoints

INPUT DATA FORMAT:
The procedure data will be provided as JSON with the following structure:
{
  "componentName": "Component Name",
  "policy": {
    "title": "Policy Title",
    "requirements": ["requirement1", "requirement2"],
    "responsibilities": {...}
  },
  "questionnaire": {
    "key": "ISQM_1",
    "heading": "Component Heading",
    "sections": [
      {
        "heading": "Section Title",
        "qna": [
          {
            "question": "Question text",
            "answer": "Response text",
            "state": true/false
          }
        ]
      }
    ]
  },
  "firmDetails": {
    "size": "mid-sized",
    "jurisdiction": "UK",
    "specializations": ["audit", "tax", "advisory"],
    "processes": ["existing process details"]
  }
}

Generate detailed, actionable procedures based on this data, ensuring they are practical and implementable.
`,

  /**
   * Risk Assessment Generator
   * Generates risk assessments based on ISQM questionnaire responses
   */
  RISK_ASSESSMENT_GENERATOR: `
You are an expert in audit risk management and ISQM 1 quality management systems.

TASK: Generate a comprehensive risk assessment based on completed ISQM questionnaire responses.

CONTEXT: Analyze the questionnaire responses to identify:
- Quality management risks
- Control gaps and weaknesses
- Areas requiring attention
- Risk mitigation strategies

REQUIREMENTS: Generate a risk assessment that includes:

1. **Risk Identification**
   - Quality management risks based on questionnaire responses
   - Control environment risks
   - Operational risks
   - Compliance risks

2. **Risk Analysis**
   - Likelihood assessment (High/Medium/Low)
   - Impact assessment (High/Medium/Low)
   - Risk rating calculation
   - Risk categorization

3. **Risk Response**
   - Mitigation strategies
   - Control recommendations
   - Monitoring requirements
   - Escalation procedures

4. **Risk Monitoring**
   - Key risk indicators
   - Review frequency
   - Reporting requirements
   - Continuous monitoring processes

Generate a structured risk assessment document suitable for audit firm quality management.
`,

  /**
   * Compliance Checklist Generator
   * Generates compliance checklists based on ISQM requirements
   */
  COMPLIANCE_CHECKLIST_GENERATOR: `
You are an expert in ISQM 1 compliance and audit firm quality management.

TASK: Generate a compliance checklist based on ISQM questionnaire responses and requirements.

CONTEXT: Create a practical checklist that ensures:
- ISQM 1 compliance
- Quality management effectiveness
- Ongoing monitoring capabilities
- Documentation requirements

REQUIREMENTS: Generate a checklist that includes:

1. **Compliance Areas**
   - ISQM 1 component requirements
   - Quality management system elements
   - Control environment components
   - Monitoring and review requirements

2. **Checklist Items**
   - Specific compliance criteria
   - Evidence requirements
   - Documentation standards
   - Review frequency

3. **Responsibility Matrix**
   - Who is responsible for each item
   - Review and approval requirements
   - Escalation procedures

4. **Monitoring Framework**
   - How compliance will be monitored
   - Reporting requirements
   - Continuous improvement processes

Generate a practical, actionable compliance checklist for audit firm use.
`

};

/**
 * Helper function to format ISQM data for prompt input
 * @param {Object} isqmData - Complete ISQM questionnaire data
 * @param {string} promptType - Type of prompt to use
 * @returns {string} Formatted prompt with data
 */
function formatISQMPrompt(isqmData, promptType = 'POLICY_GENERATOR') {
  const prompt = ISQM_PROMPTS[promptType];
  
  if (!prompt) {
    throw new Error(`Invalid prompt type: ${promptType}`);
  }

  // Format the ISQM data as JSON string for inclusion in prompt
  const formattedData = JSON.stringify(isqmData, null, 2);
  
  return `${prompt}

ISQM QUESTIONNAIRE DATA:
${formattedData}

Please generate the requested document based on the above data.`;
}

/**
 * Get available prompt types
 * @returns {Array} Array of available prompt types
 */
function getAvailablePrompts() {
  return Object.keys(ISQM_PROMPTS);
}

/**
 * Validate ISQM data structure
 * @param {Object} data - ISQM data to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateISQMData(data) {
  const requiredFields = ['componentName', 'questionnaire'];
  
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  for (const field of requiredFields) {
    if (!data[field]) {
      return false;
    }
  }
  
  // Validate questionnaire structure
  const questionnaire = data.questionnaire;
  if (!questionnaire.key || !questionnaire.heading || !Array.isArray(questionnaire.sections)) {
    return false;
  }
  
  return true;
}

module.exports = {
  ISQM_PROMPTS,
  formatISQMPrompt,
  getAvailablePrompts,
  validateISQMData
};
