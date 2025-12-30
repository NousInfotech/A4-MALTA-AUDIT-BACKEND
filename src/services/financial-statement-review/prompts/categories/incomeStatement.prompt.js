// INCOME_STATEMENT — Expanded Test Library (Super Detailed, Enterprise Signing)
// Naming convention:
// - test_id: IS01, IS02, ...
// - category fixed to "INCOME_STATEMENT"
// - severity_default: "B" for numerical/logic/disclosure/signing errors; "C" for presentation-only issues
// - evidence_required: indicates what the AI MUST use/cite (pdf_text/pdf_images/portalData/derived_values)
//
// Key rules to embed:
// - Revenue might be absent (entity with no turnover) → must handle gracefully
// - Profit/(Loss) labels may vary: Profit, Loss, (Loss)/Profit, Profit/(Loss), Loss - Profit, etc.
// - Arithmetic is JS-first: AI extracts line items + structure + page refs; JS computes totals/recalcs
// - EUR 1 rounding tolerance only if demonstrably rounding-based; otherwise critical
// - Negative presentation must be consistent: brackets vs minus, and must not flip meaning

const incomeStatementTests = [
  /* =====================================================
       IS01–IS06 : STATEMENT PRESENCE, PERIOD, STRUCTURE
    ===================================================== */

  {
    test_id: "IS01",
    category: "INCOME_STATEMENT",
    test_name: "INCOME_STATEMENT_PRESENT_AND_IDENTIFIABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Locate the Income Statement / Profit and Loss statement in the PDF.",
      "Acceptable headings include (non-exhaustive):",
      "- 'Income statement'",
      "- 'Profit and loss account'",
      "- 'Statement of comprehensive income'",
      "- 'Statement of profit or loss'",
      "- 'Profit and loss'",
      "If not found, flag as critical.",
      "Cite page_no where the income statement starts.",
    ],
  },

  {
    test_id: "IS02",
    category: "INCOME_STATEMENT",
    test_name: "INCOME_STATEMENT_PERIOD_LABEL_PRESENT_AND_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract the period wording (e.g., 'for the year ended 31 December 20XX') from the income statement heading.",
      "Confirm it is present and parseable as a date/period.",
      "Confirm it matches the overall FS year-end from General Information tests.",
      "Any mismatch is critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS03",
    category: "INCOME_STATEMENT",
    test_name: "COMPARATIVE_COLUMN_PRESENT_AND_LABELLED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a comparative period column is present and labelled (prior year).",
      "If comparatives are missing, flag as critical unless explicitly stated as not applicable (rare).",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS04",
    category: "INCOME_STATEMENT",
    test_name: "LINE_ITEM_ORDER_LOGICALLY_PRESENTED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check that income statement lines are presented in a logical order such as:",
      "- Revenue/turnover",
      "- Cost of sales (if applicable)",
      "- Gross profit (if applicable)",
      "- Other income (if applicable)",
      "- Administrative/operating expenses",
      "- Operating profit/(loss)",
      "- Finance income/costs",
      "- Profit/(loss) before tax",
      "- Tax",
      "- Profit/(loss) for the year",
      "If order is unusual but still unambiguous, classify as C.",
      "If order causes misinterpretation risk, escalate to B.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS05",
    category: "INCOME_STATEMENT",
    test_name: "SUBTOTALS_AND_TOTALS_IDENTIFIABLE_FOR_RECALC",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm that the statement provides enough structure for recalculation (line names + amounts).",
      "If key totals exist but components are missing (e.g., operating profit shown with no expense lines), flag as critical if it prevents validation.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS06",
    category: "INCOME_STATEMENT",
    test_name: "SIGN_CONVENTIONS_CLEAR_AND_NOT_AMBIGUOUS",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Check that negative values are clearly shown (brackets or minus signs).",
      "If any negative values are displayed without brackets/minus such that they could be read as positive, flag as critical.",
      "If style differs but meaning is clear, classify as C.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       IS07–IS13 : REVENUE HANDLING (INCLUDING ABSENT/ ZERO)
    ===================================================== */

  {
    test_id: "IS07",
    category: "INCOME_STATEMENT",
    test_name: "REVENUE_LINE_PRESENT_OR_EXPLICITLY_NOT_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Determine whether revenue exists in portalData (P&L) or in the income statement.",
      "Allowed scenarios:",
      "A) Revenue exists → revenue line must appear in the income statement.",
      "B) Revenue is zero → revenue line may appear as dash (–) or explicitly shown as 0 (0 is presentation issue handled separately).",
      "C) Entity has no turnover/revenue category absent → statement must still make income structure clear (e.g., starts with 'Other income' or 'Administrative expenses').",
      "If portalData indicates revenue exists but FS has no revenue line, flag as critical.",
      "If revenue absent everywhere, do not fail—confirm income statement structure still valid.",
      "Cite page_no evidence and portalData fields used.",
    ],
  },

  {
    test_id: "IS08",
    category: "INCOME_STATEMENT",
    test_name: "REVENUE_ZERO_PRESENTATION_DASH_VS_ZERO",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If revenue is zero, verify it is presented as dash (–) rather than '0' or '€0' where dash is standard practice.",
      "If shown as 0, flag as presentation issue (C).",
      "If revenue line is absent and entity truly has no turnover (per portalData), do not fail; record as acceptable.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS09",
    category: "INCOME_STATEMENT",
    test_name: "REVENUE_DESCRIPTION_MATCHES_NOTE_AND_SCHEDULE_WHEN_PROVIDED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If a revenue note or sales schedule exists, confirm the revenue caption matches logically (e.g., 'Turnover', 'Revenue').",
      "If note refers to 'Sales' but income statement uses an unrelated caption without explanation, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS10",
    category: "INCOME_STATEMENT",
    test_name: "OTHER_INCOME_PRESENTATION_CONSISTENT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If 'Other income' exists, ensure it is not double counted within revenue.",
      "If unclear classification (e.g., other income included in revenue without disclosure), escalate to B.",
      "Otherwise C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS11",
    category: "INCOME_STATEMENT",
    test_name: "GRANTS_OR_SUBSIDIES_PRESENTED_AND_DISCLOSED_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If grants/subsidies exist in portalData or notes:",
      "- Confirm they are presented in the income statement (either in other income or netted appropriately per policy).",
      "- Confirm there is a corresponding note if material.",
      "If material and missing disclosure, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS12",
    category: "INCOME_STATEMENT",
    test_name: "EXCEPTIONAL_OR_ONE_OFF_ITEMS_DISCLOSED_WHEN_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData or income statement contains one-off items (e.g., disposal gains, impairment, restructuring):",
      "- Confirm they are separately disclosed or clearly described.",
      "If lumped into admin expenses with no disclosure and material, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS13",
    category: "INCOME_STATEMENT",
    test_name: "REVENUE_RECOGNITION_POLICY_EXISTS_WHEN_REVENUE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If revenue exists (non-zero), confirm a revenue recognition policy exists in the accounting policies note.",
      "If missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       IS14–IS22 : COST OF SALES / GROSS PROFIT / OPERATING RESULT
    ===================================================== */

  {
    test_id: "IS14",
    category: "INCOME_STATEMENT",
    test_name: "COST_OF_SALES_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates cost of sales exists, confirm cost of sales is presented in the income statement.",
      "If revenue exists but cost of sales absent while portalData has it, flag as critical.",
      "If entity is service-based and no cost of sales exists, this is acceptable.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS15",
    category: "INCOME_STATEMENT",
    test_name: "GROSS_PROFIT_PRESENT_WHEN_STRUCTURE_SUPPORTS_IT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If revenue and cost of sales are both present, check whether gross profit is presented.",
      "If omitted but still derivable and not misleading, classify as C.",
      "If omitted and totals become ambiguous (e.g., expenses netted), escalate to B.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS16",
    category: "INCOME_STATEMENT",
    test_name: "OPERATING_PROFIT_OR_LOSS_PRESENT_OR_DERIVABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm operating profit/(loss) is presented or derivable from clearly disclosed lines.",
      "If operating result cannot be derived due to missing structure, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS17",
    category: "INCOME_STATEMENT",
    test_name: "OPERATING_EXPENSES_PRESENTED_WITH_SUFFICIENT_DETAIL",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm operating expenses are not presented as a single undifferentiated line unless supported by notes/schedules.",
      "If only one expense line exists with no breakdown note and it prevents validation, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS18",
    category: "INCOME_STATEMENT",
    test_name:
      "ADMINISTRATIVE_EXPENSES_LABEL_CONSISTENT_WITH_NOTE_AND_SCHEDULE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If admin expenses note/schedule exists, confirm the income statement caption aligns with that note/schedule.",
      "If note says 'Administrative expenses' but income statement uses 'Operating expenses' without mapping clarity, flag as critical if reconciliation becomes ambiguous.",
      "If mapping is clear (e.g., 'Operating expenses' explicitly includes admin), classify as C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS19",
    category: "INCOME_STATEMENT",
    test_name: "STAFF_COSTS_PRESENTED_OR_DISCLOSED_WHEN_MATERIAL",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If staff costs exist in portalData and are material, confirm they are disclosed either as a separate income statement line or in notes/schedules.",
      "If material and missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS20",
    category: "INCOME_STATEMENT",
    test_name: "DEPRECIATION_AND_AMORTISATION_PRESENTATION_AND_DISCLOSURE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If depreciation/amortisation exists in portalData or PPE/intangible notes exist, confirm it is presented in the income statement (either separately or within expenses with clear disclosure).",
      "If missing or not disclosed while assets exist, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS21",
    category: "INCOME_STATEMENT",
    test_name: "IMPAIRMENT_PRESENTATION_AND_DISCLOSURE_WHEN_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If impairment exists in portalData or notes, confirm impairment charge/(credit) is presented and disclosed.",
      "If lumped with no disclosure and material, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS22",
    category: "INCOME_STATEMENT",
    test_name: "OPERATING_LEASE_OR_RENT_EXPENSE_DISCLOSURE_WHEN_PRESENT",
    severity_default: "C",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If rent/lease expense exists and is material, confirm it is disclosed either in admin expenses breakdown or as separate line.",
      "If minor, C; if material and missing breakdown, B.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       IS23–IS30 : FINANCE ITEMS, TAX, NET RESULT (LABEL VARIANTS)
    ===================================================== */

  {
    test_id: "IS23",
    category: "INCOME_STATEMENT",
    test_name: "FINANCE_INCOME_AND_FINANCE_COSTS_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates finance income/costs, confirm they appear in the income statement.",
      "If borrowings exist but finance costs are zero, require explanation in notes; otherwise critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS24",
    category: "INCOME_STATEMENT",
    test_name: "PROFIT_OR_LOSS_BEFORE_TAX_PRESENT_OR_DERIVABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm profit/(loss) before tax is presented or derivable.",
      "If missing and cannot be derived, critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS25",
    category: "INCOME_STATEMENT",
    test_name: "INCOME_TAX_PRESENTATION_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates tax expense or tax balances exist, confirm an income tax line exists in the income statement.",
      "If tax exists but no tax line shown, critical.",
      "If tax is zero, can be shown as dash; 0 presentation is C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS26",
    category: "INCOME_STATEMENT",
    test_name: "NET_PROFIT_LOSS_LABEL_VARIANTS_HANDLED_AND_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Identify the final result caption and ensure it reflects the correct sign and meaning.",
      "Acceptable captions include (non-exhaustive):",
      "- 'Profit for the year'",
      "- 'Loss for the year'",
      "- 'Profit/(Loss) for the year'",
      "- '(Loss)/Profit for the year'",
      "- 'Profit - Loss' or 'Loss - Profit' (rare, must be unambiguous)",
      "Rules:",
      "- If the number is negative, caption must indicate loss or show brackets/minus clearly.",
      "- If the number is positive, caption must indicate profit or be neutral 'profit/(loss)'.",
      "If caption implies profit but value is clearly negative (or vice versa), flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS27",
    category: "INCOME_STATEMENT",
    test_name: "TOTAL_COMPREHENSIVE_INCOME_PRESENTATION_IF_USED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If the statement is titled 'Statement of comprehensive income' or shows 'Total comprehensive income':",
      "- Confirm whether OCI items exist.",
      "- If none exist, total comprehensive income should equal profit/(loss).",
      "If OCI exists but not shown clearly, escalate to B.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS28",
    category: "INCOME_STATEMENT",
    test_name: "EARNINGS_PER_SHARE_NOT_PRESENT_UNLESS_REQUIRED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If EPS appears unexpectedly, ensure entity type requires it and calculation basis is disclosed.",
      "If not required and shown without explanation, C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS29",
    category: "INCOME_STATEMENT",
    test_name: "EXTRAORDINARY_ITEMS_NOT_USED_UNLESS_FRAMEWORK_PERMITS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether 'extraordinary items' are presented.",
      "If presented, confirm framework permits and disclosure is adequate.",
      "If used inappropriately, critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS30",
    category: "INCOME_STATEMENT",
    test_name: "STATEMENT_REFERENCES_NOTE_NUMBERS_THAT_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If the income statement contains note references (e.g., 'Note 4'), verify each referenced note exists.",
      "Any reference to missing note number is critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       IS31–IS40 : ARITHMETIC & RECONCILIATION (JS-FIRST)
    ===================================================== */

  {
    test_id: "IS31",
    category: "INCOME_STATEMENT",
    test_name: "INCOME_STATEMENT_ARITHMETIC_RECALC_MATCHES_REPORTED",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Recalculate using JS-derived values:",
      "- Revenue - Cost of sales = Gross profit (if applicable)",
      "- Gross profit - Operating expenses = Operating profit",
      "- Operating profit ± Finance items = Profit before tax",
      "- Profit before tax - Tax = Profit/(Loss) for the year",
      "Compare recalculated totals to reported totals.",
      "Apply EUR 1 rounding tolerance only if demonstrably rounding-based.",
      "Any other difference (even EUR 1) is critical.",
    ],
  },

  {
    test_id: "IS32",
    category: "INCOME_STATEMENT",
    test_name: "COMPONENT_TOTALS_RECONCILE_TO_ADMIN_EXPENSES_SCHEDULE",
    severity_default: "B",
    evidence_required: ["derived_values", "portalData"],
    test_instructions: [
      "If admin expenses schedule exists:",
      "- Sum schedule lines (JS).",
      "- Confirm equals admin expenses in income statement.",
      "- Confirm reconciles to portalData ETB/lead sheets mapping.",
      "Any mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "IS33",
    category: "INCOME_STATEMENT",
    test_name: "COST_OF_SALES_SCHEDULE_RECONCILES_WHEN_PRESENT",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If cost of sales schedule exists:",
      "- Sum schedule lines (JS).",
      "- Confirm equals cost of sales in income statement.",
      "Mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "IS34",
    category: "INCOME_STATEMENT",
    test_name: "FINANCE_COSTS_RECONCILE_TO_NOTE",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If finance costs note exists:",
      "- Sum note lines (JS).",
      "- Confirm equals finance costs in income statement.",
      "Mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "IS35",
    category: "INCOME_STATEMENT",
    test_name: "TAX_EXPENSE_RECONCILE_TO_TAX_NOTE",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "If tax note exists:",
      "- Confirm tax expense per note equals tax line in income statement.",
      "Mismatch > EUR 1 is critical.",
    ],
  },

  {
    test_id: "IS36",
    category: "INCOME_STATEMENT",
    test_name: "PORTAL_VS_FS_LINE_BY_LINE_MAPPING_MATCH",
    severity_default: "B",
    evidence_required: ["portalData", "derived_values"],
    test_instructions: [
      "Compare portalData P&L to FS income statement captions.",
      "Confirm line-by-line totals match within EUR 1 tolerance only if rounding-based.",
      "Any other mismatch is critical.",
    ],
  },

  {
    test_id: "IS37",
    category: "INCOME_STATEMENT",
    test_name: "COMPARATIVES_ARITHMETIC_INTERNAL_CONSISTENCY",
    severity_default: "B",
    evidence_required: ["derived_values"],
    test_instructions: [
      "Perform the same arithmetic recalculation for comparative column using JS.",
      "Any mismatch beyond rounding is critical.",
    ],
  },

  {
    test_id: "IS38",
    category: "INCOME_STATEMENT",
    test_name: "ROUNDING_CONVENTION_APPLIED_CONSISTENTLY_IN_STATEMENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "derived_values"],
    test_instructions: [
      "Identify rounding convention used in the income statement (€, €000, etc.).",
      "Verify all line items follow the convention consistently.",
      "If convention mismatch causes arithmetic tie failures, critical.",
    ],
  },

  {
    test_id: "IS39",
    category: "INCOME_STATEMENT",
    test_name: "NO_ILLEGAL_NETTING_OF_MATERIAL_INCOME_AND_EXPENSE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Check for netting that hides material items (e.g., netting finance income with finance costs without disclosure).",
      "If material netting exists and disclosure is absent, critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "IS40",
    category: "INCOME_STATEMENT",
    test_name: "STATEMENT_FORMAT_DOES_NOT_CREATE_AMBIGUITY",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Check for formatting that could cause wrong reading (misaligned columns, swapped numbers, missing brackets).",
      "If any ambiguity exists that could misstate profit/loss, critical.",
      "Cite page_no evidence.",
    ],
  },
  {
    test_id: "IS41",
    category: "INCOME_STATEMENT",
    test_name:
      "INCOME_STATEMENT_REFERENCED_POLICIES_AND_NOTES_PAGE_RANGE_MATCH",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Scan the income statement page (and immediately adjacent explanatory text) for any statement indicating that accounting policies and notes form an integral part of the financial statements.",
      "Typical wording includes (non-exhaustive):",
      "- 'The accounting policies and explanatory notes on pages X to Y form an integral part of the financial statements.'",
      "- 'The notes on pages X–Y are an integral part of these financial statements.'",
      "For each identified reference:",
      "- Extract the referenced start page number (X) and end page number (Y).",
      "- Identify the actual page_no where:",
      "  • The accounting policies section begins, and",
      "  • The final explanatory note ends.",
      "Verify that:",
      "- The referenced start page (X) exactly equals the actual first page_no of the accounting policies section.",
      "- The referenced end page (Y) exactly equals the actual last page_no containing the explanatory notes.",
      "- No accounting policy page appears before X.",
      "- No explanatory note page appears after Y.",
      "If the referenced page range:",
      "- Starts later than the actual policies start,",
      "- Ends earlier than the actual notes end,",
      "- Includes pages that are not part of the policies/notes,",
      "- Or does not match the actual financial statements structure,",
      "THEN flag as a critical scope and completeness error.",
      "This is a BLOCKING issue because it defines the legal scope of the financial statements.",
      "Cite page_no evidence for:",
      "- The income statement reference text,",
      "- The actual first accounting policies page,",
      "- The actual last explanatory notes page.",
    ],
  },
];

const incomeStatementPrompt = `
  the tests are to run against the income statement.
  ${incomeStatementTests.map(test => `- ${test.test_name}`).join('\n')}
`;

module.exports = {
  incomeStatementTests,
  incomeStatementPrompt,
};
