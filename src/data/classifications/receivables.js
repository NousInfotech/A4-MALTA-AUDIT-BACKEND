// src/data/classifications/receivables.js
// IFRS & GAPSME variants for Receivables-like items (Trade/Other/Prepayments/Recoverable VAT)
function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "receivables_related_gapsme",
      title: "Fieldwork Procedures — Receivables & Related Assets (GAPSME)",
      standards: ["ISA 315", "ISA 500", "ISA 560", "ISA 580", "GAPSME Section 9"],
      fields: [
        {
          key: "rr_gapsme_1",
          type: "textarea",
          label: "1. Risk Assessment & Response Design",
          assertions: ["Existence","Completeness","Rights & Obligations","Cut-off","Valuation","Classification","Presentation & Disclosure"],
          help: "Document inherent risks across all receivable-like items and related audit responses.",
          commentable: true
        },
        {
          key: "rr_gapsme_4",
          type: "procedure",
          label: "4. Analytical Review",
          procedure: "Evaluate trends such as days sales outstanding, prepayment usage, and allowance movement.",
          assertions: ["Occurrence","Completeness","Valuation"],
          commentable: true
        },
        {
          key: "rr_gapsme_5",
          type: "procedure",
          label: "5. Existence & Rights Verification",
          procedure: "Use confirmations, bank receipts, or source docs to verify ownership and authenticity.",
          assertions: ["Existence","Rights & Obligations"],
          commentable: true
        },
        {
          key: "rr_gapsme_6",
          type: "procedure",
          label: "6. Cut-off Testing",
          procedure: "Test year-end cut-off for receivables and related assets with supporting documents.",
          assertions: ["Cut-off","Accuracy"],
          commentable: true
        },
        // ...continue pasting your full pack following same shape
        {
          key: "rr_gapsme_12",
          type: "procedure",
          label: "12. Conclusion — Receivables & Related Assets (GAPSME)",
          procedure: "Summarize audit conclusion and note material exceptions, if any.",
          assertions: ["All"],
          commentable: true
        }
      ]
    };
  }
  // IFRS default
  return {
    sectionId: "receivables_related_ifrs",
    title: "Fieldwork Procedures — Receivables & Related Assets (IFRS)",
    standards: ["ISA 315", "ISA 500", "ISA 560", "ISA 580", "IFRS 9", "IFRS 15"],
    fields: [
      {
        key: "rr_ifrs_1",
        type: "textarea",
        label: "1. Risk Assessment & Response Design",
        assertions: ["Existence","Completeness","Rights & Obligations","Cut-off","Valuation","Classification","Presentation & Disclosure"],
        help: "Flag risks such as IFRS 9 classification, ECL, or IFRS 15 revenue cut-off errors.",
        commentable: true
      },
      {
        key: "rr_ifrs_4",
        type: "procedure",
        label: "4. Analytical Review",
        procedure: "Evaluate trends such as days sales outstanding, prepayment usage, and allowance movement.",
        assertions: ["Occurrence","Completeness","Valuation"],
        commentable: true
      },
      {
        key: "rr_ifrs_5",
        type: "procedure",
        label: "5. Existence & Rights Validation",
        procedure: "Use confirmations, receipts, or original docs to verify entitlement and existence.",
        assertions: ["Existence","Rights & Obligations"],
        commentable: true
      },
      {
        key: "rr_ifrs_6",
        type: "procedure",
        label: "6. Cut-off & Revenue Recognition Testing",
        procedure: "Test receivable cut-off under IFRS 15 and verify prepayment matching to performance obligations.",
        assertions: ["Cut-off","Accuracy"],
        commentable: true
      },
      {
        key: "rr_ifrs_12",
        type: "procedure",
        label: "12. Conclusion — Receivables & Related Assets (IFRS)",
        procedure: "Conclude whether balances are free from material misstatement; note exceptions.",
        assertions: ["All"],
        commentable: true
      }
    ]
  };
}


module.exports = { getManualFields };