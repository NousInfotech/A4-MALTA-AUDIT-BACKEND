// src/data/classifications/ppe.js
 function getManualFields(framework = "IFRS") {
  // NOTE: For brevity, include a few; you can paste your whole pack from your PPE file
  if (framework === "GAPSME") {
    return {
      sectionId: "ppe_procedures_gapsme",
      title: "Fieldwork Procedures — PPE (GAPSME Framework)",
      standards: ["ISA 315","ISA 330","ISA 500","ISA 560","ISA 580","GAPSME Section 7","GAPSME Section 12"],
      fields: [
        { key: "ppe_gapsme_risk_response", type: "textarea", label: "1. Risk Assessment & Response Design", help: "Document PPE-related risks aligned with GAPSME Sections 7 & 12.", assertions: ["Existence","Completeness","Valuation","Classification"], commentable: true },
        { key: "ppe_gapsme_opening_tieback", type: "procedure", label: "2. Opening Balances Tie-back", procedure: "Agree opening PPE balances to prior FS/SOCIE; investigate any variances.", assertions: ["Completeness","Existence"], commentable: true },
        // ...continue your full GAPSME PPE list
      ]
    };
  }
  return {
    sectionId: "ppe_procedures_ifrs",
    title: "Fieldwork Procedures — PPE (IFRS)",
    standards: ["ISA 315 (Revised 2019)","ISA 330","ISA 500","ISA 560","ISA 580","IAS 16","IAS 36"],
    fields: [
      { key: "ppe_ifrs_risk_response", type: "textarea", label: "1. Risk Assessment & Response Design", help: "Document PPE risks, related assertions, and audit responses.", assertions: ["Existence","Completeness","Valuation","Classification"], commentable: true },
      { key: "ppe_ifrs_opening_tieback", type: "procedure", label: "2. Opening Balances Tie-back", procedure: "Agree opening PPE balances to prior FS/FAS; investigate discrepancies.", assertions: ["Completeness","Existence"], commentable: true },
      { key: "ppe_ifrs_depreciation", type: "procedure", label: "7. Depreciation Calculations Reviewed", procedure: "Recalculate depreciation; check useful lives and methods comply with policy and IAS 16; component approach where material.", assertions: ["Valuation","Accuracy"], commentable: true },
      { key: "ppe_ifrs_impairment", type: "procedure", label: "8. Impairment Review (IAS 36)", procedure: "Assess indicators of impairment; if present, test impairment calculations and disclosures.", assertions: ["Valuation"], commentable: true },
      { key: "ppe_ifrs_conclusion", type: "procedure", label: "15. Conclusion — PPE (IFRS)", procedure: "State conclusion on whether PPE is free of material misstatement. Reference any exceptions.", assertions: ["All"], commentable: true }
    ]
  };
}

module.exports = { getManualFields };