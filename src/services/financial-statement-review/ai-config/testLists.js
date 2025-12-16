module.exports = [
  {
    test_id: 1,
    test_name: "VISUAL_LAYOUT_INTEGRITY",
    test_instructions: [
      "Use page images to check:",
      "- Consistent fonts and sizes across similar elements (e.g. note headings, main captions).",
      "- Numeric columns aligned vertically (units, tens, hundreds).",
      "- Currency symbols lined up.",
      "- Brackets and minus signs consistent.",
      "- Headers and footers in same position, with correct page numbers.",
      "- Tables aligned and not drifting across pages.",
      "Any visual inconsistency is an issue.",
      "Missing page or duplicated page is an issue."
    ]
  },
  {
    test_id: 2,
    test_name: "STRUCTURE_AND_DOCUMENT_CONTROL",
    test_instructions: [
      "Check that required sections exist and appear in the specified order:",
      "- Cover, Contents, General info, Directors' responsibilities, Income statement, Balance sheet, Notes, Audit report, Schedules.",
      "Check page numbering is continuous, no gaps/duplicates.",
      "Check that the contents page references correct page numbers.",
      "Check cross-references (e.g. \"See Note 5\") actually point to existing notes, and note numbers match."
    ]
  },
  {
    test_id: 3,
    test_name: "ARITHMETICAL_FS_INTERNAL",
    test_instructions: [
      "Recalculate income statement:",
      "- Revenue – Cost of sales = Gross profit",
      "- Gross profit – operating expenses = Operating profit",
      "- Operating profit ± finance items = Profit before tax",
      "- Profit before tax – tax expense = Net profit",
      "Recalculate balance sheet:",
      "- Total non-current + total current = total assets",
      "- Equity + liabilities = total equity and liabilities",
      "Compare your recomputed totals with reported totals (EUR 1 rounding tolerance rule).",
      "IMPORTANT: Negative equity values are valid (e.g., accumulated losses). This test ONLY checks arithmetic balance, not portal reconciliation.",
      "If Equity + Liabilities = Assets (within EUR 1), the balance sheet balances correctly.",
      "Portal reconciliation issues should be flagged under T10, not T3.",
      "Any non-rounding discrepancy in arithmetic = critical."
    ]
  },
  {
    test_id: 4,
    test_name: "RETAINED_EARNINGS_BRIDGE",
    test_instructions: [
      "Apply formula:",
      "Opening retained earnings + Profit for the year – Dividends ± Prior year adjustments = Closing retained earnings",
      "Use:",
      "- Prior year closing as opening",
      "- Current year profit",
      "- Any disclosed dividends / adjustments",
      "Identify any residual difference > EUR 1 as a critical error."
    ]
  },
  {
    test_id: 5,
    test_name: "NOTES_RECONCILIATION",
    test_instructions: [
      "For each pairing (e.g. PPE note vs PPE line in balance sheet):",
      "- Sum note components.",
      "- Compare to statement caption.",
      "Do same for:",
      "- Receivables",
      "- Payables",
      "- Borrowings",
      "- Deferred tax",
      "- Cost of sales schedule vs income statement",
      "- Admin expenses schedule vs income statement",
      "Mismatch beyond EUR 1 (that is not rounding) = critical."
    ]
  },
  {
    test_id: 6,
    test_name: "ACCOUNTING_POLICIES_INTEGRITY",
    test_instructions: [
      "For each main caption in the statements:",
      "- Ensure there is an accounting policy note.",
      "Also check no \"orphan policies\":",
      "- Policies disclosed for items that don't exist in the statements.",
      "Check that measurement/recognition in the statements/notes aligns with what policies say."
    ]
  },
  {
    test_id: 7,
    test_name: "TAX_AND_DEFERRED_TAX_LOGIC",
    test_instructions: [
      "Check current tax roll-forward:",
      "Opening tax liability + current tax expense – tax payments = closing tax liability.",
      "Check link from profit before tax to tax expense:",
      "- Tax at nominal rate ± reconciling items = recorded tax expense.",
      "Check deferred tax movements tie to temporary differences.",
      "Any unexplained differences beyond EUR 1 = error."
    ]
  },
  {
    test_id: 8,
    test_name: "LOANS_BORROWINGS_EQUITY_CLASSIFICATION",
    test_instructions: [
      "Check that:",
      "- Equity vs liability classification is correct.",
      "- Current vs non-current split is correct based on maturity.",
      "- Related party loans are properly measured (e.g. discounting when appropriate).",
      "- Security/collateral disclosures are present, if applicable."
    ]
  },
  {
    test_id: 9,
    test_name: "COMPARATIVES_INTEGRITY",
    test_instructions: [
      "Ensure comparatives:",
      "- Exist for all primary lines.",
      "- Exist for all material notes.",
      "Check prior year numbers are internally consistent in that prior-year column."
    ]
  },
  {
    test_id: 10,
    test_name: "PORTAL_VS_FS_RECONCILIATION",
    test_instructions: [
      "Compare:",
      "- Portal P&L lines vs FS income statement.",
      "- Portal balance sheet vs FS balance sheet.",
      "- Lead schedule totals vs FS captions.",
      "- Directors' remuneration vs FS note.",
      "Any mismatch > EUR 1 or ANY difference in directors' remuneration is a fail."
    ]
  },
  {
    test_id: 11,
    test_name: "MBR_VS_FS_REGISTRY_MATCH",
    test_instructions: [
      "Check:",
      "- Company name matches exactly.",
      "- Registration number matches exactly.",
      "- Address line-by-line, content and order.",
      "- Directors list (names, count) vs FS and portal."
    ]
  },
  {
    test_id: 12,
    test_name: "GOING_CONCERN_TRIGGER",
    test_instructions: [
      "Identify triggers such as:",
      "- Current year loss + negative equity.",
      "- Loss + liabilities > assets.",
      "- Liquidity stress (current liabilities > current assets).",
      "- High overdue taxes/payables (approximation).",
      "If any trigger is present:",
      "- There must be explicit going concern disclosure in notes.",
      "- Wording must be consistent in directors' responsibilities.",
      "- Audit report should reflect appropriate emphasis / material uncertainty.",
      "If trigger present but disclosure missing/inconsistent → breach."
    ]
  },
  {
    test_id: 13,
    test_name: "SIGNATURE_DATES_CONSISTENCY",
    test_instructions: [
      "Check:",
      "- FS approval date present.",
      "- Director signature date present.",
      "- Audit report date present.",
      "All dates must:",
      "- Be after or on the balance sheet date.",
      "- Be logically ordered (e.g. FS approval not after audit report date in a nonsensical way)."
    ]
  },
  {
    test_id: 14,
    test_name: "DIRECTORS_NUMBER_AND_GRAMMAR",
    test_instructions: [
      "Based on MBR directors count:",
      "- If 1 director → wording must be singular (\"the director\").",
      "- If multiple → wording must be plural (\"the directors\").",
      "Headings and narrative must align."
    ]
  },
  {
    test_id: 15,
    test_name: "DIRECTORS_REMUNERATION_MATCH",
    test_instructions: [
      "Directors' remuneration:",
      "- Must match exactly between portal and FS note.",
      "- Tolerance = 0 (no difference allowed)."
    ]
  },
  {
    test_id: 16,
    test_name: "GRAMMAR_AND_SPELLING_KEY_SECTIONS",
    test_instructions: [
      "Check for obvious errors in:",
      "- Directors' responsibilities page",
      "- Going concern note",
      "- Post-balance sheet events note",
      "- Related party disclosures",
      "- Independent auditors' report",
      "Look for:",
      "- Subject-verb agreement",
      "- Duplicate or missing words",
      "- Clear spelling mistakes"
    ]
  },
  {
    test_id: 17,
    test_name: "MBR_SHARE_CAPITAL_AND_LEGAL_IDENTITY",
    test_instructions: [
      "Check:",
      "- Number of shares",
      "- Nominal value",
      "- Share class description",
      "- Legal form and suffix (e.g. \"Limited\")",
      "These must match across MBR, FS note, and portal."
    ]
  },
  {
    test_id: 18,
    test_name: "COMPANY_STATUS_VS_WORDING",
    test_instructions: [
      "If MBR says \"in liquidation\":",
      "- FS and audit report must reflect liquidation basis, not going concern.",
      "If MBR says \"active\":",
      "- Going concern basis is acceptable unless other triggers indicate otherwise."
    ]
  },
  {
    test_id: 19,
    test_name: "RELATED_PARTY_INTERNAL_TIE",
    test_instructions: [
      "Check that related party balances:",
      "- Amounts due from shareholder",
      "- Related party receivables/payables",
      "tie across:",
      "- Notes",
      "- Receivables/payables captions",
      "- Portal schedules",
      "Within EUR 1 tolerance."
    ]
  },
  {
    test_id: 20,
    test_name: "TAX_RECONCILIATION_DETAIL",
    test_instructions: [
      "If a detailed tax reconciliation is given:",
      "- Recompute tax at nominal rate.",
      "- Recompute each reconciling item.",
      "- Confirm sum of items equals the difference from nominal.",
      "- Ensure effective tax rate matches and is reasonably explained."
    ]
  },
  {
    test_id: 21,
    test_name: "EQUITY_MOVEMENTS_INTERNAL",
    test_instructions: [
      "If there is an equity/reserve movement schedule:",
      "- Check that each component rolls forward correctly.",
      "- Dividends and transfers match portal data.",
      "- Totals match balance sheet."
    ]
  },
  {
    test_id: 22,
    test_name: "PORTAL_MAPPING_COMPLETENESS",
    test_instructions: [
      "Ensure:",
      "- Every portal TB line is mapped to an FS caption or note.",
      "- No unmapped balances.",
      "- Mapped sums match FS values.",
      "- Rounding logic is consistent."
    ]
  },
  {
    test_id: 23,
    test_name: "LARGE_RELATED_PARTY_EXPOSURES",
    test_instructions: [
      "Compare related party exposures to:",
      "- Equity",
      "- Total assets",
      "If above threshold (e.g. 50%):",
      "- There must be clear, strong disclosure.",
      "Absence of such disclosure is a breach."
    ]
  },
  {
    test_id: 24,
    test_name: "CURRENCY_AND_ROUNDING_STATEMENT",
    test_instructions: [
      "Check:",
      "- Currency note is present (euro).",
      "- Rounding policy note is present if applicable.",
      "- Figures are consistent with the claimed rounding."
    ]
  },
  {
    test_id: 25,
    test_name: "YEAR_END_WORDING_CONSISTENCY",
    test_instructions: [
      "Confirm the year-end date wording is consistent across:",
      "- Cover",
      "- Primary statement headings",
      "- Audit report reference."
    ]
  },
  {
    test_id: 26,
    test_name: "NOTE_REFERENCE_COMPLETENESS",
    test_instructions: [
      "Check that:",
      "- Every note has at least one reference.",
      "- There are no references to missing note numbers."
    ]
  }
];

