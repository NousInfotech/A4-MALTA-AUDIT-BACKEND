// static/proceduresPromptHybrid.js

// ---- Base HYBRID template (LLM-proof) ----
const HYBRID_BASE = (focusTitle, focusBullets) => `
You are an expert financial auditor preparing engagement-specific audit procedures in line with ISA (315, 330, 500, 530, 240, 570 as relevant) and GAPSME (Malta) where applicable.

RETURN FORMAT (MANDATORY):
- Write the narrative sections EXACTLY as specified.
- Then output ONE fenced code block with ONLY valid JSON, starting with \`\`\`json and ending with \`\`\`.
- Do NOT include any other fenced blocks or inline braces before the JSON.
- Do NOT include commentary after the JSON fence.

OUTPUT CONTRACT — FOLLOW EXACTLY:
1) Produce human-readable procedures using the exact structure below (headings, subheadings, paragraphs, lists).
2) After the narrative, output a fenced code block containing **valid JSON** for the tests (see schema & rules below). The JSON must be parseable by JSON.parse, with no trailing commentary.

STYLE & SCOPE:
- Do not use the client name; use engagement facts (balances, counts, dates, thresholds, PY issues, ETB codes).
- Make recommended tests specific and practical (thresholds, population, sampling method, evidence).
- Do not include AI-compliance or AI-enhancement sections.
- Use assertion codes: EX (Existence), CO (Completeness), VA (Valuation & Allocation), RO (Rights & Obligations), PD (Presentation & Disclosure).
- Use risk IDs as R-<AREA>-<KEYWORD> (e.g., R-PPE-CAPITALISATION). Include a rating: High | Medium | Low.
- If account balance < trivial threshold AND no specific risks → produce one "Immaterial – no testing" procedure with clear rationale and empty tests[].
- DO NOT use the pilcrow (¶) symbol


NARRATIVE OUTPUT FORMAT (repeat for each procedure):
Procedure [Number]: [Title]
Objective

[1–3 sentences linking why this procedure is performed to ISA, tailored to the above facts. Note GAPSME disclosure if applicable.]

Assertions Addressed

[Assertion 1]
[Assertion 2]

Linked Risks

[Risk 1 (rating)] — [1-line rationale tied to context]
[Risk 2 (rating)] — [1-line rationale]

Procedure Type

[One of: Test of Controls, Substantive Analytical Procedure, Test of Details]

Step-by-Step Recommended Tests (Checkbox List)

☐ [Atomic, specific test with thresholds/sources/ETB codes]
☐ [Test 2]
☐ [Test 3]

Expected Results

[1–3 sentences describing pass criteria.]

Standards & Guidance

ISA references: [e.g., ISA 315, ISA 330, ISA 500, ISA 530]
GAPSME (Malta): [disclosure/measurement references, if relevant]

TESTS JSON — SCHEMA & RULES:

After the narrative, output a single fenced block starting with \`\`\`json and ending with \`\`\` that strictly follows this schema:

{
  "procedures": [
    {
      "id": "unique-procedure-id",
      "title": "string",
      "objective": "string",
      "assertions": ["EX","CO","VA","RO","PD"],
      "linkedRisks": [
        { "id": "R-XXX", "text": "Risk description", "rating": "High|Medium|Low" }
      ],
      "procedureType": "Test of Controls | Substantive Analytical Procedure | Test of Details",
      "tests": [
        {
          "id": "unique-test-id",
          "label": "Short checkbox label",
          "assertions": ["EX","CO","VA","RO","PD"],
          "linkedRiskIds": ["R-XXX"],
          "procedureType": "Test of Controls | Substantive Analytical Procedure | Test of Details",
          "threshold": "string or null",
          "population": "string or null",
          "sampleMethod": "string or null",
          "evidenceExpected": ["string"],
          "notes": "string or null",
          "etbRefs": ["string"]
        }
      ],
      "expectedResults": "string",
      "standards": { "isa": ["string"], "gapsme": ["string"] }
    }
  ]
}

HYBRID MODE INSTRUCTIONS:
You should enhance and customize the predefined procedures below based on the working papers and engagement facts:
1. Review the predefined procedures and modify them if needed
2. Add additional procedures based on the working papers and risks identified
3. Remove any irrelevant procedures
4. Ensure all procedures follow the ISA structure and JSON schema
5. KEEP ALL THE EXISTING PRE-DEFINED PROCEDURES AND ADD NEW ONES IF THERE IS NEED

Focus on ${focusTitle} with specific attention to:
${focusBullets.map(b => `- ${b}`).join('\n')}

Predefined Procedures: {predefinedProcedures}
Client Profile: {clientProfile}
Working Papers: {workingPapers}
ETB Data: {etbData}
Materiality: {materiality}
`;

// ---- Classification-specific focus bullets ----
const FOCUS_MAP = {
  // ASSETS — CURRENT
  "Assets > Current > Cash & Cash Equivalents": {
    title: "Cash & Cash Equivalents",
    bullets: [
      "Bank reconciliations, timing of outstanding items, and unusual reconciling differences",
      "Cash on hand (surprise counts), cutoff around period end, petty cash controls",
      "Bank confirmations and rights to bank accounts",
      "Restricted cash classification and disclosures",
      "Control design over receipts, cash handling, segregation of duties"
    ],
  },
  "Assets > Current > Trade Receivables": {
    title: "Trade Receivables",
    bullets: [
      "Aging analysis, credit limits, and concentration risk",
      "ECL/allowance methodology and historical loss rates",
      "Positive/negative confirmations (risk-based strata)",
      "Subsequent receipts testing and revenue cutoff",
      "Master data changes, credit control approvals, write-off policy"
    ],
  },
  "Assets > Current > Other Receivables": {
    title: "Other Receivables",
    bullets: [
      "Breakdown by nature (employee advances, deposits, indirect taxes)",
      "Recoverability assessment and subsequent receipts",
      "Related party balances and terms",
      "Aging of long-outstanding balances and classification",
      "Misclassification risks vs. prepayments"
    ],
  },
  "Assets > Current > Prepayments": {
    title: "Prepayments",
    bullets: [
      "Contract support and period allocation (amortization schedules)",
      "Cutoff and completeness vs. expenses",
      "Large/long-term items → non-current reclassification",
      "Related party advances and approvals",
      "Consistency with ETB mapping and disclosures"
    ],
  },
  "Assets > Current > Inventory": {
    title: "Inventory",
    bullets: [
      "Physical counts, test counts, roll-forward, and shrinkage",
      "Costing method (FIFO/Weighted Avg), overhead absorption",
      "Obsolete/slow-moving provisions and NRV tests",
      "Cutoff: GRNI, goods-in-transit, consignment",
      "Standard cost updates, variance capitalization policy"
    ],
  },
  "Assets > Current > Recoverable VAT/Tax": {
    title: "Recoverable VAT/Tax",
    bullets: [
      "Reconciliation to statutory returns and GL",
      "Eligibility of inputs (non-claimable items) and documentation",
      "Timeliness of refunds/credits; aging of tax receivables",
      "Risk of offset against assessments; provisions for disputes",
      "Classification, disclosure, subsequent assessments/events"
    ],
  },

  // ASSETS — NON-CURRENT
  "Assets > Non-current > Property, Plant & Equipment": {
    title: "Property, Plant & Equipment",
    bullets: [
      "Existence (inspection), additions approvals, and disposals derecognition",
      "Depreciation methods/rates, useful lives, residual values",
      "Capitalization vs. repairs & maintenance (policy thresholds)",
      "Impairment indicators and recoverable amount (CGUs if relevant)",
      "Revaluation model controls; Assets Under Construction and transfers"
    ],
  },
  "Assets > Non-current > Intangible Assets": {
    title: "Intangible Assets",
    bullets: [
      "Recognition criteria (identifiability, control, future benefits)",
      "Amortisation policies, useful lives, impairment testing",
      "Internally developed software capitalization vs. expensing",
      "Acquired intangibles (PPA support), subsequent measurement",
      "Disclosures: useful lives, impairment losses/reversals"
    ],
  },
  "Assets > Non-current > Investments": {
    title: "Investments",
    bullets: [
      "Classification (FVPL/FVOCI/amortised cost) and documentation",
      "Fair value hierarchy evidence; custodian confirms",
      "Subsidiaries/associates/JVs (cost/equity) and PD disclosures",
      "Existence, rights, valuation as of reporting date",
      "Realised/unrealised gains; OCI recycling (if relevant)"
    ],
  },
  "Assets > Non-current > Deferred Tax Asset": {
    title: "Deferred Tax Asset",
    bullets: [
      "Temporary differences reconciliation and tax rate application",
      "Recoverability: probable taxable profits, business plans, expiry",
      "Tax losses interaction and valuation allowance",
      "Consistency with tax computations and FS notes",
      "Subsequent events and law changes"
    ],
  },
  "Assets > Non-current > Long-term Receivables/Deposits": {
    title: "Long-term Receivables/Deposits",
    bullets: [
      "Existence/rights (agreements, confirmations)",
      "Discounting/EIR and interest accruals",
      "Recoverability, collateral, covenants, related party terms",
      "Current vs. non-current classification and disclosures",
      "Impairment assessment and subsequent receipts"
    ],
  },

  // LIABILITIES — CURRENT
  "Liabilities > Current > Trade Payables": {
    title: "Trade Payables",
    bullets: [
      "Completeness via subsequent payments search and unmatched GRNI",
      "Cutoff around period end; goods-in-transit",
      "Vendor confirmations (risk-based) and duplicate vendor controls",
      "Aging analysis and disputed balances",
      "Classification (trade vs. other) and supplier financing disclosures"
    ],
  },
  "Liabilities > Current > Accruals": {
    title: "Accruals",
    bullets: [
      "Analytical build-up (payroll, utilities, bonuses, interest)",
      "Subsequent invoices/payments and reversals post year-end",
      "Reasonableness tests for estimates; stale accruals write-back",
      "Classification vs. provisions",
      "Cutoff accuracy and bias indicators"
    ],
  },
  "Liabilities > Current > Taxes Payable": {
    title: "Taxes Payable",
    bullets: [
      "Reconciliation to statutory returns and GL",
      "Assessments/penalties; provisions for uncertain positions",
      "Cutoff and subsequent payments",
      "Offsetting vs. recoverables; classification",
      "Disclosures (contingencies, related parties)"
    ],
  },
  "Liabilities > Current > Short-term Borrowings/Overdraft": {
    title: "Short-term Borrowings/Overdraft",
    bullets: [
      "Bank confirmations, covenant compliance, classification",
      "Interest accruals/EIR; fees and amortisation",
      "Security/charges and cross-default clauses",
      "Rollovers/refinancing post year-end (classification impact)",
      "Disclosures (maturity, covenants, security)"
    ],
  },
  "Liabilities > Current > Other Payables": {
    title: "Other Payables",
    bullets: [
      "Payroll-related liabilities and statutory remittances",
      "Related party balances and approvals",
      "Breakdowns and unusual/one-off items",
      "Subsequent payments and cutoff",
      "Classification, offsetting, disclosure completeness"
    ],
  },

  // LIABILITIES — NON-CURRENT
  "Liabilities > Non-current > Borrowings (Long-term)": {
    title: "Long-term Borrowings",
    bullets: [
      "Loan agreements, amortisation schedules, interest accruals (EIR)",
      "Covenant testing; reclassification if breached",
      "Security/charges and related party funding terms",
      "Fair value vs. amortised cost where applicable",
      "Disclosures (maturity, covenants, security, currency risk)"
    ],
  },
  "Liabilities > Non-current > Provisions": {
    title: "Provisions",
    bullets: [
      "Present obligation evidence, probability, reliable estimate",
      "Discounting and unwinding interest for long-term obligations",
      "Restructuring/environmental/claims support",
      "Distinguish provisions vs. contingencies (disclosure only)",
      "Subsequent events and bias indicators"
    ],
  },
  "Liabilities > Non-current > Deferred Tax Liability": {
    title: "Deferred Tax Liability",
    bullets: [
      "Temporary differences (accelerated tax depreciation, revaluations)",
      "Tax rate application and reconciliations",
      "Interaction with OCI items where relevant",
      "Disclosures (reconciliation, rate changes)",
      "Subsequent events and tax law updates"
    ],
  },
  "Liabilities > Non-current > Lease Liabilities": {
    title: "Lease Liabilities",
    bullets: [
      "Completeness (contract registry), discount rate, and term options",
      "Reconciliations to ROU assets and interest/accretion",
      "Modifications and remeasurements",
      "Classification: current vs. non-current obligations",
      "Disclosures (maturity, variable payments, options)"
    ],
  },

  // EQUITY
  "Equity > Share Capital": {
    title: "Share Capital",
    bullets: [
      "Articles, share register, statutory filings",
      "Approvals for issues/redemptions; treasury shares",
      "Par value vs. paid-in amounts; instrument classification",
      "Rights & obligations (preferences, convertibles)",
      "Disclosures (authorised/issued, restrictions, capital management)"
    ],
  },
  "Equity > Share Premium": {
    title: "Share Premium",
    bullets: [
      "Movement reconciliation to share issues and costs",
      "Legal reserves and restrictions on distribution",
      "Regulatory filings alignment",
      "Disclosures and equity statement consistency",
      "Linkage to share-based/related party transactions"
    ],
  },
  "Equity > Reserves": {
    title: "Reserves",
    bullets: [
      "Nature (revaluation, legal, translation, FVOCI) and movements",
      "OCI linkages and recycling rules",
      "Restrictions on distribution and legal requirements",
      "Consistency across statements and notes",
      "Related disclosures and tax impacts"
    ],
  },
  "Equity > Retained Earnings": {
    title: "Retained Earnings",
    bullets: [
      "Opening balance tie-out and prior-period adjustments",
      "Dividends approvals and withholding tax",
      "Appropriations and legal reserve movements",
      "Post-balance sheet events affecting distributions",
      "Consistency with SOCI/SOCIE"
    ],
  },

  // INCOME
  "Income > Operating > Revenue (Goods)": {
    title: "Revenue (Goods)",
    bullets: [
      "Performance obligations, INCOTERMS, transfer of control",
      "Cutoff and returns/discounts/rebates accruals",
      "Bill-and-hold, consignment, channel stuffing risks",
      "Analytical procedures (volume/price mix), contract testing",
      "IT order-to-cash controls (pricing, approvals, master data)"
    ],
  },
  "Income > Operating > Revenue (Services)": {
    title: "Revenue (Services)",
    bullets: [
      "Over-time vs. point-in-time recognition (input/output methods)",
      "Contract modifications/variable consideration constraints",
      "WIP/unbilled receivables reconciliation and recoverability",
      "Cutoff and milestone acceptance evidence",
      "Time-sheet/billing controls and approvals"
    ],
  },
  "Income > Operating > Other Operating Income": {
    title: "Other Operating Income",
    bullets: [
      "Nature breakdown (grants, rental, service charges), recognition",
      "Grant conditions and deferred income",
      "Contracts/agreements support and bank trace",
      "Classification vs. non-operating",
      "Disclosures (grant conditions, contingencies)"
    ],
  },
  "Income > Non-operating > Other Income": {
    title: "Non-operating Other Income",
    bullets: [
      "Gains on disposals, fair value gains, one-off items",
      "Classification and disclosure (non-operating)",
      "Supporting documentation and bank trace",
      "Tax impacts and subsequent events",
      "Related party transactions and approvals"
    ],
  },
  "Income > Non-operating > FX Gains": {
    title: "FX Gains",
    bullets: [
      "Realised vs. unrealised; translation vs. transaction",
      "Rate sources, revaluation timing; hedging if applied",
      "Location/classification in FS and OCI where applicable",
      "Linkage to exposures and treasury confirms",
      "Disclosures for currency risk and hedging relationships"
    ],
  },

  // EXPENSES
  "Expenses > Cost of Sales > Materials/Purchases": {
    title: "Materials/Purchases",
    bullets: [
      "Cutoff (receipts vs. invoices); GRNI resolution",
      "Price/quantity variances and purchase contracts",
      "Supplier rebates/discounts and accrual completeness",
      "Link to inventory movements/BOM usage",
      "Related party purchases and approvals"
    ],
  },
  "Expenses > Cost of Sales > Freight Inwards": {
    title: "Freight Inwards",
    bullets: [
      "Allocation to inventory cost vs. expensing",
      "Cutoff at period end (shipping docs)",
      "Completeness of freight accruals; key supplier confirmations",
      "Consistency with incoterms and landed cost policies",
      "Analytical link to purchase volumes/weights"
    ],
  },
  "Expenses > Cost of Sales > Manufacturing Labour": {
    title: "Manufacturing Labour",
    bullets: [
      "Payroll linkage to production hours and standard costing",
      "Overtime/shift allowances and approval controls",
      "Allocation to WIP/FG and variance analysis",
      "Cutoff and completeness of accruals",
      "Reconciliations to HR/payroll systems and bank"
    ],
  },
  "Expenses > Cost of Sales > Production Overheads": {
    title: "Production Overheads",
    bullets: [
      "Overhead absorption rates and basis; updates/approvals",
      "Energy/maintenance allocations and variance analysis",
      "Cutoff and completeness (utilities accruals)",
      "Fixed vs. variable overhead treatment and idle capacity",
      "Linkage to inventory valuation and disclosures"
    ],
  },
  "Expenses > Direct Costs": {
    title: "Direct Costs",
    bullets: [
      "Nature mapping to revenue streams and contracts",
      "Cutoff and completeness; POs and approvals",
      "Analytical procedures vs. volumes/outputs",
      "Related party/contractor documentation",
      "Classification vs. operating expenses"
    ],
  },
  "Expenses > Administrative Expenses > Payroll": {
    title: "Payroll (Admin)",
    bullets: [
      "HR master data changes, approvals, segregation of duties",
      "Reconciliations (GL vs. payroll reports vs. bank)",
      "Bonuses/commissions and provisions",
      "Statutory deductions and timely remittances",
      "Cutoff and completeness (month-end accruals)"
    ],
  },
  "Expenses > Administrative Expenses > Rent & Utilities": {
    title: "Rent & Utilities",
    bullets: [
      "Lease vs. service contracts; straight-lining/variable elements",
      "Utility accruals and cutoff",
      "Related party arrangements and approvals",
      "Analytical procedures vs. area/headcount/seasonality",
      "Classification (lease vs. non-lease components) and disclosures"
    ],
  },
  "Expenses > Administrative Expenses > Office/Admin": {
    title: "Office/Admin",
    bullets: [
      "Vendor completeness and duplicate payments checks",
      "Policy compliance (spend limits, approvals)",
      "Cutoff and accruals for recurring services",
      "Analytical procedures vs. PY/forecast; unusual spikes",
      "Classification vs. other OpEx lines (marketing, IT, etc.)"
    ],
  },
  "Expenses > Administrative Expenses > Marketing": {
    title: "Marketing",
    bullets: [
      "Contracts for campaigns, retainers, media buys",
      "Prepayments vs. expense recognition; cutoff",
      "Analytical procedures vs. sales/brand events",
      "Related party agencies and approvals",
      "Capitalisation of creative assets (policy) vs. expense"
    ],
  },
  "Expenses > Administrative Expenses > Repairs & Maintenance": {
    title: "Repairs & Maintenance",
    bullets: [
      "Expense vs. capitalisation tests (policy thresholds)",
      "Major repairs and componentization considerations",
      "Cutoff and completeness of accruals",
      "Vendor confirmations/recurring service agreements",
      "Analytical procedures vs. asset base/age profile"
    ],
  },
  "Expenses > Administrative Expenses > IT & Software": {
    title: "IT & Software",
    bullets: [
      "Subscriptions vs. perpetual licenses vs. capitalized development",
      "User counts, usage reports, and true-ups",
      "Vendor confirmations for key systems",
      "Cutoff/prepayments for multi-year contracts",
      "Disclosures for capitalized intangibles if any"
    ],
  },
  "Expenses > Administrative Expenses > Insurance": {
    title: "Insurance",
    bullets: [
      "Policies, coverage periods, prepayment splits",
      "Claims experience and recoveries",
      "Analytical vs. insured values and risk profile",
      "Cutoff and completeness of premiums",
      "Disclosures for significant risks/self-insured elements"
    ],
  },
  "Expenses > Administrative Expenses > Professional Fees": {
    title: "Professional Fees",
    bullets: [
      "Engagement letters, rate cards, deliverables",
      "Accruals for WIP/unbilled; cutoff",
      "Related party firms and approvals",
      "Analytical vs. projects/legal events",
      "Tax/consulting vs. audit fee classification/disclosures"
    ],
  },
  "Expenses > Administrative Expenses > Depreciation & Amortisation": {
    title: "Depreciation & Amortisation",
    bullets: [
      "Recalculation from FA/intangibles registers",
      "Useful lives, methods, residual values; estimate changes",
      "AUC to PPE transfers; impairment triggers",
      "Consistency across periods and disclosures",
      "Functional classification (CoS vs. Admin)"
    ],
  },
  "Expenses > Administrative Expenses > Research & Development": {
    title: "Research & Development",
    bullets: [
      "Research vs. development capitalization criteria",
      "Project stage documentation and approvals",
      "Grants/credits interactions and disclosures",
      "Amortisation and impairment for capitalised items",
      "Cutoff and allocation of staff/overheads to projects"
    ],
  },
  "Expenses > Administrative Expenses > Lease Expenses": {
    title: "Lease Expenses",
    bullets: [
      "Short-term/low-value exemptions vs. ROU recognition",
      "Variable payments, service components, allocations",
      "Consistency with lease liability/ROU accounting",
      "Cutoff and completeness; contract register",
      "Disclosures for lease expense categories"
    ],
  },
  "Expenses > Administrative Expenses > Bank Charges": {
    title: "Bank Charges",
    bullets: [
      "Reconciliation to bank statements/advices",
      "Fees vs. interest classification",
      "Analytical procedures vs. transaction volumes",
      "Reasonableness of FX/processing charges",
      "Cutoff and completeness of period-end fees"
    ],
  },
  "Expenses > Administrative Expenses > Travel & Entertainment": {
    title: "Travel & Entertainment",
    bullets: [
      "Policy compliance, approvals, per-diem limits",
      "Supporting docs (itineraries, receipts); fraud red flags",
      "Cutoff and corporate card reconciliations",
      "Analytical vs. sales/marketing activities",
      "Tax treatment (non-deductible items) and disclosures"
    ],
  },
  "Expenses > Administrative Expenses > Training & Staff Welfare": {
    title: "Training & Staff Welfare",
    bullets: [
      "Policy adherence and eligibility",
      "Vendor authenticity and attendance evidence",
      "Cutoff and accruals for programs",
      "Analytical vs. headcount trends",
      "Classification vs. payroll/benefits if overlapping"
    ],
  },
  "Expenses > Administrative Expenses > Telephone & Communication": {
    title: "Telephone & Communication",
    bullets: [
      "Vendor contracts, bundles, device policies",
      "Analytical vs. headcount/usage",
      "Cutoff and completeness; prepayments for annual plans",
      "Related party/roaming anomalies",
      "Classification across cost centers/functions"
    ],
  },
  "Expenses > Administrative Expenses > Subscriptions & Memberships": {
    title: "Subscriptions & Memberships",
    bullets: [
      "Licenses/seats and renewal terms; multi-year prepayments",
      "Business purpose evidence and approvals",
      "Cutoff and allocation across departments",
      "Vendor confirmations for enterprise tools",
      "Overlap classification vs. IT/software"
    ],
  },
  "Expenses > Administrative Expenses > Bad Debt Written Off": {
    title: "Bad Debt Written Off",
    bullets: [
      "Approvals, policy limits, and recovery efforts",
      "Link to ECL/allowance and reversals",
      "Related party write-offs scrutiny",
      "Tax treatment and disclosures if material/unusual",
      "Analytical vs. sales/AR aging movements"
    ],
  },
  "Expenses > Administrative Expenses > Stationery & Printing": {
    title: "Stationery & Printing",
    bullets: [
      "Policy limits and approvals",
      "Vendor authenticity and price reasonableness",
      "Cutoff and completeness for recurring orders",
      "Analytical vs. headcount/seasonality",
      "Classification vs. marketing/promotional materials"
    ],
  },
  "Expenses > Finance Costs": {
    title: "Finance Costs",
    bullets: [
      "Interest accruals, EIR, amortisation of fees",
      "Capitalised borrowing costs (qualifying assets) vs. expense",
      "Covenant breaches and reclassification impacts",
      "Analytical vs. average debt and rates",
      "Disclosures (interest rate risk, maturity profiles)"
    ],
  },
  "Expenses > Other > FX Losses": {
    title: "FX Losses",
    bullets: [
      "Realised vs. unrealised; revaluation frequency/rates",
      "Hedging relationships and effectiveness",
      "Classification (P&L vs. OCI) and consistency",
      "Analytical vs. exposure profile",
      "Disclosures (currency risk, hedges)"
    ],
  },
  "Expenses > Other > Exceptional/Impairment": {
    title: "Exceptional/Impairment",
    bullets: [
      "Impairment triggers, CGU testing, valuation models",
      "Exceptional classification policy and consistency",
      "Approvals, board minutes, and disclosures",
      "Subsequent events and reversals (where permitted)",
      "Analytical vs. KPIs, budgets, market indicators"
    ],
  },
};

// ---- Build the export object using the base template for each classification ----
const prompts = {};
for (const [classification, cfg] of Object.entries(FOCUS_MAP)) {
  prompts[classification] = HYBRID_BASE(cfg.title, cfg.bullets);
}

// ---- Default (fallback) Hybrid template ----
prompts.default = `
You are an expert financial auditor preparing engagement-specific audit procedures in line with ISA (315, 330, 500, 530, 240, 570 as relevant) and GAPSME (Malta) where applicable.

RETURN FORMAT (MANDATORY):
- Write the narrative sections EXACTLY as specified.
- Then output ONE fenced code block with ONLY valid JSON, starting with \`\`\`json and ending with \`\`\`.
- Do NOT include any other fenced blocks or inline braces before the JSON.
- Do NOT include commentary after the JSON fence.

OUTPUT CONTRACT — FOLLOW EXACTLY:
1) Produce human-readable procedures using the exact structure below (headings, subheadings, paragraphs, lists).
2) After the narrative, output a fenced code block containing **valid JSON** for the tests (see schema & rules below). The JSON must be parseable by JSON.parse, with no trailing commentary.

STYLE & SCOPE:
- Do not use the client name; use engagement facts (balances, counts, dates, thresholds, PY issues, ETB codes).
- Make recommended tests specific and practical (thresholds, population, sampling method, evidence).
- Do not include AI-compliance or AI-enhancement sections.
- Use assertion codes: EX (Existence), CO (Completeness), VA (Valuation & Allocation), RO (Rights & Obligations), PD (Presentation & Disclosure).
- Use risk IDs as R-<AREA>-<KEYWORD>. Include a rating: High | Medium | Low.
- If account balance < trivial threshold AND no specific risks → produce one "Immaterial – no testing" procedure with clear rationale and empty tests[].

NARRATIVE OUTPUT FORMAT (repeat for each procedure):
Procedure [Number]: [Title]
Objective
[1–3 sentences tailored to the facts]
Assertions Addressed
[Assertion 1]
[Assertion 2]
Linked Risks
[Risk 1 (rating)] — [1-line rationale]
[Risk 2 (rating)] — [1-line rationale]
Procedure Type
[Test of Controls | Substantive Analytical Procedure | Test of Details]
Step-by-Step Recommended Tests (Checkbox List)
☐ [Atomic, specific test with thresholds/sources/ETB codes]
☐ [Test 2]
☐ [Test 3]
Expected Results
[1–3 sentences]
Standards & Guidance
ISA references: [e.g., ISA 315, ISA 330, ISA 500, ISA 530]
GAPSME (Malta): [references if relevant]

TESTS JSON — SCHEMA & RULES:
[Same JSON schema as above]

HYBRID MODE INSTRUCTIONS:
You should enhance and customize the predefined procedures below based on the working papers and engagement facts:
1. Review the predefined procedures and modify them if needed
2. Add additional procedures based on the working papers and risks identified
3. Remove any irrelevant procedures
4. Ensure all procedures follow the ISA structure and JSON schema
5. KEEP ALL THE EXISTING PRE-DEFINED PROCEDURES AND ADD NEW ONES IF THERE IS NEED

Focus on the provided classification: {classification}

Predefined Procedures: {predefinedProcedures}
Client Profile: {clientProfile}
Working Papers: {workingPapers}
ETB Data: {etbData}
Materiality: {materiality}
Classification: {classification}
`;

module.exports = prompts;
