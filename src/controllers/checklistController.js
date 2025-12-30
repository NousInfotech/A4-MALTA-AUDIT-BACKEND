const ChecklistItem = require("../models/ChecklistItem");
const defaultChecklistItems = [
  {
    key: "prof-clearance-letter",
    description: "Signed Professional Clearance Letter (if required)",
    category: "Pre-Audit Phase",
    subcategory: "Professional Clearance",
    fieldType: "checkbox",
  },
  {
    key: "removal-auditor",
    description: "Removal of Auditor",
    category: "Pre-Audit Phase",
    subcategory: "Professional Clearance",
    fieldType: "checkbox",
  },
  {
    key: "form-f1",
    description: "Form F1 Submitted (if required)",
    category: "Pre-Audit Phase",
    subcategory: "Professional Clearance",
    fieldType: "checkbox",
  },

  {
    key: "draft-engagement",
    description: "Draft Engagement Letter",
    category: "Pre-Audit Phase",
    subcategory: "Engagement Letter",
    fieldType: "checkbox",
  },
  {
    key: "signed-engagement",
    description: "Signed Engagement Letter by Client",
    category: "Pre-Audit Phase",
    subcategory: "Engagement Letter",
    fieldType: "checkbox",
  },
  {
    key: "engagement-sent",
    description: "Engagement Letter sent to client",
    category: "Pre-Audit Phase",
    subcategory: "Engagement Letter",
    fieldType: "date",
  },

  {
    key: "draft-independence",
    description: "Draft Letter of Independence for team",
    category: "Pre-Audit Phase",
    subcategory: "Letter of Independence",
    fieldType: "checkbox",
  },
  {
    key: "signed-independence",
    description: "Signed Independence Letter by audit team members",
    category: "Pre-Audit Phase",
    subcategory: "Letter of Independence",
    fieldType: "checkbox",
  },
  {
    key: "filed-independence",
    description: "Filed for record",
    category: "Pre-Audit Phase",
    subcategory: "Letter of Independence",
    fieldType: "date",
  },

  {
    key: "mbr-auth-request",
    description: "Authorization request submitted for MBR access",
    category: "Pre-Audit Phase",
    subcategory: "MBR Authorization Access",
    fieldType: "date",
  },
  {
    key: "mbr-confirmation",
    description: "Access confirmation received",
    category: "Pre-Audit Phase",
    subcategory: "MBR Authorization Access",
    fieldType: "date",
  },

  {
    key: "cfr02-request",
    description: "CFR02 Tax access request submitted",
    category: "Pre-Audit Phase",
    subcategory: "CFR02 Tax Access",
    fieldType: "date",
  },
  {
    key: "cfr02-granted",
    description: "Access granted for tax details",
    category: "Pre-Audit Phase",
    subcategory: "CFR02 Tax Access",
    fieldType: "date",
  },

  {
    key: "engagement-type",
    description: "Specify Type of Engagement",
    category: "Pre-Audit Phase",
    subcategory: "Task Assignment",
    fieldType: "select",
    selectOptions: ["Audit", "Liquidation", "Review", "Other"],
  },
  {
    key: "assign-manager",
    description: "Assign audit manager/lead auditor",
    category: "Pre-Audit Phase",
    subcategory: "Task Assignment",
    fieldType: "text",
  },

  {
    key: "audit-period",
    description: "Years/Periods to be Audited",
    category: "Pre-Audit Phase",
    subcategory: "Audit Period",
    fieldType: "text",
  },

  {
    key: "bank-letters-sent",
    description: "Bank Confirmation Letters sent",
    category: "Pre-Audit Phase",
    subcategory: "Bank Confirmation Letter",
    fieldType: "date",
  },
  {
    key: "bank-letters-received",
    description: "Bank Confirmation Letters received",
    category: "Pre-Audit Phase",
    subcategory: "Bank Confirmation Letter",
    fieldType: "date",
  },

  {
    key: "planning-meeting",
    description: "Initial audit planning meeting scheduled",
    category: "Audit Planning Phase",
    subcategory: "Audit Planning Meeting",
    fieldType: "date",
  },
  {
    key: "scope-discussion",
    description: "Discussion of audit scope, timing, and key focus areas",
    category: "Audit Planning Phase",
    subcategory: "Audit Planning Meeting",
    fieldType: "checkbox",
  },
  {
    key: "risk-assessment",
    description: "Identify significant risks and audit areas",
    category: "Audit Planning Phase",
    subcategory: "Audit Strategy and Risk Assessment",
    fieldType: "checkbox",
  },
  {
    key: "audit-strategy",
    description: "Document audit strategy",
    category: "Audit Planning Phase",
    subcategory: "Audit Strategy and Risk Assessment",
    fieldType: "checkbox",
  },
  {
    key: "internal-controls",
    description: "Review internal controls (if applicable)",
    category: "Audit Planning Phase",
    subcategory: "Audit Strategy and Risk Assessment",
    fieldType: "checkbox",
  },
  {
    key: "team-assigned",
    description: "Audit team assigned and roles clarified",
    category: "Audit Planning Phase",
    subcategory: "Audit Team Planning",
    fieldType: "checkbox",
  },
  {
    key: "timeline-communication",
    description: "Communication of timelines and deliverables",
    category: "Audit Planning Phase",
    subcategory: "Audit Team Planning",
    fieldType: "checkbox",
  },

  {
    key: "financial-statements",
    description:
      "Financial Statements (balance sheet, income statement, cash flow)",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "trial-balance",
    description: "General Ledger and Trial Balance",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "fixed-asset-register",
    description: "Fixed Asset Register",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "bank-statements",
    description: "Bank Statements and Reconciliations",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "payroll-reports",
    description: "Payroll Reports and Supporting Documents",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "tax-returns",
    description: "Tax Returns and Correspondence",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "debtors-creditors",
    description: "Debtors & Creditors Ledgers",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "legal-documents",
    description: "Legal Documents (agreements, contracts, leases)",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "board-minutes",
    description: "Minutes of Board Meetings",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "significant-transactions",
    description:
      "Significant transactions documentation (loans, acquisitions, etc.)",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "checkbox",
  },
  {
    key: "other-requests",
    description: "Other (list any additional requests)",
    category: "Documentation Requested",
    subcategory: "Client Documentation Request",
    fieldType: "text",
  },

  {
    key: "working-papers",
    description: "Audit working papers created",
    category: "Documentation Requested",
    subcategory: "Audit File Preparation",
    fieldType: "date",
  },

  {
    key: "fieldwork-start",
    description: "Date of Audit Fieldwork Start",
    category: "Fieldwork Phase",
    subcategory: "Audit Started",
    fieldType: "date",
  },
  {
    key: "inventory-count",
    description: "Attendance of inventory count (if applicable)",
    category: "Fieldwork Phase",
    subcategory: "Audit Started",
    fieldType: "checkbox",
  },

  {
    key: "assertions-tested",
    description: "Financial statement assertions tested",
    category: "Fieldwork Phase",
    subcategory: "Testing and Sampling",
    fieldType: "checkbox",
  },
  {
    key: "sampling-plan",
    description: "Sampling plan for testing developed",
    category: "Fieldwork Phase",
    subcategory: "Testing and Sampling",
    fieldType: "checkbox",
  },
  {
    key: "sample-selection",
    description: "Sample selection completed",
    category: "Fieldwork Phase",
    subcategory: "Testing and Sampling",
    fieldType: "checkbox",
  },

  {
    key: "revenue-testing",
    description: "Revenue testing",
    category: "Fieldwork Phase",
    subcategory: "Substantive Procedures",
    fieldType: "checkbox",
  },
  {
    key: "expense-testing",
    description: "Expense testing",
    category: "Fieldwork Phase",
    subcategory: "Substantive Procedures",
    fieldType: "checkbox",
  },
  {
    key: "cash-bank-testing",
    description: "Cash and bank testing",
    category: "Fieldwork Phase",
    subcategory: "Substantive Procedures",
    fieldType: "checkbox",
  },
  {
    key: "asset-testing",
    description: "Asset testing",
    category: "Fieldwork Phase",
    subcategory: "Substantive Procedures",
    fieldType: "checkbox",
  },
  {
    key: "liability-testing",
    description: "Liability testing",
    category: "Fieldwork Phase",
    subcategory: "Substantive Procedures",
    fieldType: "checkbox",
  },

  {
    key: "estimates-review",
    description:
      "Review management's estimates (e.g., provisions, impairments)",
    category: "Fieldwork Phase",
    subcategory: "Review of Estimates and Judgments",
    fieldType: "checkbox",
  },

  {
    key: "going-concern",
    description: "Going concern analysis completed",
    category: "Fieldwork Phase",
    subcategory: "Review of Going Concern",
    fieldType: "checkbox",
  },

  {
    key: "fs-drafted",
    description: "Financial Statements Drafted by",
    category: "Finalization Phase",
    subcategory: "Financial Statements",
    fieldType: "text",
  },
  {
    key: "fs-reviewed",
    description: "Financial Statements Reviewed by",
    category: "Finalization Phase",
    subcategory: "Financial Statements",
    fieldType: "text",
  },
  {
    key: "review-date",
    description: "Date of Review",
    category: "Finalization Phase",
    subcategory: "Financial Statements",
    fieldType: "date",
  },

  {
    key: "fieldwork-completed",
    description: "Date Audit Fieldwork Completed",
    category: "Finalization Phase",
    subcategory: "Audit Completion Date",
    fieldType: "date",
  },

  {
    key: "adjustments-discussed",
    description: "Discuss adjustments with client",
    category: "Finalization Phase",
    subcategory: "Audit Adjustments",
    fieldType: "checkbox",
  },
  {
    key: "adjustments-processed",
    description: "Final adjustments processed",
    category: "Finalization Phase",
    subcategory: "Audit Adjustments",
    fieldType: "checkbox",
  },

  {
    key: "final-fs-reviewed",
    description: "Final financial statements reviewed by audit team",
    category: "Finalization Phase",
    subcategory: "Review of Financial Statements",
    fieldType: "checkbox",
  },
  {
    key: "representation-drafted",
    description: "Letter of representation drafted and sent to management",
    category: "Finalization Phase",
    subcategory: "Review of Financial Statements",
    fieldType: "checkbox",
  },
  {
    key: "representation-received",
    description: "Signed letter of representation received",
    category: "Finalization Phase",
    subcategory: "Review of Financial Statements",
    fieldType: "date",
  },

  {
    key: "draft-report",
    description: "Draft audit report completed",
    category: "Finalization Phase",
    subcategory: "Audit Opinion Drafting",
    fieldType: "checkbox",
  },
  {
    key: "report-review",
    description: "Review with audit team",
    category: "Finalization Phase",
    subcategory: "Audit Opinion Drafting",
    fieldType: "checkbox",
  },
  {
    key: "final-report",
    description: "Final report issued",
    category: "Finalization Phase",
    subcategory: "Audit Opinion Drafting",
    fieldType: "date",
  },

  {
    key: "form-dd1",
    description: "Form DD1 prepared and submitted",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Form DD1/DD2 (If Applicable)",
    fieldType: "date",
  },
  {
    key: "form-dd2",
    description: "Form DD2 prepared and submitted",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Form DD1/DD2 (If Applicable)",
    fieldType: "date",
  },

  {
    key: "lor-drafted",
    description: "Drafted and sent to management",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Letter of Representation",
    fieldType: "date",
  },
  {
    key: "lor-received",
    description: "Signed letter received",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Letter of Representation",
    fieldType: "date",
  },

  {
    key: "shareholder-confirmation",
    description: "Confirmation from shareholders received",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Shareholder's/s' Confirmation (If Applicable)",
    fieldType: "date",
  },

  {
    key: "shareholder-draft",
    description: "Draft shareholder's resolution",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Shareholder's/s' Resolution (If Applicable)",
    fieldType: "checkbox",
  },
  {
    key: "shareholder-signed",
    description: "Signed resolution received",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Shareholder's/s' Resolution (If Applicable)",
    fieldType: "date",
  },

  {
    key: "director-draft",
    description: "Draft director's resolution",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Director's/s' Resolution (If Applicable)",
    fieldType: "checkbox",
  },
  {
    key: "director-signed",
    description: "Signed resolution received",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Director's/s' Resolution (If Applicable)",
    fieldType: "date",
  },

  {
    key: "going-concern-letter",
    description: "Going concern letter obtained from management and reviewed",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Going Concern Letter (If Applicable)",
    fieldType: "checkbox",
  },

  {
    key: "related-parties-drafted",
    description: "Related parties letter drafted and sent to management",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Related Parties Letters (If Applicable)",
    fieldType: "checkbox",
  },
  {
    key: "related-parties-confirmed",
    description:
      "Confirmation of related parties transactions received and reviewed",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Related Parties Letters (If Applicable)",
    fieldType: "checkbox",
  },

  {
    key: "external-confirmations-sent",
    description:
      "External confirmation letters (e.g., bank, receivables) drafted and sent",
    category: "Post-Audit Letters & Documentation",
    subcategory: "External Confirmation Letters (If Applicable)",
    fieldType: "checkbox",
  },
  {
    key: "external-confirmations-received",
    description:
      "External confirmations received and reconciled with client records",
    category: "Post-Audit Letters & Documentation",
    subcategory: "External Confirmation Letters (If Applicable)",
    fieldType: "checkbox",
  },

  {
    key: "management-letter-draft",
    description: "Draft letter of management comments prepared",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Letter of Management",
    fieldType: "checkbox",
  },
  {
    key: "management-letter-sent",
    description: "Final letter sent to management",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Letter of Management",
    fieldType: "date",
  },

  {
    key: "adjustments-discussed-client",
    description: "Audit adjustments discussed with client",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Audit Adjustments Approval",
    fieldType: "checkbox",
  },
  {
    key: "adjustments-approved",
    description: "Adjustments approved by management",
    category: "Post-Audit Letters & Documentation",
    subcategory: "Audit Adjustments Approval",
    fieldType: "date",
  },

  {
    key: "draft-management-letter",
    description: "Draft Management Letter",
    category: "Post-Audit Phase",
    subcategory: "Management Letter",
    fieldType: "checkbox",
  },
  {
    key: "finalized-management-letter",
    description: "Finalized Management Letter",
    category: "Post-Audit Phase",
    subcategory: "Management Letter",
    fieldType: "date",
  },

  {
    key: "post-audit-meeting",
    description: "Post-audit meeting scheduled with client",
    category: "Post-Audit Phase",
    subcategory: "Client Debrief",
    fieldType: "date",
  },
  {
    key: "client-feedback",
    description: "Feedback received from the client",
    category: "Post-Audit Phase",
    subcategory: "Client Debrief",
    fieldType: "checkbox",
  },

  {
    key: "audit-file-archived",
    description: "Audit file archived",
    category: "Post-Audit Phase",
    subcategory: "Archiving",
    fieldType: "checkbox",
  },
  {
    key: "closure-meeting",
    description: "Engagement closure meeting with the team",
    category: "Post-Audit Phase",
    subcategory: "Archiving",
    fieldType: "checkbox",
  },

  {
    key: "signed-documents",
    description: "Signed documents obtained from the client",
    category: "Post-Audit Phase",
    subcategory: "Conclusion",
    fieldType: "date",
  },
  {
    key: "documentation-rearranged",
    description: "Documentation re-arranged and prepared for submission",
    category: "Post-Audit Phase",
    subcategory: "Conclusion",
    fieldType: "checkbox",
  },
  {
    key: "counter-signed-docs",
    description: "Counter-signed documents sent to the client",
    category: "Post-Audit Phase",
    subcategory: "Conclusion",
    fieldType: "date",
  },
  {
    key: "mbr-submission",
    description: "Submission completed with MBR",
    category: "Post-Audit Phase",
    subcategory: "Conclusion",
    fieldType: "date",
  },
  {
    key: "final-billing",
    description: "Final billing for the engagement issued",
    category: "Post-Audit Phase",
    subcategory: "Conclusion",
    fieldType: "date",
  },
];

exports.getChecklistByEngagement = async (req, res, next) => {
  try {
    let items = await ChecklistItem.find({
      engagement: req.params.engagementId,
    });

    if (items.length === 0) {
      const defaultItems = defaultChecklistItems.map((item) => ({
        ...item,
        engagement: req.params.engagementId,
      }));

      items = await ChecklistItem.insertMany(defaultItems);
    }

    const orderedItems = [];
    const itemMap = new Map(items.map((item) => [item.key, item]));

    for (const defaultItem of defaultChecklistItems) {
      const existingItem = itemMap.get(defaultItem.key);
      if (existingItem) {
        orderedItems.push(existingItem);
      }
    }

    res.json(orderedItems);
  } catch (err) {
    next(err);
  }
};

exports.updateChecklistItem = async (req, res, next) => {
  try {
    const { completed, textValue, dateValue, selectValue, isRequested, isUploaded } = req.body;

    // Get the current item to check completion restrictions
    const currentItem = await ChecklistItem.findById(req.params.id);
    if (!currentItem) {
      return res.status(404).json({ message: "Checklist item not found" });
    }

    // Get all checklist items for this engagement
    const allItems = await ChecklistItem.find({
      engagement: currentItem.engagement,
      isNotApplicable: { $ne: true }
    });

    // Count completed items (excluding current item being updated)
    const completedCount = allItems.filter(
      item => item._id.toString() !== req.params.id && item.completed
    ).length;

    // If trying to mark as completed, check if all previous items are completed
    if (completed === true && !currentItem.completed) {
      // Check if this item has restriction enabled
      if (currentItem.isRestricted) {
        const totalItems = allItems.length;
        const totalCompleted = completedCount;
        
        // Check if all items before this one are completed (sequential completion restriction)
        // For simplicity, we check if at least 80% are completed, or if this is the last item
        // You can adjust this logic based on requirements
        
        // Get item index in ordered list (if you maintain order)
        const itemIndex = allItems.findIndex(item => item._id.toString() === req.params.id);
        
        // If not all previous items are completed, enforce restriction
        // Allow completion if:
        // 1. All previous items are completed, OR
        // 2. At least 80% of items are completed (for flexibility), OR  
        // 3. User is admin/employee (auditors can override)
        const completionPercentage = (completedCount / totalItems) * 100;
        const isAdminOrEmployee = req.user.role === 'admin' || req.user.role === 'employee';
        
        if (completionPercentage < 80 && !isAdminOrEmployee) {
          return res.status(400).json({
            message: "Please complete other checklist items first before marking this as complete. At least 80% of checklist items must be completed.",
            completionPercentage: completionPercentage.toFixed(1),
            completedItems: completedCount,
            totalItems: totalItems
          });
        }
      }
    }

    const updateData = {};
    if (completed !== undefined) updateData.completed = completed;
    if (textValue !== undefined) updateData.textValue = textValue;
    if (dateValue !== undefined) updateData.dateValue = dateValue;
    if (selectValue !== undefined) updateData.selectValue = selectValue;
    if (isRequested !== undefined) updateData.isRequested = isRequested;
    if (isUploaded !== undefined) updateData.isUploaded = isUploaded;

    const item = await ChecklistItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!item)
      return res.status(404).json({ message: "Checklist item not found" });

    const io = req.app.get("io");
    io.to(`engagement_${item.engagement}`).emit("checklist:update", item);

    res.json(item);
  } catch (err) {
    next(err);
  }
};

// Get checklist completion percentage
exports.getChecklistCompletion = async (req, res, next) => {
  try {
    const engagementId = req.params.engagementId;
    
    const allItems = await ChecklistItem.find({
      engagement: engagementId,
      isNotApplicable: { $ne: true }
    });
    
    const completedItems = allItems.filter(item => item.completed).length;
    const totalItems = allItems.length;
    const completionPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    
    res.json({
      completedItems,
      totalItems,
      completionPercentage: completionPercentage.toFixed(1),
      isComplete: completedItems === totalItems && totalItems > 0
    });
  } catch (err) {
    next(err);
  }
};
