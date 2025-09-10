const PlanningProcedure = require("../models/PlanningProcedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const WorkingPaper = require("../models/WorkingPaper");
const EngagementLibrary = require("../models/EngagementLibrary");
const planningSections = require("../static/planningSections");
const planningQuestionsPrompt = require("../static/planningQuestionsPrompt");
const planningAnswersPrompt = require("../static/planningAnswersPrompt");
const planningRecommendationsPrompt = require("../static/planningRecommendationsPrompt");
const planningSectionQuestionsPrompt = require("../static/planningSectionQuestionsPrompt");
const planningSectionAnswersPrompt = require("../static/planningSectionAnswersPrompt");
const hybridQuestionsPrompt = require("../static/hybridQuestionsPrompt")
const hybridAnswersPrompt = require("../static/hybridAnswersPrompt")
const { supabase } = require("../config/supabase");
const hybridSectionQuestionsPrompt = require("../static/hybridSectionQuestionsPrompt");
const hybridSectionAnswersPrompt = require("../static/hybridSectionAnswersPrompt");
// Build a lookup map from the array export
const sectionsById = new Map(
  Array.isArray(planningSections)
    ? planningSections.map(s => [s.sectionId, s])
    : Object.values(planningSections || {}).map(s => [s.sectionId, s]) // safety if it ever changes shape
);
const normalize = (raw) => {
      const out = { ...raw };

      out.mode = ["manual", "ai", "hybrid"].includes(out.mode) ? out.mode : "manual";
      out.status = ["draft", "in-progress", "completed"].includes(out.status) ? out.status : "in-progress";

      out.selectedSections = Array.isArray(out.selectedSections) ? out.selectedSections : [];
      out.procedures = Array.isArray(out.procedures) ? out.procedures : [];

      out.procedures = out.procedures.map((sec) => ({
        id: sec?.id,
        sectionId: sec?.sectionId,
        title: sec?.title,
        standards: Array.isArray(sec?.standards) ? sec.standards : undefined,
        currency: sec?.currency,
        footer: sec?.footer ?? null, // can be string or object

        fields: Array.isArray(sec?.fields)
          ? sec.fields.map((f) => ({
              key: f?.key,
              type: f?.type,
              label: f?.label ?? "",
              required: !!f?.required,
              help: f?.help ?? "",
              options: Array.isArray(f?.options) ? f.options : undefined,
              columns: Array.isArray(f?.columns) ? f.columns : undefined,
              fields: f?.fields,          // Mixed
              content: f?.content ?? "",  // for markdown
              visibleIf: f?.visibleIf,    // Mixed
              answer: f?.answer,          // Mixed (can be filename, URL, etc.)
            }))
          : [],
      }));

      if (!Array.isArray(out.files)) out.files = [];
      return out;
    };
const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");
const JSON5 = require("json5");
async function loadStripJsonComments() {
  const stripJsonComments = (await import('strip-json-comments')).default;

  // Now you can use stripJsonComments
  const jsonString = '{"key": "value"}';  // Example JSON
  const cleanedJson = stripJsonComments(jsonString);
  console.log(cleanedJson);  // Should output cleaned JSON without comments
}

loadStripJsonComments();


// ---------- OpenAI client (same pattern as fieldwork controller) ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Helper function to remove spaces from file names
function sanitizeFileName(fileName) {
  return fileName.replace(/\s+/g, "_");
}

// ---------- Robust JSON parsing helper (same as your fieldwork) ----------
async function robustParseJSON(raw, client, { debugLabel = "" } = {}) {
  if (typeof raw !== "string") raw = String(raw ?? "");
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  const firstBrace = Math.min(...["{", "["].map((c) => (cleaned.indexOf(c) === -1 ? Number.MAX_SAFE_INTEGER : cleaned.indexOf(c))));
  if (firstBrace !== Number.MAX_SAFE_INTEGER) cleaned = cleaned.slice(firstBrace);

  cleaned = cleaned
    .replace(/\u00A0/g, " ")
    .replace(/[“"]/g, '"')
    .replace(/[‘']/g, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

  try { return JSON.parse(cleaned); } catch {}
  try { return JSON.parse(jsonrepair(cleaned)); } catch {}
  try { return JSON5.parse(cleaned); } catch {}
  try {
    const noComments = stripJsonComments(cleaned);
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(noTrailing);
  } catch {}

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a strict JSON fixer. Return ONLY valid JSON. No comments, no explanations." },
        { role: "user", content: `Fix this into valid JSON:\n\n${cleaned}` },
      ],
      temperature: 0,
    });
    let c = (response.choices?.[0]?.message?.content || "").trim();
    if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(c);
  } catch (err) {
    console.error(`[robustParseJSON:${debugLabel}] Failed to repair JSON`, err);
    throw new Error("Could not parse AI JSON output.");
  }
}

async function callOpenAI(prompt) {
    console.log("prompt "+prompt)
    const r = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert financial auditor. Follow the instructions exactly and provide structured output as requested." },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  });
  return r.choices[0].message.content;
}

// ---------- small helpers for Supabase URLs ----------
function extractStoragePathFromPublicUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const after = urlObj.pathname.split("/storage/v1/object/public/engagement-documents/")[1];
    return after ? decodeURIComponent(after) : null;
  } catch {
    return null;
  }
}
function getFileNameFromPublicUrl(url) {
  const path = extractStoragePathFromPublicUrl(url);
  if (!path) return null;
  const last = path.split("/").pop() || "";
  return last.split("?")[0];
}

// ---------- public endpoints ----------
exports.get = async (req, res) => {
  const { engagementId } = req.params;
  const doc = await PlanningProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Planning procedure not found" });
  res.json(doc);
};

exports.save = async (req, res) => {
  try {
    const { engagementId } = req.params;
    if (!engagementId) return res.status(400).json({ error: "Missing engagementId" });

    const raw = req.body?.data ? JSON.parse(req.body.data) : req.body || {};
    const fileMap = req.body?.fileMap ? JSON.parse(req.body.fileMap) : [];

    const payload = normalize(raw);

    // Fetch the document to update (don't overwrite the file field)
    let doc = await PlanningProcedure.findOne({ engagement: engagementId });

    // If document doesn't exist, create a new one
    if (!doc) {
      doc = new PlanningProcedure({
        engagement: engagementId,
        procedureType: "planning",
      });
    }

    // Save the rest of the fields (procedures, recommendations, etc.)
    doc.procedures = payload.procedures;
    doc.recommendations = payload.recommendations || "";
    doc.status = payload.status;
    doc.mode = payload.mode;

    // Handle file uploads
    const uploaded = [];
    const files = req.files || [];
    for (const f of files) {
      const sanitizedFileName = f.originalname.replace(/\s+/g, "_");
      const filePath = `${engagementId}/Planning/${sanitizedFileName}`;

      // Upload file to Cloudinary or Supabase storage
      const upload = async () =>
        supabase.storage.from("engagement-documents").upload(filePath, f.buffer, {
          contentType: f.mimetype,
          upsert: false,
          cacheControl: "0",
        });

      let { data, error } = await upload();
      if (error && String(error.message).toLowerCase().includes("exists")) {
        try {
          await supabase.storage.from("engagement-documents").remove([filePath]);
        } catch {}
        ({ data, error } = await upload());
      }
      if (error) throw error;

      const { data: pub } = supabase.storage.from("engagement-documents").getPublicUrl(data.path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const meta = { name: sanitizedFileName, url, size: f.size, mimetype: f.mimetype };
      uploaded.push(meta);

      await EngagementLibrary.create({
        engagement: engagementId,
        category: "Planning",
        url,
      });
    }

    // Add uploaded files to the procedure object
    if (uploaded.length) {
      const byName = new Map(uploaded.map((u) => [u.name, u.url]));

      // Update file links in procedure fields using fileMap
      for (const m of fileMap) {
        const url = byName.get(m.originalName);
        if (!url) continue;

        const sec = (doc.procedures || []).find((s) => s.sectionId === m.sectionId || s.id === m.sectionId);
        if (!sec) continue;

        const fld = (sec.fields || []).find((ff) => ff.key === m.fieldKey);
        if (!fld) continue;

        fld.answer = url; // Set the uploaded file URL in the field's answer
      }

      doc.files = [...(doc.files || []), ...uploaded]; // Preserve existing files and add new ones
    }

    // Save the document
    await doc.save();

    res.json(doc); // Return the saved document
  } catch (e) {
    console.error("Error saving planning procedure:", e);
    res.status(400).json({ error: e.message });
  }
};

// ---------- New endpoint: Generate questions for a specific section ----------
exports.generateSectionQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  // client profile
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  // ETB summary
  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = Array.isArray(etb?.rows) ? etb.rows : [];
  const summarizeETB = (rows, materialityNum) => {
    const top = [...rows]
      .sort((a,b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
      .slice(0, 20)
      .map(({ account, amount, type }) => ({ account, amount, type }));
    const material = top.filter(r => Math.abs(r.amount || 0) >= (Number(materialityNum) || 0) * 0.5);
    return { top, material, count: rows.length };
  };

  // Get section info
  const section = sectionsById.get(sectionId);
  if (!section) return res.status(404).json({ message: "Section not found" });

  // field palette (examples only; NOT actual fields)
  const fieldPalette = [
    { type: "text",       example: { key: "short_text", label: "Short input", required: false, help: "One-line text." } },
    { type: "textarea",   example: { key: "long_text",  label: "Describe...", required: true,  help: "Multi-line narrative." } },
    { type: "checkbox",   example: { key: "flag",       label: "Is applicable?", required: true, help: "True/false flag." } },
    { type: "select",     example: { key: "choice",     label: "Pick one", required: true, options: ["A","B","C"], help: "Choose best fit." } },
    { type: "multiselect",example: { key: "tags",       label: "Select all that apply", required: false, options: ["X","Y","Z"], help: "Multiple choices." } },
    { type: "number",     example: { key: "count",      label: "Quantity", required: false, min: 0, help: "Numeric value." } },
    { type: "currency",   example: { key: "amount",      label: "Amount (€)", required: false, min: 0, help: "Monetary input." } },
    { type: "user",       example: { key: "owner",      label: "Assignee", required: false, help: "Select staff user." } },
    { type: "date",       example: { key: "as_of",      label: "As of date", required: false, help: "Select a date." } }
  ];

  // build prompt
  const prompt = String(planningSectionQuestionsPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{materiality}", String(materiality))
    .replace("{etbRows}", JSON.stringify(summarizeETB(etbRows, materiality)))
    .replace("{section}", JSON.stringify({ sectionId: section.sectionId, title: section.title }))
    .replace("{fieldPalette}", JSON.stringify(fieldPalette));

  const raw = await callOpenAI(prompt);
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_section_questions" });

  // normalize & strip answers (defensive against leaks)
  const ALLOWED_TYPES = new Set(["text","textarea","checkbox","multiselect","number","currency","select","user","date"]);
  const sectionFields = (parsed?.fields || [])
    .filter(f => ALLOWED_TYPES.has(f?.type))
    .map((f) => ({
      key: String(f.key || "").trim(),
      type: f.type,
      label: String(f.label || "").trim(),
      required: !!f.required,
      help: String(f.help || "").trim(),
      options: Array.isArray(f.options) ? f.options.slice(0, 20) : undefined,
      visibleIf: f.visibleIf,
      min: typeof f.min === "number" ? f.min : undefined,
      max: typeof f.max === "number" ? f.max : undefined,
      placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
      answer: undefined
    }));

  // Update or create the procedure document
  let doc = await PlanningProcedure.findOne({ engagement: engagementId });
  if (!doc) {
    doc = new PlanningProcedure({
      engagement: engagementId,
      procedureType: "planning",
      mode: "ai",
      materiality,
      selectedSections: [sectionId],
      procedures: [],
      status: "in-progress",
    });
  }

  // Update the specific section
  const existingSectionIndex = doc.procedures.findIndex(s => s.sectionId === sectionId);
  if (existingSectionIndex >= 0) {
    doc.procedures[existingSectionIndex].fields = sectionFields;
  } else {
    doc.procedures.push({
      id: `sec-${doc.procedures.length + 1}`,
      sectionId: section.sectionId,
      title: section.title,
      standards: section.standards,
      currency: section.currency,
      fields: sectionFields,
      footer: section.footer || null
    });
  }

  doc.questionsGeneratedAt = new Date();
  await doc.save();

  res.json({ 
    sectionId: section.sectionId, 
    fields: sectionFields
  });
};

// ---------- New endpoint: Generate answers for a specific section ----------
exports.generateSectionAnswers = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId } = req.body;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const doc = await PlanningProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Planning procedure not found" });

  // Find the section to answer
  const sectionIndex = doc.procedures.findIndex(s => s.sectionId === sectionId);
  if (sectionIndex === -1) return res.status(404).json({ message: "Section not found in procedure" });

  const section = doc.procedures[sectionIndex];

  // --- client profile + ETB
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = etb?.rows || [];

  // Build prompt for this section
  const prompt = String(planningSectionAnswersPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{materiality}", String(doc.materiality || 0))
    .replace("{etbRows}", JSON.stringify(etbRows || []))
    .replace("{section}", JSON.stringify(section));

  const raw = await callOpenAI(prompt);
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_section_answers" });

  // In the generateSectionAnswers function, update the response handling:
if (parsed && parsed.sectionId === sectionId && Array.isArray(parsed.fields)) {
    const answeredFields = section.fields.map(field => {
      const answeredField = parsed.fields.find(f => f.key === field.key);
      return answeredField ? { ...field, answer: answeredField.answer } : field;
    });

    // NEW: Add section recommendations
    doc.procedures[sectionIndex].fields = answeredFields;
    doc.procedures[sectionIndex].sectionRecommendations = parsed.sectionRecommendations || "";
    
    await doc.save();

    res.json({ 
      sectionId, 
      fields: answeredFields,
      sectionRecommendations: parsed.sectionRecommendations || "" // NEW
    });
} else {
    res.status(500).json({ message: "Failed to generate answers for section" });
}
};

// ---------- Generate recommendations for all sections ----------
exports.generateRecommendations = async (req, res) => {
  const { engagementId } = req.params;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const doc = await PlanningProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Planning procedure not found" });

  // --- client profile + ETB
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = etb?.rows || [];

  // Prepare concise answers for your recommendations prompt
  const keyAnswers = doc.procedures.map((s) => ({
    section: s.title,
    answers: (s.fields || [])
      .slice(0, 6)
      .map((f) => `${f.label}: ${typeof f.answer === "object" ? JSON.stringify(f.answer) : String(f.answer ?? "")}`),
  }));

  const recPrompt = String(planningRecommendationsPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{materiality}", String(doc.materiality || 0))
    .replace("{etbSummary}", JSON.stringify(etbRows.slice(0, 20)))
    .replace("{keyAnswers}", JSON.stringify(keyAnswers));

  const recommendations = await callOpenAI(recPrompt);

  doc.recommendations = recommendations;
  doc.answersGeneratedAt = new Date();
  doc.status = "completed";
  await doc.save();

  res.json({ recommendations, procedures: doc.procedures });
};

exports.generateQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { mode = "ai", materiality = 0, selectedSections = [] } = req.body;

  if (!["ai", "hybrid"].includes(mode)) {
    return res.status(400).json({ message: "mode must be 'ai' or 'hybrid' for generate questions" });
  }

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  // client profile
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  // ETB summary
  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = Array.isArray(etb?.rows) ? etb.rows : [];
  const summarizeETB = (rows, materialityNum) => {
    const top = [...rows]
      .sort((a,b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
      .slice(0, 20)
      .map(({ account, amount, type }) => ({ account, amount, type }));
    const material = top.filter(r => Math.abs(r.amount || 0) >= (Number(materialityNum) || 0) * 0.5);
    return { top, material, count: rows.length };
  };

  // section names only
  const sectionNames = selectedSections.map((sid) => {
    const s = sectionsById.get(sid);
    return s ? { sectionId: s.sectionId, title: s.title } : { sectionId: sid, title: sid };
  });

  // field palette (examples only; NOT actual fields)
  const fieldPalette = [
    { type: "text",       example: { key: "short_text", label: "Short input", required: false, help: "One-line text." } },
    { type: "textarea",   example: { key: "long_text",  label: "Describe...", required: true,  help: "Multi-line narrative." } },
    { type: "checkbox",   example: { key: "flag",       label: "Is applicable?", required: true, help: "True/false flag." } },
    { type: "select",     example: { key: "choice",     label: "Pick one", required: true, options: ["A","B","C"], help: "Choose best fit." } },
    { type: "multiselect",example: { key: "tags",       label: "Select all that apply", required: false, options: ["X","Y","Z"], help: "Multiple choices." } },
    { type: "number",     example: { key: "count",      label: "Quantity", required: false, min: 0, help: "Numeric value." } },
    { type: "currency",   example: { key: "amount",      label: "Amount (€)", required: false, min: 0, help: "Monetary input." } },
    { type: "user",       example: { key: "owner",      label: "Assignee", required: false, help: "Select staff user." } },
    { type: "date",       example: { key: "as_of",      label: "As of date", required: false, help: "Select a date." } }
  ];

  // build prompt
  const prompt = String(planningQuestionsPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{mode}", mode)
    .replace("{materiality}", String(materiality))
    .replace("{sectionNames}", JSON.stringify(sectionNames))
    .replace("{fieldPalette}", JSON.stringify(fieldPalette))
    .replace("{etbRows}", JSON.stringify(summarizeETB(etbRows, materiality)));

  const raw = await callOpenAI(prompt);
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_step1_sections_only" });

  // normalize & strip answers (defensive against leaks)
  const ALLOWED_TYPES = new Set(["text","textarea","checkbox","multiselect","number","currency","select","user","date"]);
  const procedures = (parsed?.procedures || []).map((sec, i) => ({
    id: sec.id || `sec-${i + 1}`,
    sectionId: sec.sectionId || sectionNames[i]?.sectionId || `custom_${i + 1}`,
    title: sec.title || sectionNames[i]?.title || "Planning Section",
    standards: Array.isArray(sec.standards) && sec.standards.length ? sec.standards.slice(0, 2) : ["ISA 315 (Revised 2019)"],
    currency: sec.currency || "EUR",
    footer: typeof sec.footer === "string" ? sec.footer : "",
    fields: (sec.fields || [])
      .filter(f => ALLOWED_TYPES.has(f?.type))
      .map((f) => ({
        key: String(f.key || "").trim(),
        type: f.type,
        label: String(f.label || "").trim(),
        required: !!f.required,
        help: String(f.help || "").trim(),
        options: Array.isArray(f.options) ? f.options.slice(0, 20) : undefined,
        visibleIf: f.visibleIf,
        min: typeof f.min === "number" ? f.min : undefined,
        max: typeof f.max === "number" ? f.max : undefined,
        placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
        answer: undefined
      })),
  }));

  const metaNote = typeof parsed?.meta?.note === "string" ? parsed.meta.note : "";

  const doc = await PlanningProcedure.findOneAndUpdate(
    { engagement: engagementId },
    {
      engagement: engagementId,
      procedureType: "planning",
      mode,
      materiality,
      procedures,
      questionsGeneratedAt: new Date(),
      status: "in-progress",
      meta: { note: metaNote },
    },
    { upsert: true, new: true }
  );

  res.json(doc);
};


// ---------- AI/Hybrid Step-2: fill answers + recommendations ----------
exports.generateAnswers = async (req, res) => {
  const { engagementId } = req.params;
  const { procedures: incomingProcedures } = req.body;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const doc = await PlanningProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Planning procedure not found (run step-1 first)" });

  // --- source-of-truth procedures to be answered
  const baseProcedures = Array.isArray(incomingProcedures) && incomingProcedures.length
    ? incomingProcedures
    : (doc.procedures || []);

  // quick guard
  if (!baseProcedures.length) {
    return res.status(400).json({ message: "No procedures to answer." });
  }

  // --- client profile + ETB
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = etb?.rows || [];

  // ---------- helpers ----------
  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Limit concurrency to avoid rate limits; simple semaphore
  const runWithLimit = async (tasks, limit = 2) => {
    const results = new Array(tasks.length);
    let idx = 0;
    async function worker() {
      while (idx < tasks.length) {
        const current = idx++;
        try {
          results[current] = await tasks[current]();
        } catch (e) {
          results[current] = { error: e };
        }
      }
    }
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
  };

  // Retry with exponential backoff (jitter)
  const withRetry = async (fn, { retries = 2, baseMs = 600 } = {}) => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= retries) throw err;
        const wait = Math.round((baseMs * Math.pow(2, attempt)) * (0.75 + Math.random() * 0.5));
        await new Promise(r => setTimeout(r, wait));
        attempt++;
      }
    }
  };

  // Build one prompt for a subset and parse strictly
  const callForSubset = async (subset) => {
    const prompt = String(planningAnswersPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(doc.materiality || 0))
      .replace("{etbRows}", JSON.stringify(etbRows || []))
      .replace("{proceduresSubset}", JSON.stringify(subset || []));

    const raw = await callOpenAI(prompt); // smaller batch => fewer tokens
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_step2_batched" });

    // Normalize shape defensively
    const batch = Array.isArray(parsed?.procedures) ? parsed.procedures : [];
    return batch.map((sec) => ({
      ...sec,
      fields: (sec.fields || []).map((f) => ({
        ...f,
        answer: Object.prototype.hasOwnProperty.call(f, "answer") ? f.answer : undefined,
      })),
    }));
  };

  // ---------- batching plan ----------
  const BATCH_SIZE = 3;      // tune as you like (2–5 works well)
  const CONCURRENCY = 2;     // parallel LLM calls without slamming API
  const chunks = chunk(baseProcedures, BATCH_SIZE);

  // Create tasks for each chunk
  const tasks = chunks.map((subset, i) => async () =>
    withRetry(() => callForSubset(subset), { retries: 2, baseMs: 700 })
      .then((ans) => ({ index: i, answered: ans }))
  );

  // Execute with limited concurrency
  const results = await runWithLimit(tasks, CONCURRENCY);

  // ---------- merge answers back in original order ----------
  // Map by sectionId (preferred) or id as fallback
  const byKey = new Map(); // key -> filled section
  for (const r of results) {
    if (!r || r.error) continue; // tolerate partial failures
    for (const sec of r.answered || []) {
      const key = sec.sectionId || sec.id;
      if (key) byKey.set(key, sec);
    }
  }

  // Compose final "filled" array preserving the original order
  const filled = baseProcedures.map((orig) => {
    const key = orig.sectionId || orig.id;
    const replacement = key ? byKey.get(key) : undefined;
    if (!replacement) {
      // No answer returned for this section: keep original (no answers)
      return {
        ...orig,
        fields: (orig.fields || []).map((f) => ({ ...f, answer: f.answer ?? undefined })),
      };
    }
    // Ensure missing fields are preserved (model may drop some if it didn't change them)
    const byFieldKey = new Map((replacement.fields || []).map((f) => [f.key, f]));
    const mergedFields = (orig.fields || []).map((f) => {
      const repl = byFieldKey.get(f.key);
      return repl ? { ...f, ...repl } : { ...f, answer: f.answer ?? undefined };
    });
    return { ...orig, ...replacement, fields: mergedFields };
  });

  // ---------- Recommendations (single pass after merging) ----------
  // Prepare concise answers for your recommendations prompt
  const keyAnswers = filled.map((s) => ({
    section: s.title,
    answers: (s.fields || [])
      .slice(0, 6)
      .map((f) => `${f.label}: ${typeof f.answer === "object" ? JSON.stringify(f.answer) : String(f.answer ?? "")}`),
  }));

  // Try to use model-provided recommendations if any appeared in one of the batches.
  // Otherwise build them with your dedicated prompt.
  let recommendations = "";
  for (const r of results) {
    if (r && !r.error && r.answered) {
      // some models include a 'recommendations' sibling—handle if present
      const any = r.answered.find(x => typeof x?.recommendations === "string");
      if (any?.recommendations) { recommendations = any.recommendations; break; }
    }
  }
  if (!recommendations) {
    const recPrompt = String(planningRecommendationsPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(doc.materiality || 0))
      .replace("{etbSummary}", JSON.stringify(etbRows.slice(0, 20)))
      .replace("{keyAnswers}", JSON.stringify(keyAnswers))
      .replace("{sections}",JSON.stringify(planningSections));
    const recRaw = await callOpenAI(recPrompt);
    recommendations = (recRaw || "").trim();
  }

  // ---------- persist ----------
  doc.procedures = filled;
  doc.recommendations = recommendations;
  doc.answersGeneratedAt = new Date();
  doc.status = "completed";
  await doc.save();

  res.json(doc);
};

exports.generateHybridQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { mode = "hybrid", materiality = 0, selectedSections = [], existingProcedures = [] } = req.body;

  if (mode !== "hybrid") {
    return res.status(400).json({ message: "This endpoint is for hybrid mode only" });
  }

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // client profile
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();

    // ETB summary
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const etbRows = Array.isArray(etb?.rows) ? etb.rows : [];
    const summarizeETB = (rows, materialityNum) => {
      const top = [...rows]
        .sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
        .slice(0, 20)
        .map(({ account, amount, type }) => ({ account, amount, type }));
      const material = top.filter((r) => Math.abs(r.amount || 0) >= (Number(materialityNum) || 0) * 0.5);
      return { top, material, count: rows.length };
    };

    // Build enhanced prompt for hybrid mode - request only additional questions
    const prompt = String(hybridQuestionsPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(summarizeETB(etbRows, materiality)))
      .replace("{selectedSections}", JSON.stringify(selectedSections))
      .replace("{existingProcedures}", JSON.stringify(existingProcedures || []));

    const raw = await callOpenAI(prompt);
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "hybrid_additional_questions" });

    // Return only the additional fields, not the entire procedures
    res.json({
      additionalFields: parsed?.additionalFields || [],
      recommendations: parsed?.recommendations || ""
    });
  } catch (error) {
    console.error("Error generating hybrid additional questions:", error);
    res.status(500).json({ message: "Failed to generate additional questions", error: error.message });
  }
};

exports.generateHybridAnswers = async (req, res) => {
  const { engagementId } = req.params;
  const { procedures: incomingProcedures, materiality = 0 } = req.body;

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Use incoming procedures directly instead of fetching from database
    const baseProcedures = Array.isArray(incomingProcedures) && incomingProcedures.length ? incomingProcedures : [];

    if (!baseProcedures.length) {
      return res.status(400).json({ message: "No procedures to answer." });
    }

    // Get client profile and ETB
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();

    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const etbRows = etb?.rows || [];

    // Build prompt for hybrid answers with recommendations
    const prompt = String(hybridAnswersPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(etbRows || []))
      .replace("{proceduresSubset}", JSON.stringify(baseProcedures || []));

    const raw = await callOpenAI(prompt);
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "hybrid_answers_generation" });

    // Extract recommendations if provided
    const recommendations = parsed?.recommendations || "";

    // Merge answers back into procedures, excluding file fields
    const answeredProcedures = baseProcedures.map((origProc) => {
      const answeredProc = (parsed?.procedures || []).find(
        (p) => p.sectionId === origProc.sectionId || p.id === origProc.id,
      );

      if (!answeredProc) return origProc;

      const fieldsWithAnswers = (origProc.fields || []).map((origField) => {
        // Skip file fields - user must upload manually
        if (origField.type === "file") {
          return origField;
        }

        const answeredField = (answeredProc.fields || []).find((f) => f.key === origField.key);
        if (answeredField && answeredField.answer !== undefined) {
          return { ...origField, answer: answeredField.answer };
        }
        return origField;
      });

      return { ...origProc, fields: fieldsWithAnswers };
    });

    // Return the answered procedures and recommendations
    // Don't save to database here - let the frontend handle saving
    res.json({ 
      procedures: answeredProcedures, 
      recommendations: recommendations,
      answersGeneratedAt: new Date()
    });
  } catch (error) {
    console.error("Error generating hybrid answers:", error);
    res.status(500).json({ message: "Failed to generate hybrid answers", error: error.message });
  }
};

// Add these new endpoints to the existing controller

// ---------- Hybrid Section Questions ----------
exports.generateHybridSectionQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Get client profile
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();

    // Get ETB data
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const etbRows = etb?.rows || [];

    // Get section info
    const section = sectionsById.get(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });

    // Get existing procedures for context
    const doc = await PlanningProcedure.findOne({ engagement: engagementId });
    const existingProcedures = doc?.procedures || [];

    // Build prompt
    const prompt = 
      String(hybridSectionQuestionsPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(etbRows))
      .replace("{section}", JSON.stringify(section))
      .replace("{existingProcedures}", JSON.stringify(existingProcedures));

    const raw = await callOpenAI(prompt);
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "hybrid_section_questions" });

    res.json(parsed);
  } catch (error) {
    console.error("Error generating hybrid section questions:", error);
    res.status(500).json({ message: "Failed to generate section questions", error: error.message });
  }
};


// ---------- Hybrid Section Answers ----------
exports.generateHybridSectionAnswers = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0, sectionData } = req.body;

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Get client profile
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();

    // Get ETB data
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const etbRows = etb?.rows || [];

    // Get or create the procedure document
    let doc = await PlanningProcedure.findOne({ engagement: engagementId });
    
    // Use the section data sent from frontend or get predefined section
    const section = sectionData || getPredefinedSection(sectionId);
    
    if (!doc) {
      // Create a new procedure with the requested section
      doc = new PlanningProcedure({
        engagement: engagementId,
        procedureType: "planning",
        mode: "hybrid",
        procedures: [section],
        status: "in-progress"
      });
    } else {
      // Check if section already exists
      const sectionIndex = doc.procedures.findIndex(s => s.sectionId === sectionId);
      
      if (sectionIndex === -1) {
        // Add new section to existing procedures
        doc.procedures.push(section);
      } else {
        // Update existing section with new data (preserving any existing answers)
        const existingSection = doc.procedures[sectionIndex];
        
        // Merge fields - keep existing answers but update field definitions
        const mergedFields = section.fields.map(newField => {
          const existingField = existingSection.fields.find(f => f.key === newField.key);
          return existingField ? { ...newField, answer: existingField.answer } : newField;
        });
        
        doc.procedures[sectionIndex] = {
          ...section,
          fields: mergedFields
        };
      }
    }

    // Build prompt using the section data
    const prompt = String(hybridSectionAnswersPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(etbRows))
      .replace("{section}", JSON.stringify(section));

    const raw = await callOpenAI(prompt);
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "hybrid_section_answers" });

    // Update the section with answers (skip file fields)
    const answeredFields = section.fields.map(field => {
      // Skip file fields - user must upload manually
      if (field.type === "file") {
        return field;
      }
      
      const answeredField = parsed.fields.find(f => f.key === field.key);
      return answeredField ? { ...field, answer: answeredField.answer } : field;
    });

    // Update the section in procedures
    const sectionIndex = doc.procedures.findIndex(s => s.sectionId === sectionId);
    if (sectionIndex !== -1) {
      doc.procedures[sectionIndex].fields = answeredFields;
    }

    // Save the document
    await doc.save();

    // Return only the updated section fields, not the entire procedures array
    res.json({ 
      sectionId, 
      fields: answeredFields
    });
  } catch (error) {
    console.error("Error generating hybrid section answers:", error);
    res.status(500).json({ message: "Failed to generate section answers", error: error.message });
  }
};
function getPredefinedSection(sectionId) {
  const sections =
  {
    "engagement_setup_acceptance_independence": {
      title: "Section 1: Engagement Setup, Acceptance & Independence",
      standards: ["ISA 200", "ISA 210", "ISA 220 (Revised)", "ISQM 1", "IESBA Code"],
      fields: [
        {
          key: "reporting_framework",
          type: "select",
          label: "Reporting Framework",
          options: ["IFRS", "EU-IFRS", "Local GAAP", "GAPSME", "Other"],
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
          options: ["New Acceptance", "Continuation", "Declination"],
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
          columns: ["Name", "Role", "Declaration Date", "Exceptions"],
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
          options: ["Partner rotation / Cooling-off", "TCWG disclosure", "EQR required", "Disengagement plan"],
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
          options: ["Self-review", "Familiarity", "Advocacy", "Intimidation", "Self-interest", "Other"],
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
          visibleIf: { ethical_threat_types: [{ operator: "any", value: ["Self-review", "Familiarity", "Advocacy", "Intimidation", "Self-interest", "Other"] }] },
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
            ethical_additional_checks: [{ operator: "any", value: ["long_tenure", "client_relationships", "management_functions", "non_audit_services"] }]
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
          options: ["No", "Yes – mandated", "Yes – risk-based"],
          required: true,
          help: "Include EQR if required by ISQM 1 or firm policy."
        },
        {
          key: "eqr_reviewer",
          type: "user",
          label: "Assigned EQR Reviewer",
          required: true,
          visibleIf: { eqr_required: ["Yes – mandated", "Yes – risk-based"] },
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
          options: ["Fraud", "Going Concern", "IT", "Estimates", "Complex Transactions", "Legal", "Group Consolidation", "Other"],
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

    "understanding_entity_environment": {
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
          columns: ["Risk Description", "Level (FS / Assertion)", "Assertion Affected", "Inherent Risk Factors", "Controls Related"],
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

    "materiality_risk_summary": {
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
          columns: ["Item", "Materiality (€)", "Rationale"],
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
          columns: ["Component", "Materiality (€)", "Rationale"],
          help: "Set lower thresholds for components to address aggregation risk."
        },
        {
          key: "documentation_reminder",
          type: "markdown",
          content: "**ISA 230 Documentation Reminder:** Record all judgments, thresholds, rationales, revisions, and communications with TCWG."
        }
      ]
    },

    "risk_response_planning": {
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
          options: ["Complexity", "Subjectivity", "Uncertainty", "Change", "Bias/Fraud Susceptibility"],
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
          options: ["Design & Implementation", "Operating Effectiveness"],
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

    "fraud_gc_planning": {
      title: "Section 5: Fraud Risk & Going Concern Planning",
      standards: ["ISA 240 (Revised)", "ISA 570 (Revised 2024)"],
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
          options: ["Going Concern – No material uncertainty", "Material Uncertainty Related to Going Concern (MURGC)"],
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

    "compliance_laws_regulations": {
      title: "Section 6: Compliance with Laws & Regulations (ISA 250)",
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
  }

  return sections[sectionId] || { title: "Unknown Section", fields: [] }
}