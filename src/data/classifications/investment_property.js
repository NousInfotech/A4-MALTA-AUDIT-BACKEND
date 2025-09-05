// src/data/classifications/investment_property.js
 function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "invprop_procedures_gapsme",
      title: "Fieldwork Procedures — Investment Property (GAPSME Framework)",
      standards: ["ISA 315","ISA 330","ISA 500","ISA 560","ISA 580","GAPSME Section 8"],
      fields: [
        { key: "ip_gapsme_opening_tieback", type: "procedure", label: "2. Opening Balance Tie-back", procedure: "Agree opening investment property balances to prior audited FS; investigate discrepancies.", assertions: ["Existence","Completeness"], commentable: true },
        { key: "ip_gapsme_lead_schedule", type: "procedure", label: "3. Lead Schedule Reconciliation", procedure: "Ensure investment property schedule aligns with GL and note disclosures.", assertions: ["Accuracy","Classification"], commentable: true },
        { key: "ip_gapsme_measurement", type: "procedure", label: "6. Measurement — Cost vs Fair Value (Section 8)", procedure: "Verify consistent application of cost model or fair value model, as permitted by GAPSME.", assertions: ["Valuation"], commentable: true },
        { key: "ip_gapsme_disclosures", type: "procedure", label: "11. Disclosure Review — GAPSME §8", procedure: "Check disclosures on measurement basis, reconciliation of amounts, gain/loss on disposal, and classification for SME size.", assertions: ["Completeness","Presentation","Disclosure"], commentable: true },
        { key: "ip_gapsme_conclusion", type: "procedure", label: "14. Conclusion — Investment Property (GAPSME)", procedure: "State audit conclusion noting whether investment properties are free from material misstatement; reference exceptions.", assertions: ["All"], commentable: true }
      ]
    };
  }
  return {
    sectionId: "invprop_procedures_ifrs",
    title: "Fieldwork Procedures — Investment Property (IFRS Framework)",
    standards: ["ISA 315","ISA 330","ISA 500","ISA 560","ISA 580","IAS 40","IFRS 13"],
    fields: [
      { key: "ip_ifrs_inspection_title", type: "procedure", label: "8. Physical Inspection & Title Review", procedure: "Inspect property and review title deeds/leases for control and existence.", assertions: ["Existence","Rights & Obligations"], commentable: true },
      { key: "ip_ifrs_cutoff", type: "procedure", label: "9. Cut-off Testing", procedure: "Ensure additions and disposals around year-end are recorded in the correct accounting period.", assertions: ["Cut-off","Accuracy"], commentable: true },
      { key: "ip_ifrs_fairvalue_review", type: "procedure", label: "10. Fair Value Review (Fair Value Model)", procedure: "If fair value model used, review valuation reports and ensure adherence to IFRS 13 hierarchy and disclosures.", assertions: ["Valuation"], commentable: true },
      { key: "ip_ifrs_disclosures", type: "procedure", label: "11. Disclosure Review — IAS 40", procedure: "Check required notes: model used, reconciliation of balances, valuation methods, lessor disclosures, restrictions, contractual obligations, rental income, and expenses.", assertions: ["Completeness","Presentation","Disclosure"], commentable: true },
      { key: "ip_ifrs_conclusion", type: "procedure", label: "14. Conclusion — Investment Property (IFRS)", procedure: "Conclude audit outcome for investment property; detail exceptions if any.", assertions: ["All"], commentable: true }
    ]
  };
}

module.exports = { getManualFields };