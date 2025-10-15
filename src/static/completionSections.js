// static/completionSections.js
module.exports = [
    {
        sectionId: "initial_completion",
        title: "P1: Initial Completion",
        standards: ["ISA 230", "ISA 220", "ISA 402", "ISA 620", "ISA 580"],
        fields: [
            {
                key: "engagement_letter_signed",
                type: "select",
                label: "Is there a signed, up-to-date engagement letter?",
                options: ["Yes", "No"],
                required: true,
                help: "Confirms contract / scope is formally agreed. Without this, audit is not valid."
            },
            {
                key: "work_follows_plan",
                type: "group",
                label: "Did the audit work follow the plan? If not, describe deviations.",
                required: true,
                help: "Helps reviewer / partner see what changed mid-audit and whether changes are justified.",
                fields: [
                    { key: "followed_plan", type: "select", label: "Followed Plan?", options: ["Yes", "No"], required: true },
                    { key: "deviation_details", type: "textarea", label: "Deviation Details", required: true, visibleIf: { "work_follows_plan.followed_plan": ["No"] } }
                ]
            },
            {
                key: "all_schedules_on_file",
                type: "select",
                label: "Are all expected schedules / modules present in the file?",
                options: ["Yes", "No"],
                required: true,
                help: "Ensures completeness of deliverables / modules so nothing is missing."
            },
            {
                key: "working_papers_detail",
                type: "textarea",
                label: "Describe how working papers document each audit step (sources, references).",
                required: true,
                help: "Evidence supporting that all work is traceable, documented, and understandable by another auditor."
            },
            {
                key: "cross_references_done",
                type: "group",
                label: "Are working papers fully cross-referenced? If not, explain.",
                required: true,
                help: "Cross-referencing ensures navigation among related workpapers and supports review.",
                fields: [
                    { key: "cross_referenced", type: "select", label: "Cross-referenced?", options: ["Yes", "No"], required: true },
                    { key: "explanation", type: "textarea", label: "Explanation", required: true, visibleIf: { "cross_references_done.cross_referenced": ["No"] } }
                ]
            },
            {
                key: "audit_queries_closed",
                type: "group",
                label: "Have all audit queries / open items been resolved?",
                required: true,
                help: "To ensure no loose ends or unresolved issues remain before closing the file.",
                fields: [
                    { key: "queries_closed", type: "select", label: "Queries Closed?", options: ["Yes", "No"], required: true },
                    { key: "outstanding_items", type: "textarea", label: "Outstanding Items", required: true, visibleIf: { "audit_queries_closed.queries_closed": ["No"] } }
                ]
            },
            {
                key: "quality_control_followed",
                type: "textarea",
                label: "Confirm that all firm quality control reviews / consultations have been completed.",
                required: true,
                help: "Verifies that review steps required by firm policy / ISQM have been carried out."
            },
            {
                key: "service_org_used",
                type: "select",
                label: "Does client use service organizations?",
                options: ["Yes", "No"],
                required: true,
                help: "Determine if service organization evidence is needed (ISA 402)."
            },
            {
                key: "service_org_evidence",
                type: "group",
                label: "If client uses service organizations, has adequate evidence been obtained?",
                required: true,
                visibleIf: { "service_org_used": ["Yes"] },
                help: "Only appears if service orgs used; ensures evidence of controls / third-party compliance (ISA 402).",
                fields: [
                    { key: "evidence_obtained", type: "select", label: "Evidence Obtained?", options: ["Yes", "No"], required: true },
                    { key: "evidence_details", type: "textarea", label: "Evidence Details", required: true }
                ]
            },
            {
                key: "expert_used",
                type: "select",
                label: "Were experts used in the audit?",
                options: ["Yes", "No"],
                required: true,
                help: "Determine if expert work evidence is needed (ISA 620)."
            },
            {
                key: "expert_work_evidence",
                type: "group",
                label: "If experts were used, is there sufficient evidence to rely on their work?",
                required: true,
                visibleIf: { "expert_used": ["Yes"] },
                help: "Only if specialist / expert used (e.g. valuation). Ensures basis to rely on their work (ISA 620).",
                fields: [
                    { key: "sufficient_evidence", type: "select", label: "Sufficient Evidence?", options: ["Yes", "No"], required: true },
                    { key: "expert_evidence_details", type: "textarea", label: "Evidence Details", required: true }
                ]
            },
            {
                key: "points_forward_notes",
                type: "textarea",
                label: "List important points & recommendations for next year.",
                required: true,
                help: "Captures lessons learned, control improvements, or audit planning suggestions for the future."
            },
            {
                key: "disclosure_check_updates",
                type: "textarea",
                label: "Confirm that disclosures were reviewed considering new reporting standards / laws.",
                required: true,
                help: "Ensures that any new rules or changes (e.g. new IFRS, local law) have been considered."
            },
            {
                key: "draft_report_layout_ok",
                type: "group",
                label: "Is the layout / structure of draft report and financials acceptable?",
                required: true,
                help: "Checks that the draft output is in acceptable format (readability, consistency, pagination).",
                fields: [
                    { key: "layout_acceptable", type: "select", label: "Layout Acceptable?", options: ["Yes", "No"], required: true },
                    { key: "layout_issues", type: "textarea", label: "Layout Issues", required: true, visibleIf: { "draft_report_layout_ok.layout_acceptable": ["No"] } }
                ]
            },
            {
                key: "standards_compliance",
                type: "textarea",
                label: "State that audit followed applicable ISAs / laws; note any exceptions.",
                required: true,
                help: "Formal attestation that the audit adhered to required standards and legal requirements."
            },
            {
                key: "rep_letter_prepared",
                type: "group",
                label: "Has a draft management representation letter been prepared (ISA 580)?",
                required: true,
                help: "Confirms the obligation to get written management representation is addressed.",
                fields: [
                    { key: "letter_prepared", type: "select", label: "Letter Prepared?", options: ["Yes", "No"], required: true },
                    { key: "preparation_details", type: "textarea", label: "Preparation Details", required: true }
                ]
            },
            {
                key: "mgmt_letter_drafted",
                type: "group",
                label: "Has a draft letter of comment / management letter been prepared?",
                required: true,
                help: "This is for communicating control suggestions, observations, non-binding advice to management.",
                fields: [
                    { key: "letter_drafted", type: "select", label: "Letter Drafted?", options: ["Yes", "No"], required: true },
                    { key: "draft_details", type: "textarea", label: "Draft Details", required: true }
                ]
            },
            {
                key: "external_reporting_needed",
                type: "textarea",
                label: "Are any issues reportable to external parties (regulators etc.)?",
                required: true,
                help: "Captures whether there is a legal / regulatory reporting obligation arising out of audit work."
            },
            {
                key: "independence_for_next_audit",
                type: "textarea",
                label: "Is our independence fully demonstrable for reappointment?",
                required: true,
                help: "Helps assess whether audit firm can validly be reappointed next year (no conflicts)."
            },
            {
                key: "changes_due_to_evidence",
                type: "textarea",
                label: "Note changes made to risk estimate / materiality / audit approach based on evidence.",
                required: true,
                help: "Records deviations or dynamic changes made mid-audit and justifies them."
            },
            {
                key: "final_sign_off_comment",
                type: "textarea",
                label: "Final conclusion: work meets standards and draft report is acceptable (or explain otherwise).",
                required: true,
                help: "This is the formal sign-off statement from the auditor / reviewer before issuing the report."
            }
        ]
    },
    {
        sectionId: "audit_highlights_report",
        title: "P2: Audit Highlights Report",
        standards: ["ISA 701", "ISA 570", "ISA 450", "ISA 250"],
        fields: [
            {
                key: "client_overview",
                type: "textarea",
                label: "Short description of client (industry, operations, key figures).",
                required: true,
                help: "Sets context for readers (board, audit committee) to understand scale / nature."
            },
            {
                key: "audit_scope_summary",
                type: "textarea",
                label: "Scope of audit, key limitations, changes from prior year.",
                required: true,
                help: "Clarifies what was covered and any limits or focus shifts."
            },
            {
                key: "kam_required",
                type: "select",
                label: "Are Key Audit Matters (KAMs) required?",
                options: ["Yes", "No"],
                required: true,
                help: "Determine if KAMs section should be shown (for PIEs or where ISA 701 applies)."
            },
            {
                key: "key_audit_matters",
                type: "table",
                label: "List key audit matters: description, approach, risks, outcome.",
                required: true,
                visibleIf: { "kam_required": ["Yes"] },
                columns: ["Description", "Audit Approach", "Risks", "Outcome"],
                help: "For PIEs or where ISA 701 applies; shows significant matters to users."
            },
            {
                key: "going_concern_issues",
                type: "textarea",
                label: "Any material uncertainties about going concern and disclosure?",
                required: true,
                help: "Summarizes judgment around going concern for governance audience."
            },
            {
                key: "opinion_modified",
                type: "select",
                label: "Was opinion modified?",
                options: ["Yes", "No"],
                required: true,
                help: "Determine if opinion modification details should be shown."
            },
            {
                key: "opinion_modifications",
                type: "textarea",
                label: "If opinion was modified, describe nature, basis, effect.",
                required: true,
                visibleIf: { "opinion_modified": ["Yes"] },
                help: "Transparently communicates why opinion is qualified / adverse / disclaimer."
            },
            {
                key: "major_adjustments",
                type: "textarea",
                label: "Describe the most significant audit adjustments (corrected / uncorrected).",
                required: true,
                help: "Helps governance understand the financial impact of audit changes."
            },
            {
                key: "control_weaknesses",
                type: "textarea",
                label: "Summarize major internal control deficiencies and management's responses.",
                required: true,
                help: "Alerts management / governance to internal control risks discovered."
            },
            {
                key: "fraud_or_non_compliance",
                type: "textarea",
                label: "Highlight any significant fraud / compliance issues discovered.",
                required: true,
                help: "Disclosure of serious issues, exposures, regulatory risk."
            },
            {
                key: "judgments_and_estimates",
                type: "textarea",
                label: "Describe challenging or subjective estimates (impairment, fair value) and audit approach.",
                required: true,
                help: "Demonstrates audit attention to areas of subjectivity."
            },
            {
                key: "legal_risks",
                type: "textarea",
                label: "Any significant litigation, environmental, regulatory exposures to note?",
                required: true,
                help: "Highlights contingent liabilities or uncertainties."
            },
            {
                key: "next_year_points",
                type: "textarea",
                label: "Key recommendations or points to address next year.",
                required: true,
                help: "Gives management a forward-looking agenda — ties to P4 module."
            },
            {
                key: "draft_highlights_report_file",
                type: "file",
                label: "Attach draft Audit Highlights Report (final version).",
                required: true,
                help: "Enables version control and audit trail of what was delivered."
            },
            {
                key: "report_review_approved",
                type: "group",
                label: "Has the Highlights Report been reviewed / approved?",
                required: true,
                help: "Ensures oversight and sign-off before reporting to governance.",
                fields: [
                    { key: "approved", type: "select", label: "Approved?", options: ["Yes", "No"], required: true },
                    { key: "reviewer", type: "text", label: "Reviewer Name", required: true },
                    { key: "approval_date", type: "date", label: "Approval Date", required: true }
                ]
            },
            {
                key: "executive_summary",
                type: "textarea",
                label: "Summary conclusion for governance: audit outcome, key points, remarks.",
                required: true,
                help: "This is the 'front page' narrative that governance will read."
            }
        ]
    },
    {
        sectionId: "final_analytical_review",
        title: "P3: Final Analytical Review",
        standards: ["ISA 520"],
        fields: [
            {
                key: "ratio_analysis",
                type: "table",
                label: "Ratio Analysis",
                required: true,
                columns: ["Ratio Name", "Prior Period Value", "Current Period Value", "Comments / Observations"],
                help: "Comparative ratio analysis to identify unusual movements, trends, or anomalies."
            },
            {
                key: "additional_ratios",
                type: "textarea",
                label: "Any other ratios important for this business (specify name and values)",
                required: false,
                help: "For ratios that are specific to the client's industry."
            },
            {
                key: "final_analytical_conclusion",
                type: "textarea",
                label: "Final conclusion from analytical review: are there unexplained variances, do ratios support financials, any additional risks flagged?",
                required: true,
                help: "This is the summarizing narrative result that ties together the ratio work."
            }
        ]
    },
    {
        sectionId: "points_forward_next_year",
        title: "P4: Points Forward for Next Year",
        standards: ["ISA 315", "ISA 300"],
        fields: [
            {
                key: "points_forward_table",
                type: "table",
                label: "Points Forward for Next Year",
                required: true,
                columns: ["Issue / Area to Monitor", "Action / Recommended Step", "Responsibility", "Target Date", "Additional Notes"],
                help: "Captures recommendations or observations from the current audit to follow up next year."
            },
            {
                key: "no_issues_flag",
                type: "checkbox",
                label: "No issues to report for next year",
                required: false,
                help: "Check if there are no issues to carry forward to next year."
            }
        ]
    },
    {
        sectionId: "final_client_meeting",
        title: "P5: Notes of Final Client Meeting",
        standards: ["ISA 260", "ISA 265"],
        fields: [
            {
                key: "meeting_notes",
                type: "table",
                label: "Meeting Discussion Points",
                required: true,
                columns: ["Issue for Discussion", "Client Comments & Agreed Actions", "Action Status", "Client Initials & Date"],
                help: "Capture key discussion points, client responses, and commitments."
            },
            {
                key: "final_meeting_clearance",
                type: "group",
                label: "Clearance: Nothing requires discussion / all cleared",
                required: true,
                help: "Final clearance confirmation after client meeting.",
                fields: [
                    { key: "cleared", type: "select", label: "All Cleared?", options: ["Yes", "No"], required: true },
                    { key: "outstanding_issues", type: "textarea", label: "Outstanding Issues", required: true, visibleIf: { "final_meeting_clearance.cleared": ["No"] } }
                ]
            }
        ]
    },
    {
        sectionId: "unadjusted_errors",
        title: "P6: Summary of Unadjusted Errors",
        standards: ["ISA 450"],
        fields: [
            {
                key: "unadjusted_errors_table",
                type: "table",
                label: "Unadjusted Errors Summary",
                required: true,
                columns: [
                    "Error Description",
                    "Reference",
                    "Action Type",
                    "Dr Estimate",
                    "Cr Estimate",
                    "Dr Actual",
                    "Cr Actual"
                ],
                help: "Summarize misstatements not corrected by client per ISA 450 requirements."
            },
            {
                key: "total_potential_adjustment",
                type: "number",
                label: "Total Potential Adjustment (auto-calculated)",
                required: false,
                help: "Auto-sum of estimated adjustments for materiality assessment."
            },
            {
                key: "unadjusted_errors_conclusion",
                type: "textarea",
                label: "Conclusion: materiality, justification, whether these errors would affect true & fair view, whether client has been informed.",
                required: true,
                help: "Final narrative explanation per ISA 450 / standards regarding uncorrected misstatements."
            }
        ]
    },
    {
        sectionId: "reappointment_schedule",
        title: "P7: Reappointment Schedule",
        standards: ["IESBA Code", "ISA 220"],
        fields: [
            {
                key: "reapp_issues_independence",
                type: "group",
                label: "Have any independence issues arisen during the audit?",
                required: true,
                help: "If 'Yes,' explain nature, impact, and mitigation",
                fields: [
                    { key: "issues_present", type: "select", label: "Issues Present?", options: ["Yes", "No"], required: true },
                    { key: "issues_details", type: "textarea", label: "Issues Details", required: true, visibleIf: { "reapp_issues_independence.issues_present": ["Yes"] } }
                ]
            },
            {
                key: "reapp_issues_integrity",
                type: "group",
                label: "Have any issues regarding client integrity arisen?",
                required: true,
                help: "Important for reputational / professional risk",
                fields: [
                    { key: "issues_present", type: "select", label: "Issues Present?", options: ["Yes", "No"], required: true },
                    { key: "issues_details", type: "textarea", label: "Issues Details", required: true, visibleIf: { "reapp_issues_integrity.issues_present": ["Yes"] } }
                ]
            },
            {
                key: "reapp_issues_competence",
                type: "group",
                label: "Have any issues regarding the firm's competence or performance arisen?",
                required: true,
                help: "E.g. staff skill gaps, unexpected challenges",
                fields: [
                    { key: "issues_present", type: "select", label: "Issues Present?", options: ["Yes", "No"], required: true },
                    { key: "issues_details", type: "textarea", label: "Issues Details", required: true, visibleIf: { "reapp_issues_competence.issues_present": ["Yes"] } }
                ]
            },
            {
                key: "reapp_future_recovery_concern",
                type: "group",
                label: "Do we have reason to believe the audit will not recover adequately (economically) in future?",
                required: true,
                help: "For business planning / risk assessment",
                fields: [
                    { key: "concern_present", type: "select", label: "Concern Present?", options: ["Yes", "No"], required: true },
                    { key: "concern_details", type: "textarea", label: "Concern Details", required: true, visibleIf: { "reapp_future_recovery_concern.concern_present": ["Yes"] } }
                ]
            },
            {
                key: "reapp_other_considerations",
                type: "textarea",
                label: "Other issues that should be considered when deciding reappointment (e.g. client's financial difficulties, changes in risk profile, regulatory change).",
                required: true,
                help: "Captures additional risks beyond standard questions."
            },
            {
                key: "reapp_conclusion",
                type: "textarea",
                label: "Conclusion: can we seek reappointment? Any conditions? Summary rationale.",
                required: true,
                help: "Formal decision and narrative justification for reappointment consideration."
            }
        ]
    }
];