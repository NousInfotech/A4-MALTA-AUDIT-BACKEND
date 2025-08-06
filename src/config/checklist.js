// config/checklist.js

module.exports = [
  // Pre-Audit Phase
  { key: 'prof-clearance-letter',        description: 'Signed Professional Clearance Letter (if required)',                  category: 'Pre-Audit Phase' },
  { key: 'removal-auditor',              description: 'Removal of Auditor',                                                category: 'Pre-Audit Phase' },
  { key: 'form-f1',                      description: 'Form F1 Submitted (if required)',                                  category: 'Pre-Audit Phase' },

  { key: 'draft-engagement',             description: 'Draft Engagement Letter',                                          category: 'Pre-Audit Phase' },
  { key: 'signed-engagement',            description: 'Signed Engagement Letter by Client',                               category: 'Pre-Audit Phase' },
  { key: 'engagement-sent',              description: 'Engagement Letter sent to client (Date: __________)',              category: 'Pre-Audit Phase' },

  { key: 'draft-independence',           description: 'Draft Letter of Independence for team',                            category: 'Pre-Audit Phase' },
  { key: 'signed-independence',          description: 'Signed Independence Letter by audit team members',                 category: 'Pre-Audit Phase' },
  { key: 'filed-independence',           description: 'Filed for record (Date: __________)',                              category: 'Pre-Audit Phase' },

  { key: 'mbr-auth-request',             description: 'Authorization request submitted for MBR access (Date: __________)', category: 'Pre-Audit Phase' },
  { key: 'mbr-confirmation',             description: 'Access confirmation received (Date: __________)',                   category: 'Pre-Audit Phase' },

  { key: 'cfr02-request',                description: 'CFR02 Tax access request submitted (Date: __________)',             category: 'Pre-Audit Phase' },
  { key: 'cfr02-granted',                description: 'Access granted for tax details (Date: __________)',                category: 'Pre-Audit Phase' },

  { key: 'engagement-type',              description: 'Specify Type of Engagement: (✓ Audit ☐ Liquidation ☐ Review ☐ Other)', category: 'Pre-Audit Phase' },
  { key: 'assign-manager',               description: 'Assign audit manager/lead auditor (Name: __________)',             category: 'Pre-Audit Phase' },

  { key: 'audit-period',                 description: 'Years/Periods to be Audited: ______ to ______',                    category: 'Pre-Audit Phase' },

  { key: 'bank-letters-sent',            description: 'Bank Confirmation Letters sent (Date: __________)',                category: 'Pre-Audit Phase' },
  { key: 'bank-letters-received',        description: 'Bank Confirmation Letters received (Date: __________)',            category: 'Pre-Audit Phase' },

  // Audit Planning Phase
  { key: 'planning-meeting',             description: 'Initial audit planning meeting scheduled (Date: __________)',      category: 'Audit Planning Phase' },
  { key: 'scope-discussion',             description: 'Discussion of audit scope, timing, and key focus areas',           category: 'Audit Planning Phase' },

  { key: 'risk-assessment',              description: 'Identify significant risks and audit areas',                       category: 'Audit Planning Phase' },
  { key: 'audit-strategy',               description: 'Document audit strategy',                                          category: 'Audit Planning Phase' },
  { key: 'internal-controls',            description: 'Review internal controls (if applicable)',                         category: 'Audit Planning Phase' },

  { key: 'team-assigned',                description: 'Audit team assigned and roles clarified',                         category: 'Audit Planning Phase' },
  { key: 'timeline-communication',       description: 'Communication of timelines and deliverables',                      category: 'Audit Planning Phase' },

  // Documentation Requested
  { key: 'financial-statements',         description: 'Financial Statements (balance sheet, income statement, cash flow)', category: 'Documentation Requested' },
  { key: 'trial-balance',                description: 'General Ledger and Trial Balance',                                category: 'Documentation Requested' },
  { key: 'fixed-asset-register',         description: 'Fixed Asset Register',                                             category: 'Documentation Requested' },
  { key: 'bank-statements',              description: 'Bank Statements and Reconciliations',                              category: 'Documentation Requested' },
  { key: 'payroll-reports',              description: 'Payroll Reports and Supporting Documents',                        category: 'Documentation Requested' },
  { key: 'tax-returns',                  description: 'Tax Returns and Correspondence',                                  category: 'Documentation Requested' },
  { key: 'debtors-creditors',            description: 'Debtors & Creditors Ledgers',                                     category: 'Documentation Requested' },
  { key: 'legal-documents',              description: 'Legal Documents (agreements, contracts, leases)',                 category: 'Documentation Requested' },
  { key: 'board-minutes',                description: 'Minutes of Board Meetings',                                       category: 'Documentation Requested' },
  { key: 'significant-transactions',     description: 'Significant transactions documentation (loans, acquisitions, etc.)', category: 'Documentation Requested' },
  { key: 'other-requests',               description: 'Other (list any additional requests: __________)',                category: 'Documentation Requested' },

  { key: 'working-papers',               description: 'Audit working papers created (Date: __________)',                 category: 'Documentation Requested' },

  // Fieldwork Phase
  { key: 'fieldwork-start',              description: 'Date of Audit Fieldwork Start: __________',                       category: 'Fieldwork Phase' },
  { key: 'inventory-count',              description: 'Attendance of inventory count (if applicable)',                   category: 'Fieldwork Phase' },

  { key: 'assertions-tested',            description: 'Financial statement assertions tested',                          category: 'Fieldwork Phase' },
  { key: 'sampling-plan',                description: 'Sampling plan for testing developed',                            category: 'Fieldwork Phase' },
  { key: 'sample-selection',             description: 'Sample selection completed',                                     category: 'Fieldwork Phase' },

  { key: 'revenue-testing',              description: 'Revenue testing',                                                 category: 'Fieldwork Phase' },
  { key: 'expense-testing',              description: 'Expense testing',                                                 category: 'Fieldwork Phase' },
  { key: 'cash-bank-testing',            description: 'Cash and bank testing',                                           category: 'Fieldwork Phase' },
  { key: 'asset-testing',                description: 'Asset testing',                                                   category: 'Fieldwork Phase' },
  { key: 'liability-testing',            description: 'Liability testing',                                               category: 'Fieldwork Phase' },

  { key: 'estimates-review',             description: 'Review management\'s estimates (e.g., provisions, impairments)', category: 'Fieldwork Phase' },
  { key: 'going-concern',                description: 'Going concern analysis completed',                                category: 'Fieldwork Phase' },

  // Finalization Phase
  { key: 'fs-drafted',                   description: 'Financial Statements Drafted by: __________ (Name)',              category: 'Finalization Phase' },
  { key: 'fs-reviewed',                  description: 'Financial Statements Reviewed by: __________ (Name)',             category: 'Finalization Phase' },
  { key: 'review-date',                  description: 'Date of Review: __________',                                      category: 'Finalization Phase' },

  { key: 'fieldwork-completed',          description: 'Date Audit Fieldwork Completed: __________',                      category: 'Finalization Phase' },

  { key: 'adjustments-discussed',        description: 'Discuss adjustments with client',                                category: 'Finalization Phase' },
  { key: 'adjustments-processed',        description: 'Final adjustments processed',                                    category: 'Finalization Phase' },

  { key: 'final-fs-reviewed',            description: 'Final financial statements reviewed by audit team',               category: 'Finalization Phase' },
  { key: 'representation-drafted',       description: 'Letter of representation drafted and sent to management',         category: 'Finalization Phase' },
  { key: 'representation-received',      description: 'Signed letter of representation received (Date: __________)',     category: 'Finalization Phase' },

  { key: 'draft-report',                 description: 'Draft audit report completed',                                   category: 'Finalization Phase' },
  { key: 'report-review',                description: 'Review audit report with team',                                  category: 'Finalization Phase' },
  { key: 'final-report',                 description: 'Final report issued (Date: __________)',                         category: 'Finalization Phase' },

  // Post-Audit Letters & Documentation
  { key: 'form-dd1',                     description: 'Form DD1 prepared and submitted (Date: __________)',             category: 'Post-Audit Letters & Documentation' },
  { key: 'form-dd2',                     description: 'Form DD2 prepared and submitted (Date: __________)',             category: 'Post-Audit Letters & Documentation' },

  { key: 'lor-drafted',                  description: 'Letter of Representation drafted and sent to management (Date: __________)', category: 'Post-Audit Letters & Documentation' },
  { key: 'lor-received',                 description: 'Signed Letter of Representation received (Date: __________)',     category: 'Post-Audit Letters & Documentation' },

  { key: 'shareholder-confirmation',     description: 'Confirmation from shareholders received (Date: __________)',      category: 'Post-Audit Letters & Documentation' },

  { key: 'shareholder-draft',            description: 'Draft shareholder\'s resolution',                               category: 'Post-Audit Letters & Documentation' },
  { key: 'shareholder-signed',           description: 'Signed shareholder\'s resolution received (Date: __________)',   category: 'Post-Audit Letters & Documentation' },

  { key: 'director-draft',               description: 'Draft director\'s resolution',                                  category: 'Post-Audit Letters & Documentation' },
  { key: 'director-signed',              description: 'Signed director\'s resolution received (Date: __________)',       category: 'Post-Audit Letters & Documentation' },

  { key: 'going-concern-letter',         description: 'Going concern letter obtained from management and reviewed.',     category: 'Post-Audit Letters & Documentation' },

  { key: 'related-parties-drafted',      description: 'Related parties letter drafted and sent to management.',          category: 'Post-Audit Letters & Documentation' },
  { key: 'related-parties-confirmed',    description: 'Confirmation of related parties transactions received.',         category: 'Post-Audit Letters & Documentation' },

  { key: 'external-confirmations-sent',     description: 'External confirmation letters drafted and sent.',                category: 'Post-Audit Letters & Documentation' },
  { key: 'external-confirmations-received', description: 'External confirmations received and reconciled with records.',   category: 'Post-Audit Letters & Documentation' },

  { key: 'management-letter-draft',      description: 'Draft letter of management comments prepared',                    category: 'Post-Audit Letters & Documentation' },
  { key: 'management-letter-sent',       description: 'Final letter of management comments sent (Date: __________)',     category: 'Post-Audit Letters & Documentation' },

  { key: 'adjustments-discussed-client', description: 'Audit adjustments discussed with client',                        category: 'Post-Audit Letters & Documentation' },
  { key: 'adjustments-approved',         description: 'Adjustments approved by management (Date: __________)',           category: 'Post-Audit Letters & Documentation' },

  // Post-Audit Phase
  { key: 'draft-management-letter',      description: 'Draft Management Letter',                                        category: 'Post-Audit Phase' },
  { key: 'finalized-management-letter',  description: 'Finalized Management Letter (Date: __________)',                  category: 'Post-Audit Phase' },

  { key: 'post-audit-meeting',           description: 'Post-audit meeting scheduled with client (Date: __________)',     category: 'Post-Audit Phase' },
  { key: 'client-feedback',              description: 'Feedback received from the client',                              category: 'Post-Audit Phase' },

  { key: 'audit-file-archived',          description: 'Audit file archived',                                            category: 'Post-Audit Phase' },
  { key: 'closure-meeting',              description: 'Engagement closure meeting with the team',                       category: 'Post-Audit Phase' },

  { key: 'signed-documents',             description: 'Signed documents obtained from the client (Date: __________)',    category: 'Post-Audit Phase' },
  { key: 'documentation-rearranged',     description: 'Documentation re-arranged and prepared for submission',          category: 'Post-Audit Phase' },
  { key: 'counter-signed-docs',          description: 'Counter-signed documents sent to the client (Date: __________)',  category: 'Post-Audit Phase' },
  { key: 'mbr-submission',               description: 'Submission completed with MBR (Date: __________)',               category: 'Post-Audit Phase' },
  { key: 'final-billing',                description: 'Final billing for the engagement issued (Date: __________)',      category: 'Post-Audit Phase' },
];
