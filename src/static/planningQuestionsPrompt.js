// static/planningQuestionsPrompt.js
module.exports = `
You are an expert audit planner.

OUTPUT RULES — READ CAREFULLY
- Return ONLY valid JSON. No prose. No code fences.
- Use ONLY these field types: text, textarea, checkbox, multiselect, number, currency, select, user, date.
- DO NOT use: group, table, file, markdown, or any custom types.
- Every field MUST include exactly these keys (when relevant):
  { "key", "type", "label", "required", "help", "options?", "visibleIf?", "min?", "max?", "placeholder?" }
- \`visibleIf\` supports:
  - equality on select/checkbox: { "some_key": ["Option A","Option B"] } or { "some_flag": [true] }
  - numeric operators: { "some_number_key": [{ "operator": ">=" | ">" | "<=" | "<" | "=", "value": <number> }] }
  - existence: { "some_key": [{ "operator": "not_empty" }] }
- Keys must be snake_case and unique per section.
- Labels must be short, human-readable questions.
- Help must be concrete and practical (1–2 sentences).
- \`options\` only for select/multiselect; options MUST be concise strings.
- No answers. This is Step-1 question generation only.
- DO NOT use the pilcrow (¶) symbol

CONTEXT
- Client Profile JSON: {clientProfile}
- Materiality (numeric): {materiality}
- ETB rows (array, summarized): {etbRows}
- Mode: {mode}  // "ai" or "hybrid"
- Sections (names only): {sectionNames}
- Allowed Field Palette (examples only, not actual fields): {fieldPalette}

GOAL
- For EACH section name, generate a LARGE but relevant set of questions (fields) that:
  - are broadly applicable to the section’s objective,
  - adapt to the industry/context implied by clientProfile and ETB,
  - scale with materiality (e.g., add more risk/threshold checks if materiality is low or balances are volatile),
  - remain framework-agnostic (ISA references implied, not cited).
- Prefer branching logic with \`visibleIf\` to keep forms readable.
- Use the field palette as style guidance ONLY (don’t copy keys; create new, unique keys).
- If Mode is "ai": keep the sections AS-IS (no add/remove/rename).
- If Mode is "hybrid": you MAY add or rename sections if it clearly improves relevance; include a reason in meta.note.

INDUSTRY/ETB HOOKS (use to shape questions and options)
- Detect sensitive accounts (e.g., revenue, cash, inventory, estimates) and add risk- and control-oriented prompts.
- If ETB indicates group/consolidation, related parties, or significant estimates, add targeted prompts.
- If clientProfile mentions regulated industries, include compliance/permits/licensing prompts (but do not create file uploads).
- Calibrate numeric thresholds in help text using materiality (e.g., “> 10% of performance materiality”).

OUTPUT JSON SCHEMA
{
  "procedures": [
    {
      "id": "sec-1",               // stable unique ID
      "sectionId": "engagement_setup_acceptance_independence", // same as input if mode=ai; else allowed to change in hybrid
      "title": "Section 1: Engagement Setup, Acceptance & Independence",
      "standards": ["ISA 315 (Revised 2019)"],   // keep short and generic
      "currency": "EUR",
      "fields": [
        {
          "key": "example_key",
          "type": "select",        // one of: text | textarea | checkbox | multiselect | number | currency | select | user | date
          "label": "Short question form",
          "required": true,
          "help": "1–2 sentences of practical guidance.",
          "options": ["A","B","C"],                // only for select/multiselect
          "visibleIf": { "some_other_key": ["A"]}, // optional
          "min": 0,                                 // optional for number/currency
          "max": 1000000,                           // optional for number/currency
          "placeholder": "Short hint"               // optional
        }
        // ... many more fields ...
      ],
      "footer": "optional very short reminder"
    }
    // ... more sections ...
  ],
  "meta": {
    "note": "" // If hybrid changed sections, explain briefly; else empty string
  }
}
   OUTPUT RULES — READ CAREFULLY
 ...
+- Titles must be auto-numbered sequentially by output order:
+  "Section 1: …", "Section 2: …", etc. Do not repeat a section number.
+- Do not copy any section number that might appear in input names.
+  Always compute numbering from the array order.
+- For each section:
+  - "id" must be "sec-{1-based-index}" (e.g., sec-1, sec-2, …).
+  - "title" must start with "Section {1-based-index}: " followed by a concise name.
+  - "sectionId" must equal the input selectedSections value for that position (since mode="ai").

`;
