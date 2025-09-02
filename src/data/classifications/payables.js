// src/data/classifications/payables.js
 function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "payables_procedures_gapsme",
      title: "Fieldwork Procedures — Payables & Other Payables (GAPSME)",
      standards: ["ISA 315","ISA 500","ISA 560","ISA 580","GAPSME Section 9"],
      fields: [
        {
          key: "pb_gapsme_2",
          type: "procedure",
          label: "2. Opening Balances Tie-back",
          procedure: "Agree opening trade and other payables to prior year FS; investigate variances.",
          assertions: ["Existence","Completeness"],
          commentable: true
        },
        {
          key: "pb_gapsme_3",
          type: "procedure",
          label: "3. Lead Schedule Reconciliation",
          procedure: "Prepare/review the payables lead schedule and reconcile to the GL and draft disclosures.",
          assertions: ["Accuracy","Classification"],
          commentable: true
        },
        {
          key: "pb_gapsme_7",
          type: "procedure",
          label: "7. Supplier Statement Reconciliations",
          procedure: "Reconcile selected vendor balances to supplier statements or third-party confirmations; resolve reconciling items.",
          assertions: ["Existence","Completeness"],
          commentable: true
        },
        {
          key: "pb_gapsme_10",
          type: "procedure",
          label: "10. Large/Unusual Items",
          procedure: "Review and corroborate large/unusual balances and journal entries with underlying documentation.",
          assertions: ["Occurrence","Completeness","Classification"],
          commentable: true
        },
        {
          key: "pb_gapsme_12",
          type: "procedure",
          label: "12. Classification & Disclosure",
          procedure: "Check current vs non-current split; evaluate offsetting, security/guarantees, covenant terms and related party disclosures per GAPSME.",
          assertions: ["Classification","Presentation & Disclosure"],
          commentable: true
        },
        {
          key: "pb_gapsme_15",
          type: "procedure",
          label: "15. Conclusion — Payables & Other Payables (GAPSME)",
          procedure: "Conclude whether balances are free from material misstatement; summarize exceptions and required adjustments.",
          assertions: ["All relevant"],
          commentable: true
        }
      ]
    };
  }
  // IFRS default
  return {
    sectionId: "payables_procedures_ifrs",
    title: "Fieldwork Procedures — Payables & Other Payables (IFRS)",
    standards: ["ISA 315","ISA 500","ISA 560","ISA 580","IFRS 9","IAS 1","IAS 24","IAS 32"],
    fields: [
      {
        key: "pb_ifrs_4",
        type: "procedure",
        label: "4. Analytical Review",
        procedure: "Analyze creditor days, purchases vs payables, GRNI, and accruals movements; investigate anomalies.",
        assertions: ["Completeness","Valuation"],
        commentable: true
      },
      {
        key: "pb_ifrs_5",
        type: "procedure",
        label: "5. Supplier Statements / Confirmations",
        procedure: "Perform supplier reconciliations or confirmations on a risk-based sample, addressing un-reconciled items.",
        assertions: ["Existence","Completeness"],
        commentable: true
      },
      {
        key: "pb_ifrs_9",
        type: "procedure",
        label: "9. Cut-off — Purchases & Receipt of Goods",
        procedure: "Test purchase cut-off to GRNs/inbound logistics and supplier invoices; verify accruals/GRNI recognition.",
        assertions: ["Cut-off","Completeness","Accuracy"],
        commentable: true
      },
      {
        key: "pb_ifrs_11",
        type: "procedure",
        label: "11. Classification & Offsetting",
        procedure: "Evaluate current vs non-current presentation (IAS 1) and the appropriateness of any offsetting (IAS 32).",
        assertions: ["Classification","Presentation & Disclosure"],
        commentable: true
      },
      {
        key: "pb_ifrs_14",
        type: "procedure",
        label: "14. Conclusion — Payables & Other Payables (IFRS)",
        procedure: "Conclude on freedom from material misstatement; document exceptions and adjustments.",
        assertions: ["All relevant"],
        commentable: true
      }
    ]
  };
}

module.exports = { getManualFields };