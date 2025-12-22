// CROSS_STATEMENT — Enterprise-Grade Test Library (Signing Critical)
//
// Purpose:
// - Enforce logical, numerical, legal and disclosure consistency ACROSS statements
// - These tests override individual section correctness
// - Any failure here = NOT FIT FOR APPROVAL
//
// Naming convention:
// - test_id: CS01, CS02, ...
// - category fixed to "CROSS_STATEMENT"
// - severity_default: ALWAYS "B" unless explicitly stated
// - evidence_required: pdf_text, portalData, derived_values (JS-calculated)
//
// IMPORTANT:
// - Arithmetic MUST be JS-first
// - AI extracts references, captions, structure, wording
// - AI NEVER invents numbers

const crossStatementTests = [
  /* =====================================================
       CS01–CS05 : P&L ↔ EQUITY ↔ BALANCE SHEET
    ===================================================== */

  {
    test_id: "CS01",
    category: "CROSS_STATEMENT",
    test_name: "PROFIT_OR_LOSS_FLOWS_TO_RETAINED_EARNINGS",
    severity_default: "B",
    evidence_required: ["pdf_text", "derived_values"],
    test_instructions: [
      "Extract profit/(loss) for the year from the income statement.",
      "Extract opening and closing retained earnings / accumulated losses from balance sheet and/or notes.",
      "Apply reconciliation:",
      "Opening retained earnings",
      "+ Profit/(Loss) for the year",
      "- Dividends",
      "± Prior period adjustments",
      "= Closing retained earnings",
      "Use derived_values calculated in JS.",
      "Any unexplained difference > EUR 1 (non-rounding) is a critical error.",
      "Cite page_no for profit, retained earnings balances, and notes used.",
    ],
  },

  {
    test_id: "CS02",
    category: "CROSS_STATEMENT",
    test_name: "PROFIT_OR_LOSS_SIGN_AND_LABELING_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Verify consistent sign and terminology usage across statements:",
      "- 'Profit for the year'",
      "- 'Loss for the year'",
      "- '(Loss)/Profit'",
      "- 'Profit/(Loss)'",
      "Ensure negative results are consistently presented as losses.",
      "If profit shown in P&L but treated as loss in equity (or vice versa), flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "CS03",
    category: "CROSS_STATEMENT",
    test_name: "TOTAL_COMPREHENSIVE_INCOME_TREATED_CONSISTENTLY",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If 'Total comprehensive income' is presented:",
      "- Confirm whether OCI items exist.",
      "- Confirm whether retained earnings movement uses profit or total comprehensive income correctly.",
      "If OCI exists but not reflected correctly in equity movements, flag as critical.",
      "If OCI does not exist, ensure equity uses profit only.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "CS04",
    category: "CROSS_STATEMENT",
    test_name: "DIVIDENDS_FLOW_CORRECTLY_ACROSS_STATEMENTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "derived_values"],
    test_instructions: [
      "If dividends are declared or paid:",
      "- Confirm disclosure in notes.",
      "- Confirm deduction from retained earnings.",
      "- Confirm cash outflow if paid.",
      "Any missing linkage is a critical error.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "CS05",
    category: "CROSS_STATEMENT",
    test_name: "PRIOR_PERIOD_ADJUSTMENTS_CONSISTENT_ACROSS_NOTES_AND_EQUITY",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If prior period adjustments are disclosed:",
      "- Confirm impact reflected in opening equity.",
      "- Confirm explanation exists in notes.",
      "If adjustment exists in equity but not explained, or vice versa, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       CS06–CS10 : TAX ↔ P&L ↔ BALANCE SHEET ↔ NOTES
    ===================================================== */

  {
    test_id: "CS06",
    category: "CROSS_STATEMENT",
    test_name: "INCOME_TAX_EXPENSE_RECONCILES_TO_TAX_BALANCES",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Reconcile:",
      "Opening current tax balance",
      "+ Current tax expense",
      "- Tax payments",
      "= Closing current tax balance",
      "Use JS-derived values.",
      "Any unexplained difference > EUR 1 is critical.",
    ],
  },

  {
    test_id: "CS07",
    category: "CROSS_STATEMENT",
    test_name: "DEFERRED_TAX_MOVEMENT_RECONCILES",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If deferred tax exists:",
      "- Opening deferred tax",
      "± Deferred tax charge/(credit)",
      "= Closing deferred tax",
      "If mismatch exists, flag critical.",
    ],
  },

  {
    test_id: "CS08",
    category: "CROSS_STATEMENT",
    test_name: "EFFECTIVE_TAX_RATE_LOGICALLY_CONSISTENT",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Compare:",
      "- Profit before tax",
      "- Income tax expense",
      "- Nominal tax rate",
      "If effective tax rate is implausible and no reconciling explanation exists, flag critical.",
    ],
  },

  {
    test_id: "CS09",
    category: "CROSS_STATEMENT",
    test_name: "TAX_DISCLOSURES_CONSISTENT_WITH_AUDIT_REPORT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If audit report includes tax emphasis or qualification:",
      "- Confirm corresponding disclosure exists in tax note.",
      "If mismatch exists, flag critical.",
    ],
  },

  {
    test_id: "CS10",
    category: "CROSS_STATEMENT",
    test_name: "TAX_PRESENTATION_SIGN_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Ensure tax expense is presented consistently:",
      "- Expense increases losses or reduces profit.",
      "- Tax credits reduce expense.",
      "If signs are inconsistent across P&L, notes, BS, flag critical.",
    ],
  },

  /* =====================================================
       CS11–CS16 : PPE ↔ DEPRECIATION ↔ NOTES ↔ P&L
    ===================================================== */

  {
    test_id: "CS11",
    category: "CROSS_STATEMENT",
    test_name: "PPE_MOVEMENT_RECONCILES_TO_BALANCE_SHEET",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Reconcile PPE:",
      "Opening cost + additions - disposals = closing cost",
      "Opening accumulated depreciation + depreciation - disposals = closing accumulated depreciation",
      "Net PPE must match balance sheet.",
      "Any mismatch is critical.",
    ],
  },

  {
    test_id: "CS12",
    category: "CROSS_STATEMENT",
    test_name: "DEPRECIATION_CHARGE_MATCHES_INCOME_STATEMENT",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm depreciation charge in P&L equals movement per PPE note.",
      "Any mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "CS13",
    category: "CROSS_STATEMENT",
    test_name: "CAPITAL_EXPENDITURE_MATCHES_CASH_OUTFLOWS_WHEN_DISCLOSED",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If cash flow or cash disclosures exist:",
      "- Capital expenditure should logically align with PPE additions.",
      "If materially inconsistent, flag critical.",
    ],
  },

  {
    test_id: "CS14",
    category: "CROSS_STATEMENT",
    test_name: "IMPAIRMENT_PRESENTATION_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If impairment losses are disclosed:",
      "- Confirm charge is reflected in P&L.",
      "- Confirm asset values reduced accordingly.",
      "Any mismatch is critical.",
    ],
  },

  {
    test_id: "CS15",
    category: "CROSS_STATEMENT",
    test_name: "ASSET_DISPOSALS_CONSISTENT_ACROSS_NOTES_AND_PNL",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If asset disposals occur:",
      "- Gain/loss must appear in P&L.",
      "- Asset movement note must reflect disposals.",
      "Mismatch is critical.",
    ],
  },

  {
    test_id: "CS16",
    category: "CROSS_STATEMENT",
    test_name: "PPE_POLICY_APPLIED_CONSISTENTLY",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm depreciation method and rates disclosed are applied consistently to movements.",
      "If policy contradicts actual depreciation behavior, flag critical.",
    ],
  },

  /* =====================================================
       CS17–CS22 : RECEIVABLES / PAYABLES / BORROWINGS
    ===================================================== */

  {
    test_id: "CS17",
    category: "CROSS_STATEMENT",
    test_name: "RECEIVABLES_BALANCE_MATCHES_NOTE_AND_PORTAL",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm receivables balance in BS matches total per note and portalData.",
      "Any mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "CS18",
    category: "CROSS_STATEMENT",
    test_name: "PAYABLES_BALANCE_MATCHES_NOTE_AND_PORTAL",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm payables balance in BS matches total per note and portalData.",
      "Any mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "CS19",
    category: "CROSS_STATEMENT",
    test_name: "RELATED_PARTY_BALANCES_CONSISTENT_ACROSS_ALL_STATEMENTS",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm related party balances are consistent across:",
      "- Balance sheet",
      "- Notes",
      "- PortalData",
      "Any mismatch is critical.",
    ],
  },

  {
    test_id: "CS20",
    category: "CROSS_STATEMENT",
    test_name: "BORROWINGS_CLASSIFICATION_AND_MOVEMENT_CONSISTENT",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm borrowings classification (current/non-current) matches maturity disclosures.",
      "Confirm movement reconciles opening to closing.",
      "Mismatch is critical.",
    ],
  },

  {
    test_id: "CS21",
    category: "CROSS_STATEMENT",
    test_name: "INTEREST_EXPENSE_MATCHES_BORROWINGS",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm finance costs logically align with borrowings balances.",
      "Zero interest with material borrowings requires explanation; absence = critical.",
    ],
  },

  {
    test_id: "CS22",
    category: "CROSS_STATEMENT",
    test_name: "SECURITY_AND_COVENANTS_DISCLOSED_CONSISTENTLY",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If borrowings are secured or subject to covenants:",
      "- Confirm disclosure in notes.",
      "- Confirm audit report consistency if emphasis exists.",
      "Mismatch is critical.",
    ],
  },

  /* =====================================================
       CS23–CS27 : GOING CONCERN & AUDIT REPORT DEPENDENCIES
    ===================================================== */

  {
    test_id: "CS23",
    category: "CROSS_STATEMENT",
    test_name: "GOING_CONCERN_TRIGGERS_REFLECTED_IN_NOTES_AND_AUDIT_REPORT",
    severity_default: "B",
    evidence_required: ["derived_values", "pdf_text"],
    test_instructions: [
      "If going concern triggers exist:",
      "- Confirm going concern disclosure in notes.",
      "- Confirm audit report reflects appropriate emphasis/material uncertainty.",
      "Any missing linkage is critical.",
    ],
  },

  {
    test_id: "CS24",
    category: "CROSS_STATEMENT",
    test_name: "LIQUIDATION_BASIS_CONSISTENT_ACROSS_FS_AND_AUDIT_REPORT",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If entity is in liquidation:",
      "- Confirm liquidation basis applied consistently across FS and audit report.",
      "Any inconsistency is critical.",
    ],
  },

  {
    test_id: "CS25",
    category: "CROSS_STATEMENT",
    test_name: "AUDIT_OPINION_SCOPE_MATCHES_FINANCIAL_STATEMENTS_PRESENTED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm audit opinion covers all statements presented in the FS package.",
      "If audit report scope omits statements that exist, flag critical.",
    ],
  },

  {
    test_id: "CS26",
    category: "CROSS_STATEMENT",
    test_name: "AUDIT_OPINION_CONSISTENT_WITH_DISCLOSED_ISSUES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If FS contain material misstatements, uncertainties, or breaches:",
      "- Audit opinion must reflect this via qualification, emphasis, or disclaimer.",
      "Clean opinion with unresolved material issues = critical.",
    ],
  },

  {
    test_id: "CS27",
    category: "CROSS_STATEMENT",
    test_name: "NO_CONTRADICTIONS_BETWEEN_AUDIT_REPORT_AND_NOTES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Scan for contradictions between audit report statements and note disclosures.",
      "Any contradiction is critical.",
    ],
  },

  /* =====================================================
       CS28–CS32 : PORTAL ↔ FS ↔ NOTES (ENTERPRISE CONTROL)
    ===================================================== */

  {
    test_id: "CS28",
    category: "CROSS_STATEMENT",
    test_name: "PORTAL_TRIAL_BALANCE_FULLY_MAPPED",
    severity_default: "B",
    evidence_required: ["portalData"],
    test_instructions: [
      "Confirm every material portal TB line maps to an FS caption or note.",
      "Unmapped balances = critical.",
    ],
  },

  {
    test_id: "CS29",
    category: "CROSS_STATEMENT",
    test_name: "PORTAL_TOTALS_MATCH_FS_TOTALS",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm portal totals reconcile to FS totals.",
      "Any mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "CS30",
    category: "CROSS_STATEMENT",
    test_name: "DIRECTORS_REMUNERATION_MATCHES_ACROSS_ALL_SOURCES",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Confirm directors' remuneration matches exactly across:",
      "- Portal",
      "- Notes",
      "- Income statement",
      "Tolerance = 0.",
    ],
  },

  {
    test_id: "CS31",
    category: "CROSS_STATEMENT",
    test_name: "SHARE_CAPITAL_MATCHES_ACROSS_MBR_FS_AND_NOTES",
    severity_default: "B",
    evidence_required: ["portalData", "pdf_text"],
    test_instructions: [
      "Confirm share capital details match across:",
      "- MBR / portalData.company",
      "- Balance sheet",
      "- Notes",
      "Any mismatch is critical.",
    ],
  },

  {
    test_id: "CS32",
    category: "CROSS_STATEMENT",
    test_name: "NO_DOUBLE_COUNTING_OR_OMISSIONS_ACROSS_STATEMENTS",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Check for duplicated or omitted balances when aggregating statements.",
      "Any double counting or omission is critical.",
    ],
  },
];

const crossStatementPrompt = `
  the tests are to run across statements.
  ${crossStatementTests.map(test => `- ${test.test_name}`).join('\n')}
`;

module.exports = {
  crossStatementTests,
  crossStatementPrompt,
};
