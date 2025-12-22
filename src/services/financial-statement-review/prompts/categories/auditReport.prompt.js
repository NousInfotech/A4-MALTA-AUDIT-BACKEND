// AUDIT_REPORT — Expanded Test Library (Super Detailed)
//
// Naming convention:
// - test_id: AR01, AR02, ...
// - category fixed to "AUDIT_REPORT"
// - severity_default: "B" for legal/identity/date/opinion scope issues; "C" for presentation/wording issues
// - evidence_required: indicates what the AI MUST use/cite (pdf_text/pdf_images/portalData)
//
// Core philosophy:
// - Audit report is a legal document: identity, scope, dates, opinion type, responsibilities must be correct.
// - AI extracts and validates structure/wording/consistency; arithmetic is not relevant here.
// - If audit report is expected but missing => B (blocking).
// - If audit report exists, all mandatory elements must be present; missing any mandatory element => B.

const auditReportTests = [
  /* =====================================================
       AR01–AR06 : PRESENCE, LOCATION, IDENTIFICATION
    ===================================================== */

  {
    test_id: "AR01",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_PRESENT_WHEN_EXPECTED",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Determine whether an audit report is expected based on engagement/portalData context if provided.",
      "If expected, confirm an audit report section exists in the PDF.",
      "Acceptable headings include:",
      "- 'Independent auditors' report'",
      "- 'Independent auditor's report' (check terminology separately)",
      "- 'Auditors' report'",
      "If expected but not present, flag as critical (B).",
      "Cite page_no where audit report should appear (contents reference) and confirm absence.",
    ],
  },

  {
    test_id: "AR02",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_SECTION_START_PAGE_IDENTIFIED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If audit report exists, identify the first page_no where it begins.",
      "Capture the heading text exactly as shown.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR03",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_HEADING_CLEAR_AND_INDEPENDENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the heading clearly indicates this is an independent auditors' report.",
      "If heading is ambiguous or missing 'independent' where expected, flag as critical.",
      "Cite page_no and exact heading.",
    ],
  },

  {
    test_id: "AR04",
    category: "AUDIT_REPORT",
    test_name: "AUDITORS_REPORT_TERMINOLOGY_PLURAL_POSSESSIVE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Verify terminology must be 'auditors' report' (plural possessive) NOT 'auditor's report' (singular possessive).",
      "If incorrect terminology appears, flag as C unless it creates legal ambiguity (then B).",
      "Check both contents page and report heading/body.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR05",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_ADDRESSEE_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the addressee is present (e.g., 'To the shareholders of ...' or 'To the members of ...').",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR06",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_REFERENCES_CORRECT_ENTITY_NAME_AND_REG_NUMBER",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData.company"],
    test_instructions: [
      "Extract entity name referenced in audit report.",
      "Compare to FS cover/general information and portalData.company legal name.",
      "If name mismatches materially, flag as critical identity issue.",
      "If registration number is included in audit report, verify exact match to portalData.company.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       AR07–AR15 : OPINION SECTION (MANDATORY)
    ===================================================== */

  {
    test_id: "AR07",
    category: "AUDIT_REPORT",
    test_name: "OPINION_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm an explicit opinion section exists.",
      "Acceptable headings include 'Opinion'.",
      "If no explicit opinion is present, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR08",
    category: "AUDIT_REPORT",
    test_name: "OPINION_COVERS_REQUIRED_FINANCIAL_STATEMENTS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the opinion explicitly references the financial statements audited, including:",
      "- Statement of Financial Position / Balance sheet",
      "- Income Statement / Profit and Loss",
      "- Notes to the financial statements",
      "If opinion scope omits notes or misstates the statements, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR09",
    category: "AUDIT_REPORT",
    test_name: "REPORTING_PERIOD_AND_DATE_IN_OPINION_MATCH_FS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract the period end date and period description from the audit report (e.g., 'for the year ended ...').",
      "Verify it matches exactly the FS year-end and balance sheet date.",
      "Any mismatch is critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR10",
    category: "AUDIT_REPORT",
    test_name: "OPINION_TYPE_IDENTIFIED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Determine the opinion type from wording:",
      "- Unmodified (clean) opinion",
      "- Qualified opinion",
      "- Adverse opinion",
      "- Disclaimer of opinion",
      "If opinion type is unclear or contradictory, flag as critical.",
      "Cite page_no and exact wording.",
    ],
  },

  {
    test_id: "AR11",
    category: "AUDIT_REPORT",
    test_name: "OPINION_WORDING_NOT_CONTRADICTORY_WITH_OTHER_SECTIONS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check for contradictions such as:",
      "- Clean opinion but later states unable to obtain sufficient evidence without qualification/disclaimer.",
      "- Disclaimer wording but still asserts true and fair.",
      "Any internal contradiction is critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR12",
    category: "AUDIT_REPORT",
    test_name: "BASIS_FOR_MODIFIED_OPINION_PRESENT_WHEN_MODIFIED",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If opinion is qualified/adverse/disclaimer, verify a 'Basis for Qualified Opinion' / 'Basis for Adverse Opinion' / 'Basis for Disclaimer' section exists.",
      "Confirm basis explains the modification clearly.",
      "If modified opinion but no basis section, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR13",
    category: "AUDIT_REPORT",
    test_name:
      "EMPHASIS_OF_MATTER_OR_MATERIAL_UNCERTAINTY_PRESENT_WHEN_REQUIRED",
    severity_default: "B",
    evidence_required: ["pdf_text", "portalData"],
    test_instructions: [
      "Check whether going concern triggers or other uncertainties exist (losses, negative equity, liquidity stress, etc.).",
      "If audit report includes an Emphasis of Matter or Material Uncertainty Related to Going Concern section, ensure it is clearly labelled and consistent with notes.",
      "If triggers exist and audit report should reasonably refer to them but does not (based on your internal rules), flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR14",
    category: "AUDIT_REPORT",
    test_name: "OTHER_INFORMATION_SECTION_PRESENT_WHEN_APPLICABLE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check if an 'Other Information' section is present (where annual report includes other info beyond FS).",
      "If the FS package clearly includes directors' report or other narrative sections and no 'Other Information' section exists, flag as C unless legally required in your engagement (then B).",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR15",
    category: "AUDIT_REPORT",
    test_name: "REPORTING_FRAMEWORK_REFERENCE_IN_OPINION_OR_BASIS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm audit report references the applicable financial reporting framework (e.g., GAPSME Malta) or refers to 'applicable financial reporting framework'.",
      "If no framework reference exists anywhere in audit report, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       AR16–AR24 : RESPONSIBILITIES SECTIONS (MANDATORY)
    ===================================================== */

  {
    test_id: "AR16",
    category: "AUDIT_REPORT",
    test_name: "DIRECTORS_RESPONSIBILITIES_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a section describing directors'/management responsibilities for the financial statements exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR17",
    category: "AUDIT_REPORT",
    test_name: "AUDITORS_RESPONSIBILITIES_SECTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm a section describing auditors' responsibilities exists.",
      "If missing, flag as critical.",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR18",
    category: "AUDIT_REPORT",
    test_name: "INDEPENDENCE_STATEMENT_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm audit report includes an independence statement (e.g., compliance with ethical requirements).",
      "If missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR19",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_SCOPE_DESCRIPTION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the report describes the audit scope, including that it was conducted in accordance with applicable auditing standards.",
      "If standards reference is missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR20",
    category: "AUDIT_REPORT",
    test_name: "GOING_CONCERN_RESPONSIBILITIES_WORDING_PRESENT",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check whether responsibilities section includes going concern responsibilities wording where appropriate.",
      "If absent, mark as C unless required by your template/standards in the engagement (then B).",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR21",
    category: "AUDIT_REPORT",
    test_name:
      "OTHER_LEGAL_AND_REGULATORY_REQUIREMENTS_SECTION_PRESENT_WHEN_APPLICABLE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "If the audit report template includes 'Report on Other Legal and Regulatory Requirements', confirm presence where applicable.",
      "If missing, mark as C unless mandatory in your engagement (then B).",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR22",
    category: "AUDIT_REPORT",
    test_name: "RESPONSIBILITIES_LANGUAGE_MATCHES_DIRECTORS_COUNT",
    severity_default: "C",
    evidence_required: ["pdf_text", "portalData.company"],
    test_instructions: [
      "Based on portalData.company directors count, confirm wording is singular/plural consistently.",
      "If mismatch could create legal ambiguity, escalate to B; otherwise C.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR23",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_DOES_NOT_CONFLICT_WITH_FS_STATUS_LABELS",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check for conflicts such as:",
      "- Audit report present but cover says 'Unaudited' or 'Draft' prominently.",
      "If contradiction exists, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR24",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_SIGNATURE_BLOCK_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Confirm audit report includes signature block including:",
      "- Audit firm name (or auditor name)",
      "- Auditor signature line/marking",
      "- Address of auditor (or place of signature)",
      "- Audit report date",
      "Missing signature block elements = critical.",
      "Cite page_no evidence.",
    ],
  },

  /* =====================================================
       AR25–AR33 : DATES, PLACE, CONSISTENCY (LEGAL)
    ===================================================== */

  {
    test_id: "AR25",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_DATE_PRESENT_AND_PARSEABLE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract audit report date.",
      "Confirm it is present and parseable.",
      "If missing or multiple conflicting dates exist, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR26",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_DATE_EQUALS_FS_APPROVAL_DATE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract FS approval date from the balance sheet approval statement.",
      "Extract audit report date from audit report signature block.",
      "Confirm dates match exactly (day/month/year).",
      "Mismatch is a legal compliance critical error.",
      "Cite page_no evidence for both dates.",
    ],
  },

  {
    test_id: "AR27",
    category: "AUDIT_REPORT",
    test_name: "ALL_REPORT_DATES_ON_OR_AFTER_BALANCE_SHEET_DATE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm audit report date is on or after the balance sheet date.",
      "If earlier, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR28",
    category: "AUDIT_REPORT",
    test_name: "SIGNATURE_PLACE_OR_ADDRESS_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm the audit report indicates place of signature or address (e.g., Malta).",
      "If missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR29",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_FIRM_NAME_PRESENT_AND_CONSISTENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Extract audit firm name from audit report.",
      "Confirm it is present and consistent across any occurrences.",
      "If missing or inconsistent, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR30",
    category: "AUDIT_REPORT",
    test_name: "AUDITOR_IDENTIFICATION_PRESENT",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm auditor identification exists (e.g., audit partner name, warranted auditor number, or equivalent identifier per your practice requirements).",
      "If missing, flag as critical.",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR31",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_ADDRESSEE_MATCHES_ENTITY_TYPE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Check addressee is appropriate ('shareholders' vs 'members') based on entity form.",
      "If mismatched, classify as C unless it creates legal ambiguity (then B).",
      "Cite page_no.",
    ],
  },

  {
    test_id: "AR32",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_LANGUAGE_CONSISTENT_WITH_FS_LANGUAGE",
    severity_default: "C",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Confirm audit report uses consistent terminology with FS (e.g., statement names).",
      "If inconsistent, mark as C unless it changes meaning/scope (then B).",
      "Cite page_no evidence.",
    ],
  },

  {
    test_id: "AR33",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_IS_COMPLETE_AND_NOT_TRUNCATED",
    severity_default: "B",
    evidence_required: ["pdf_text", "pdf_images"],
    test_instructions: [
      "Check whether the audit report appears complete (no cut-off paragraphs, no missing pages, no sudden ending).",
      "If truncated or incomplete, flag as critical.",
      "Cite page_no evidence.",
    ],
  },
  {
    test_id: "AR34",
    category: "AUDIT_REPORT",
    test_name: "AUDIT_REPORT_PAGE_NUMBERS_MATCH_DOCUMENT_SEQUENCE",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Identify page number(s) shown on the audit report pages (e.g., footer/header numbering such as 'Page X of Y' or standalone page numbers).",
      "Compare the displayed page number to the actual page_no provided in the PDF data structure.",
      "Verify that:",
      "- The audit report page number corresponds exactly to its position in the full financial statements document.",
      "- There are no duplicated page numbers within the audit report.",
      "- There are no skipped or missing page numbers within the audit report section.",
      "If the contents page references the audit report page number, verify that reference matches the actual page_no.",
      "Any mismatch, duplication, or gap in audit report page numbering is a critical structural and legal error.",
      "Cite page_no evidence for:",
      "- Displayed page number text",
      "- Actual page_no from input structure",
    ],
  },
  {
    test_id: "AR35",
    category: "AUDIT_REPORT",
    test_name:
      "AUDIT_REPORT_REFERENCED_FINANCIAL_STATEMENTS_PAGE_NUMBERS_MATCH",
    severity_default: "B",
    evidence_required: ["pdf_text"],
    test_instructions: [
      "Scan the audit report for any references to page numbers relating to the financial statements.",
      "Examples include (non-exhaustive):",
      "- 'The financial statements set out on pages X to Y'",
      "- 'The accompanying financial statements on pages X–Y'",
      "- 'The balance sheet on page X and the income statement on page Y'",
      "For each referenced page number or page range:",
      "- Identify the referenced page number(s) as stated in the audit report.",
      "- Compare them to the actual page_no values where the referenced financial statements appear in the PDF data structure.",
      "Verify that:",
      "- The starting page number matches exactly the actual first page of the financial statements.",
      "- The ending page number matches exactly the actual last page of the financial statements (including notes, if stated).",
      "- Any individually referenced statement page (e.g., balance sheet, income statement) matches its actual page_no.",
      "If the audit report references a page range that:",
      "- Starts too early or too late,",
      "- Ends too early or too late,",
      "- Omits pages that are part of the financial statements,",
      "- Includes pages that are not part of the financial statements,",
      "THEN flag as a critical legal and structural error.",
      "If the audit report references financial statements without page numbers, no error is raised under this test (handled elsewhere).",
      "Cite page_no evidence for:",
      "- The audit report reference text",
      "- The actual page_no of the referenced financial statements",
    ],
  },
];

const auditReportPrompt = `
  the tests are to run against the audit report.
  ${auditReportTests.map(test => `- ${test.test_name}`).join('\n')}
`;

module.exports = {
  auditReportTests,
  auditReportPrompt,
};
