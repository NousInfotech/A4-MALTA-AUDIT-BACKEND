const ChecklistItem = require('../models/ChecklistItem');

// Predefined checklist items exactly as per the PDF document
const defaultChecklistItems = [
  // Pre-Audit Phase - Professional Clearance
  { key: 'prof-clearance-letter', description: 'Signed Professional Clearance Letter (if required)', category: 'Pre-Audit Phase', subcategory: 'Professional Clearance', fieldType: 'checkbox' },
  { key: 'removal-auditor', description: 'Removal of Auditor', category: 'Pre-Audit Phase', subcategory: 'Professional Clearance', fieldType: 'checkbox' },
  { key: 'form-f1', description: 'Form F1 Submitted (if required)', category: 'Pre-Audit Phase', subcategory: 'Professional Clearance', fieldType: 'checkbox' },

  // Pre-Audit Phase - Engagement Letter
  { key: 'draft-engagement', description: 'Draft Engagement Letter', category: 'Pre-Audit Phase', subcategory: 'Engagement Letter', fieldType: 'checkbox' },
  { key: 'signed-engagement', description: 'Signed Engagement Letter by Client', category: 'Pre-Audit Phase', subcategory: 'Engagement Letter', fieldType: 'checkbox' },
  { key: 'engagement-sent', description: 'Engagement Letter sent to client', category: 'Pre-Audit Phase', subcategory: 'Engagement Letter', fieldType: 'date' },

  // Pre-Audit Phase - Letter of Independence
  { key: 'draft-independence', description: 'Draft Letter of Independence for team', category: 'Pre-Audit Phase', subcategory: 'Letter of Independence', fieldType: 'checkbox' },
  { key: 'signed-independence', description: 'Signed Independence Letter by audit team members', category: 'Pre-Audit Phase', subcategory: 'Letter of Independence', fieldType: 'checkbox' },
  { key: 'filed-independence', description: 'Filed for record', category: 'Pre-Audit Phase', subcategory: 'Letter of Independence', fieldType: 'date' },

  // Pre-Audit Phase - MBR Authorization Access
  { key: 'mbr-auth-request', description: 'Authorization request submitted for MBR access', category: 'Pre-Audit Phase', subcategory: 'MBR Authorization Access', fieldType: 'date' },
  { key: 'mbr-confirmation', description: 'Access confirmation received', category: 'Pre-Audit Phase', subcategory: 'MBR Authorization Access', fieldType: 'date' },

  // Pre-Audit Phase - CFR02 Tax Access
  { key: 'cfr02-request', description: 'CFR02 Tax access request submitted', category: 'Pre-Audit Phase', subcategory: 'CFR02 Tax Access', fieldType: 'date' },
  { key: 'cfr02-granted', description: 'Access granted for tax details', category: 'Pre-Audit Phase', subcategory: 'CFR02 Tax Access', fieldType: 'date' },

  // Pre-Audit Phase - Task Assignment
  { key: 'engagement-type', description: 'Specify Type of Engagement', category: 'Pre-Audit Phase', subcategory: 'Task Assignment', fieldType: 'select', selectOptions: ['Audit', 'Liquidation', 'Review', 'Other'] },
  { key: 'assign-manager', description: 'Assign audit manager/lead auditor', category: 'Pre-Audit Phase', subcategory: 'Task Assignment', fieldType: 'text' },

  // Pre-Audit Phase - Audit Period
  { key: 'audit-period', description: 'Years/Periods to be Audited', category: 'Pre-Audit Phase', subcategory: 'Audit Period', fieldType: 'text' },

  // Pre-Audit Phase - Bank Confirmation Letter
  { key: 'bank-letters-sent', description: 'Bank Confirmation Letters sent', category: 'Pre-Audit Phase', subcategory: 'Bank Confirmation Letter', fieldType: 'date' },
  { key: 'bank-letters-received', description: 'Bank Confirmation Letters received', category: 'Pre-Audit Phase', subcategory: 'Bank Confirmation Letter', fieldType: 'date' },

  // Audit Planning Phase - Audit Planning Meeting
  { key: 'planning-meeting', description: 'Initial audit planning meeting scheduled', category: 'Audit Planning Phase', subcategory: 'Audit Planning Meeting', fieldType: 'date' },
  { key: 'scope-discussion', description: 'Discussion of audit scope, timing, and key focus areas', category: 'Audit Planning Phase', subcategory: 'Audit Planning Meeting', fieldType: 'checkbox' },

  // Audit Planning Phase - Audit Strategy and Risk Assessment
  { key: 'risk-assessment', description: 'Identify significant risks and audit areas', category: 'Audit Planning Phase', subcategory: 'Audit Strategy and Risk Assessment', fieldType: 'checkbox' },
  { key: 'audit-strategy', description: 'Document audit strategy', category: 'Audit Planning Phase', subcategory: 'Audit Strategy and Risk Assessment', fieldType: 'checkbox' },
  { key: 'internal-controls', description: 'Review internal controls (if applicable)', category: 'Audit Planning Phase', subcategory: 'Audit Strategy and Risk Assessment', fieldType: 'checkbox' },

  // Audit Planning Phase - Audit Team Planning
  { key: 'team-assigned', description: 'Audit team assigned and roles clarified', category: 'Audit Planning Phase', subcategory: 'Audit Team Planning', fieldType: 'checkbox' },
  { key: 'timeline-communication', description: 'Communication of timelines and deliverables', category: 'Audit Planning Phase', subcategory: 'Audit Team Planning', fieldType: 'checkbox' },

  // Documentation Requested - Client Documentation Request
  { key: 'financial-statements', description: 'Financial Statements (balance sheet, income statement, cash flow)', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'trial-balance', description: 'General Ledger and Trial Balance', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'fixed-asset-register', description: 'Fixed Asset Register', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'bank-statements', description: 'Bank Statements and Reconciliations', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'payroll-reports', description: 'Payroll Reports and Supporting Documents', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'tax-returns', description: 'Tax Returns and Correspondence', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'debtors-creditors', description: 'Debtors & Creditors Ledgers', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'legal-documents', description: 'Legal Documents (agreements, contracts, leases)', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'board-minutes', description: 'Minutes of Board Meetings', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'significant-transactions', description: 'Significant transactions documentation (loans, acquisitions, etc.)', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'checkbox' },
  { key: 'other-requests', description: 'Other (list any additional requests)', category: 'Documentation Requested', subcategory: 'Client Documentation Request', fieldType: 'text' },

  // Documentation Requested - Audit File Preparation
  { key: 'working-papers', description: 'Audit working papers created', category: 'Documentation Requested', subcategory: 'Audit File Preparation', fieldType: 'date' },

  // Fieldwork Phase - Audit Started
  { key: 'fieldwork-start', description: 'Date of Audit Fieldwork Start', category: 'Fieldwork Phase', subcategory: 'Audit Started', fieldType: 'date' },
  { key: 'inventory-count', description: 'Attendance of inventory count (if applicable)', category: 'Fieldwork Phase', subcategory: 'Audit Started', fieldType: 'checkbox' },

  // Fieldwork Phase - Testing and Sampling
  { key: 'assertions-tested', description: 'Financial statement assertions tested', category: 'Fieldwork Phase', subcategory: 'Testing and Sampling', fieldType: 'checkbox' },
  { key: 'sampling-plan', description: 'Sampling plan for testing developed', category: 'Fieldwork Phase', subcategory: 'Testing and Sampling', fieldType: 'checkbox' },
  { key: 'sample-selection', description: 'Sample selection completed', category: 'Fieldwork Phase', subcategory: 'Testing and Sampling', fieldType: 'checkbox' },

  // Fieldwork Phase - Substantive Procedures
  { key: 'revenue-testing', description: 'Revenue testing', category: 'Fieldwork Phase', subcategory: 'Substantive Procedures', fieldType: 'checkbox' },
  { key: 'expense-testing', description: 'Expense testing', category: 'Fieldwork Phase', subcategory: 'Substantive Procedures', fieldType: 'checkbox' },
  { key: 'cash-bank-testing', description: 'Cash and bank testing', category: 'Fieldwork Phase', subcategory: 'Substantive Procedures', fieldType: 'checkbox' },
  { key: 'asset-testing', description: 'Asset testing', category: 'Fieldwork Phase', subcategory: 'Substantive Procedures', fieldType: 'checkbox' },
  { key: 'liability-testing', description: 'Liability testing', category: 'Fieldwork Phase', subcategory: 'Substantive Procedures', fieldType: 'checkbox' },

  // Fieldwork Phase - Review of Estimates and Judgments
  { key: 'estimates-review', description: 'Review management\'s estimates (e.g., provisions, impairments)', category: 'Fieldwork Phase', subcategory: 'Review of Estimates and Judgments', fieldType: 'checkbox' },

  // Fieldwork Phase - Review of Going Concern
  { key: 'going-concern', description: 'Going concern analysis completed', category: 'Fieldwork Phase', subcategory: 'Review of Going Concern', fieldType: 'checkbox' },

  // Finalization Phase - Financial Statements
  { key: 'fs-drafted', description: 'Financial Statements Drafted by', category: 'Finalization Phase', subcategory: 'Financial Statements', fieldType: 'text' },
  { key: 'fs-reviewed', description: 'Financial Statements Reviewed by', category: 'Finalization Phase', subcategory: 'Financial Statements', fieldType: 'text' },
  { key: 'review-date', description: 'Date of Review', category: 'Finalization Phase', subcategory: 'Financial Statements', fieldType: 'date' },

  // Finalization Phase - Audit Completion Date
  { key: 'fieldwork-completed', description: 'Date Audit Fieldwork Completed', category: 'Finalization Phase', subcategory: 'Audit Completion Date', fieldType: 'date' },

  // Finalization Phase - Audit Adjustments
  { key: 'adjustments-discussed', description: 'Discuss adjustments with client', category: 'Finalization Phase', subcategory: 'Audit Adjustments', fieldType: 'checkbox' },
  { key: 'adjustments-processed', description: 'Final adjustments processed', category: 'Finalization Phase', subcategory: 'Audit Adjustments', fieldType: 'checkbox' },

  // Finalization Phase - Review of Financial Statements
  { key: 'final-fs-reviewed', description: 'Final financial statements reviewed by audit team', category: 'Finalization Phase', subcategory: 'Review of Financial Statements', fieldType: 'checkbox' },
  { key: 'representation-drafted', description: 'Letter of representation drafted and sent to management', category: 'Finalization Phase', subcategory: 'Review of Financial Statements', fieldType: 'checkbox' },
  { key: 'representation-received', description: 'Signed letter of representation received', category: 'Finalization Phase', subcategory: 'Review of Financial Statements', fieldType: 'date' },

  // Finalization Phase - Audit Opinion Drafting
  { key: 'draft-report', description: 'Draft audit report completed', category: 'Finalization Phase', subcategory: 'Audit Opinion Drafting', fieldType: 'checkbox' },
  { key: 'report-review', description: 'Review with audit team', category: 'Finalization Phase', subcategory: 'Audit Opinion Drafting', fieldType: 'checkbox' },
  { key: 'final-report', description: 'Final report issued', category: 'Finalization Phase', subcategory: 'Audit Opinion Drafting', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Form DD1/DD2
  { key: 'form-dd1', description: 'Form DD1 prepared and submitted', category: 'Post-Audit Letters & Documentation', subcategory: 'Form DD1/DD2 (If Applicable)', fieldType: 'date' },
  { key: 'form-dd2', description: 'Form DD2 prepared and submitted', category: 'Post-Audit Letters & Documentation', subcategory: 'Form DD1/DD2 (If Applicable)', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Letter of Representation
  { key: 'lor-drafted', description: 'Drafted and sent to management', category: 'Post-Audit Letters & Documentation', subcategory: 'Letter of Representation', fieldType: 'date' },
  { key: 'lor-received', description: 'Signed letter received', category: 'Post-Audit Letters & Documentation', subcategory: 'Letter of Representation', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Shareholder's Confirmation
  { key: 'shareholder-confirmation', description: 'Confirmation from shareholders received', category: 'Post-Audit Letters & Documentation', subcategory: 'Shareholder\'s/s\' Confirmation (If Applicable)', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Shareholder's Resolution
  { key: 'shareholder-draft', description: 'Draft shareholder\'s resolution', category: 'Post-Audit Letters & Documentation', subcategory: 'Shareholder\'s/s\' Resolution (If Applicable)', fieldType: 'checkbox' },
  { key: 'shareholder-signed', description: 'Signed resolution received', category: 'Post-Audit Letters & Documentation', subcategory: 'Shareholder\'s/s\' Resolution (If Applicable)', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Director's Resolution
  { key: 'director-draft', description: 'Draft director\'s resolution', category: 'Post-Audit Letters & Documentation', subcategory: 'Director\'s/s\' Resolution (If Applicable)', fieldType: 'checkbox' },
  { key: 'director-signed', description: 'Signed resolution received', category: 'Post-Audit Letters & Documentation', subcategory: 'Director\'s/s\' Resolution (If Applicable)', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Going Concern Letter
  { key: 'going-concern-letter', description: 'Going concern letter obtained from management and reviewed', category: 'Post-Audit Letters & Documentation', subcategory: 'Going Concern Letter (If Applicable)', fieldType: 'checkbox' },

  // Post-Audit Letters & Documentation - Related Parties Letters
  { key: 'related-parties-drafted', description: 'Related parties letter drafted and sent to management', category: 'Post-Audit Letters & Documentation', subcategory: 'Related Parties Letters (If Applicable)', fieldType: 'checkbox' },
  { key: 'related-parties-confirmed', description: 'Confirmation of related parties transactions received and reviewed', category: 'Post-Audit Letters & Documentation', subcategory: 'Related Parties Letters (If Applicable)', fieldType: 'checkbox' },

  // Post-Audit Letters & Documentation - External Confirmation Letters
  { key: 'external-confirmations-sent', description: 'External confirmation letters (e.g., bank, receivables) drafted and sent', category: 'Post-Audit Letters & Documentation', subcategory: 'External Confirmation Letters (If Applicable)', fieldType: 'checkbox' },
  { key: 'external-confirmations-received', description: 'External confirmations received and reconciled with client records', category: 'Post-Audit Letters & Documentation', subcategory: 'External Confirmation Letters (If Applicable)', fieldType: 'checkbox' },

  // Post-Audit Letters & Documentation - Letter of Management
  { key: 'management-letter-draft', description: 'Draft letter of management comments prepared', category: 'Post-Audit Letters & Documentation', subcategory: 'Letter of Management', fieldType: 'checkbox' },
  { key: 'management-letter-sent', description: 'Final letter sent to management', category: 'Post-Audit Letters & Documentation', subcategory: 'Letter of Management', fieldType: 'date' },

  // Post-Audit Letters & Documentation - Audit Adjustments Approval
  { key: 'adjustments-discussed-client', description: 'Audit adjustments discussed with client', category: 'Post-Audit Letters & Documentation', subcategory: 'Audit Adjustments Approval', fieldType: 'checkbox' },
  { key: 'adjustments-approved', description: 'Adjustments approved by management', category: 'Post-Audit Letters & Documentation', subcategory: 'Audit Adjustments Approval', fieldType: 'date' },

  // Post-Audit Phase - Management Letter
  { key: 'draft-management-letter', description: 'Draft Management Letter', category: 'Post-Audit Phase', subcategory: 'Management Letter', fieldType: 'checkbox' },
  { key: 'finalized-management-letter', description: 'Finalized Management Letter', category: 'Post-Audit Phase', subcategory: 'Management Letter', fieldType: 'date' },

  // Post-Audit Phase - Client Debrief
  { key: 'post-audit-meeting', description: 'Post-audit meeting scheduled with client', category: 'Post-Audit Phase', subcategory: 'Client Debrief', fieldType: 'date' },
  { key: 'client-feedback', description: 'Feedback received from the client', category: 'Post-Audit Phase', subcategory: 'Client Debrief', fieldType: 'checkbox' },

  // Post-Audit Phase - Archiving
  { key: 'audit-file-archived', description: 'Audit file archived', category: 'Post-Audit Phase', subcategory: 'Archiving', fieldType: 'checkbox' },
  { key: 'closure-meeting', description: 'Engagement closure meeting with the team', category: 'Post-Audit Phase', subcategory: 'Archiving', fieldType: 'checkbox' },

  // Post-Audit Phase - Conclusion
  { key: 'signed-documents', description: 'Signed documents obtained from the client', category: 'Post-Audit Phase', subcategory: 'Conclusion', fieldType: 'date' },
  { key: 'documentation-rearranged', description: 'Documentation re-arranged and prepared for submission', category: 'Post-Audit Phase', subcategory: 'Conclusion', fieldType: 'checkbox' },
  { key: 'counter-signed-docs', description: 'Counter-signed documents sent to the client', category: 'Post-Audit Phase', subcategory: 'Conclusion', fieldType: 'date' },
  { key: 'mbr-submission', description: 'Submission completed with MBR', category: 'Post-Audit Phase', subcategory: 'Conclusion', fieldType: 'date' },
  { key: 'final-billing', description: 'Final billing for the engagement issued', category: 'Post-Audit Phase', subcategory: 'Conclusion', fieldType: 'date' }
];

exports.getChecklistByEngagement = async (req, res, next) => {
  try {
    let items = await ChecklistItem.find({
      engagement: req.params.engagementId
    });

    // If no items exist, create default ones
    if (items.length === 0) {
      const defaultItems = defaultChecklistItems.map(item => ({
        ...item,
        engagement: req.params.engagementId
      }));
      
      items = await ChecklistItem.insertMany(defaultItems);
    }

    // Sort the items to match the exact order of defaultChecklistItems
    const orderedItems = [];
    const itemMap = new Map(items.map(item => [item.key, item]));
    
    // Iterate through the default order and populate the orderedItems array
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
    const { completed, textValue, dateValue, selectValue } = req.body;
    
    const updateData = {};
    if (completed !== undefined) updateData.completed = completed;
    if (textValue !== undefined) updateData.textValue = textValue;
    if (dateValue !== undefined) updateData.dateValue = dateValue;
    if (selectValue !== undefined) updateData.selectValue = selectValue;

    const item = await ChecklistItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });

    // Emit real-time update to all clients in this engagement room
    const io = req.app.get('io');
    io.to(`engagement_${item.engagement}`).emit('checklist:update', item);

    res.json(item);
  } catch (err) {   
    next(err);
  }
};
