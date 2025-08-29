const PlanningProcedure = require("../models/PlanningProcedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const WorkingPaper = require("../models/WorkingPaper");
const EngagementLibrary = require("../models/EngagementLibrary");
const planningSections = require("../static/planningSections");
const planningQuestionsPrompt = require("../static/planningQuestionsPrompt");
const planningAnswersPrompt = require("../static/planningAnswersPrompt");
const planningRecommendationsPrompt = require("../static/planningRecommendationsPrompt");
const hybridQuestionsPrompt = require("../static/hybridQuestionsPrompt")
const hybridAnswersPrompt = require("../static/hybridAnswersPrompt")
const { supabase } = require("../config/supabase");
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
      .replace("{keyAnswers}", JSON.stringify(keyAnswers));
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