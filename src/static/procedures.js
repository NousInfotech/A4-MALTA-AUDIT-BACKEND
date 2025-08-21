export default {
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
  "Assets > Current > Other Receivables": [
    {
      id: "other_receivables_1",
      question: "Have other receivables been analyzed and aged appropriately?",
      isRequired: true,
    },
    {
      id: "other_receivables_2",
      question: "Has the collectibility of other receivables been assessed?",
      isRequired: true,
    },
    {
      id: "other_receivables_3",
      question: "Have related party receivables been identified and disclosed?",
      isRequired: true,
    },
    {
      id: "other_receivables_4",
      question: "Has proper authorization been obtained for other receivables?",
      isRequired: false,
    },
    {
      id: "other_receivables_5",
      question: "Have subsequent receipts been tested for validity?",
      isRequired: false,
    },
  ],
  "Assets > Current > Prepayments": [
    {
      id: "prepayments_1",
      question: "Have prepayments been analyzed for proper classification?",
      isRequired: true,
    },
    {
      id: "prepayments_2",
      question: "Has the amortization of prepayments been reviewed?",
      isRequired: true,
    },
    {
      id: "prepayments_3",
      question: "Have supporting documents for prepayments been examined?",
      isRequired: true,
    },
    {
      id: "prepayments_4",
      question: "Has the recoverability of prepayments been assessed?",
      isRequired: false,
    },
    {
      id: "prepayments_5",
      question: "Have cut-off procedures been performed for prepayments?",
      isRequired: false,
    },
  ],
  "Assets > Current > Recoverable VAT/Tax": [
    {
      id: "vat_tax_1",
      question: "Have VAT returns been reconciled to the general ledger?",
      isRequired: true,
    },
    {
      id: "vat_tax_2",
      question: "Has the recoverability of VAT/tax been confirmed with authorities?",
      isRequired: true,
    },
    {
      id: "vat_tax_3",
      question: "Have supporting documents for VAT/tax claims been reviewed?",
      isRequired: true,
    },
    {
      id: "vat_tax_4",
      question: "Has subsequent recovery of VAT/tax been verified?",
      isRequired: false,
    },
    {
      id: "vat_tax_5",
      question: "Have penalties or interest on late filings been considered?",
      isRequired: false,
    },
  ],
  "Assets > Non-current > Intangible Assets": [
    {
      id: "intangible_1",
      question: "Have intangible assets been properly identified and valued?",
      isRequired: true,
    },
    {
      id: "intangible_2",
      question: "Has amortization of intangible assets been calculated correctly?",
      isRequired: true,
    },
    {
      id: "intangible_3",
      question: "Has impairment testing been performed on intangible assets?",
      isRequired: true,
    },
    {
      id: "intangible_4",
      question: "Have legal rights to intangible assets been verified?",
      isRequired: false,
    },
    {
      id: "intangible_5",
      question: "Has the useful life of intangible assets been reviewed?",
      isRequired: false,
    },
  ],
  "Assets > Non-current > Investments": [
    {
      id: "investments_1",
      question: "Have investment holdings been confirmed and valued appropriately?",
      isRequired: true,
    },
    {
      id: "investments_2",
      question: "Has investment income been properly recorded?",
      isRequired: true,
    },
    {
      id: "investments_3",
      question: "Have unrealized gains/losses been properly accounted for?",
      isRequired: true,
    },
    {
      id: "investments_4",
      question: "Has impairment of investments been considered?",
      isRequired: false,
    },
    {
      id: "investments_5",
      question: "Have investment classifications been reviewed for accuracy?",
      isRequired: false,
    },
  ],
  "Assets > Non-current > Deferred Tax Asset": [
    {
      id: "dta_1",
      question: "Has the calculation of deferred tax assets been reviewed?",
      isRequired: true,
    },
    {
      id: "dta_2",
      question: "Has the recoverability of deferred tax assets been assessed?",
      isRequired: true,
    },
    {
      id: "dta_3",
      question: "Have temporary differences been properly identified?",
      isRequired: true,
    },
    {
      id: "dta_4",
      question: "Has the tax rate used been verified as appropriate?",
      isRequired: false,
    },
    {
      id: "dta_5",
      question: "Have changes in tax legislation been considered?",
      isRequired: false,
    },
  ],
  "Assets > Non-current > Long-term Receivables/Deposits": [
    {
      id: "lt_receivables_1",
      question: "Have long-term receivables been properly classified?",
      isRequired: true,
    },
    {
      id: "lt_receivables_2",
      question: "Has the collectibility of long-term receivables been assessed?",
      isRequired: true,
    },
    {
      id: "lt_receivables_3",
      question: "Have deposits been confirmed with third parties?",
      isRequired: true,
    },
    {
      id: "lt_receivables_4",
      question: "Has imputed interest been calculated where applicable?",
      isRequired: false,
    },
    {
      id: "lt_receivables_5",
      question: "Have security arrangements been reviewed?",
      isRequired: false,
    },
  ],
  "Liabilities > Current > Accruals": [
    {
      id: "accruals_1",
      question: "Have accruals been calculated based on reasonable estimates?",
      isRequired: true,
    },
    {
      id: "accruals_2",
      question: "Has completeness of accruals been tested?",
      isRequired: true,
    },
    {
      id: "accruals_3",
      question: "Have supporting documents for accruals been reviewed?",
      isRequired: true,
    },
    {
      id: "accruals_4",
      question: "Has subsequent payment of accruals been verified?",
      isRequired: false,
    },
    {
      id: "accruals_5",
      question: "Have accrual estimates been compared to actual amounts?",
      isRequired: false,
    },
  ],
  "Liabilities > Current > Taxes Payable": [
    {
      id: "taxes_payable_1",
      question: "Have tax calculations been reviewed for accuracy?",
      isRequired: true,
    },
    {
      id: "taxes_payable_2",
      question: "Has compliance with tax filing requirements been verified?",
      isRequired: true,
    },
    {
      id: "taxes_payable_3",
      question: "Have tax payments been reconciled to liabilities?",
      isRequired: true,
    },
    {
      id: "taxes_payable_4",
      question: "Have penalties and interest been properly accrued?",
      isRequired: false,
    },
    {
      id: "taxes_payable_5",
      question: "Has correspondence with tax authorities been reviewed?",
      isRequired: false,
    },
  ],
  "Liabilities > Current > Short-term Borrowings/Overdraft": [
    {
      id: "st_borrowings_1",
      question: "Have borrowing agreements been reviewed for compliance?",
      isRequired: true,
    },
    {
      id: "st_borrowings_2",
      question: "Has interest on borrowings been properly calculated?",
      isRequired: true,
    },
    {
      id: "st_borrowings_3",
      question: "Have bank confirmations been obtained for borrowings?",
      isRequired: true,
    },
    {
      id: "st_borrowings_4",
      question: "Have covenant compliance requirements been tested?",
      isRequired: false,
    },
    {
      id: "st_borrowings_5",
      question: "Has classification between current and non-current been reviewed?",
      isRequired: false,
    },
  ],
  "Liabilities > Current > Other Payables": [
    {
      id: "other_payables_1",
      question: "Have other payables been analyzed and classified appropriately?",
      isRequired: true,
    },
    {
      id: "other_payables_2",
      question: "Has completeness of other payables been tested?",
      isRequired: true,
    },
    {
      id: "other_payables_3",
      question: "Have supporting documents for other payables been examined?",
      isRequired: true,
    },
    {
      id: "other_payables_4",
      question: "Has subsequent payment of other payables been verified?",
      isRequired: false,
    },
    {
      id: "other_payables_5",
      question: "Have related party payables been identified and disclosed?",
      isRequired: false,
    },
  ],
  "Liabilities > Non-current > Borrowings (Long-term)": [
    {
      id: "lt_borrowings_1",
      question: "Have long-term borrowing agreements been reviewed?",
      isRequired: true,
    },
    {
      id: "lt_borrowings_2",
      question: "Has the current portion of long-term debt been properly classified?",
      isRequired: true,
    },
    {
      id: "lt_borrowings_3",
      question: "Have debt covenant compliance requirements been tested?",
      isRequired: true,
    },
    {
      id: "lt_borrowings_4",
      question: "Has interest expense been properly calculated and recorded?",
      isRequired: false,
    },
    {
      id: "lt_borrowings_5",
      question: "Have security arrangements and guarantees been reviewed?",
      isRequired: false,
    },
  ],
  "Liabilities > Non-current > Provisions": [
    {
      id: "provisions_1",
      question: "Have provisions been calculated based on best estimates?",
      isRequired: true,
    },
    {
      id: "provisions_2",
      question: "Has the probability of outflow been assessed appropriately?",
      isRequired: true,
    },
    {
      id: "provisions_3",
      question: "Have legal opinions been obtained where necessary?",
      isRequired: true,
    },
    {
      id: "provisions_4",
      question: "Has discounting been applied where material?",
      isRequired: false,
    },
    {
      id: "provisions_5",
      question: "Have changes in provisions been properly explained?",
      isRequired: false,
    },
  ],
  "Liabilities > Non-current > Deferred Tax Liability": [
    {
      id: "dtl_1",
      question: "Has the calculation of deferred tax liabilities been reviewed?",
      isRequired: true,
    },
    {
      id: "dtl_2",
      question: "Have temporary differences been properly identified?",
      isRequired: true,
    },
    {
      id: "dtl_3",
      question: "Has the tax rate used been verified as appropriate?",
      isRequired: true,
    },
    {
      id: "dtl_4",
      question: "Have changes in tax legislation been considered?",
      isRequired: false,
    },
    {
      id: "dtl_5",
      question: "Has the reversal pattern been assessed?",
      isRequired: false,
    },
  ],
  "Liabilities > Non-current > Lease Liabilities": [
    {
      id: "lease_liabilities_1",
      question: "Have lease agreements been reviewed for proper classification?",
      isRequired: true,
    },
    {
      id: "lease_liabilities_2",
      question: "Has the lease liability been calculated correctly under IFRS 16?",
      isRequired: true,
    },
    {
      id: "lease_liabilities_3",
      question: "Have lease payments been properly discounted?",
      isRequired: true,
    },
    {
      id: "lease_liabilities_4",
      question: "Has the current portion been properly classified?",
      isRequired: false,
    },
    {
      id: "lease_liabilities_5",
      question: "Have lease modifications been properly accounted for?",
      isRequired: false,
    },
  ],
  "Equity > Share Capital": [
    {
      id: "share_capital_1",
      question: "Have share capital movements been properly authorized?",
      isRequired: true,
    },
    {
      id: "share_capital_2",
      question: "Has the number of shares been reconciled to statutory records?",
      isRequired: true,
    },
    {
      id: "share_capital_3",
      question: "Have share certificates been examined where applicable?",
      isRequired: true,
    },
    {
      id: "share_capital_4",
      question: "Has compliance with company law been verified?",
      isRequired: false,
    },
    {
      id: "share_capital_5",
      question: "Have rights and restrictions been properly disclosed?",
      isRequired: false,
    },
  ],
  "Equity > Share Premium": [
    {
      id: "share_premium_1",
      question: "Have share premium calculations been verified?",
      isRequired: true,
    },
    {
      id: "share_premium_2",
      question: "Has the treatment of share issue costs been reviewed?",
      isRequired: true,
    },
    {
      id: "share_premium_3",
      question: "Have movements in share premium been properly recorded?",
      isRequired: true,
    },
    {
      id: "share_premium_4",
      question: "Has compliance with legal requirements been verified?",
      isRequired: false,
    },
    {
      id: "share_premium_5",
      question: "Have disclosures been reviewed for completeness?",
      isRequired: false,
    },
  ],
  "Equity > Reserves": [
    {
      id: "reserves_1",
      question: "Have reserve movements been properly authorized and recorded?",
      isRequired: true,
    },
    {
      id: "reserves_2",
      question: "Has the nature of reserves been properly classified?",
      isRequired: true,
    },
    {
      id: "reserves_3",
      question: "Have restrictions on reserves been identified and disclosed?",
      isRequired: true,
    },
    {
      id: "reserves_4",
      question: "Has compliance with legal requirements been verified?",
      isRequired: false,
    },
    {
      id: "reserves_5",
      question: "Have reserve transfers been properly approved?",
      isRequired: false,
    },
  ],
  "Equity > Retained Earnings": [
    {
      id: "retained_earnings_1",
      question: "Has the retained earnings calculation been verified?",
      isRequired: true,
    },
    {
      id: "retained_earnings_2",
      question: "Have dividend payments been properly deducted?",
      isRequired: true,
    },
    {
      id: "retained_earnings_3",
      question: "Have prior period adjustments been properly recorded?",
      isRequired: true,
    },
    {
      id: "retained_earnings_4",
      question: "Has the opening balance been agreed to prior year?",
      isRequired: false,
    },
    {
      id: "retained_earnings_5",
      question: "Have transfers to/from reserves been verified?",
      isRequired: false,
    },
  ],
  "Income > Operating > Revenue (Goods)": [
    {
      id: "revenue_goods_1",
      question: "Has revenue recognition for goods been reviewed for IFRS 15 compliance?",
      isRequired: true,
    },
    {
      id: "revenue_goods_2",
      question: "Have performance obligations been properly identified?",
      isRequired: true,
    },
    {
      id: "revenue_goods_3",
      question: "Has the timing of revenue recognition been verified?",
      isRequired: true,
    },
    {
      id: "revenue_goods_4",
      question: "Have sales returns and allowances been properly recorded?",
      isRequired: false,
    },
    {
      id: "revenue_goods_5",
      question: "Has cut-off testing been performed for goods sales?",
      isRequired: false,
    },
  ],
  "Income > Operating > Revenue (Services)": [
    {
      id: "revenue_services_1",
      question: "Has revenue recognition for services been reviewed for compliance?",
      isRequired: true,
    },
    {
      id: "revenue_services_2",
      question: "Has the percentage of completion method been properly applied?",
      isRequired: true,
    },
    {
      id: "revenue_services_3",
      question: "Have contract assets and liabilities been properly recorded?",
      isRequired: true,
    },
    {
      id: "revenue_services_4",
      question: "Has the measurement of progress been verified?",
      isRequired: false,
    },
    {
      id: "revenue_services_5",
      question: "Have variable consideration estimates been reviewed?",
      isRequired: false,
    },
  ],
  "Income > Operating > Other Operating Income": [
    {
      id: "other_operating_income_1",
      question: "Has other operating income been properly classified?",
      isRequired: true,
    },
    {
      id: "other_operating_income_2",
      question: "Have supporting documents been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "other_operating_income_3",
      question: "Has the recognition timing been verified?",
      isRequired: true,
    },
    {
      id: "other_operating_income_4",
      question: "Have related party transactions been identified?",
      isRequired: false,
    },
    {
      id: "other_operating_income_5",
      question: "Has completeness of income been tested?",
      isRequired: false,
    },
  ],
  "Income > Non-operating > Other Income": [
    {
      id: "other_income_1",
      question: "Has other income been properly classified as non-operating?",
      isRequired: true,
    },
    {
      id: "other_income_2",
      question: "Have supporting documents been examined for validity?",
      isRequired: true,
    },
    {
      id: "other_income_3",
      question: "Has the nature of other income been properly disclosed?",
      isRequired: true,
    },
    {
      id: "other_income_4",
      question: "Has the recurrence of other income been assessed?",
      isRequired: false,
    },
    {
      id: "other_income_5",
      question: "Have tax implications been considered?",
      isRequired: false,
    },
  ],
  "Income > Non-operating > FX Gains": [
    {
      id: "fx_gains_1",
      question: "Have foreign exchange gains been properly calculated?",
      isRequired: true,
    },
    {
      id: "fx_gains_2",
      question: "Has the exchange rate used been verified?",
      isRequired: true,
    },
    {
      id: "fx_gains_3",
      question: "Have realized and unrealized gains been properly classified?",
      isRequired: true,
    },
    {
      id: "fx_gains_4",
      question: "Has hedge accounting been properly applied where applicable?",
      isRequired: false,
    },
    {
      id: "fx_gains_5",
      question: "Have disclosures been reviewed for completeness?",
      isRequired: false,
    },
  ],
  "Expenses > Cost of Sales > Materials/Purchases": [
    {
      id: "materials_1",
      question: "Have material costs been properly matched to revenue?",
      isRequired: true,
    },
    {
      id: "materials_2",
      question: "Has the cost flow assumption been consistently applied?",
      isRequired: true,
    },
    {
      id: "materials_3",
      question: "Have purchase cut-off procedures been performed?",
      isRequired: true,
    },
    {
      id: "materials_4",
      question: "Have purchase returns been properly recorded?",
      isRequired: false,
    },
    {
      id: "materials_5",
      question: "Has the allocation of overhead costs been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Cost of Sales > Freight Inwards": [
    {
      id: "freight_inwards_1",
      question: "Have freight costs been properly allocated to inventory?",
      isRequired: true,
    },
    {
      id: "freight_inwards_2",
      question: "Has the treatment of freight costs been consistent?",
      isRequired: true,
    },
    {
      id: "freight_inwards_3",
      question: "Have supporting documents been reviewed for accuracy?",
      isRequired: true,
    },
    {
      id: "freight_inwards_4",
      question: "Has the matching principle been properly applied?",
      isRequired: false,
    },
    {
      id: "freight_inwards_5",
      question: "Have accruals for freight costs been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Cost of Sales > Manufacturing Labour": [
    {
      id: "manufacturing_labour_1",
      question: "Have direct labor costs been properly allocated?",
      isRequired: true,
    },
    {
      id: "manufacturing_labour_2",
      question: "Has the allocation basis been reviewed for reasonableness?",
      isRequired: true,
    },
    {
      id: "manufacturing_labour_3",
      question: "Have labor cost calculations been verified?",
      isRequired: true,
    },
    {
      id: "manufacturing_labour_4",
      question: "Has overtime and bonus allocation been reviewed?",
      isRequired: false,
    },
    {
      id: "manufacturing_labour_5",
      question: "Have payroll taxes been properly allocated?",
      isRequired: false,
    },
  ],
  "Expenses > Cost of Sales > Production Overheads": [
    {
      id: "production_overheads_1",
      question: "Have production overheads been properly allocated?",
      isRequired: true,
    },
    {
      id: "production_overheads_2",
      question: "Has the allocation method been consistently applied?",
      isRequired: true,
    },
    {
      id: "production_overheads_3",
      question: "Have overhead rates been reviewed for reasonableness?",
      isRequired: true,
    },
    {
      id: "production_overheads_4",
      question: "Has under/over absorption been properly treated?",
      isRequired: false,
    },
    {
      id: "production_overheads_5",
      question: "Have fixed and variable costs been properly classified?",
      isRequired: false,
    },
  ],
  "Expenses > Direct Costs": [
    {
      id: "direct_costs_1",
      question: "Have direct costs been properly identified and classified?",
      isRequired: true,
    },
    {
      id: "direct_costs_2",
      question: "Has the matching principle been properly applied?",
      isRequired: true,
    },
    {
      id: "direct_costs_3",
      question: "Have supporting documents been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "direct_costs_4",
      question: "Has the allocation to projects been verified?",
      isRequired: false,
    },
    {
      id: "direct_costs_5",
      question: "Have accruals for direct costs been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Payroll": [
    {
      id: "payroll_1",
      question: "Have payroll calculations been reviewed for accuracy?",
      isRequired: true,
    },
    {
      id: "payroll_2",
      question: "Has compliance with employment legislation been verified?",
      isRequired: true,
    },
    {
      id: "payroll_3",
      question: "Have payroll taxes been properly calculated and remitted?",
      isRequired: true,
    },
    {
      id: "payroll_4",
      question: "Has segregation of duties been reviewed?",
      isRequired: false,
    },
    {
      id: "payroll_5",
      question: "Have employee benefits been properly accrued?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Rent & Utilities": [
    {
      id: "rent_utilities_1",
      question: "Have rent and utility expenses been properly recorded?",
      isRequired: true,
    },
    {
      id: "rent_utilities_2",
      question: "Has the allocation of costs been reviewed?",
      isRequired: true,
    },
    {
      id: "rent_utilities_3",
      question: "Have lease agreements been reviewed for proper treatment?",
      isRequired: true,
    },
    {
      id: "rent_utilities_4",
      question: "Have prepaid expenses been properly recorded?",
      isRequired: false,
    },
    {
      id: "rent_utilities_5",
      question: "Have accruals been reviewed for completeness?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Office/Admin": [
    {
      id: "office_admin_1",
      question: "Have office and administrative expenses been properly classified?",
      isRequired: true,
    },
    {
      id: "office_admin_2",
      question: "Has the business purpose been verified for expenses?",
      isRequired: true,
    },
    {
      id: "office_admin_3",
      question: "Have supporting documents been reviewed?",
      isRequired: true,
    },
    {
      id: "office_admin_4",
      question: "Has the allocation between departments been reviewed?",
      isRequired: false,
    },
    {
      id: "office_admin_5",
      question: "Have recurring vs. one-time expenses been identified?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Marketing": [
    {
      id: "marketing_1",
      question: "Have marketing expenses been properly classified and recorded?",
      isRequired: true,
    },
    {
      id: "marketing_2",
      question: "Has the business purpose been verified for marketing costs?",
      isRequired: true,
    },
    {
      id: "marketing_3",
      question: "Have prepaid marketing expenses been properly recorded?",
      isRequired: true,
    },
    {
      id: "marketing_4",
      question: "Has the effectiveness of marketing spend been assessed?",
      isRequired: false,
    },
    {
      id: "marketing_5",
      question: "Have related party marketing transactions been identified?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Repairs & Maintenance": [
    {
      id: "repairs_maintenance_1",
      question: "Have repairs and maintenance been properly classified?",
      isRequired: true,
    },
    {
      id: "repairs_maintenance_2",
      question: "Has the distinction between repairs and capital improvements been made?",
      isRequired: true,
    },
    {
      id: "repairs_maintenance_3",
      question: "Have supporting invoices been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "repairs_maintenance_4",
      question: "Has the allocation to different assets been reviewed?",
      isRequired: false,
    },
    {
      id: "repairs_maintenance_5",
      question: "Have accruals for ongoing maintenance been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > IT & Software": [
    {
      id: "it_software_1",
      question: "Have IT and software expenses been properly classified?",
      isRequired: true,
    },
    {
      id: "it_software_2",
      question: "Has the treatment of software licenses been reviewed?",
      isRequired: true,
    },
    {
      id: "it_software_3",
      question: "Have subscription costs been properly allocated over time?",
      isRequired: true,
    },
    {
      id: "it_software_4",
      question: "Has the capitalization of software development been considered?",
      isRequired: false,
    },
    {
      id: "it_software_5",
      question: "Have maintenance and support costs been properly recorded?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Insurance": [
    {
      id: "insurance_1",
      question: "Have insurance expenses been properly allocated over the coverage period?",
      isRequired: true,
    },
    {
      id: "insurance_2",
      question: "Has the adequacy of insurance coverage been assessed?",
      isRequired: true,
    },
    {
      id: "insurance_3",
      question: "Have insurance policies been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "insurance_4",
      question: "Have prepaid insurance amounts been properly recorded?",
      isRequired: false,
    },
    {
      id: "insurance_5",
      question: "Have insurance claims been properly accounted for?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Professional Fees": [
    {
      id: "professional_fees_1",
      question: "Have professional fees been properly classified and recorded?",
      isRequired: true,
    },
    {
      id: "professional_fees_2",
      question: "Has the business purpose been verified for professional services?",
      isRequired: true,
    },
    {
      id: "professional_fees_3",
      question: "Have accruals for unbilled professional services been reviewed?",
      isRequired: true,
    },
    {
      id: "professional_fees_4",
      question: "Has the allocation between capital and revenue been reviewed?",
      isRequired: false,
    },
    {
      id: "professional_fees_5",
      question: "Have related party professional fees been identified?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Depreciation & Amortisation": [
    {
      id: "depreciation_1",
      question: "Have depreciation and amortization calculations been reviewed?",
      isRequired: true,
    },
    {
      id: "depreciation_2",
      question: "Has the consistency of depreciation methods been verified?",
      isRequired: true,
    },
    {
      id: "depreciation_3",
      question: "Have useful lives been reviewed for reasonableness?",
      isRequired: true,
    },
    {
      id: "depreciation_4",
      question: "Has impairment testing been considered where appropriate?",
      isRequired: false,
    },
    {
      id: "depreciation_5",
      question: "Have residual values been reviewed and updated?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Research & Development": [
    {
      id: "rd_1",
      question: "Have R&D expenses been properly classified?",
      isRequired: true,
    },
    {
      id: "rd_2",
      question: "Has the distinction between research and development been made?",
      isRequired: true,
    },
    {
      id: "rd_3",
      question: "Has the capitalization criteria been properly applied?",
      isRequired: true,
    },
    {
      id: "rd_4",
      question: "Have R&D tax credits been properly accounted for?",
      isRequired: false,
    },
    {
      id: "rd_5",
      question: "Has the allocation of overhead to R&D been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Lease Expenses": [
    {
      id: "lease_expenses_1",
      question: "Have lease expenses been properly classified under IFRS 16?",
      isRequired: true,
    },
    {
      id: "lease_expenses_2",
      question: "Has the distinction between lease and service components been made?",
      isRequired: true,
    },
    {
      id: "lease_expenses_3",
      question: "Have short-term and low-value lease exemptions been properly applied?",
      isRequired: true,
    },
    {
      id: "lease_expenses_4",
      question: "Has the allocation of lease costs been reviewed?",
      isRequired: false,
    },
    {
      id: "lease_expenses_5",
      question: "Have variable lease payments been properly recorded?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Bank Charges": [
    {
      id: "bank_charges_1",
      question: "Have bank charges been properly recorded and classified?",
      isRequired: true,
    },
    {
      id: "bank_charges_2",
      question: "Has the reasonableness of bank charges been assessed?",
      isRequired: true,
    },
    {
      id: "bank_charges_3",
      question: "Have bank statements been reconciled for charges?",
      isRequired: true,
    },
    {
      id: "bank_charges_4",
      question: "Has the allocation of charges between accounts been reviewed?",
      isRequired: false,
    },
    {
      id: "bank_charges_5",
      question: "Have foreign exchange charges been properly classified?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Travel & Entertainment": [
    {
      id: "travel_entertainment_1",
      question: "Have travel and entertainment expenses been properly supported?",
      isRequired: true,
    },
    {
      id: "travel_entertainment_2",
      question: "Has the business purpose been verified for expenses?",
      isRequired: true,
    },
    {
      id: "travel_entertainment_3",
      question: "Has compliance with company policy been verified?",
      isRequired: true,
    },
    {
      id: "travel_entertainment_4",
      question: "Have tax implications been properly considered?",
      isRequired: false,
    },
    {
      id: "travel_entertainment_5",
      question: "Has the allocation between employees been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Training & Staff Welfare": [
    {
      id: "training_welfare_1",
      question: "Have training and staff welfare expenses been properly recorded?",
      isRequired: true,
    },
    {
      id: "training_welfare_2",
      question: "Has the business benefit been assessed for training costs?",
      isRequired: true,
    },
    {
      id: "training_welfare_3",
      question: "Have supporting documents been reviewed for validity?",
      isRequired: true,
    },
    {
      id: "training_welfare_4",
      question: "Has the allocation between employees been reviewed?",
      isRequired: false,
    },
    {
      id: "training_welfare_5",
      question: "Have tax implications been properly considered?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Telephone & Communication": [
    {
      id: "telephone_communication_1",
      question: "Have telephone and communication expenses been properly recorded?",
      isRequired: true,
    },
    {
      id: "telephone_communication_2",
      question: "Has the business use been verified for communication costs?",
      isRequired: true,
    },
    {
      id: "telephone_communication_3",
      question: "Have monthly charges been properly allocated?",
      isRequired: true,
    },
    {
      id: "telephone_communication_4",
      question: "Has the allocation between personal and business use been reviewed?",
      isRequired: false,
    },
    {
      id: "telephone_communication_5",
      question: "Have accruals for communication services been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Subscriptions & Memberships": [
    {
      id: "subscriptions_memberships_1",
      question: "Have subscriptions and memberships been properly recorded?",
      isRequired: true,
    },
    {
      id: "subscriptions_memberships_2",
      question: "Has the business purpose been verified for memberships?",
      isRequired: true,
    },
    {
      id: "subscriptions_memberships_3",
      question: "Have prepaid subscriptions been properly allocated?",
      isRequired: true,
    },
    {
      id: "subscriptions_memberships_4",
      question: "Has the allocation between periods been reviewed?",
      isRequired: false,
    },
    {
      id: "subscriptions_memberships_5",
      question: "Have unused subscriptions been assessed for impairment?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Bad Debt Written Off": [
    {
      id: "bad_debt_1",
      question: "Have bad debts been properly authorized before write-off?",
      isRequired: true,
    },
    {
      id: "bad_debt_2",
      question: "Has the recoverability been properly assessed?",
      isRequired: true,
    },
    {
      id: "bad_debt_3",
      question: "Have collection efforts been documented?",
      isRequired: true,
    },
    {
      id: "bad_debt_4",
      question: "Has the provision for doubtful debts been reviewed?",
      isRequired: false,
    },
    {
      id: "bad_debt_5",
      question: "Have subsequent recoveries been properly recorded?",
      isRequired: false,
    },
  ],
  "Expenses > Administrative Expenses > Stationery & Printing": [
    {
      id: "stationery_printing_1",
      question: "Have stationery and printing expenses been properly recorded?",
      isRequired: true,
    },
    {
      id: "stationery_printing_2",
      question: "Has the business purpose been verified for expenses?",
      isRequired: true,
    },
    {
      id: "stationery_printing_3",
      question: "Have inventory levels of stationery been reviewed?",
      isRequired: true,
    },
    {
      id: "stationery_printing_4",
      question: "Has the allocation between departments been reviewed?",
      isRequired: false,
    },
    {
      id: "stationery_printing_5",
      question: "Have bulk purchases been properly allocated over time?",
      isRequired: false,
    },
  ],
  "Expenses > Finance Costs": [
    {
      id: "finance_costs_1",
      question: "Have finance costs been properly calculated and recorded?",
      isRequired: true,
    },
    {
      id: "finance_costs_2",
      question: "Has the effective interest method been properly applied?",
      isRequired: true,
    },
    {
      id: "finance_costs_3",
      question: "Have borrowing costs been properly allocated?",
      isRequired: true,
    },
    {
      id: "finance_costs_4",
      question: "Has capitalization of borrowing costs been considered?",
      isRequired: false,
    },
    {
      id: "finance_costs_5",
      question: "Have accruals for finance costs been reviewed?",
      isRequired: false,
    },
  ],
  "Expenses > Other > FX Losses": [
    {
      id: "fx_losses_1",
      question: "Have foreign exchange losses been properly calculated?",
      isRequired: true,
    },
    {
      id: "fx_losses_2",
      question: "Has the exchange rate used been verified?",
      isRequired: true,
    },
    {
      id: "fx_losses_3",
      question: "Have realized and unrealized losses been properly classified?",
      isRequired: true,
    },
    {
      id: "fx_losses_4",
      question: "Has hedge accounting been properly applied where applicable?",
      isRequired: false,
    },
    {
      id: "fx_losses_5",
      question: "Have disclosures been reviewed for completeness?",
      isRequired: false,
    },
  ],
  "Expenses > Other > Exceptional/Impairment": [
    {
      id: "exceptional_impairment_1",
      question: "Have exceptional items been properly identified and classified?",
      isRequired: true,
    },
    {
      id: "exceptional_impairment_2",
      question: "Has impairment testing been performed where required?",
      isRequired: true,
    },
    {
      id: "exceptional_impairment_3",
      question: "Have the criteria for exceptional treatment been met?",
      isRequired: true,
    },
    {
      id: "exceptional_impairment_4",
      question: "Has the measurement of impairment been verified?",
      isRequired: false,
    },
    {
      id: "exceptional_impairment_5",
      question: "Have disclosures been reviewed for adequacy?",
      isRequired: false,
    },
  ],
}
