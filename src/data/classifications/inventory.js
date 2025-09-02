// src/data/classifications/inventory.js
function getManualFields(framework = "IFRS") {
  if (framework === "GAPSME") {
    return {
      sectionId: "inventory_procedures_gapsme",
      title: "Fieldwork Procedures — Inventory (GAPSME)",
      standards: ["ISA 315","ISA 330","ISA 500","ISA 501","ISA 540","ISA 560","ISA 580","ISA 620","GAPSME Section 15"],
      fields: [
        { key: "inv_gapsme_1", type: "textarea", label: "1. Risk Assessment & Response Design", help: "Count errors, cut-off, obsolete/slow-moving, costing.", assertions: ["Existence","Completeness","Rights & Obligations","Cut-off","Valuation","Classification","Presentation & Disclosure"], commentable: true },
        { key: "inv_gapsme_3", type: "procedure", label: "3. Inventory Count Attendance (ISA 501)", procedure: "Attend counts; test counts; alt procedures if not possible.", assertions: ["Existence","Completeness"], commentable: true },
        { key: "inv_gapsme_8", type: "procedure", label: "8. NRV & Provisioning", procedure: "Subsequent sales/market data; obsolete lists.", assertions: ["Valuation","Accuracy"], commentable: true },
        { key: "inv_gapsme_15", type: "procedure", label: "15. Conclusion — Inventory (GAPSME)", procedure: "Conclusion & control recs.", assertions: ["All"], commentable: true }
      ]
    };
  }
  return {
    sectionId: "inventory_procedures_ifrs",
    title: "Fieldwork Procedures — Inventory (IFRS)",
    standards: ["ISA 315","ISA 330","ISA 500","ISA 501","ISA 540","ISA 560","ISA 580","ISA 620","IAS 2","IAS 1"],
    fields: [
      { key: "inv_ifrs_1", type: "textarea", label: "1. Risk Assessment & Response Design", help: "IAS 2 cost vs NRV; overhead absorption; consignment; WIP.", assertions: ["Existence","Completeness","Rights & Obligations","Cut-off","Valuation","Classification","Presentation & Disclosure"], commentable: true },
      { key: "inv_ifrs_3", type: "procedure", label: "3. Inventory Count Attendance (ISA 501)", procedure: "Attend/test counts; alt procedures if needed.", assertions: ["Existence","Completeness"], commentable: true },
      { key: "inv_ifrs_7", type: "procedure", label: "7. Costing & Allocation (IAS 2)", procedure: "Cost formula; conversion costs; standard cost variances.", assertions: ["Valuation","Allocation","Accuracy"], commentable: true },
      { key: "inv_ifrs_15", type: "procedure", label: "15. Conclusion — Inventory (IFRS)", procedure: "Conclusion & adjustments.", assertions: ["All"], commentable: true }
    ]
  };
}

module.exports = { getManualFields };
