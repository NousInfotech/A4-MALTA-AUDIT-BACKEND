module.exports = {
  "Assets > Current > Cash & Cash Equivalents": [
    {
      id: "cash_1",
      question: "Have bank reconciliations been prepared for all bank accounts as at year-end?",
      isRequired: true,
    },
    {
      id: "cash_2",
      question: "Have outstanding items on bank reconciliations been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "cash_3",
      question: "Has cash on hand been counted and verified?",
      isRequired: false,
    },
    {
      id: "cash_4",
      question: "Have bank confirmations been obtained for all accounts?",
      isRequired: true,
    },
    {
      id: "cash_5",
      question: "Have restrictions on cash been properly disclosed?",
      isRequired: false,
    },
  ],
  "Assets > Current > Trade Receivables": [
    {
      id: "receivables_1",
      question: "Has an aged debtors analysis been prepared and reviewed?",
      isRequired: true,
    },
    {
      id: "receivables_2",
      question: "Have doubtful debts been adequately provided for?",
      isRequired: true,
    },
    {
      id: "receivables_3",
      question: "Have debtor confirmations been sent and responses reviewed?",
      isRequired: false,
    },
    {
      id: "receivables_4",
      question: "Has subsequent cash receipts testing been performed?",
      isRequired: true,
    },
    {
      id: "receivables_5",
      question: "Have credit terms and collection procedures been reviewed?",
      isRequired: false,
    },
  ],
  "Assets > Current > Inventory": [
    {
      id: "inventory_1",
      question: "Has a physical inventory count been performed?",
      isRequired: true,
    },
    {
      id: "inventory_2",
      question: "Have inventory valuation methods been reviewed for consistency?",
      isRequired: true,
    },
    {
      id: "inventory_3",
      question: "Has obsolete or slow-moving inventory been identified and provided for?",
      isRequired: true,
    },
    {
      id: "inventory_4",
      question: "Have cut-off procedures been performed?",
      isRequired: false,
    },
    {
      id: "inventory_5",
      question: "Has the lower of cost or net realizable value been applied?",
      isRequired: true,
    },
  ],
  "Assets > Non-current > Property, Plant & Equipment": [
    {
      id: "ppe_1",
      question: "Has a fixed asset register been maintained and reconciled?",
      isRequired: true,
    },
    {
      id: "ppe_2",
      question: "Have depreciation rates and methods been reviewed for reasonableness?",
      isRequired: true,
    },
    {
      id: "ppe_3",
      question: "Have additions and disposals been properly authorized and recorded?",
      isRequired: true,
    },
    {
      id: "ppe_4",
      question: "Has impairment testing been considered where appropriate?",
      isRequired: false,
    },
    {
      id: "ppe_5",
      question: "Have capital vs. revenue expenditures been properly classified?",
      isRequired: true,
    },
  ],
  "Liabilities > Current > Trade Payables": [
    {
      id: "payables_1",
      question: "Has an aged creditors analysis been prepared and reviewed?",
      isRequired: true,
    },
    {
      id: "payables_2",
      question: "Have supplier statements been reconciled?",
      isRequired: true,
    },
    {
      id: "payables_3",
      question: "Has search for unrecorded liabilities been performed?",
      isRequired: true,
    },
    {
      id: "payables_4",
      question: "Have creditor confirmations been obtained where necessary?",
      isRequired: false,
    },
    {
      id: "payables_5",
      question: "Have cut-off procedures been performed for purchases?",
      isRequired: true,
    },
  ],
  Income: [
    {
      id: "revenue_1",
      question: "Has revenue recognition policy been reviewed for compliance with accounting standards?",
      isRequired: true,
    },
    {
      id: "revenue_2",
      question: "Have cut-off procedures been performed for sales?",
      isRequired: true,
    },
    {
      id: "revenue_3",
      question: "Has analytical review of revenue been performed?",
      isRequired: true,
    },
    {
      id: "revenue_4",
      question: "Have sales returns and allowances been properly recorded?",
      isRequired: false,
    },
    {
      id: "revenue_5",
      question: "Has completeness of revenue been tested?",
      isRequired: true,
    },
  ],
  Expenses: [
    {
      id: "expenses_1",
      question: "Have expense classifications been reviewed for accuracy?",
      isRequired: true,
    },
    {
      id: "expenses_2",
      question: "Has analytical review of expenses been performed?",
      isRequired: true,
    },
    {
      id: "expenses_3",
      question: "Have accruals and prepayments been properly recorded?",
      isRequired: true,
    },
    {
      id: "expenses_4",
      question: "Have related party transactions been identified and disclosed?",
      isRequired: false,
    },
    {
      id: "expenses_5",
      question: "Has cut-off testing been performed for expenses?",
      isRequired: true,
    },
  ],
  Equity: [
    {
      id: "equity_1",
      question: "Have share capital movements been properly authorized and recorded?",
      isRequired: true,
    },
    {
      id: "equity_2",
      question: "Has retained earnings been properly calculated and presented?",
      isRequired: true,
    },
    {
      id: "equity_3",
      question: "Have dividend payments been properly authorized and recorded?",
      isRequired: false,
    },
    {
      id: "equity_4",
      question: "Have reserves been properly classified and disclosed?",
      isRequired: false,
    },
  ],
  default: [
    {
      id: "general_1",
      question: "Have supporting documents been reviewed and found adequate?",
      isRequired: true,
    },
    {
      id: "general_2",
      question: "Has analytical review been performed and variances investigated?",
      isRequired: true,
    },
    {
      id: "general_3",
      question: "Have journal entries been reviewed for appropriateness?",
      isRequired: false,
    },
    {
      id: "general_4",
      question: "Has management representation been obtained where appropriate?",
      isRequired: false,
    },
  ],
}
