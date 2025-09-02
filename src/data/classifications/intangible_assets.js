// src/data/classifications/intangible_assets.js
function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "intangibles_gapsme",
      title: "Fieldwork Procedures — Intangible Assets (GAPSME)",
      standards: ["ISA 315","ISA 500","ISA 560","ISA 580","GAPSME Section 11","GAPSME Section 12"],
      fields: [
        { key: "ga_gapsme_7", type: "procedure", label: "7. Amortisation Calculations Review", procedure: "Recalculate amortisation; ensure useful lives and methods align with accounting policy; goodwill amortised max 20 years, else write-off over 10 years.", assertions: ["Valuation","Accuracy"], commentable: true },
        { key: "ga_gapsme_8", type: "procedure", label: "8. Impairment Review (Section 12)", procedure: "Assess if indicators exist; test impairment loss calculation and reversal; verify disclosures (reason, amount, asset nature, method).", assertions: ["Valuation"], commentable: true },
        { key: "ga_gapsme_11", type: "procedure", label: "11. Disclosure Review – Section 11 & 12", procedure: "Verify disclosures: useful lives/amortisation rates, methods, opening/closing amounts, reconciliation of movements (additions, disposals, amortisation, impairment), and impairment details.", assertions: ["Completeness","Presentation","Disclosure"], commentable: true },
        { key: "ga_gapsme_14", type: "procedure", label: "14. Conclusion — Intangible Assets (GAPSME)", procedure: "Summarise whether intangible assets are free from material misstatement and properly accounted and disclosed; reference exceptions if any.", assertions: ["All"], commentable: true }
      ]
    };
  }
  // (Optionally add an IFRS flavor if you want — omitted to keep things concise)
  return {
    sectionId: "intangibles_ifrs",
    title: "Fieldwork Procedures — Intangible Assets (IFRS) — TEMPLATE",
    standards: ["IAS 38","IAS 36","ISA 315","ISA 500"],
    fields: [
      { key: "ia_ifrs_placeholder", type: "label", label: "Paste your full IFRS pack here following the shape used above." }
    ]
  };
}
module.exports = { getManualFields };
