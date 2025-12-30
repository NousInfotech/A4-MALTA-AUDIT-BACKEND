// PRESENTATION — Presentation Integrity Test
// This category contains tests for visual consistency, formatting, and presentation integrity
// across all pages of the financial statements

const presentationTests = [
  {
    test_id: "PRES01",
    category: "PRESENTATION",
    test_name: "ENTERPRISE_PRESENTATION_INTEGRITY_MARGINS_FONTS_CURRENCY_ZERO_FORMATTING_AND_EMPTY_CELLS",
    severity_default: "B",
    evidence_required: ["pdf_images", "pdf_text"],
    test_instructions: [
      "IMPORTANT: This is an image-first presentation integrity test. You MUST review the PDF page images in detail (base64 PNG per page) and use pdf_text only as supporting evidence.",
      "",
      "OBJECTIVE:",
      "Confirm the financial statements are visually consistent, professionally formatted, and unambiguous across ALL pages, with strict checks on:",
      "- margins and alignment consistency",
      "- fonts and typography consistency",
      "- currency symbol and numeric formatting consistency",
      "- table integrity and column alignment",
      "- presence of values (no blank numeric cells where a value is expected)",
      "- zero presentation as dash (–) rather than 0 / €0 where dash is standard",
      "",
      "STEP 1 — PAGE-BY-PAGE VISUAL SCAN (ALL PAGES):",
      "For each page image (in page_no order):",
      "- Visually confirm left/right/top/bottom margins are consistent with the document's baseline layout.",
      "- Flag any irregular indenting, drifting tables, shifted columns, or content that is not aligned with the rest of the document.",
      "- Confirm headers/footers are placed consistently (same vertical position across pages).",
      "- Confirm page number placement is consistent (same location/style) across pages where page numbers exist.",
      "",
      "STEP 2 — FONT & TYPOGRAPHY CONSISTENCY:",
      "Across all pages, visually verify consistent use of:",
      "- primary body font (same family/weight) for narrative text",
      "- heading font/size/weight for primary statements headings",
      "- note headings formatting (consistent hierarchy: Note title vs subheadings)",
      "- table fonts (numbers and labels in tables should not randomly change font/size/weight)",
      "Flag any random font changes, mixed sizes, or inconsistent bolding that creates ambiguity (e.g., a subtotal looks like a line item or vice versa).",
      "",
      "STEP 3 — TABLE & COLUMN INTEGRITY (CRITICAL):",
      "For every table on every page (income statement, balance sheet, notes tables, schedules):",
      "- Confirm numeric columns are vertically aligned (units/tens/hundreds align).",
      "- Confirm comparative columns align directly under their headers and do not drift.",
      "- Confirm currency symbols (if shown) align consistently with numeric columns.",
      "- Confirm brackets/minus signs are consistently positioned and not clipped.",
      "- Confirm subtotal/total lines are visually distinguishable and consistent (e.g., underline/spacing/bold) across the document.",
      "If column drift, misalignment, or formatting could cause a reader to misread which number belongs to which caption/column, classify as CRITICAL (B).",
      "",
      "STEP 4 — NO BLANK NUMERIC CELLS WHERE VALUES ARE EXPECTED (CRITICAL):",
      "Visually inspect tables for numeric fields that appear intentionally left empty.",
      "Rules:",
      "- If a line item exists, it must show a value in the current year column (even if zero).",
      "- If comparative column exists, it must show a value (even if zero) unless the statement explicitly explains why a comparative is not applicable.",
      "Blank numeric cells are NOT acceptable where a value is expected because they create ambiguity.",
      "If blank cells exist in any primary statement or note table where a value is expected, classify as CRITICAL (B) unless clearly marked 'N/A' or the table explicitly defines blanks as zero (rare; if so, C and cite wording).",
      "",
      "STEP 5 — ZERO PRESENTATION RULE (DASH VS 0):",
      "When a line item value is zero and the document uses dash convention:",
      "- Zero MUST be presented as dash (–), not '0' and not '€0'.",
      "Apply this check across primary statements and all note tables/schedules.",
      "If '0' or '€0' is used where dash convention is otherwise used in the document, classify as NON-BLOCKING (C) unless it creates inconsistency/ambiguity between columns or totals (then B).",
      "Use pdf_text to confirm the actual character if visually ambiguous.",
      "",
      "STEP 6 — CURRENCY CONSISTENCY (SYMBOLS, UNITS, ROUNDING):",
      "Visually verify consistency of:",
      "- currency symbol placement (€ / EUR wording)",
      "- rounding unit indicators (€, €000, €'000, etc.) across pages",
      "- thousands separators and decimal styles",
      "If the income statement appears to be in €000 but notes/BS appear in €, or mixed units appear without clear disclosure, classify as CRITICAL (B).",
      "If currency symbol usage varies but meaning is clear and unit is consistent, classify as C.",
      "",
      "STEP 7 — IRREGULAR LINES / BROKEN RULES / VISUAL ARTIFACTS:",
      "Identify any:",
      "- broken lines/underlines that do not match the rest of the document",
      "- inconsistent horizontal rules under totals",
      "- mis-rendered characters (e.g., dash becomes hyphen, missing bracket)",
      "- overlapping text, clipped numbers, or wrapped captions that distort meaning",
      "If any artifact can change numeric meaning (e.g., missing bracket, number clipped, column header misaligned), classify as CRITICAL (B). Otherwise C.",
      "",
      "STEP 8 — OUTPUT REQUIREMENTS FOR THIS TEST:",
      "For EACH issue found, provide:",
      "- exact page_no",
      "- what visual inconsistency exists",
      "- why it is an issue (ambiguity / misstatement risk / presentation)",
      "- classification guidance: B if ambiguity/misstatement risk; C if cosmetic/presentation-only",
      "If no issues found, confirm explicitly that margins, fonts, currency formatting, numeric alignment, and zero presentation are consistent across all pages reviewed (cite representative page_no range)."
    ],
  },
];

const presentationPrompt = `
PRESENTATION INTEGRITY TESTS

These tests verify the visual consistency, formatting, and presentation integrity of the financial statements across all pages.

The presentation integrity test checks:
- Margins and alignment consistency
- Fonts and typography consistency  
- Currency symbol and numeric formatting consistency
- Table integrity and column alignment
- Presence of values (no blank numeric cells)
- Zero presentation as dash (–) vs 0 / €0
- Visual artifacts and formatting issues

This is a mandatory test that runs on all financial statement reviews to ensure professional presentation and prevent ambiguity.
`;

module.exports = {
  presentationTests,
  presentationPrompt,
};

