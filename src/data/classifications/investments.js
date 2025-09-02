// src/data/classifications/investments.js
function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "otherinv_procedures_gapsme",
      title: "Fieldwork Procedures — Other Investments (GAPSME)",
      standards: ["ISA 315","ISA 500","ISA 560","ISA 580","GAPSME Section 9"],
      fields: [
        { key: "oi_gapsme_5", type: "procedure", label: "5. Additions & Disposals Testing", procedure: "Validate transactions; correct classification.", assertions: ["Existence","Rights & Obligations","Classification","Completeness"], commentable: true },
        { key: "oi_gapsme_6", type: "procedure", label: "6. Valuation Review", procedure: "Listed vs unlisted valuation basis.", assertions: ["Valuation"], commentable: true },
        { key: "oi_gapsme_10", type: "procedure", label: "10. Disclosure Review", procedure: "Classification & disclosures complete.", assertions: ["Completeness","Presentation","Disclosure"], commentable: true },
        { key: "oi_gapsme_13", type: "procedure", label: "13. Conclusion", procedure: "Conclusion & exceptions.", assertions: ["All"], commentable: true }
      ]
    };
  }
  return {
    sectionId: "otherinv_procedures_ifrs",
    title: "Fieldwork Procedures — Other Investments (IFRS Framework)",
    standards: ["ISA 315","ISA 500","ISA 560","ISA 580","IFRS 9"],
    fields: [
      { key: "oi_ifrs_5", type: "procedure", label: "5. Additions & Disposals Testing", procedure: "Validate; verify IFRS 9 classification.", assertions: ["Existence","Rights & Obligations","Classification","Completeness"], commentable: true },
      { key: "oi_ifrs_6", type: "procedure", label: "6. Valuation & Impairment Review", procedure: "Fair value or ECL (amortised cost).", assertions: ["Valuation"], commentable: true },
      { key: "oi_ifrs_10", type: "procedure", label: "10. Disclosure Review – IFRS 7/9", procedure: "Classification, fair values, impairments, risk exposure.", assertions: ["Completeness","Presentation","Disclosure"], commentable: true },
      { key: "oi_ifrs_13", type: "procedure", label: "13. Conclusion — Other Investments (IFRS)", procedure: "Conclusion & exceptions.", assertions: ["All"], commentable: true }
    ]
  };
}

module.exports = { getManualFields };
