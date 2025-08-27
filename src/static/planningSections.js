// static/planningSections.js
module.exports = [
  {
      sectionId:"engagement_setup_acceptance_independence",
      title: "Section 1: Engagement Setup, Acceptance & Independence",
      standards: ["ISA 200", "ISA 210", "ISA 220 (Revised)", "ISQM 1", "IESBA Code"],
      fields: [
        {
          key: "reporting_framework",
          type: "select",
          label: "Reporting Framework",
          options: ["IFRS","EU-IFRS","Local GAAP","GAPSME","Other"],
          required: true,
          help: "Choose the framework used for financial statements; ISA 210 requires an acceptable framework (GAPSME included)."
        },
        {
          key: "reporting_framework_other",
          type: "text",
          label: "If 'Other', please specify",
          required: true,
          visibleIf: { reporting_framework: ["Other"] }
        },
        {
          key: "mgmt_responsibility_ack",
          type: "checkbox",
          label: "Management responsibilities acknowledged (FS prep, IC, access to information/personnel)",
          required: true,
          help: "Required by ISA 210 to confirm management understands its responsibilities."
        },
        {
          key: "engagement_letter",
          type: "file",
          label: "Engagement Letter (signed)",
          required: true,
          help: "Documents scope, responsibilities, reporting framework, and limitations per ISA 210."
        },
        {
          key: "engagement_type",
          type: "select",
          label: "Engagement Type",
          options: ["New Acceptance","Continuation","Declination"],
          required: true,
          help: "Select appropriate action; ISA 300 emphasizes that planning and acceptance may need revisiting."
        },
        {
          key: "due_diligence_upload",
          type: "file",
          label: "Due Diligence Checklist (new client)",
          required: true,
          visibleIf: { engagement_type: ["New Acceptance"] },
          help: "Attach due diligence, including KYC/UBO/AML, for new client acceptance."
        },
        {
          key: "prior_year_review",
          type: "file",
          label: "Prior-year Reappointment Review",
          required: true,
          visibleIf: { engagement_type: ["Continuation"] },
          help: "Attach documentation of prior issues or changes when continuing client."
        },
        {
          key: "structure_change_notes",
          type: "textarea",
          label: "Changes in corporate structure or UBOs (describe or 'None')",
          required: true,
          visibleIf: { engagement_type: ["Continuation"] },
          help: "Document any changes since last engagement."
        },
        {
          key: "kyc_screening_completed",
          type: "checkbox",
          label: "KYC / UBO / PEP / Sanctions screening completed",
          required: true,
          help: "Confirm screening to mitigate ethical/regulatory risks."
        },
        {
          key: "follow_up_evidence",
          type: "file",
          label: "Follow-up due diligence evidence",
          required: true,
          visibleIf: { kyc_screening_completed: [false] },
          help: "Provide documentation if any screening flags were raised."
        },
        {
          key: "acceptance_decision_memo",
          type: "file",
          label: "Acceptance / Continuance Decision Memo",
          required: true,
          help: "Document decision rationale per ISA 210/ISQM 1."
        },
        {
          key: "independence_declarations",
          type: "table",
          label: "Independence Declarations",
          required: true,
          columns: ["Name","Role","Declaration Date","Exceptions"],
          help: "Record confirmations from all team members per ISA 220 (Revised)."
        },
        {
          key: "audit_fee_percent",
          type: "number",
          label: "Audit Fee as % of Firm Revenue",
          required: true,
          help: "Determine if fee dependency exceeds firm threshold (e.g., ≥15%)."
        },
        {
          key: "fee_dependency_actions",
          type: "multiselect",
          label: "Safeguards triggered by fee dependency",
          options: ["Partner rotation / Cooling-off","TCWG disclosure","EQR required","Disengagement plan"],
          required: true,
          visibleIf: { audit_fee_percent: [{ operator: ">=", value: 15 }] },
          help: "Select safeguards if dependency is high, especially for PIEs."
        },
        {
          key: "overdue_fees_present",
          type: "checkbox",
          label: "Significant overdue fees present (or treated as loan)?",
          required: true,
          help: "Overdue fees may pose a self-interest threat per IESBA Code."
        },
        {
          key: "overdue_fees_details",
          type: "textarea",
          label: "Details and mitigation for overdue fees",
          required: true,
          visibleIf: { overdue_fees_present: [true] },
          help: "Document steps taken to resolve or mitigate self-interest risk."
        },
        {
          key: "ethical_threat_types",
          type: "multiselect",
          label: "Threat types identified",
          options: ["Self-review","Familiarity","Advocacy","Intimidation","Self-interest","Other"],
          help: "ISA 220 (Revised) requires documentation of identified threats."
        },
        {
          key: "other_threats_detail",
          type: "textarea",
          label: "Describe other threat(s)",
          required: true,
          visibleIf: { ethical_threat_types: ["Other"] },
          help: "Provide details if 'Other' threats are selected."
        },
        {
          key: "safeguards_implemented",
          type: "textarea",
          label: "Safeguards applied to address threats",
          required: true,
          visibleIf: { ethical_threat_types: [{ operator: "any", value: ["Self-review","Familiarity","Advocacy","Intimidation","Self-interest","Other"] }] },
          help: "Document safeguards that reduce threats per ISA 220."
        },
        {
          key: "ethical_additional_checks",
          type: "group",
          label: "Additional Ethical Checks",
          required: true,
          help: "Check all that apply per IESBA Code.",
          fields: [
            { key: "long_tenure", type: "checkbox", label: "Long tenure beyond firm policy?" },
            { key: "client_relationships", type: "checkbox", label: "Staff have relationships/shareholdings/loans with client?" },
            { key: "management_functions", type: "checkbox", label: "Staff performing management functions for client?" },
            { key: "non_audit_services", type: "checkbox", label: "Providing non-audit services creating self-review threat?" }
          ]
        },
        {
          key: "ethical_issues_detail",
          type: "textarea",
          label: "Describe actions taken if any ethical issues flagged",
          required: true,
          visibleIf: {
            ethical_additional_checks: [{ operator: "any", value: ["long_tenure","client_relationships","management_functions","non_audit_services"] }]
          },
          help: "Explain mitigation if any ethical issues are flagged."
        },
        {
          key: "independence_register",
          type: "file",
          label: "Independence & Ethics Summary Register",
          required: true,
          help: "Upload register/documentation of independence compliance."
        },
        {
          key: "engagement_partner",
          type: "user",
          label: "Engagement Partner",
          required: true,
          help: "Select partner responsible for overall engagement quality."
        },
        {
          key: "eqr_required",
          type: "select",
          label: "Is Engagement Quality Reviewer (EQR) required?",
          options: ["No","Yes – mandated","Yes – risk-based"],
          required: true,
          help: "Include EQR if required by ISQM 1 or firm policy."
        },
        {
          key: "eqr_reviewer",
          type: "user",
          label: "Assigned EQR Reviewer",
          required: true,
          visibleIf: { eqr_required: ["Yes – mandated","Yes – risk-based"] },
          help: "Assign a reviewer if EQR is required."
        },
        {
          key: "supervision_schedule",
          type: "textarea",
          label: "Supervision gates / review schedule",
          required: true,
          help: "Plan key supervision points per ISA 220 (Revised)."
        },
        {
          key: "consultation_triggers",
          type: "multiselect",
          label: "Consultation triggers",
          options: ["Fraud","Going Concern","IT","Estimates","Complex Transactions","Legal","Group Consolidation","Other"],
          required: true,
          help: "Identify areas requiring consultation during planning."
        },
        {
          key: "other_trigger_details",
          type: "textarea",
          label: "Describe other triggers",
          required: true,
          visibleIf: { consultation_triggers: ["Other"] },
          help: "Provide detail if 'Other' is chosen."
        },
        {
          key: "eq_plan",
          type: "file",
          label: "Engagement Quality Plan (document)",
          required: true,
          help: "Upload plan evidencing partner's oversight and quality procedures."
        }
      ],
      footer: {
        type: "markdown",
        content: "**Documentation Reminder:** Under **ISA 230**, audit documentation must be sufficient for an experienced auditor to understand the procedures performed, evidence obtained, and conclusions reached—*oral explanations alone are insufficient.*"
      }
    },
    {
      sectionId:"understanding_entity_environment",
      title: "Section 2: Understanding the Entity & Its Environment",
      standards: ["ISA 315 (Revised 2019)"],
      fields: [
        {
          key: "industry_regulatory_factors",
          type: "textarea",
          label: "Industry, Regulatory, and External Factors",
          required: true,
          help: "Document industry trends, regulation, economic conditions, and external factors affecting the entity (ISA 315 ¶11(a))."
        },
        {
          key: "entity_nature_operations",
          type: "textarea",
          label: "Nature of the Entity (operations, structure, governance, financing, business model)",
          required: true,
          help: "Describe operations, governance, structure, financing, investments, and business model including IT integration (ISA 315 ¶11(b), Appendix 1)."
        },
        {
          key: "accounting_policies_changes",
          type: "textarea",
          label: "Accounting Policies and Changes",
          required: true,
          help: "Evaluate policies for appropriateness and consistency with framework; document reasons for any changes (ISA 315 ¶11(c))."
        },
        {
          key: "objectives_strategies_risks",
          type: "textarea",
          label: "Objectives, Strategies, and Related Business Risks",
          required: true,
          help: "Document entity’s objectives, strategies, and related risks that could cause misstatement (ISA 315 ¶11(d))."
        },
        {
          key: "performance_measurement",
          type: "textarea",
          label: "Measurement and Review of Financial Performance (internal & external)",
          required: true,
          help: "Describe how performance is measured internally and externally, and how pressure may create misstatement risk (ISA 315 ¶11(e), A74–A77)."
        },
        {
          key: "control_environment",
          type: "textarea",
          label: "Control Environment",
          required: true,
          help: "Assess tone at the top, ethics culture, governance oversight (ISA 315 ¶14, A77–A87)."
        },
        {
          key: "risk_assessment_process_entity",
          type: "textarea",
          label: "Entity’s Risk Assessment Process",
          required: true,
          help: "Describe how management identifies and responds to business risks relevant to financial reporting (ISA 315 ¶15–¶17)."
        },
        {
          key: "monitoring_controls",
          type: "textarea",
          label: "Monitoring of Controls",
          required: true,
          help: "Document how internal control is monitored and deficiencies are addressed, including any internal audit function (ISA 315 ¶22–¶24)."
        },
        {
          key: "information_system",
          type: "textarea",
          label: "Information System & Communication",
          required: true,
          help: "Describe transaction flows, IT and manual systems, reporting processes, journal entry controls (ISA 315 ¶18–¶19)."
        },
        {
          key: "control_activities",
          type: "textarea",
          label: "Control Activities Relevant to the Audit",
          required: true,
          help: "Identify significant controls addressing risks at assertion level (ISA 315 ¶20–¶21)."
        },
        {
          key: "it_controls_understanding",
          type: "textarea",
          label: "IT & General IT Controls Understanding",
          required: true,
          help: "Understand IT environment and general IT controls relevant to the audit (Appendix 5 & 6 of ISA 315 Revised)."
        },
        {
          key: "risk_assessment_discussion",
          type: "textarea",
          label: "Engagement Team Discussion – Susceptibility to Misstatement (including fraud)",
          required: true,
          help: "Document discussion among team about susceptibility to material misstatement and fraud (ISA 315 ¶10, A21–A24)."
        },
        {
          key: "identified_risks_and_assertions",
          type: "table",
          label: "Identified Risks of Material Misstatement (Financial Statement & Assertion Level)",
          required: true,
          columns: ["Risk Description","Level (FS / Assertion)","Assertion Affected","Inherent Risk Factors","Controls Related"],
          help: "List identified risks by level, related assertions, IRF tags, and relevant controls (ISA 315 ¶25, ¶26)."
        },
        {
          key: "significant_risk_flag",
          type: "checkbox",
          label: "Is this a Significant Risk?",
          required: true,
          help: "Tick if this risk requires special audit consideration (non-routine, estimation, fraud risk) per ISA 315 ¶32."
        },
        {
          key: "substantive_only_risk",
          type: "checkbox",
          label: "Does this risk require only substantive procedures? (Controls not reliable)",
          required: true,
          help: "Tick if substantive procedures alone are required (control risk high or controls absent) per ISA 315 ¶30."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 230 Reminder:** Document sources of understanding, risk assessment procedures, identified risks and controls, team discussions, and the rationale. Documentation must be sufficient for an experienced auditor to understand the work."
        }
      ]
    },
    {
      sectionId:"materiality_risk_summary",
      title: "Section 3: Materiality & Risk Summary",
      standards: ["ISA 320", "ISA 450", "ISA 600 (Group Audits)"],
      currency: "EUR",
      fields: [
        {
          key: "overall_materiality_amount",
          type: "number",
          label: "Overall Materiality (€)",
          required: true,
          help: "Threshold impacting users’ decisions (per ISA 320 ¶10–11)."
        },
        {
          key: "overall_materiality_basis",
          type: "textarea",
          label: "Benchmark & Rationale (e.g. 1 % of turnover)",
          required: true,
          help: "Explain rationale and benchmark used."
        },
        {
          key: "specific_materiality_table",
          type: "table",
          label: "Specific Materiality for Particular Items",
          required: false,
          columns: ["Item","Materiality (€)","Rationale"],
          help: "Lower thresholds for sensitive balances."
        },
        {
          key: "performance_materiality_amount",
          type: "number",
          label: "Performance Materiality (€)",
          required: true,
          help: "Lower threshold to control aggregation risk (ISA 320)."
        },
        {
          key: "performance_materiality_percent",
          type: "number",
          label: "Performance Materiality as % of Overall",
          required: true,
          help: "Typically 50 %–75 % based on risk assessment."
        },
        {
          key: "tolerable_misstatement_amount",
          type: "number",
          label: "Tolerable Misstatement (€)",
          required: false,
          help: "Used in sampling—generally at or below performance materiality."
        },
        {
          key: "clearly_trivial_threshold",
          type: "number",
          label: "Clearly Trivial Threshold (€)",
          required: true,
          help: "E.g., 5 % of performance materiality—used to accumulate misstatements."
        },
        {
          key: "tcwg_communicated",
          type: "checkbox",
          label: "TCWG informed of materiality thresholds",
          required: true,
          help: "ISA 320 requires communication of materiality basis to TCWG."
        },
        {
          key: "reassess_materiality",
          type: "checkbox",
          label: "Final materiality reassessed at conclusion?",
          required: true,
          help: "ISA 320 ¶12–13: reassess when new info emerges."
        },
        {
          key: "revised_materiality_amount",
          type: "number",
          label: "Revised Materiality (€)",
          required: false,
          visibleIf: { reassess_materiality: [true] },
          help: "Enter updated figure if materiality was changed."
        },
        {
          key: "group_materiality",
          type: "number",
          label: "Group Overall Materiality (€)",
          required: false,
          help: "Required for group audits under ISA 600."
        },
        {
          key: "component_materiality_table",
          type: "table",
          label: "Component Materiality (€)",
          required: false,
          columns: ["Component","Materiality (€)","Rationale"],
          help: "Set lower thresholds for components to address aggregation risk."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 230 Documentation Reminder:** Record all judgments, thresholds, rationales, revisions, and communications with TCWG."
        }
      ]
    },
    {
      sectionId:"risk_response_planning",
      title: "Section 4: Risk Register & Audit Response Planning",
      standards: ["ISA 330", "ISA 315 (Revised)"],
      fields: [
        {
          key: "risk_statement",
          type: "textarea",
          label: "Risk Statement (Assertion-level)",
          required: true,
          help: "Describe specific risk of material misstatement at assertion level."
        },
        {
          key: "risk_inherent_factor_tags",
          type: "multiselect",
          label: "Inherent Risk Factors",
          options: ["Complexity","Subjectivity","Uncertainty","Change","Bias/Fraud Susceptibility"],
          required: true,
          help: "Tag risk factors per ISA 315 revised."
        },
        {
          key: "controls_relied_on",
          type: "textarea",
          label: "Controls to be Tested",
          required: false,
          help: "List controls—only if you plan to rely on them (ISA 330)."
        },
        {
          key: "control_test_type",
          type: "select",
          label: "Type of Control Test",
          options: ["Design & Implementation","Operating Effectiveness"],
          required: false,
          visibleIf: { controls_relied_on: [{ operator: "not_empty" }] },
          help: "Select control test type (only if controls are relied on)."
        },
        {
          key: "substantive_procedures",
          type: "textarea",
          label: "Substantive Procedures Planned",
          required: true,
          help: "Describe tests of details or analytics planned in response to this risk."
        },
        {
          key: "nature_timing_extent_changes",
          type: "textarea",
          label: "Nature, Timing, and Extent Changes",
          required: true,
          help: "Document how the procedures change due to risk (ISA 330)."
        },
        {
          key: "unpredictability_elements",
          type: "textarea",
          label: "Unpredictability Elements",
          required: true,
          help: "Include unpredictable testing nature as a deterrent (ISA 330 A1)."
        },
        {
          key: "overall_response_actions",
          type: "textarea",
          label: "Overall Response Actions",
          required: true,
          help: "E.g. specialized staff, supervision increase, professional skepticism based on risk."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 330 Documentation Reminder:** Record the risk linkages, procedure rationale, and how responses address assessed risks at assertion level."
        }
      ]
    },
    {
      sectionId:"fraud_gc_planning",
      title: "Section 4: Fraud Risk & Going Concern Planning",
      standards: ["ISA 240 (Revised)","ISA 570 (Revised 2024)"],
      fields: [
        {
          key: "fraud_lens_discussion",
          type: "textarea",
          label: "Engagement Team Discussion – Fraud Lens",
          required: true,
          help: "Discuss where FS may be susceptible to fraud; ISA 240 (Revised) requires a heightened 'fraud lens'."
        },
        {
          key: "whistleblower_program_understanding",
          type: "textarea",
          label: "Understanding of Whistleblower Program",
          required: true,
          help: "ISA 240 (Revised) requires understanding of the entity's whistleblower procedures."
        },
        {
          key: "fraud_inquiries_mgmt_tcwg",
          type: "textarea",
          label: "Inquiries with Management / TCWG about Fraud",
          required: true,
          help: "Includes discussing risks of fraud and any past incidents with management or TCWG."
        },
        {
          key: "fraud_ka_matter_flag",
          type: "checkbox",
          label: "Fraud matter may be a Key Audit Matter (KAM)",
          required: true,
          help: "ISA 240 (Revised) emphasizes considering fraud risks when determining KAMs."
        },
        {
          key: "going_concern_assessment_period",
          type: "number",
          label: "Going Concern Assessment Period (months)",
          required: true,
          help: "ISA 570 (Revised 2024) requires evaluation over at least 12 months from FS approval."
        },
        {
          key: "mgmt_intent_ability_evidence",
          type: "textarea",
          label: "Management’s Intent & Ability – Evidence",
          required: true,
          help: "Assess and corroborate management's plans to address going concern assumptions."
        },
        {
          key: "gc_mgmt_relations_third_parties",
          type: "textarea",
          label: "Going Concern Support from Third Parties",
          required: false,
          help: "Document assurances or support (financial or otherwise) from third parties."
        },
        {
          key: "going_concern_opinion_section_needed",
          type: "select",
          label: "Auditor Report Section: Going Concern or MURGC",
          required: true,
          options: ["Going Concern – No material uncertainty","Material Uncertainty Related to Going Concern (MURGC)"],
          help: "ISA 570 (Revised) requires a dedicated report section in all cases."
        },
        {
          key: "gc_report_details",
          type: "textarea",
          label: "Report Text Details",
          required: true,
          help: "If no uncertainty: state that GC basis is appropriate, no doubt identified, basis of conclusion. If MURGC: include reference to disclosures, conclusion and opinion unaffected."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 230 Reminder:** Document fraud planning, inquiries, management’s going concern plans, and communications to support your judgments."
        }
      ]
    },
    {
      sectionId:"compliance_laws_regulations",
      title: "Section 4: Compliance with Laws & Regulations (ISA 250)",
      standards: ["ISA 250 (Revised)"],
      fields: [
        {
          key: "legal_reg_framework_understanding",
          type: "textarea",
          label: "Understanding of Legal & Regulatory Framework",
          required: true,
          help: "Describe laws/regulations affecting FS and how the entity ensures compliance (ISA 250 ¶13–17)."
        },
        {
          key: "compliance_procedures_specific",
          type: "textarea",
          label: "Procedures for Laws/Regs with Direct FS Effect",
          required: true,
          help: "E.g., checks for tax, pension, licensing compliance — obtain sufficient audit evidence (ISA 250 ¶13)."
        },
        {
          key: "procedures_for_other_regs",
          type: "textarea",
          label: "Procedures for Other Laws/Regs (Indirect FS Effect)",
          required: true,
          help: "E.g., inquiries, regulatory correspondence to identify non-compliance (ISA 250 ¶14)."
        },
        {
          key: "management_written_rep",
          type: "checkbox",
          label: "Management provided written representation on compliance",
          required: true,
          help: "Required: management confirms all known non-compliance disclosed (ISA 250 ¶16)."
        },
        {
          key: "non_compliance_flag",
          type: "checkbox",
          label: "Non-compliance identified or suspected?",
          required: true,
          help: "Indicate if a possible breach of laws or regulations was noted."
        },
        {
          key: "non_compliance_details",
          type: "textarea",
          label: "Details of Non-compliance and Actions",
          required: true,
          visibleIf: { non_compliance_flag: [true] },
          help: "Document nature, circumstances, management/TCWG discussions, legal advice (ISA 250 ¶18–20)."
        },
        {
          key: "notify_tcwg",
          type: "checkbox",
          label: "TCWG informed of non-compliance (if applicable)",
          required: false,
          visibleIf: { non_compliance_flag: [true] },
          help: "Communicate material or intentional non-compliance per ISA 250 ¶22."
        },
        {
          key: "consult_legal",
          type: "checkbox",
          label: "Legal advice obtained (if required)",
          required: false,
          visibleIf: { non_compliance_flag: [true] },
          help: "If management response is unsatisfactory and risk is material, seek legal advice (ISA 250 ¶19)."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 230 Reminder:** Document all compliance understanding, procedures, findings, communications, and legal consultations per audit documentation standards."
        }
      ]
    }
];
