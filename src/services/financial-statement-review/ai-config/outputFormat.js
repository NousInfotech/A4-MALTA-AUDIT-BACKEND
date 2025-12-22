/**
 * Output format prompt for AI financial statement review - Optimized
 */
const outputFormatPrompt = `CRITICAL: Final output MUST be a single JSON object with exactly 5 keys: A, B, C, D, E. No additional keys, no variations.

Return analysis results in this JSON structure. Use testLists to map test_id numbers to test names.

OUTPUT FORMAT:

{
  "A": {
    "title": "CONFIRMED CORRECT ITEMS",
    "items": [
      {
        "test_id": "T1",
        "area": "Visual Layout Integrity",
        "details": "Brief description of what was confirmed correct"
      }
    ]
  },
  "B": {
    "title": "CRITICAL ERRORS",
    "items": [
      {
        "id": "B1",
        "test_id": "T4",
        "type": "arithmetical",
        "severity": "critical",
        "description": "Clear description of the error",
        "location": {
          "page": 7,
          "section": "Statement of Changes in Equity",
          "note": null,
          "line_hint": "Retained earnings movement"
        },
        "reported_value": 52000,
        "expected_value": 50000,
        "difference": 2000,
        "reason": "Explanation of why it's wrong",
        "financial_impact": "Description of impact",
        "suggested_fix": "Specific recommendation to fix"
      }
    ]
  },
  "C": {
    "title": "DISCLOSURE & REGULATORY BREACHES",
    "items": [
      {
        "id": "C1",
        "test_id": "T13",
        "type": "legal",
        "severity": "regulatory",
        "description": "Description of the issue",
        "location": {
          "page": 2,
          "section": "Approval Statement",
          "note": null,
          "line_hint": "Date"
        },
        "impact": "Description of regulatory impact",
        "suggested_fix": "Recommendation to address"
      }
    ]
  },
  "D": {
    "title": "RECONCILIATION TABLES",
    "tables": {
      "retained_earnings": {
        "columns": ["2024", "2023"],
        "rows": [
          { "description": "Opening balance", "values": [45000, 40000] },
          { "description": "Profit for the year", "values": [9000, 7000] },
          { "description": "Dividends", "values": [-5000, -2000] },
          { "description": "Closing balance", "values": [49000, 45000] }
        ]
      },
      "borrowings": {
        "columns": ["2024", "2023"],
        "rows": [
          { "description": "Current portion", "values": [10000, 9000] },
          { "description": "Non-current portion", "values": [20000, 19000] },
          { "description": "Total", "values": [30000, 28000] }
        ]
      },
      "deferred_tax": {
        "columns": ["2024", "2023"],
        "rows": [
          { "description": "Opening balance", "values": [2000, 1500] },
          { "description": "Movement", "values": [400, 500] },
          { "description": "Closing balance", "values": [2400, 2000] }
        ]
      },
      "equity": {
        "columns": ["2024", "2023"],
        "rows": [
          { "description": "Share capital", "values": [1200, 1200] },
          { "description": "Retained earnings", "values": [49000, 45000] },
          { "description": "Total equity", "values": [50200, 46200] }
        ]
      }
    }
  },
  "E": {
    "title": "FINAL VERDICT",
    "verdict": "FINANCIAL STATEMENTS ARE NOT FIT FOR APPROVAL – ERRORS PRESENT"
  }
}

INSTRUCTIONS:

1. TEST ID MAPPING: Use testLists to get test_id numbers 1-26. Format as "T" + number (e.g., "T1", "T4"). Use test_name for area field.

2. SECTION A: title exactly "CONFIRMED CORRECT ITEMS". Include only tests that passed completely. Fields: test_id (T format), area (human-readable name), details (brief verification text). CRITICAL: A test_id that appears in Section B or C MUST NOT appear in Section A.

3. SECTION B: title exactly "CRITICAL ERRORS". Fields: id (B1, B2, B3 sequential), test_id (T format), type (arithmetical/logic/portal_crosscheck/registry_crosscheck/visual/structure/disclosure/classification/legal/grammar/presentation), severity always "critical", description, location (page number or null, section string or null, note string or null, line_hint string or null), reported_value (number/string/null), expected_value (number/string/null), difference (number or null), reason, financial_impact, suggested_fix. Include all arithmetical errors, logic errors, material misstatements. CRITICAL: A test_id that appears in Section B MUST NOT appear in Section A or Section C.

4. SECTION C: title exactly "DISCLOSURE & REGULATORY BREACHES". Fields: id (C1, C2, C3 sequential), test_id, type, severity (regulatory or presentation), description, location (same as B), impact (NOT financial_impact), suggested_fix. Include missing disclosures, regulatory non-compliance, presentation issues. CRITICAL: A test_id that appears in Section C MUST NOT appear in Section A or Section B.

CRITICAL RULE - TEST EXCLUSIVITY: Each test_id (T1-T26) can ONLY appear in ONE section. If a test has ANY critical error (Section B), it cannot be in Section A or C. If a test has ANY regulatory breach (Section C) but no critical errors, it cannot be in Section A or B. Only include a test in Section A if it has passed completely with no errors or breaches found.

5. SECTION D: title exactly "RECONCILIATION TABLES". tables object with keys: retained_earnings, borrowings, deferred_tax, equity. Include only relevant tables. Each table: columns array, rows array with description and values array. Use actual values from FS. Ensure rows reconcile.

6. SECTION E: title exactly "FINAL VERDICT". verdict must be one of: "FINANCIAL STATEMENTS ARE 100% GAPSME COMPLIANT – SIGNING APPROVED" (if Section B empty), "FINANCIAL STATEMENTS ARE NOT FIT FOR APPROVAL – ERRORS PRESENT" (if Section B has items).

7. LOCATION: page (integer or null), section (string or null), note (string like "Note 5" or null), line_hint (string or null).

8. VALUES: Use actual numeric values from FS. Use null for non-applicable fields. Ensure reported_value, expected_value, difference are consistent.

9. TYPE: Match test category - arithmetical (T3,T4,T5,T7,T19,T20,T21), logic (T4,T9,T12,T23), portal_crosscheck (T10,T15,T22), registry_crosscheck (T11,T17,T18), visual (T1), structure (T2,T26), disclosure (T6), classification (T8), legal (T13), grammar (T14,T16), presentation (T24,T25).

10. OUTPUT: Return ONLY valid JSON with exactly 5 keys A,B,C,D,E. All numeric values as numbers not strings. Use null for missing values. NO emojis. NO additional keys. Follow exact format.`;

module.exports = {
  outputFormatPrompt,
};
