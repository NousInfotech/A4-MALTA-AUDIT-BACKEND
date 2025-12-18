/**
 * Portal Data Structure Prompt - Optimized for OpenAI
 */
const portalDataPrompt = `PORTAL DATA STRUCTURE AND USAGE

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

LEAD SHEET REFERENCE SYSTEM:

1. ETB TO LEAD SHEET MAPPING:
- Each ETB row has a rowId (e.g., "1", "2", "3")
- Lead sheets at grouping3 level have a "rows" array containing rowIds
- Example: lead sheet LS_1 has rows: ["1", "2"] means it includes ETB rows with rowId "1" and "2"
- Use this to trace from ETB rows to lead sheet groupings

2. PROFIT & LOSS TO LEAD SHEET MAPPING:
- profit_and_loss.breakdowns contain category names (e.g., "Administrative expenses")
- Each category has an "accounts" array with lead sheet IDs (e.g., ["LS_1"])
- These are grouping3 level IDs from lead_sheets
- Example: "Administrative expenses" with accounts: ["LS_1"] means it maps to lead sheet LS_1
- Use this to verify P&L line items match lead sheet totals

3. BALANCE SHEET TO LEAD SHEET MAPPING:
- balance_sheet.totals contain: assets, liabilities, equity
- Each total has an "accounts" array with lead sheet IDs (e.g., ["LS_5"], ["LS_2"], ["LS_4"])
- These are grouping3 level IDs from lead_sheets
- Example: assets with accounts: ["LS_5"] means it maps to lead sheet LS_5
- Use this to verify balance sheet totals match lead sheet totals

4. TRACING WORKFLOW:
- Start with FS caption (e.g., "Administrative expenses" in income statement)
- Find corresponding entry in profit_and_loss.breakdowns["Administrative expenses"].accounts = ["LS_1"]
- Find lead sheet with id "LS_1" in lead_sheets array
- Check lead sheet totals.finalBalance matches FS caption value
- Trace to ETB: lead sheet rows: ["1", "2"] means check ETB rows with rowId "1" and "2"
- Verify ETB rows sum to lead sheet total, which should match FS caption

KEY POINTS:
- portalData.company contains all MBR extract information
- Directors count: portalData.company.directors.length
- All monetary values in EUR
- Negative values represent credits/liabilities/expenses
- Lead sheet structure: grouping1 → grouping2 → grouping3
- grouping3 level has "id" field (e.g., "LS_1", "LS_2") - these are referenced in profit_and_loss and balance_sheet
- grouping3 level has "rows" array - these are ETB rowIds that contribute to this lead sheet
- ETB rows link to lead sheets via rows array in grouping3
- profit_and_loss.breakdowns[category].accounts contains grouping3 IDs
- balance_sheet.totals[type].accounts contains grouping3 IDs
- Lead sheet totals include adjustments and reclassifications
- Use this reference system to verify FS captions reconcile to portal data`;

module.exports = portalDataPrompt;
