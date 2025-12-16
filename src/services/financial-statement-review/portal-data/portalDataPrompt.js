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

KEY POINTS:
- portalData.company contains all MBR extract information
- Directors count: portalData.company.directors.length
- All monetary values in EUR
- Negative values represent credits/liabilities/expenses
- Lead sheet structure: grouping1 → grouping2 → grouping3
- ETB rows link to lead sheets via rows array in grouping3
- Lead sheet totals include adjustments and reclassifications`;

module.exports = portalDataPrompt;
