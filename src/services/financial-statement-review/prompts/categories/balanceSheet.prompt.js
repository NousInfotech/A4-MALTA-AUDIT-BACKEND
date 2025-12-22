// BALANCE_SHEET — Expanded Test Library (Super Detailed)
//
// Naming convention:
// - test_id: BS01, BS02, ...
// - category fixed to "BALANCE_SHEET"
// - severity_default: "B" for blocking/structural/misstatement risk; "C" for presentation-only issues
// - evidence_required: indicates what the AI MUST use/cite (pdf_text/pdf_images/portalData)
//
// Notes:
// - NO arithmetic by AI.
// - AI extracts structure, captions, ordering, and relationships.
// - All balance checks, totals, and reconciliations are JS-first.
// - Includes strict caption-composition rules for Trade/Other receivables and payables based on note composition.

const balanceSheetTests = [
  /* =====================================================
       BS01–BS06 : EXISTENCE, HEADING & DATE
    ===================================================== */

  {
    test_id: "BS01",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Locate a statement presenting financial position at a point in time.",
      "Acceptable headings include:",
      "- 'Statement of Financial Position'",
      "- 'Balance Sheet'",
      "- 'Statement of Assets and Liabilities'",
      "Confirm the statement is clearly identifiable.",
      "If missing, flag as critical.",
      "Cite page_no where the statement begins.",
    ],
  },

  {
    test_id: "BS02",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_HEADING_UNAMBIGUOUS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract the exact heading used for the balance sheet.",
      "Confirm the heading clearly indicates a statement of financial position.",
      "If wording is ambiguous or misleading, flag as critical.",
      "Cite page_no and exact heading text.",
    ],
  },

  {
    test_id: "BS03",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_DATE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract the balance sheet date (e.g., 'as at 31 December 20XX').",
      "Confirm the date is explicitly present and parseable.",
      "If missing, flag as critical.",
      "Cite page_no and extracted wording.",
    ],
  },

  {
    test_id: "BS04",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_DATE_CONSISTENT_WITH_GENERAL_INFORMATION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Compare balance sheet date to dates extracted in General Information tests.",
      "Dates must match exactly for the current year.",
      "If mismatch exists without explicit explanation, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS05",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_SINGLE_POINT_IN_TIME_CONFIRMED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm wording indicates a point-in-time statement (e.g., 'as at'), not a period.",
      "If balance sheet wording implies a period (e.g., 'for the year'), flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS06",
    category: "BALANCE_SHEET",
    test_name: "COMPARATIVE_COLUMN_PRESENT_WHEN_REQUIRED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a comparative column is present if comparatives are required.",
      "Column must be clearly labelled.",
      "If missing or unclear, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       BS07–BS12 : COLUMN STRUCTURE, CURRENCY & ROUNDING
    ===================================================== */

  {
    test_id: "BS07",
    category: "BALANCE_SHEET",
    test_name: "COLUMN_STRUCTURE_CLEAR_AND_ALIGNED",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Confirm numeric columns are vertically aligned and clearly attributable.",
      "Ensure assets, liabilities, and equity values align under correct columns.",
      "If column meaning is ambiguous, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS08",
    category: "BALANCE_SHEET",
    test_name: "CURRENCY_UNIT_INDICATED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the currency/unit used is indicated for the balance sheet.",
      "Acceptable indicators include €, EUR, €000, etc.",
      "If no unit can be inferred, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS09",
    category: "BALANCE_SHEET",
    test_name: "ROUNDING_UNIT_CONSISTENT_WITH_OTHER_STATEMENTS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Compare balance sheet rounding/unit to income statement and general information.",
      "If inconsistent without disclosure, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS10",
    category: "BALANCE_SHEET",
    test_name: "NEGATIVE_BALANCES_PRESENTED_UNAMBIGUOUSLY",
    severity_default: "C",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Check that negative balances are clearly indicated using brackets or minus signs.",
      "If presentation causes ambiguity (e.g., missing brackets), escalate to B.",
      "Otherwise classify as C.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS11",
    category: "BALANCE_SHEET",
    test_name: "ZERO_BALANCES_PRESENTED_CLEARY",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm zero balances are distinguishable from missing or blank values.",
      "If zero values are misleading, escalate to B.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS12",
    category: "BALANCE_SHEET",
    test_name: "THOUSANDS_SEPARATOR_AND_DECIMAL_STYLE_CONSISTENT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check thousands separators and decimal notation consistency.",
      "If inconsistency could cause misinterpretation, escalate to B.",
      "Otherwise classify as C.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       BS13–BS22 : ASSETS SECTION — STRUCTURE & CAPTIONS
    ===================================================== */

  {
    test_id: "BS13",
    category: "BALANCE_SHEET",
    test_name: "ASSETS_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm an Assets section exists and is clearly labelled.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS14",
    category: "BALANCE_SHEET",
    test_name: "NON_CURRENT_AND_CURRENT_ASSETS_DISTINGUISHED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm assets are split into non-current and current categories, where applicable.",
      "If not split, ensure structure still allows clear classification.",
      "If ambiguous, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS15",
    category: "BALANCE_SHEET",
    test_name: "MAJOR_ASSET_CLASSES_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Check for presence of major asset classes indicated by portalData (e.g., PPE, receivables, cash, inventories, investments, intangibles, prepayments).",
      "If portal indicates balances but FS omits the class, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS16",
    category: "BALANCE_SHEET",
    test_name: "ASSET_CAPTIONS_CLEAR_AND_NOT_MISLEADING",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Review asset captions for clarity and appropriateness.",
      "If wording could mislead users about nature or liquidity, escalate to B.",
      "Otherwise classify as C.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS17",
    category: "BALANCE_SHEET",
    test_name: "ASSET_NOTE_REFERENCES_PRESENT_WHEN_EXPECTED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether major asset captions include note references (e.g., 'Note X').",
      "If references are missing for multiple major captions, flag as C.",
      "Escalate to B only if absence prevents traceability or creates ambiguity.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS18",
    category: "BALANCE_SHEET",
    test_name: "ASSET_SUBTOTALS_PRESENT_WHEN_STRUCTURE_IMPLIES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If assets are grouped (e.g., non-current/current), confirm subtotals are present:",
      "- Total non-current assets",
      "- Total current assets",
      "If grouping exists without subtotals, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS19",
    category: "BALANCE_SHEET",
    test_name: "TOTAL_ASSETS_LINE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a 'Total assets' line exists and is clearly labelled.",
      "If missing or ambiguous, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS20",
    category: "BALANCE_SHEET",
    test_name: "TRADE_AND_OTHER_RECEIVABLES_LINE_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates receivables balances exist (trade and/or other), confirm receivables line(s) are present on the balance sheet.",
      "Receivables may be labelled as 'Trade receivables', 'Other receivables', or 'Trade and other receivables'.",
      "If receivables exist in portal but no receivables line is present, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS21",
    category: "BALANCE_SHEET",
    test_name: "CASH_AND_BANK_LINE_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates cash/bank balances, confirm a cash and bank line exists.",
      "Acceptable captions include 'Cash and bank balances', 'Cash at bank and in hand'.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS22",
    category: "BALANCE_SHEET",
    test_name: "INVENTORIES_LINE_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates inventory balances, confirm an inventories line exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       BS23–BS36 : LIABILITIES & EQUITY — STRUCTURE & CAPTIONS
    ===================================================== */

  {
    test_id: "BS23",
    category: "BALANCE_SHEET",
    test_name: "LIABILITIES_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a Liabilities section exists and is clearly labelled.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS24",
    category: "BALANCE_SHEET",
    test_name: "CURRENT_AND_NON_CURRENT_LIABILITIES_DISTINGUISHED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm liabilities are split into current and non-current categories where applicable.",
      "If not split, ensure liabilities are still classifiable and not ambiguous.",
      "If ambiguous, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS25",
    category: "BALANCE_SHEET",
    test_name: "MAJOR_LIABILITY_CLASSES_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Check for presence of major liability classes indicated by portalData (e.g., payables, borrowings, tax liabilities, provisions, deferred income).",
      "If portal indicates balances but FS omits the class, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS26",
    category: "BALANCE_SHEET",
    test_name: "TRADE_AND_OTHER_PAYABLES_LINE_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates payables balances exist (trade and/or other), confirm payables line(s) are present on the balance sheet.",
      "Payables may be labelled as 'Trade payables', 'Other payables', or 'Trade and other payables'.",
      "If payables exist in portal but no payables line is present, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS27",
    category: "BALANCE_SHEET",
    test_name: "TOTAL_LIABILITIES_SUBTOTAL_PRESENT_WHEN_STRUCTURE_IMPLIES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If liabilities are split into current and non-current, confirm subtotals are present:",
      "- Total non-current liabilities",
      "- Total current liabilities",
      "If grouping exists without subtotals, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS28",
    category: "BALANCE_SHEET",
    test_name: "EQUITY_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm an Equity section exists and is clearly labelled.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS29",
    category: "BALANCE_SHEET",
    test_name: "SHARE_CAPITAL_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates issued share capital, confirm a share capital line exists on the balance sheet.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS30",
    category: "BALANCE_SHEET",
    test_name: "RETAINED_EARNINGS_OR_ACCUMULATED_LOSSES_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm retained earnings / accumulated losses line exists.",
      "Acceptable captions include:",
      "- Retained earnings",
      "- Accumulated losses",
      "- Retained profits/(losses)",
      "- Profit and loss account",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS31",
    category: "BALANCE_SHEET",
    test_name: "TOTAL_EQUITY_LINE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a 'Total equity' or equivalent line exists.",
      "If missing or ambiguous, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS32",
    category: "BALANCE_SHEET",
    test_name: "TOTAL_LIABILITIES_AND_EQUITY_LINE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a 'Total equity and liabilities' (or equivalent) line exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS33",
    category: "BALANCE_SHEET",
    test_name: "NEGATIVE_EQUITY_PRESENTATION_CLEAR",
    severity_default: "C",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "If equity is negative, confirm presentation clearly indicates deficit using brackets/minus and/or wording (e.g., 'deficit').",
      "If ambiguity exists, escalate to B.",
      "Otherwise classify as C.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       BS34–BS37 : STRICT CAPTION-COMPOSITION RULES (RECEIVABLES/PAYABLES)
    ===================================================== */

  {
    test_id: "BS34",
    category: "BALANCE_SHEET",
    test_name: "RECEIVABLES_CAPTION_REFLECTS_NOTE_COMPOSITION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Locate the receivables line item caption on the balance sheet.",
      "Extract the exact caption used (e.g., 'Trade and other receivables', 'Trade receivables', 'Other receivables').",
      "Locate the corresponding receivables note and identify which components are disclosed:",
      "- Trade receivables",
      "- Other receivables",
      "- Both",
      "Apply the following rules strictly:",
      "- If ONLY trade receivables exist in the note → balance sheet caption MUST be 'Trade receivables'.",
      "- If ONLY other receivables exist in the note → balance sheet caption MUST be 'Other receivables'.",
      "- If BOTH trade and other receivables exist → caption MUST be 'Trade and other receivables'.",
      "If caption does not accurately reflect note composition, flag as critical (B).",
      "Cite page_no for balance sheet caption and note disclosure.",
    ],
  },

  {
    test_id: "BS35",
    category: "BALANCE_SHEET",
    test_name: "PAYABLES_CAPTION_REFLECTS_NOTE_COMPOSITION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Locate the payables line item caption on the balance sheet.",
      "Extract the exact caption used (e.g., 'Trade and other payables', 'Trade payables', 'Other payables').",
      "Locate the corresponding payables note and identify which components are disclosed:",
      "- Trade payables",
      "- Other payables",
      "- Both",
      "Apply the following rules strictly:",
      "- If ONLY trade payables exist in the note → balance sheet caption MUST be 'Trade payables'.",
      "- If ONLY other payables exist in the note → balance sheet caption MUST be 'Other payables'.",
      "- If BOTH trade and other payables exist → caption MUST be 'Trade and other payables'.",
      "If caption does not accurately reflect note composition, flag as critical (B).",
      "Cite page_no for balance sheet caption and note disclosure.",
    ],
  },

  {
    test_id: "BS36",
    category: "BALANCE_SHEET",
    test_name: "NO_MASKING_OF_ABSENT_RECEIVABLE_OR_PAYABLE_COMPONENTS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether the balance sheet caption implies existence of components not disclosed in notes.",
      "Examples of masking:",
      "- Caption says 'Trade and other receivables' but note shows only trade receivables.",
      "- Caption says 'Trade and other payables' but note shows only other payables.",
      "Masking absent components misrepresents balance composition.",
      "Any such masking must be flagged as critical (B).",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS37",
    category: "BALANCE_SHEET",
    test_name: "RECEIVABLES_AND_PAYABLES_CAPTION_CONSISTENT_WITH_COMPARATIVES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Compare current year and comparative year captions for receivables and payables.",
      "If composition changed (trade-only vs trade-and-other), confirm caption updates accordingly.",
      "If composition changed but caption did not, flag critical.",
      "If caption changed but note disclosure does not support the change, flag critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       BS38–BS42 : READINESS FOR ARITHMETIC & CROSS-REFERENCING
    ===================================================== */

  {
    test_id: "BS38",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_READY_FOR_ARITHMETIC_VALIDATION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm all required subtotals and totals are present to allow arithmetic validation:",
      "- Total assets",
      "- Total equity",
      "- Total liabilities (or implicit via equity+liabilities)",
      "- Total equity and liabilities",
      "If any are missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "BS39",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_READY_FOR_NOTE_RECONCILIATION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm major captions are traceable to notes (note numbers referenced and notes exist).",
      "If captions exist but related notes cannot be found, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS40",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_READY_FOR_PORTAL_RECONCILIATION",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Confirm balance sheet captions are specific enough to map to portalData classifications (ETB/lead sheets).",
      "If captions are overly generic (e.g., 'Other') without breakdown and portal has multiple material balances, flag as critical.",
      "Cite page_no and reference portalData fields used.",
    ],
  },

  {
    test_id: "BS41",
    category: "BALANCE_SHEET",
    test_name: "CURRENT_NON_CURRENT_CLASSIFICATION_NOT_AMBIGUOUS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm classification of balances between current and non-current is possible from captions and structure.",
      "If items such as borrowings, receivables, payables are shown without classification and classification is required, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "BS42",
    category: "BALANCE_SHEET",
    test_name: "BALANCE_SHEET_STRUCTURAL_COMPLETENESS_CONFIRMED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the balance sheet structure is complete, unambiguous, and internally coherent.",
      "If any structural ambiguity exists that could prevent accurate review or signing, flag as critical.",
      "Cite page_no.",
    ],
  },
  {
    test_id: "BS43",
    category: "BALANCE_SHEET",
    test_name:
      "BALANCE_SHEET_APPROVAL_REFERENCED_FINANCIAL_STATEMENTS_PAGE_RANGE_MATCH",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Scan the balance sheet approval section and/or director approval statement for references to a financial statements page range.",
      "Typical wording includes (non-exhaustive):",
      "- 'The financial statements on pages X to Y were approved and authorised for issue…'",
      "- 'The financial statements set out on pages X–Y were approved…'",
      "For each identified reference:",
      "- Extract the referenced start page number (X) and end page number (Y).",
      "Identify the actual structure of the financial statements:",
      "- Determine the actual page_no where the Income Statement (Profit and Loss) begins.",
      "- Determine the actual page_no where the final explanatory note ends.",
      "Verify that:",
      "- The referenced start page (X) EXACTLY equals the actual page_no where the Income Statement starts.",
      "- The referenced end page (Y) EXACTLY equals the actual page_no where the last explanatory note appears.",
      "- No primary statement (Income Statement, Balance Sheet, Notes) appears outside the approved page range.",
      "- No non-financial content (cover, contents, directors’ report) is included within the approved page range unless explicitly stated.",
      "If the referenced approval page range:",
      "- Starts before the Income Statement,",
      "- Starts after the Income Statement,",
      "- Ends before the notes finish,",
      "- Ends after non-FS pages,",
      "- Or otherwise does not match the actual financial statements boundaries,",
      "THEN flag as a critical legal approval scope error.",
      "This is a BLOCKING issue because director approval applies only to the referenced pages.",
      "Cite page_no evidence for:",
      "- The approval statement text",
      "- The actual Income Statement start page",
      "- The actual final notes page",
    ],
  },
];

const balanceSheetPrompt = `
  the tests are to run against the balance sheet.
  ${balanceSheetTests.map(test => `- ${test.test_name}`).join('\n')}
`;

module.exports = {
  balanceSheetTests,
  balanceSheetPrompt,
};
