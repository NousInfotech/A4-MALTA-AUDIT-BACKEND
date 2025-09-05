// src/data/classifications/profit_and_loss.js
 function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "pl_combined_gapsme",
      title: "Fieldwork Procedures — Profit & Loss (GAPSME)",
      standards: ["ISA 315","ISA 330","ISA 500","ISA 520","ISA 530","ISA 540","ISA 550","ISA 560","ISA 580","GAPSME Section 6","GAPSME Section 18"],
      fields: [
        { key: "pl_gapsme_2", type: "procedure", label: "2. Opening Balances & Lead Schedule", procedure: "Agree opening balances; obtain lead schedules for revenue, CoS/direct costs, admin/selling expenses and wages; reconcile to GL; investigate variances.", assertions: ["Existence","Completeness","Accuracy","Classification"], commentable: true },
        { key: "pl_gapsme_3", type: "procedure", label: "3. Analytical Review", procedure: "Perform trend/ratio analytics: revenue mix, gross margin %, creditor/debtor days links, payroll % of revenue, variance vs budget/prior. Flag anomalies.", assertions: ["Completeness","Valuation","Occurrence"], commentable: true },
        { key: "pl_gapsme_5c", type: "procedure", label: "5c. Revenue Cut-off", procedure: "Test sales invoices/credit notes around year end to GDNs/dispatch/returns for correct period.", assertions: ["Completeness","Cut-off","Accuracy"], commentable: true },
        { key: "pl_gapsme_9b", type: "procedure", label: "9b. Presentation & Disclosure", procedure: "Review quality and consistency of revenue recognition and expense disclosures per GAPSME Sec. 6; assess FX and VAT disclosures (GAPSME Sec. 18).", assertions: ["Classification","Presentation & Disclosure"], commentable: true }
      ]
    };
  }
  return {
    sectionId: "pl_combined_ifrs",
    title: "Fieldwork Procedures — Profit & Loss (IFRS): Revenue, Cost of Sales/Direct Costs, Expenditure & Wages",
    standards: ["ISA 315","ISA 330","ISA 500","ISA 520","ISA 530","ISA 540","ISA 550","ISA 560","ISA 580","IFRS 15","IAS 1","IAS 19","IAS 21","IAS 12","IFRS 7","IAS 2","IAS 38"],
    fields: [
      { key: "pl_ifrs_2", type: "procedure", label: "2. Opening Balances & Lead Schedule", procedure: "Agree opening balances; prepare lead schedules by stream/cost category; reconcile to GL; investigate significant variances vs prior/budget.", assertions: ["Existence","Completeness","Accuracy","Classification"], commentable: true },
      { key: "pl_ifrs_3", type: "procedure", label: "3. Analytical Review", procedure: "Perform ratio/trend analytics (GM%, revenue per customer, payroll %, SG&A %). Identify outliers for substantive testing.", assertions: ["Completeness","Valuation"], commentable: true },
      { key: "pl_ifrs_4a", type: "procedure", label: "4a. Revenue Vouching & IFRS 15 Mapping", procedure: "Trace contract→invoice→receipt; assess performance obligations, timing, variable consideration; verify credit notes link to invoices and correct period.", assertions: ["Existence","Rights & Obligations","Accuracy","Cut-off"], commentable: true },
      { key: "pl_ifrs_7a", type: "procedure", label: "7a. Payroll Analytics & Sampling", procedure: "Analytics over payroll vs headcount/rates; sample to contracts & payroll records; recalc payroll incl. statutory deductions and benefits.", assertions: ["Accuracy","Occurrence"], commentable: true },
      { key: "pl_ifrs_10", type: "procedure", label: "10. Conclusion — Profit & Loss (IFRS)", procedure: "Conclude whether P&L is free from material misstatement; document exceptions and proposed adjustments.", assertions: ["All relevant"], commentable: true }
    ]
  };
}


module.exports = { getManualFields };