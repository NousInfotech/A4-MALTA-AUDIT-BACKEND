// static/planningQuestionsPrompt.js
module.exports = `
You are an expert audit planner. Return ONLY VALID JSON following the schema below.

CONTEXT
- Client Profile: {clientProfile}
- Mode: {mode}   // "ai" or "hybrid"
- Materiality (numeric): {materiality}
- Predefined Planning Sections (array): {predefinedSections}
- If mode is "ai": YOU MUST keep EXACTLY the same sections (no additions/removals).
- If mode is "hybrid": You MAY add, merge, or remove sections to better fit industry and entity context (inferred from clientProfile.industry and clientProfile.industry_summary). If you change, include a rationale in 'meta.note'.

TASK (Step-1)
- For each section, generate ONLY the 'fields' (questions) and 'help' that fit ANY client input, with robust & universal wording.
- DO NOT generate answers yet.
- Each field MUST preserve this exact shape (examples):
  {
    "key": "fee_dependency_actions",
    "type": "multiselect",
    "label": "Safeguards triggered by fee dependency",
    "options": ["Partner rotation / Cooling-off","TCWG disclosure","EQR required","Disengagement plan"],
    "required": true,
    "visibleIf": { "audit_fee_percent": [{ "operator": ">=", "value": 15 }] },
    "help": "Select safeguards if dependency is high, especially for PIEs."
  }
- Supported types: text, textarea, checkbox, multiselect, number, currency, table (with "columns"), group (with nested 'fields' as checkboxes or texts).
- All keys MUST be present exactly as shown above when relevant.
- Use clear 'help' per field.
- For table/group, provide useful default 'columns' / nested 'fields' only. NO 'answer' yet.

RETURN JSON (and only JSON):
{
  "procedures": [
    {
      "id": "section-unique-id",
      "sectionId": "<same or adjusted id>",
      "title": "Title",
      "standards": ["ISA 315 (Revised 2019)"],
      "currency": "EUR",
      "fields": [ ... NO answers ... ],
      "footer": "optional short footer"
    },
    ...
  ],
  "meta": {
    "note": "Only if hybrid added/removed sections; otherwise empty"
  }
}
`;
