// NOTES — Expanded Test Library (Super Detailed)
//
// Naming convention:
// - test_id: N01, N02, ...
// - category fixed to "NOTES_AND_POLICY"
// - severity_default: "B" for blocking/missing mandatory disclosures/misstatement risk; "C" for presentation-only issues
// - evidence_required: indicates what the AI MUST use/cite (pdf_text/pdf_images/portalData)
// Notes:
// - AI MUST NOT do arithmetic. AI extracts, classifies, validates presence, wording, cross-references, and composition.
// - All arithmetic reconciliations are JS-first (sum/roll-forward/tie-out), using extracted numbers and portalData.
// - This library is designed to ensure NOTHING in notes is missing, ambiguous, or inconsistent with statements/portal/MBR triggers.

const notesPolicyTests = [
  /* =====================================================
       A. NOTES SECTION EXISTENCE, ORDER, IDENTIFIABILITY
    ===================================================== */

  {
    test_id: "N01",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Locate the 'Notes to the financial statements' section.",
      "Confirm notes section exists and is clearly identifiable (not embedded without headings).",
      "If notes section is missing, flag as critical.",
      "Cite page_no where notes begin.",
    ],
  },

  {
    test_id: "N02",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_NUMBERING_PRESENT_AND_SEQUENTIAL",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract note identifiers (e.g., Note 1, Note 2, etc.).",
      "Confirm numbering exists and is sequential without gaps/duplicates unless explicitly explained.",
      "If missing notes are referenced by statements but do not exist, flag as critical.",
      "Cite page_no evidence for first occurrence of each note and any missing references.",
    ],
  },

  {
    test_id: "N03",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_HEADINGS_CLEAR_AND_UNAMBIGUOUS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "For each note, confirm a clear heading exists describing the subject (e.g., 'Revenue', 'Tax', 'Trade and other receivables').",
      "If headings are generic (e.g., 'Other') and prevent deterministic mapping, flag as critical.",
      "Cite page_no evidence for ambiguous headings.",
    ],
  },

  {
    test_id: "N04",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_HAVE_COMPARATIVES_WHEN_REQUIRED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "For material notes containing figures, verify comparative figures exist where comparatives are required.",
      "If comparatives are missing without explicit explanation, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N05",
    category: "NOTES_AND_POLICY",
    test_name: "NOTE_TABLES_HAVE_CLEAR_COLUMNS_AND_UNITS",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "For note tables, confirm:",
      "- Columns are clearly labelled (current year vs comparative year).",
      "- Currency/unit is clear and consistent with statements (€, EUR, €000).",
      "If unit/column meaning is ambiguous, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       B. ACCOUNTING POLICIES (MANDATORY FOUNDATION)
    ===================================================== */

  {
    test_id: "N06",
    category: "NOTES_AND_POLICY",
    test_name: "ACCOUNTING_POLICIES_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm there is an accounting policies section (typically Note 1).",
      "If missing, flag as critical.",
      "Cite page_no and note reference.",
    ],
  },

  {
    test_id: "N07",
    category: "NOTES_AND_POLICY",
    test_name: "FRAMEWORK_REFERENCE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Verify accounting policies explicitly reference the reporting framework (e.g., GAPSME Malta).",
      "If framework is not referenced anywhere in notes, flag as critical.",
      "Cite page_no and exact wording.",
    ],
  },

  {
    test_id: "N08",
    category: "NOTES_AND_POLICY",
    test_name: "BASIS_OF_PREPARATION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a 'Basis of preparation' disclosure exists.",
      "Must describe preparation basis and measurement convention at a high level.",
      "If absent, flag as critical.",
      "Cite page_no and exact wording.",
    ],
  },

  {
    test_id: "N09",
    category: "NOTES_AND_POLICY",
    test_name: "GOING_CONCERN_BASIS_WORDING_PRESENT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm going concern basis wording exists in basis of preparation where appropriate.",
      "If missing but no triggers evident, mark C.",
      "If triggers evident (losses/negative equity/liquidity stress etc.), missing GC disclosure becomes B (handled in N40/N41 but still record here).",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N10",
    category: "NOTES_AND_POLICY",
    test_name: "CURRENCY_DISCLOSURE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm notes disclose presentation currency (Euro/EUR).",
      "If absent, flag as critical.",
      "Cite page_no and exact wording.",
    ],
  },

  {
    test_id: "N11",
    category: "NOTES_AND_POLICY",
    test_name: "ROUNDING_POLICY_DISCLOSED_IF_APPLICABLE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Determine if figures appear rounded (€, €000, systematic rounding).",
      "If rounding appears used, verify a rounding policy disclosure exists.",
      "If rounding appears used but no rounding disclosure exists, flag as C (escalate to B only if it causes tie failures elsewhere).",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N12",
    category: "NOTES_AND_POLICY",
    test_name: "SIGNIFICANT_ACCOUNTING_POLICIES_PRESENT_FOR_ALL_MAJOR_CAPTIONS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "For each major caption in statements (Income statement and Balance sheet), confirm there is a relevant accounting policy.",
      "Mandatory policy coverage includes (where applicable):",
      "- Revenue recognition (if revenue exists or is referenced)",
      "- Cost of sales/inventories (if applicable)",
      "- PPE and depreciation (if PPE exists)",
      "- Intangibles (if applicable)",
      "- Financial instruments / receivables / impairment (if receivables exist)",
      "- Cash and cash equivalents (if cash exists)",
      "- Trade and other payables (if payables exist)",
      "- Borrowings (if borrowings exist)",
      "- Taxation (if current/deferred tax exists)",
      "- Provisions/contingencies (if applicable)",
      "- Related parties (if related party balances/transactions exist)",
      "- Share capital and equity (if share capital/equity exists)",
      "If a required policy is missing given the presence of the related caption/balance, flag as critical.",
      "Cite page_no evidence for missing policy and the related caption.",
    ],
  },

  {
    test_id: "N13",
    category: "NOTES_AND_POLICY",
    test_name: "NO_ORPHAN_POLICIES",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Identify policies disclosed for items that do not exist anywhere in the statements/notes (e.g., inventories policy when no inventories exist and company is clearly service-only).",
      "Orphan policies are typically C (presentation/boilerplate).",
      "Escalate to B only if orphan policy creates contradictory basis (rare).",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       C. NOTE REFERENCES FROM PRIMARY STATEMENTS
    ===================================================== */

  {
    test_id: "N14",
    category: "NOTES_AND_POLICY",
    test_name: "BALANCE_SHEET_NOTE_REFERENCES_EXIST_AND_RESOLVE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract all note references shown next to balance sheet captions (e.g., 'Note 7').",
      "Confirm each referenced note exists and relates to the caption.",
      "If a referenced note does not exist or is clearly unrelated, flag as critical.",
      "Cite page_no for the caption reference and the note.",
    ],
  },

  {
    test_id: "N15",
    category: "NOTES_AND_POLICY",
    test_name: "INCOME_STATEMENT_NOTE_REFERENCES_EXIST_AND_RESOLVE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract all note references shown next to income statement captions.",
      "Confirm each referenced note exists and relates to the caption.",
      "Missing or incorrect references that prevent traceability = critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N16",
    category: "NOTES_AND_POLICY",
    test_name: "NO_REFERENCES_TO_NON_EXISTENT_NOTE_NUMBERS_ANYWHERE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Scan the entire FS for references such as 'See Note X'.",
      "Confirm Note X exists.",
      "Any reference to a missing note number is critical.",
      "Cite page_no for each missing reference.",
    ],
  },

  /* =====================================================
       D. RECEIVABLES / PAYABLES — COMPOSITION & CAPTION RULES (STRICT)
    ===================================================== */

  {
    test_id: "N17",
    category: "NOTES_AND_POLICY",
    test_name: "RECEIVABLES_NOTE_PRESENT_WHEN_RECEIVABLES_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates receivables balances OR balance sheet includes receivables caption, confirm a corresponding receivables note exists.",
      "If missing, flag as critical.",
      "Cite page_no for balance sheet caption and note.",
    ],
  },

  {
    test_id: "N18",
    category: "NOTES_AND_POLICY",
    test_name: "RECEIVABLES_NOTE_COMPONENTS_IDENTIFIABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Within the receivables note, determine which components are disclosed:",
      "- Trade receivables",
      "- Other receivables",
      "- Prepayments/accrued income (if included)",
      "Components must be explicitly identifiable (separate lines or clearly labelled).",
      "If receivables are presented as a single lump sum with no composition and materiality suggests breakdown is needed, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N19",
    category: "NOTES_AND_POLICY",
    test_name: "PAYABLES_NOTE_PRESENT_WHEN_PAYABLES_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData indicates payables balances OR balance sheet includes payables caption, confirm a corresponding payables note exists.",
      "If missing, flag as critical.",
      "Cite page_no for balance sheet caption and note.",
    ],
  },

  {
    test_id: "N20",
    category: "NOTES_AND_POLICY",
    test_name: "PAYABLES_NOTE_COMPONENTS_IDENTIFIABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Within the payables note, determine which components are disclosed:",
      "- Trade payables",
      "- Other payables",
      "- Accruals (if included)",
      "Components must be explicitly identifiable (separate lines or clearly labelled).",
      "If payables are a single lump sum with no composition and materiality suggests breakdown is needed, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N21",
    category: "NOTES_AND_POLICY",
    test_name: "RECEIVABLES_BALANCE_SHEET_CAPTION_MATCHES_NOTE_COMPOSITION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Compare balance sheet receivables caption to receivables note composition.",
      "Rules (strict):",
      "- If ONLY trade receivables in note → balance sheet caption MUST be 'Trade receivables'.",
      "- If ONLY other receivables in note → caption MUST be 'Other receivables'.",
      "- If BOTH trade and other exist → caption MUST be 'Trade and other receivables'.",
      "If caption misrepresents composition, flag as critical.",
      "Cite page_no for caption and note lines.",
    ],
  },

  {
    test_id: "N22",
    category: "NOTES_AND_POLICY",
    test_name: "PAYABLES_BALANCE_SHEET_CAPTION_MATCHES_NOTE_COMPOSITION",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Compare balance sheet payables caption to payables note composition.",
      "Rules (strict):",
      "- If ONLY trade payables in note → caption MUST be 'Trade payables'.",
      "- If ONLY other payables in note → caption MUST be 'Other payables'.",
      "- If BOTH trade and other exist → caption MUST be 'Trade and other payables'.",
      "If caption misrepresents composition, flag as critical.",
      "Cite page_no for caption and note lines.",
    ],
  },

  {
    test_id: "N23",
    category: "NOTES_AND_POLICY",
    test_name:
      "RECEIVABLES_AND_PAYABLES_AGING_OR_IMPAIRMENT_DISCLOSURE_WHEN_REQUIRED",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If trade receivables exist and are material or include overdue/impairment balances per portalData, confirm impairment/credit risk disclosure exists (policy + any impairment movement if applicable).",
      "If trade receivables exist but there is no policy/disclosure of impairment and risk, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       E. PPE / INTANGIBLES / DEPRECIATION (ROLL-FORWARD READINESS)
    ===================================================== */

  {
    test_id: "N24",
    category: "NOTES_AND_POLICY",
    test_name: "PPE_NOTE_PRESENT_WHEN_PPE_BALANCE_EXISTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If balance sheet or portalData indicates PPE balance, confirm a PPE note exists.",
      "If missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N25",
    category: "NOTES_AND_POLICY",
    test_name: "PPE_NOTE_HAS_COST_AND_ACCUMULATED_DEPRECIATION_COLUMNS",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "If PPE note is present, confirm it includes enough structure for roll-forward testing:",
      "- Cost / gross carrying amount",
      "- Accumulated depreciation",
      "- Net book value (or derivable with JS)",
      "If PPE note is a single net figure without breakdown and PPE is material, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N26",
    category: "NOTES_AND_POLICY",
    test_name: "PPE_MOVEMENT_LINES_PRESENT_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm PPE note identifies movement lines when applicable:",
      "- Opening balance",
      "- Additions",
      "- Disposals",
      "- Depreciation charge",
      "- Closing balance",
      "If movement schedule exists but key movement lines missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N27",
    category: "NOTES_AND_POLICY",
    test_name: "DEPRECIATION_POLICY_PRESENT_WHEN_PPE_EXISTS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If PPE exists, confirm depreciation policy is present including:",
      "- Depreciation method (e.g., straight-line)",
      "- Useful lives or rates by class",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N28",
    category: "NOTES_AND_POLICY",
    test_name: "INTANGIBLES_NOTE_PRESENT_WHEN_INTANGIBLES_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If portalData or balance sheet indicates intangible assets, confirm an intangibles note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       F. INVENTORIES (IF APPLICABLE)
    ===================================================== */

  {
    test_id: "N29",
    category: "NOTES_AND_POLICY",
    test_name: "INVENTORIES_NOTE_PRESENT_WHEN_INVENTORIES_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If inventories exist per portalData or balance sheet, confirm an inventories note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N30",
    category: "NOTES_AND_POLICY",
    test_name: "INVENTORIES_POLICY_PRESENT_WHEN_INVENTORIES_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If inventories exist, confirm inventory valuation policy exists (e.g., lower of cost and NRV, cost formula).",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       G. CASH AND BANK (IF APPLICABLE)
    ===================================================== */

  {
    test_id: "N31",
    category: "NOTES_AND_POLICY",
    test_name: "CASH_AND_BANK_NOTE_PRESENT_WHEN_CASH_EXISTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If cash/bank balances exist, confirm a cash/bank note exists or equivalent disclosure is present.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       H. BORROWINGS / LEASES / FINANCE (IF APPLICABLE)
    ===================================================== */

  {
    test_id: "N32",
    category: "NOTES_AND_POLICY",
    test_name: "BORROWINGS_NOTE_PRESENT_WHEN_BORROWINGS_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If borrowings exist per portalData or balance sheet, confirm a borrowings note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N33",
    category: "NOTES_AND_POLICY",
    test_name: "BORROWINGS_CURRENT_NON_CURRENT_SPLIT_DISCLOSED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If borrowings exist, confirm disclosure distinguishes current vs non-current (maturity) OR the balance sheet clearly classifies them.",
      "If classification is unclear, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N34",
    category: "NOTES_AND_POLICY",
    test_name: "BORROWINGS_TERMS_INTEREST_SECURITY_DISCLOSED_WHEN_APPLICABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "For material borrowings, confirm disclosure includes (as applicable):",
      "- Interest rate / basis",
      "- Repayment terms/maturity",
      "- Security/collateral (if any)",
      "If borrowings are material and these disclosures are absent, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N35",
    category: "NOTES_AND_POLICY",
    test_name:
      "FINANCE_INCOME_COSTS_NOTE_OR_DISCLOSURE_PRESENT_WHEN_FINANCE_ITEMS_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If finance income/costs exist (interest, bank charges, loan interest), confirm adequate disclosure exists either on face of income statement or in notes/schedules.",
      "If finance items exist but are buried without clarity, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       I. TAX (CURRENT AND DEFERRED)
    ===================================================== */

  {
    test_id: "N36",
    category: "NOTES_AND_POLICY",
    test_name: "TAX_NOTE_PRESENT_WHEN_TAX_BALANCES_OR_EXPENSE_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If income tax expense exists OR current tax payable/receivable exists OR deferred tax exists, confirm a tax note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N37",
    category: "NOTES_AND_POLICY",
    test_name: "CURRENT_TAX_COMPONENTS_IDENTIFIABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If current tax exists, confirm the note provides enough detail for roll-forward testing (JS-first):",
      "- Opening liability/asset (if shown)",
      "- Current tax charge",
      "- Payments (if disclosed)",
      "- Closing liability/asset",
      "If tax is material but note lacks determinable components, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N38",
    category: "NOTES_AND_POLICY",
    test_name: "DEFERRED_TAX_DISCLOSURE_PRESENT_WHEN_DEFERRED_TAX_EXISTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If deferred tax balance exists, confirm deferred tax disclosure exists including basis (temporary differences) and movement or explanation.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N39",
    category: "NOTES_AND_POLICY",
    test_name: "TAX_RATE_OR_RECONCILIATION_DISCLOSURE_WHEN_EXPECTED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether a tax rate reconciliation is provided (profit before tax * nominal rate +/- reconciling items).",
      "If tax is material and no reconciliation exists, flag as C (presentation) unless local requirements/engagement demands it as mandatory (then B).",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       J. GOING CONCERN, MATERIAL UNCERTAINTY, LIQUIDATION BASIS
    ===================================================== */

  {
    test_id: "N40",
    category: "NOTES_AND_POLICY",
    test_name: "GOING_CONCERN_TRIGGER_ASSESSMENT_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Assess going concern triggers using evidence from statements/portal:",
      "- Current year loss + negative equity",
      "- Loss + liabilities > assets",
      "- Current liabilities > current assets (liquidity stress)",
      "- Overdue tax/payables indicators",
      "- Auditor emphasis/material uncertainty wording if audit report present",
      "If triggers exist, there MUST be explicit going concern disclosure in notes.",
      "If triggers exist and there is NO going concern disclosure, flag as critical.",
      "Cite page_no evidence for triggers and for disclosure (or absence).",
    ],
  },

  {
    test_id: "N41",
    category: "NOTES_AND_POLICY",
    test_name: "GOING_CONCERN_DISCLOSURE_WORDING_ALIGNED_WITH_FACTS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If going concern disclosure exists, verify wording aligns with facts:",
      "- If significant doubt exists, disclosure must not state 'no material uncertainties' without support.",
      "- If reliance on shareholder support exists, support should be mentioned if material to conclusion.",
      "If disclosure is internally contradictory or misleading, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N42",
    category: "NOTES_AND_POLICY",
    test_name: "LIQUIDATION_BASIS_DISCLOSURE_WHEN_COMPANY_IN_LIQUIDATION",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData.company"],
    test_instructions: [
      "If portalData.company indicates liquidation status, confirm notes disclose liquidation basis and measurement implications as applicable.",
      "If FS continues on going concern basis without explanation, flag as critical.",
      "Cite page_no evidence and portalData.company status.",
    ],
  },

  /* =====================================================
       K. RELATED PARTIES (STRICT TRIGGERS)
    ===================================================== */

  {
    test_id: "N43",
    category: "NOTES_AND_POLICY",
    test_name: "RELATED_PARTY_NOTE_PRESENT_WHEN_TRIGGERED",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Check portalData for related party indicators:",
      "- Director/shareholder/UBO loans",
      "- Amounts due to/from directors/shareholders",
      "- Director remuneration",
      "- Guarantees, related party transactions",
      "If any indicator exists, a related party note MUST be present.",
      "If missing, flag as critical.",
      "Cite page_no evidence and reference portalData fields.",
    ],
  },

  {
    test_id: "N44",
    category: "NOTES_AND_POLICY",
    test_name: "DIRECTORS_REMUNERATION_DISCLOSED_AND_MATCHABLE",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Locate directors' remuneration disclosure in notes.",
      "Confirm it is explicitly stated and clearly attributable to the period.",
      "If portalData has directors' remuneration amount and FS does not disclose it, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N45",
    category: "NOTES_AND_POLICY",
    test_name: "RELATED_PARTY_BALANCES_COMPONENTS_IDENTIFIABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If related party note exists, confirm balances and transactions are identifiable:",
      "- Amounts due from related parties",
      "- Amounts due to related parties",
      "- Terms (interest-free/repayable on demand) where applicable",
      "If balances exist but are not identifiable, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       L. EQUITY, SHARE CAPITAL, RESERVES
    ===================================================== */

  {
    test_id: "N46",
    category: "NOTES_AND_POLICY",
    test_name: "SHARE_CAPITAL_NOTE_PRESENT_WHEN_SHARE_CAPITAL_EXISTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If share capital exists per balance sheet or portalData, confirm a share capital note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N47",
    category: "NOTES_AND_POLICY",
    test_name: "SHARE_CAPITAL_DISCLOSES_SHARES_AND_NOMINAL_VALUE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Share capital note must disclose:",
      "- Number of shares",
      "- Nominal value per share",
      "- Share class (if applicable)",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N48",
    category: "NOTES_AND_POLICY",
    test_name: "EQUITY_MOVEMENT_SCHEDULE_PRESENT_WHEN_EXPECTED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If multiple equity components exist (share capital + reserves + retained earnings), check whether an equity movement schedule is provided.",
      "If not provided, mark as C unless required by engagement/framework in your implementation.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       M. PROVISIONS, CONTINGENCIES, COMMITMENTS (IF APPLICABLE)
    ===================================================== */

  {
    test_id: "N49",
    category: "NOTES_AND_POLICY",
    test_name: "PROVISIONS_NOTE_PRESENT_WHEN_PROVISIONS_EXIST",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "If provisions exist per portalData or balance sheet, confirm a provisions note exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "N50",
    category: "NOTES_AND_POLICY",
    test_name: "CONTINGENT_LIABILITIES_AND_COMMITMENTS_DISCLOSURE_PRESENT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the notes contain disclosure of contingent liabilities/commitments or an explicit statement of none (where typical).",
      "If entirely absent, mark as C unless portalData indicates such exposures (then B).",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       N. EVENTS AFTER REPORTING PERIOD
    ===================================================== */

  {
    test_id: "N51",
    category: "NOTES_AND_POLICY",
    test_name: "POST_BALANCE_SHEET_EVENTS_NOTE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm there is a note covering events after the reporting period (or equivalent statement that none occurred).",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       O. CONSISTENCY, TERMINOLOGY, PRESENTATION QUALITY (NOT COSMETIC WHEN RISKY)
    ===================================================== */

  {
    test_id: "N52",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_TERMINOLOGY_CONSISTENT_WITH_STATEMENTS",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check consistent terminology between statements and notes (e.g., 'Statement of Financial Position' vs 'Balance Sheet', 'trade payables' vs 'creditors').",
      "If inconsistency creates mapping ambiguity, escalate to B; otherwise C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N53",
    category: "NOTES_AND_POLICY",
    test_name: "NO_CONTRADICTORY_STATEMENTS_IN_NOTES",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Identify contradictory wording in notes (e.g., stating company is dormant while revenue exists; stating no borrowings while borrowings exist).",
      "Any contradiction affecting users' understanding is critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N54",
    category: "NOTES_AND_POLICY",
    test_name: "SIGN_CONVENTION_AND_BRACKETS_CONSISTENT_WITH_STATEMENTS",
    severity_default: "C",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Check that negative values in notes use consistent convention with primary statements (brackets/minus).",
      "If inconsistency causes ambiguity or reverses meaning, escalate to B; otherwise C.",
      "Cite page_no.",
    ],
  },

  /* =====================================================
       P. NOTE-TO-STATEMENT TIE-OUT READINESS (JS-FIRST)
    ===================================================== */

  {
    test_id: "N55",
    category: "NOTES_AND_POLICY",
    test_name: "NOTES_HAVE_DETERMINISTIC_NUMERIC_EXTRACTION_FOR_TIE_OUTS",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Confirm numeric values in key notes are extractable deterministically (no missing signs, no merged columns, no ambiguous layout).",
      "Key notes include:",
      "- PPE/Intangibles",
      "- Receivables",
      "- Payables",
      "- Borrowings",
      "- Tax (current/deferred)",
      "- Share capital/equity (where numeric schedules exist)",
      "If layout prevents deterministic extraction, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N56",
    category: "NOTES_AND_POLICY",
    test_name:
      "EACH_MATERIAL_BALANCE_SHEET_CAPTION_HAS_CORRESPONDING_NOTE_OR_DISCLOSURE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "For each material balance sheet caption, confirm corresponding note/disclosure exists.",
      "If balance sheet includes material caption with no corresponding note and no clear disclosure elsewhere, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "N57",
    category: "NOTES_AND_POLICY",
    test_name:
      "EACH_MATERIAL_INCOME_STATEMENT_CAPTION_HAS_CORRESPONDING_NOTE_OR_SCHEDULE_WHEN_EXPECTED",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether material income statement captions have supporting notes/schedules where expected (e.g., admin expenses breakdown, cost of sales schedule).",
      "If absent, mark as C unless portalData indicates the breakdown is mandatory for reconciliation (then B).",
      "Cite page_no.",
    ],
  },
];

const notesPolicyPrompt = `
  the tests are to run against the notes and policies.
  ${notesPolicyTests.map(test => `- ${test.test_name}`).join('\n')}
`;

module.exports = {
  notesPolicyTests,
  notesPolicyPrompt,
};
