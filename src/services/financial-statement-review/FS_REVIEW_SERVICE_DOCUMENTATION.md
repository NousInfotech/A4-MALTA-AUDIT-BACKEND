# Financial Statement Review Service Documentation

## Overview

The `generateFSReview.service.js` orchestrates a complete financial statement review process that extracts data from multiple sources, processes it, and uses AI to perform comprehensive GAPSME (Malta) compliance validation.

---

## 1. Data Sources

### 1.1 Portal Data (Database)

**Source Module:** `portal-data/extractPortalData.service.js`

**Data Retrieved From:**

1. **Engagement Model** (`Engagement`)
   - `title`: Engagement title
   - `yearEndDate`: Financial year end date

2. **Company Model** (`Company`)
   - `name`: Company name
   - `registrationNumber`: Company registration number
   - `address`: Company address
   - `representationalSchema`: Populated with Person model to get directors
     - Filters for role containing "Director"
     - Extracts: `personId`, `name`, `nationality`, `address`, `role`

3. **Extended Trial Balance (ETB) Model** (`ExtendedTrialBalance`)
   - Finds ETB document by `engagement` ID
   - Contains `rows` array with trial balance data

4. **Adjustment Model** (`Adjustment`)
   - Finds all adjustments by `engagementId` and `etbId`
   - Contains journal entries with `dr`, `cr`, `etbRowId`, `status`

5. **Reclassification Model** (`Reclassification`)
   - Finds all reclassifications by `engagementId` and `etbId`
   - Contains journal entries with `dr`, `cr`, `etbRowId`, `status`

### 1.2 PDF Data (File Upload)

**Source Module:** `pdf-data/fsPdfDataExtractor.js`

**Input:** PDF file buffer from Multer upload

**Processing:**
- Converts PDF to page images using `pdftoppm` (Poppler CLI)
- Extracts text per page using `pdf-parse`
- Creates temporary image files in `tmp/images/` directory
- Generates unique session ID for file naming

**Output Structure:**
```javascript
{
  pageDataArray: [
    {
      page_no: 1,
      text: "Extracted text content...",
      imageName: "sessionId_page_1.png"
    }
  ],
  imageFiles: ["/path/to/image1.png", ...],
  sessionId: "unique_session_id"
}
```

---

## 2. Data Aggregation and Formatting

### 2.1 Portal Data Processing

#### Step 1: Apply Adjustments and Reclassifications
**Module:** `portal-data/trial-balance/applyAdjustmentsAndReclassifications.js`

**Process:**
1. Builds journal maps from adjustments and reclassifications
2. Filters only "posted" journals
3. Aggregates `dr`, `cr`, and net `value` per ETB row
4. Collects reference IDs for each journal entry
5. Applies to ETB rows and creates summary arrays

**Output:**
```javascript
{
  etb: [/* ETB rows with adjustments applied */],
  adjustments: [/* Aggregated adjustment summary */],
  reclassifications: [/* Aggregated reclassification summary */]
}
```

#### Step 2: Extract ETB Data and Derive Financial Statements
**Module:** `portal-data/trial-balance/extractETBData.js`

**Process Flow:**

1. **Normalize ETB** (`normalizeETB`)
   - Flips sign for Equity & Liabilities accounts (multiply by -1)
   - Rounds all numeric values
   - Calculates `finalBalance = currentYear + adjustments + reclassifications`

2. **Build Lead Sheet Tree** (`buildLeadSheetTree`)
   - Parses classification strings: `"Grouping1 > Grouping2 > Grouping3"`
   - Creates hierarchical tree structure:
     - `grouping1` (e.g., "Equity", "Liabilities", "Assets")
     - `grouping2` (e.g., "Current", "Non-current", "Current Year Profits & Losses")
     - `grouping3` (e.g., "Administrative expenses", "Trade and other payables")
   - Aggregates totals per grouping3:
     - `currentYear`, `priorYear`, `adjustments`, `reclassifications`, `finalBalance`
   - Assigns unique IDs: `LS_1`, `LS_2`, etc.
   - Links ETB row IDs to each grouping3

3. **Derive Income Statement** (`deriveIncomeStatement`)
   - Extracts "Current Year Profits & Losses" from Equity grouping
   - Collects totals by category (Revenue, Cost of sales, Administrative expenses, etc.)
   - Calculates:
     - `grossProfit = Revenue + Cost of sales`
     - `operatingProfit = grossProfit + operating expenses + other operating income`
     - `netProfitBeforeTax = operatingProfit + investment items + finance costs`
     - `net_result = netProfitBeforeTax + Income tax expense`
   - Returns prior year and current year breakdowns with account references

4. **Derive Retained Earnings** (`deriveRetainedEarnings`)
   - Finds "Retained earnings" from Equity > Equity grouping
   - Calculates:
     - `prior_year.value = priorYear balance from lead sheet`
     - `current_year.value = prior_year.value + current_year.net_result`

5. **Derive Balance Sheet** (`deriveBalanceSheet`)
   - Sums Assets, Liabilities, and Equity from lead sheet tree
   - Excludes "Current Year Profits & Losses" and "Retained earnings" from Equity sum
   - Adds calculated retained earnings to Equity
   - Checks balance: `Math.abs(assets - (liabilities + equity)) < 1`
   - Collects account references for each category

**Final Portal Data Structure:**
```javascript
{
  engagement: {
    title: "Audit 2023",
    yearEndDate: "2023-12-12T00:00:00.000Z"
  },
  company: {
    name: "White Investments Limited",
    registrationNumber: "C 73546",
    address: "99, Dingli Street, SLIEMA, Malta",
    directors: [/* Director objects */]
  },
  etb: [/* Normalized ETB rows */],
  adjustments: [/* Aggregated adjustments */],
  reclassifications: [/* Aggregated reclassifications */],
  profit_and_loss: {
    prior_year: { year, net_result, resultType, breakdowns },
    current_year: { year, net_result, resultType, breakdowns }
  },
  balance_sheet: {
    prior_year: { year, totals: { assets, liabilities, equity }, balanced },
    current_year: { year, totals: { assets, liabilities, equity }, balanced }
  },
  lead_sheets: [/* Hierarchical tree structure */]
}
```

### 2.2 PDF Data Processing

**Module:** `pdf-data/fsPdfDataExtractor.js`

**Process:**
1. Saves PDF buffer to temporary file
2. Uses `pdf-parse` to get total page count
3. Converts PDF to PNG images using `pdftoppm` CLI tool (200 DPI)
4. Extracts text per page using form feed character (`\f`) as separator
5. If form feed separation fails, splits text evenly by page count
6. Copies images to `tmp/images/` with session-based naming
7. Returns array of page objects with `page_no`, `text`, and `imageName`

**Output:**
```javascript
[
  {
    page_no: 1,
    text: "Financial Statements\nWhite Investments Limited\n...",
    imageName: "sessionId_page_1.png"
  },
  // ... more pages
]
```

---

## 3. Prompts and Configuration

### 3.1 System Instructions

**Location:** `ai-config/aiPromptGenerator.js`

**Content:**
```
You are operating as: Malta Audit Partner and GAPSME (Malta) Compliance Forensic Engine

Your role: Behave like a senior Malta audit partner plus a deterministic validation engine. 
Verify financial statements, portal data and MBR extract against GAPSME (Malta) and strict numerical logic.

REQUIREMENTS:
- Internally reason step-by-step and verify every figure and disclosure
- NEVER show reasoning or commentary in final answer
- Final answer must ALWAYS be a single JSON object with A/B/C/D/E structure

CORE MINDSET:
1. Assume everything is wrong
2. Recompute everything
3. Zero-tolerance for EUR 1 (except rounding)
4. Internal reasoning, external discipline

WORKFLOW:
Step 0: Read and internalise specification
Step 1: Preprocessing (PDF converted to page images)
Step 2: Ingest all data (FS, PDF images, Portal data, MBR)
Step 3: Run tests T1-T26
Step 4: Build reconciliation tables (Section D)
Step 5: Decide final verdict (Section E)
Step 6: Output single JSON object

OUTPUT RESTRICTIONS:
- Output ONLY the JSON object
- NO prose, NO explanations, NO markdown
- JSON must be syntactically valid
- Include all 5 sections: A, B, C, D, E
- If Section B.items length > 0: MUST choose "NOT FIT FOR APPROVAL" verdict
```

### 3.2 Portal Data Prompt

**Location:** `portal-data/portalDataPrompt.js`

**Full Prompt:**
```
PORTAL DATA STRUCTURE AND USAGE

Portal data contains structured financial information, company details, and MBR (Malta Business Registry) information from the audit system.

STRUCTURE:
{
  "engagement": {
    "title": "Audit 2023",
    "yearEndDate": "2023-12-12T00:00:00.000Z"
  },
  "company": {
    "name": "White Investments Limited",
    "registrationNumber": "C 73546",
    "address": "99, Dingli Street, SLIEMA, Malta",
    "directors": [
      {
        "personId": "ObjectId",
        "name": "Director Name",
        "nationality": "Nationality",
        "address": "Director Address",
        "role": "Director"
      }
    ]
  },
  "etb": [
    {
      "rowId": "1",
      "code": "1",
      "accountName": "Audit Fees",
      "currentYear": 0,
      "priorYear": 650,
      "adjustments": 1250,
      "reclassifications": 0,
      "finalBalance": 1250,
      "classification": "Equity > Current Year Profits & Losses > Administrative expenses"
    }
  ],
  "adjustments": [
    {
      "rowId": "1",
      "dr": 1250,
      "cr": 0,
      "value": 1250,
      "refs": ["693c0ba597e042e7f12b01d3"]
    }
  ],
  "reclassifications": [],
  "profit_and_loss": {
    "prior_year": {
      "year": 2022,
      "net_result": -856,
      "resultType": "net_loss",
      "breakdowns": {
        "Administrative expenses": {
          "value": 856,
          "accounts": ["LS_1"]
        }
      }
    },
    "current_year": {
      "year": 2023,
      "net_result": -1645,
      "resultType": "net_loss",
      "breakdowns": {
        "Administrative expenses": {
          "value": 1645,
          "accounts": ["LS_1"]
        }
      }
    }
  },
  "balance_sheet": {
    "prior_year": {
      "year": 2022,
      "totals": {
        "assets": { "value": 1200, "accounts": ["LS_5"] },
        "liabilities": { "value": 4703, "accounts": ["LS_2"] },
        "equity": { "value": -3503, "accounts": ["LS_4"] }
      },
      "balanced": true
    },
    "current_year": {
      "year": 2023,
      "totals": {
        "assets": { "value": 1200, "accounts": ["LS_5"] },
        "liabilities": { "value": 6348, "accounts": ["LS_2"] },
        "equity": { "value": -5148, "accounts": ["LS_4"] }
      },
      "balanced": true
    }
  },
  "lead_sheets": [
    {
      "level": "grouping1",
      "group": "Equity",
      "children": [
        {
          "level": "grouping2",
          "group": "Current Year Profits & Losses",
          "children": [
            {
              "level": "grouping3",
              "id": "LS_1",
              "group": "Administrative expenses",
              "totals": {
                "currentYear": 0,
                "priorYear": -856,
                "adjustments": -1645,
                "reclassification": 0,
                "finalBalance": -1645
              },
              "rows": ["1", "2"]
            }
          ]
        }
      ]
    }
  ]
}

USAGE FOR TESTS:

MBR DATA (portalData.company):
- T11: Compare company name, registration number, address, directors
- T14: Count directors from portalData.company.directors.length
- T17: Compare share capital details
- T18: Check company status

PORTAL VS FS RECONCILIATION:
- T10: Compare profit_and_loss vs FS income statement
- T10: Compare balance_sheet vs FS balance sheet
- T10: Compare lead_sheets totals vs FS captions
- T15: Compare directors remuneration from portal vs FS note (exact match, tolerance 0)
- T22: Ensure all etb rows are mapped to FS captions/notes

NUMERICAL VERIFICATION:
- Use etb for account-level verification
- Use profit_and_loss for P&L line verification
- Use balance_sheet for balance sheet totals
- Use lead_sheets for note-to-statement reconciliation

KEY POINTS:
- portalData.company contains all MBR extract information
- Directors count: portalData.company.directors.length
- All monetary values in EUR
- Negative values represent credits/liabilities/expenses
- Lead sheet structure: grouping1 → grouping2 → grouping3
- ETB rows link to lead sheets via rows array in grouping3
- Lead sheet totals include adjustments and reclassifications
```

### 3.3 PDF Data Prompt

**Location:** `pdf-data/pdfDataPrompt.js`

**Full Prompt:**
```
PDF DATA STRUCTURE AND USAGE

PDF data is extracted from financial statements. Each page has text and an image reference.

STRUCTURE:
[
  {
    "page_no": 1,
    "text": "Financial Statements\nWhite Investments Limited\n...",
    "imageName": "page_1.png"
  },
  {
    "page_no": 2,
    "text": "Directors' Responsibilities\n...",
    "imageName": "page_2.png"
  }
]

PREPROCESSING:
1. PDF converted to page images: one PNG per page, saved as page_{page_no}.png in tmp/images/
2. Text extracted per-page using form feed character as separator

USAGE FOR TESTS:

VISUAL LAYOUT (T1):
- Use imageName to check fonts, sizes, column alignment, currency symbols, brackets, headers, footers, table positions
- If imageName is null, visual checks cannot be performed for that page
- Images are authoritative source for layout/formatting

TEXT-BASED TESTS (T2-T26):
- Use text field to extract numbers, check structure, verify references, extract policies, check grammar, verify dates
- Use page_no to report location

NUMERICAL EXTRACTION:
- Extract numbers from text for calculations (T3, T4, T5, T7, T19, T20)
- Handle negative numbers in brackets or with minus signs

LOCATION TRACKING:
- Use page_no for location.page
- Use text content to identify sections and notes
- Combine page_no with text analysis for precise location

CONFLICTS:
- If text and image conflict, trust images for layout/formatting
- Use text for numerical values and content analysis

KEY POINTS:
- Each page has page_no, text, imageName
- imageName is filename only, not full path
- If imageName is null, image extraction failed (still use text)
- Page numbers start at 1
- Text extraction may not be 100% accurate, verify critical numbers
- Images preserve exact visual appearance
```

### 3.4 Test Lists (T1-T26)

**Location:** `ai-config/testLists.js`

**Tests Included:**

1. **T1 - VISUAL_LAYOUT_INTEGRITY**: Check fonts, alignment, currency symbols, headers/footers
2. **T2 - STRUCTURE_AND_DOCUMENT_CONTROL**: Required sections, page numbering, cross-references
3. **T3 - ARITHMETICAL_FS_INTERNAL**: Recalculate income statement and balance sheet arithmetic
4. **T4 - RETAINED_EARNINGS_BRIDGE**: Opening + Profit - Dividends ± Adjustments = Closing
5. **T5 - NOTES_RECONCILIATION**: Note totals vs statement captions
6. **T6 - ACCOUNTING_POLICIES_INTEGRITY**: Policy notes for all captions, no orphan policies
7. **T7 - TAX_AND_DEFERRED_TAX_LOGIC**: Tax roll-forwards and reconciliation
8. **T8 - LOANS_BORROWINGS_EQUITY_CLASSIFICATION**: Equity vs liability, current vs non-current
9. **T9 - COMPARATIVES_INTEGRITY**: Prior year comparatives exist and consistent
10. **T10 - PORTAL_VS_FS_RECONCILIATION**: Portal P&L/BS/lead sheets vs FS
11. **T11 - MBR_VS_FS_REGISTRY_MATCH**: Company name, registration, address, directors
12. **T12 - GOING_CONCERN_TRIGGER**: Loss + negative equity triggers disclosure requirement
13. **T13 - SIGNATURE_DATES_CONSISTENCY**: Approval, signature, audit report dates
14. **T14 - DIRECTORS_NUMBER_AND_GRAMMAR**: Singular/plural based on director count
15. **T15 - DIRECTORS_REMUNERATION_MATCH**: Portal vs FS note (tolerance 0)
16. **T16 - GRAMMAR_AND_SPELLING_KEY_SECTIONS**: Grammar/spelling in key sections
17. **T17 - MBR_SHARE_CAPITAL_AND_LEGAL_IDENTITY**: Share capital details match
18. **T18 - COMPANY_STATUS_VS_WORDING**: Liquidation vs going concern basis
19. **T19 - RELATED_PARTY_INTERNAL_TIE**: Related party balances tie across notes/statements
20. **T20 - TAX_RECONCILIATION_DETAIL**: Tax reconciliation arithmetic
21. **T21 - EQUITY_MOVEMENTS_INTERNAL**: Equity movement schedule roll-forwards
22. **T22 - PORTAL_MAPPING_COMPLETENESS**: All ETB rows mapped to FS
23. **T23 - LARGE_RELATED_PARTY_EXPOSURES**: Disclosure for large exposures (>50%)
24. **T24 - CURRENCY_AND_ROUNDING_STATEMENT**: Currency and rounding policy notes
25. **T25 - YEAR_END_WORDING_CONSISTENCY**: Year-end date consistent across documents
26. **T26 - NOTE_REFERENCE_COMPLETENESS**: All notes referenced, no missing references

**Format:** Each test includes `test_id`, `test_name`, and `test_instructions` array.

### 3.5 Output Format Prompt

**Location:** `ai-config/outputFormat.js`

**Full Prompt:**
```
CRITICAL: Final output MUST be a single JSON object with exactly 5 keys: A, B, C, D, E. No additional keys, no variations.

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

2. SECTION A: title exactly "CONFIRMED CORRECT ITEMS". Include only tests that passed completely. Fields: test_id (T format), area (human-readable name), details (brief verification text).

3. SECTION B: title exactly "CRITICAL ERRORS". Fields: id (B1, B2, B3 sequential), test_id (T format), type (arithmetical/logic/portal_crosscheck/registry_crosscheck/visual/structure/disclosure/classification/legal/grammar/presentation), severity always "critical", description, location (page number or null, section string or null, note string or null, line_hint string or null), reported_value (number/string/null), expected_value (number/string/null), difference (number or null), reason, financial_impact, suggested_fix. Include all arithmetical errors, logic errors, material misstatements.

4. SECTION C: title exactly "DISCLOSURE & REGULATORY BREACHES". Fields: id (C1, C2, C3 sequential), test_id, type, severity (regulatory or presentation), description, location (same as B), impact (NOT financial_impact), suggested_fix. Include missing disclosures, regulatory non-compliance, presentation issues.

5. SECTION D: title exactly "RECONCILIATION TABLES". tables object with keys: retained_earnings, borrowings, deferred_tax, equity. Include only relevant tables. Each table: columns array, rows array with description and values array. Use actual values from FS. Ensure rows reconcile.

6. SECTION E: title exactly "FINAL VERDICT". verdict must be one of: "FINANCIAL STATEMENTS ARE 100% GAPSME COMPLIANT – SIGNING APPROVED" (if Section B empty), "FINANCIAL STATEMENTS ARE NOT FIT FOR APPROVAL – ERRORS PRESENT" (if Section B has items).

7. LOCATION: page (integer or null), section (string or null), note (string like "Note 5" or null), line_hint (string or null).

8. VALUES: Use actual numeric values from FS. Use null for non-applicable fields. Ensure reported_value, expected_value, difference are consistent.

9. TYPE: Match test category - arithmetical (T3,T4,T5,T7,T19,T20,T21), logic (T4,T9,T12,T23), portal_crosscheck (T10,T15,T22), registry_crosscheck (T11,T17,T18), visual (T1), structure (T2,T26), disclosure (T6), classification (T8), legal (T13), grammar (T14,T16), presentation (T24,T25).

10. OUTPUT: Return ONLY valid JSON with exactly 5 keys A,B,C,D,E. All numeric values as numbers not strings. Use null for missing values. NO emojis. NO additional keys. Follow exact format.
```

---

## 4. AI Configuration

### 4.1 AI Service Configuration

**Location:** `ai-config/aiFSReviewConfig.js`

**OpenAI Configuration:**
```javascript
{
  model: "gpt-5.1",
  temperature: 0,  // Deterministic output
  max_completion_tokens: 8000,
  response_format: { type: "json_object" }
}
```

**Message Structure:**
```javascript
messages: [
  {
    role: "system",
    content: systemPrompt  // Generated by aiPromptGenerator
  },
  {
    role: "user",
    content: JSON.stringify({
      portalData: portalData,
      pdfData: pdfData
    })
  }
]
```

### 4.2 Prompt Generation

**Location:** `ai-config/aiPromptGenerator.js`

**Prompt Assembly Order:**
1. System instructions (Malta Audit Partner role, workflow, output restrictions)
2. Test lists (T1-T26 formatted)
3. Output format specification
4. Portal data structure and usage
5. Actual portal data (JSON stringified)
6. PDF data structure and usage
7. Actual PDF data (JSON stringified)
8. Final reminder (output format, key points)

### 4.3 Response Validation

**Validation Steps:**
1. Check response exists
2. Parse JSON
3. Validate required sections: A, B, C, D, E
4. Return structured result

---

## 5. Service Flow

### 5.1 Main Service Flow (`generateFSReview.service.js`)

```
1. Validate Inputs
   ├─ Check engagementId exists
   ├─ Check file exists
   ├─ Validate file is PDF
   └─ Validate file buffer exists

2. Extract Portal Data
   ├─ Fetch engagement from database
   ├─ Fetch company with populated directors
   ├─ Fetch ETB document
   ├─ Fetch adjustments and reclassifications
   ├─ Apply adjustments/reclassifications to ETB
   └─ Derive financial statements (P&L, BS, Lead Sheets)

3. Extract PDF Data
   ├─ Generate unique session ID
   ├─ Convert PDF to images (pdftoppm)
   ├─ Extract text per page
   └─ Create page data array

4. Generate AI Review
   ├─ Generate complete AI prompt
   ├─ Call OpenAI API
   ├─ Parse and validate response
   └─ Return structured results

5. Cleanup
   └─ Delete temporary image files

6. Return Results
   └─ Return A/B/C/D/E JSON structure
```

### 5.2 Error Handling

- **Input Validation Errors**: Thrown immediately with descriptive messages
- **Data Extraction Errors**: Cleanup images before throwing
- **AI Review Errors**: Cleanup images before throwing
- **Response Validation Errors**: Thrown if structure invalid

### 5.3 Image Cleanup

- Images created in `tmp/images/` directory
- Cleaned up after successful review or on error
- Uses `cleanupImages()` function to delete all temporary files
- Logs deletion count and any errors

---

## 6. Key Features

### 6.1 Data Processing
- **No formulas sent to AI**: All calculations done in JavaScript code
- **Pre-computed financial statements**: P&L, Balance Sheet, Lead Sheets calculated before AI review
- **Sign normalization**: Equity and Liabilities accounts flipped for consistency
- **Hierarchical aggregation**: ETB rows → Lead Sheets → Financial Statements

### 6.2 AI Review
- **Deterministic output**: Temperature = 0
- **Structured JSON response**: Enforced via `response_format`
- **Comprehensive testing**: 26 different test categories
- **Zero-tolerance validation**: EUR 1 tolerance only for rounding
- **Visual + Text analysis**: Uses both PDF images and extracted text

### 6.3 Output Structure
- **Section A**: Confirmed correct items
- **Section B**: Critical errors (blocks approval)
- **Section C**: Disclosure & regulatory breaches
- **Section D**: Reconciliation tables
- **Section E**: Final verdict (approved/not approved)

---

## 7. Dependencies

### 7.1 Database Models
- `Engagement`
- `Company`
- `ExtendedTrialBalance`
- `Adjustment`
- `Reclassification`
- `Person` (populated via Company)

### 7.2 External Tools
- `pdf-parse`: PDF text extraction
- `pdftoppm` (Poppler): PDF to image conversion
- `openai`: AI API client

### 7.3 Node.js Modules
- `fs`: File system operations
- `path`: Path manipulation
- `util`: Promise utilities
- `child_process`: CLI execution

---

## 8. Example Output Structure

```json
{
  "A": {
    "title": "CONFIRMED CORRECT ITEMS",
    "items": [
      {
        "test_id": "T1",
        "area": "Visual Layout Integrity",
        "details": "All pages have consistent formatting"
      }
    ]
  },
  "B": {
    "title": "CRITICAL ERRORS",
    "items": []
  },
  "C": {
    "title": "DISCLOSURE & REGULATORY BREACHES",
    "items": []
  },
  "D": {
    "title": "RECONCILIATION TABLES",
    "tables": {
      "retained_earnings": { /* ... */ },
      "borrowings": { /* ... */ }
    }
  },
  "E": {
    "title": "FINAL VERDICT",
    "verdict": "FINANCIAL STATEMENTS ARE 100% GAPSME COMPLIANT – SIGNING APPROVED"
  }
}
```

---

## Notes

- All monetary values are in EUR
- Negative values represent credits/liabilities/expenses
- Rounding tolerance: EUR 1 (only for pure rounding differences)
- Image files are temporary and cleaned up after processing
- Session IDs prevent filename conflicts in concurrent requests
- AI is instructed to recompute everything independently (no formulas provided)
