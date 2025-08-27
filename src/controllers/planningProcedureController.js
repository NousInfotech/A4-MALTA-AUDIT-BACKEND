// controllers/planningProcedureController.js
const PlanningProcedure = require("../models/PlanningProcedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const WorkingPaper = require("../models/WorkingPaper");
const EngagementLibrary = require("../models/EngagementLibrary");
const planningSections = require("../static/planningSections");
const planningQuestionsPrompt = require("../static/planningQuestionsPrompt");
const planningAnswersPrompt = require("../static/planningAnswersPrompt");
const planningRecommendationsPrompt = require("../static/planningRecommendationsPrompt");
const { supabase } = require("../config/supabase");

const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");
const JSON5 = require("json5");
const stripJsonComments = require("strip-json-comments");

// ---------- OpenAI client (same pattern as fieldwork controller) ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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

async function callOpenAI(prompt, { maxTokens = 4000 } = {}) {
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert financial auditor. Follow the instructions exactly and provide structured output as requested." },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
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

// controllers/planningProcedureController.js (only the save handler)
exports.save = async (req, res) => {
  try {
    const { engagementId } = req.params;
    if (!engagementId) return res.status(400).json({ error: "Missing engagementId" });

    // Accept JSON or multipart(form-data) with "data" JSON
    const raw = req.body?.data ? JSON.parse(req.body.data) : (req.body || {});
    // Optional mapping of uploaded files to specific fields:
    // [{ sectionId, fieldKey, originalName }]   (stringified JSON in body.fileMap)
    const fileMap = (() => {
      try {
        if (typeof req.body?.fileMap === "string") return JSON.parse(req.body.fileMap);
        if (Array.isArray(req.body?.fileMap)) return req.body.fileMap;
      } catch {}
      return [];
    })();

    // --- normalize shape (works for manual / ai / hybrid)
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

    const payload = normalize(raw);

    // ---- base upsert
    let doc = await PlanningProcedure.findOneAndUpdate(
      { engagement: engagementId },
      {
        engagement: engagementId,
        procedureType: "planning",
        materiality: payload.materiality,
        selectedSections: payload.selectedSections,
        procedures: payload.procedures,
        recommendations: payload.recommendations || "",
        status: payload.status,
        mode: payload.mode,
        files: payload.files,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ---- upload any files posted (covers per-field uploads & the optional "Attach files" area)
    const uploaded = [];
    const files = req.files || [];
    for (const f of files) {
      const filePath = `${engagementId}/Planning/${f.originalname}`;
      const upload = async () =>
        supabase.storage.from("engagement-documents").upload(filePath, f.buffer, {
          contentType: f.mimetype,
          upsert: false,
          cacheControl: "0",
        });

      let { data, error } = await upload();
      if (error && String(error.message).toLowerCase().includes("exists")) {
        try { await supabase.storage.from("engagement-documents").remove([filePath]); } catch {}
        ({ data, error } = await upload());
      }
      if (error) throw error;

      const { data: pub } = supabase.storage.from("engagement-documents").getPublicUrl(data.path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const meta = { name: f.originalname, url, size: f.size, mimetype: f.mimetype };
      uploaded.push(meta);

      // Add to library
      await EngagementLibrary.create({
        engagement: engagementId,
        category: "Planning",
        url,
      });
    }

    // ---- write URLs back into field answers where appropriate
    if (uploaded.length) {
      // Quick lookup
      const byName = new Map(uploaded.map((u) => [u.name, u.url]));

      // If fileMap provided, use it first (exact section+field)
      if (Array.isArray(fileMap) && fileMap.length) {
        for (const m of fileMap) {
          const url = byName.get(m.originalName);
          if (!url) continue;
          const sec = (doc.procedures || []).find((s) => s.sectionId === m.sectionId || s.id === m.sectionId);
          if (!sec) continue;
          const fld = (sec.fields || []).find((ff) => ff.key === m.fieldKey);
          if (!fld) continue;
          // Set the answer to the uploaded URL
          fld.answer = url;
        }
      }

      // Fallback: if a field has type "file" and its current answer equals a filename we uploaded, replace with the URL
      for (const sec of doc.procedures || []) {
        for (const fld of sec.fields || []) {
          if (fld?.type === "file" && typeof fld.answer === "string" && byName.has(fld.answer)) {
            fld.answer = byName.get(fld.answer);
          }
        }
      }

      // Also keep a flat list of uploaded files on the doc
      doc.files = [...(doc.files || []), ...uploaded];
      await doc.save();
    }

    res.json(doc);
  } catch (e) {
    console.error("planning save error:", e);
    res.status(400).json({ error: e.message });
  }
};


// ---------- AI/Hybrid Step-1: generate questions + help ----------
exports.generateQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { mode = "ai", materiality = 0, selectedSections = [] } = req.body;

  if (!["ai", "hybrid"].includes(mode)) {
    return res.status(400).json({ message: "mode must be 'ai' or 'hybrid' for generate questions" });
  }

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  // assemble predefined sections (subset)
  const preset = selectedSections.map((sid) => planningSections[sid]).filter(Boolean);
  const prompt = String(planningQuestionsPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{mode}", mode)
    .replace("{materiality}", String(materiality))
    .replace("{predefinedSections}", JSON.stringify(preset, null, 2));

  const raw = await callOpenAI(prompt, { maxTokens: 6000 });
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_step1" });

  // normalize and strip answers if any leaked
  const procedures = (parsed?.procedures || []).map((sec, i) => ({
    id: sec.id || `sec-${i + 1}`,
    sectionId: sec.sectionId || selectedSections[i] || `custom_${i + 1}`,
    title: sec.title || "Planning Section",
    standards: Array.isArray(sec.standards) ? sec.standards : ["ISA 315 (Revised 2019)"],
    currency: sec.currency || "EUR",
    footer: sec.footer || "",
    fields: (sec.fields || []).map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      required: !!f.required,
      options: f.options || [],
      columns: f.columns || [],
      fields: f.fields || [],
      visibleIf: f.visibleIf || undefined,
      help: f.help || "",
      answer: undefined, // ensure no answers in step-1
    })),
  }));

  const doc = await PlanningProcedure.findOneAndUpdate(
    { engagement: engagementId },
    {
      engagement: engagementId,
      procedureType: "planning",
      mode,
      materiality,
      selectedSections,
      procedures,
      questionsGeneratedAt: new Date(),
      status: "in-progress",
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

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();

  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
  const etbRows = etb?.rows || [];

  const prompt = String(planningAnswersPrompt)
    .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
    .replace("{materiality}", String(doc.materiality || 0))
    .replace("{etbRows}", JSON.stringify(etbRows || []))
    .replace("{proceduresNoAnswers}", JSON.stringify(incomingProcedures || doc.procedures || []));

  const raw = await callOpenAI(prompt, { maxTokens: 7000 });
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "planning_step2" });

  const filled = (parsed?.procedures || []).map((sec) => ({
    ...sec,
    fields: (sec.fields || []).map((f) => ({
      ...f,
      // ensure answer exists and is type-compatible; if absent, keep undefined
      answer: Object.prototype.hasOwnProperty.call(f, "answer") ? f.answer : undefined,
    })),
  }));

  // Optional: derive concise answers for recommendations prompt
  const keyAnswers = filled.map((s) => ({
    section: s.title,
    answers: (s.fields || [])
      .slice(0, 6)
      .map((f) => `${f.label}: ${typeof f.answer === "object" ? JSON.stringify(f.answer) : String(f.answer ?? "")}`),
  }));

  // Recommendations (plain text)
  let recommendations = parsed?.recommendations || "";
  if (!recommendations) {
    const recPrompt = String(planningRecommendationsPrompt)
      .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
      .replace("{materiality}", String(doc.materiality || 0))
      .replace("{etbSummary}", JSON.stringify(etbRows.slice(0, 20)))
      .replace("{keyAnswers}", JSON.stringify(keyAnswers));
    const recRaw = await callOpenAI(recPrompt, { maxTokens: 1500 });
    recommendations = (recRaw || "").trim();
  }

  doc.procedures = filled;
  doc.recommendations = recommendations;
  doc.answersGeneratedAt = new Date();
  doc.status = "completed";
  await doc.save();

  res.json(doc);
};