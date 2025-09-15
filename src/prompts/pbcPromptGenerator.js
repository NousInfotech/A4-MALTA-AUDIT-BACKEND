// utils/pbcPromptGenerator.js
function pbcPromptGenerator(pbc, documentRequests) {
    return `
  You are an audit assistant embedded in an audit portal. Your job is to analyze a client’s Trial Balance (TB) and produce a concise, deduplicated list of Prepared-By-Client (PBC) requests that an auditor would typically ask for, tailored to the TB, period, and accounting framework.
  
  Objectives:
  1. Detect accounts and situations that drive specific PBC requests (e.g., new loans, large accruals, inventory, PPE additions, leases, revenue spikes, negative balances, suspense).
  2. Prioritize requests by risk and materiality.
  3. Remove duplicates, keep each request actionable, explain why needed, and specify acceptance criteria and preferred format.
  4. Adjust wording to the framework (e.g., GAPSME, IFRS) and the entity’s industry.
  5. If inputs are missing (e.g., materiality), infer sensible defaults and proceed.
  
  Inputs:
  - entity_name: ${pbc.entityName || "N/A"}
  - period_start: ${pbc.periodStart ? pbc.periodStart.toISOString().split('T')[0] : "not provided"}
  - period_end: ${pbc.periodEnd ? pbc.periodEnd.toISOString().split('T')[0] : "not provided"}
  - currency: ${pbc.currency || "N/A"}
  - framework: ${pbc.framework || "IFRS"}
  - industry: ${pbc.industry || "N/A"}
  - materiality_absolute: ${pbc.materialityAbsolute ?? "not provided"}
  - risk_notes: ${pbc.riskNotes || "none provided"}
  - trial_balance_url: ${pbc.trialBalanceUrl || "N/A"}
  
  Attached Files:
  ${documentRequests
    .map((dr) =>
      dr.documents.map((doc) => `- ${doc.name}: ${doc.url}`).join("\n")
    )
    .join("\n")}
  
 ⚠️ Instructions:
Return the output as a JSON structure with the following format:
[
  {
    "category": "Revenue",
    "questions": [
      {
        "question": "Provide a breakdown of revenue by major product lines.",
        "isMandatory": true,
        "acceptanceCriteria": "Excel or CSV, reconciled to TB balances",
        "reason": "Material revenue fluctuations noted"
      },
      {
        "question": "Provide copies of significant revenue contracts signed during the period.",
        "isMandatory": false,
        "acceptanceCriteria": "PDF or scanned contract copies",
        "reason": "New large customers identified in TB"
      }
    ]
  },
  {
    "category": "Loans",
    "questions": [
      {
        "question": "Provide loan agreements for all new loans during the year.",
        "isMandatory": true,
        "acceptanceCriteria": "PDF signed agreements",
        "reason": "New borrowings detected in TB"
      },
      {
        "question": "Provide loan amortization schedules.",
        "isMandatory": false,
        "acceptanceCriteria": "Excel schedule with principal and interest",
        "reason": "Testing completeness of loan balances"
      }
    ]
  }
]

For each relevant category, generate multiple questions (minimum 2–3) under "questions".
Do not limit to one question per category.
    `;
  }
  
  module.exports = { pbcPromptGenerator };
  