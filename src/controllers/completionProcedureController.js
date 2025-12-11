// controllers/completionProcedureController.js
const CompletionProcedure = require("../models/CompletionProcedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const EngagementLibrary = require("../models/EngagementLibrary");
const PlanningProcedure = require("../models/PlanningProcedure");
const Procedure = require("../models/Procedure");
const completionSections = require("../static/completionSections");
const { supabase } = require("../config/supabase");

// Build a lookup map from the array export
const sectionsById = new Map(
  Array.isArray(completionSections)
    ? completionSections.map(s => [s.sectionId, s])
    : Object.values(completionSections || {}).map(s => [s.sectionId, s])
);

const normalize = (raw) => {
  const out = { ...raw };

  out.mode = ["manual", "ai", "hybrid"].includes(out.mode) ? out.mode : "manual";
  out.status = ["draft", "in-progress", "completed"].includes(out.status) ? out.status : "in-progress";

  out.selectedSections = Array.isArray(out.selectedSections) ? out.selectedSections : [];
  out.procedures = Array.isArray(out.procedures) ? out.procedures : [];

  // Enhanced procedures normalization
  out.procedures = out.procedures
    .filter(proc => proc && typeof proc === 'object')
    .map((sec) => ({
      id: sec?.id || `sec-${Date.now()}`,
      sectionId: sec?.sectionId,
      title: sec?.title || "Untitled Section",
      standards: Array.isArray(sec?.standards) ? sec.standards : undefined,
      currency: sec?.currency,
      footer: sec?.footer ?? null,
      fields: Array.isArray(sec?.fields)
        ? sec.fields
            .filter(f => f && typeof f === 'object')
            .map((f) => ({
              key: f?.key || `field_${Date.now()}`,
              type: f?.type || "text",
              label: String(f?.label || "").trim(),
              required: !!f?.required,
              help: String(f?.help || "").trim(),
              options: Array.isArray(f?.options) ? f.options : undefined,
              columns: Array.isArray(f?.columns) ? f.columns : undefined,
              fields: f?.fields,
              content: String(f?.content || "").trim(),
              visibleIf: f?.visibleIf,
              answer: f?.answer !== undefined ? f.answer : undefined,
            }))
        : [],
    }));

  // FIX: Ensure recommendations is always an array, never a string
  if (typeof out.recommendations === 'string') {
    out.recommendations = out.recommendations.trim()
      ? [{
        id: 'legacy-1',
        text: out.recommendations,
        checked: false,
        section: 'general'
      }]
      : [];
  } else if (!Array.isArray(out.recommendations)) {
    out.recommendations = [];
  }

  // FIX: Ensure recommendationsBySection is always an object, never a string
  if (typeof out.recommendationsBySection === 'string') {
    out.recommendationsBySection = {};
  } else if (!out.recommendationsBySection || typeof out.recommendationsBySection !== 'object') {
    out.recommendationsBySection = {};
  }

  if (!Array.isArray(out.files)) out.files = [];
  return out;
};

const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");
const JSON5 = require("json5");

let stripJsonComments;
async function loadStripJsonComments() {
  if (!stripJsonComments) {
    stripJsonComments = (await import('strip-json-comments')).default;
  }
}

loadStripJsonComments();

// ---------- OpenAI client ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to remove spaces from file names
function sanitizeFileName(fileName) {
  return fileName.replace(/\s+/g, "_");
}

// ---------- Robust JSON parsing helper ----------
async function robustParseJSON(raw, client, { debugLabel = "" } = {}) {
  const parseStart = Date.now();
  if (typeof raw !== "string") raw = String(raw ?? "");
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  const firstBrace = Math.min(...["{", "["].map((c) => (cleaned.indexOf(c) === -1 ? Number.MAX_SAFE_INTEGER : cleaned.indexOf(c))));
  if (firstBrace !== Number.MAX_SAFE_INTEGER) cleaned = cleaned.slice(firstBrace);

  cleaned = cleaned
    .replace(/\u00A0/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

  // Try strategy 1: Direct JSON.parse
  try {
    const result = JSON.parse(cleaned);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 1 (JSON.parse) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  // Try strategy 2: jsonrepair library
  try {
    const result = JSON.parse(jsonrepair(cleaned));
    console.log(`[robustParseJSON:${debugLabel}] Strategy 2 (jsonrepair) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  // Try strategy 3: JSON5 parser
  try {
    const result = JSON5.parse(cleaned);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 3 (JSON5) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  // Try strategy 4: Strip comments manually
  try {
    const noComments = stripJsonComments(cleaned);
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
    const result = JSON.parse(noTrailing);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 4 (strip comments) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  // Try strategy 5: Call gpt-4o-mini to fix
  console.log(`[robustParseJSON:${debugLabel}] All strategies failed, calling gpt-4o-mini to repair JSON...`);
  try {
    const repairStart = Date.now();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a strict JSON fixer. Return ONLY valid JSON. No comments, no explanations." },
        { role: "user", content: `Fix this into valid JSON:\n\n${cleaned}` },
      ],
      temperature: 0,
    });
    console.log(`[robustParseJSON:${debugLabel}] gpt-4o-mini repair call took ${Date.now() - repairStart}ms`);
    let c = (response.choices?.[0]?.message?.content || "").trim();
    if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const result = JSON.parse(c);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 5 (gpt-4o-mini repair) succeeded in ${Date.now() - parseStart}ms total`);
    return result;
  } catch (err) {
    console.error(`[robustParseJSON:${debugLabel}] Failed to repair JSON after ${Date.now() - parseStart}ms`, err);
    throw new Error("Could not parse AI JSON output.");
  }
}

async function callOpenAI(prompt, label = "default") {
  const apiStart = Date.now();
  console.log(`[callOpenAI:${label}] Starting API call with prompt length: ${prompt.length} chars`);

  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert financial auditor. Follow the instructions exactly and provide structured output as requested." },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  });

  const apiDuration = Date.now() - apiStart;
  const tokensUsed = r.usage?.total_tokens || 0;
  const promptTokens = r.usage?.prompt_tokens || 0;
  const completionTokens = r.usage?.completion_tokens || 0;

  console.log(`[callOpenAI:${label}] API call completed in ${apiDuration}ms`);
  console.log(`[callOpenAI:${label}] Tokens used - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${tokensUsed}`);
  console.log(`[callOpenAI:${label}] Response length: ${r.choices[0].message.content?.length || 0} chars`);

  return {
    content: r.choices[0].message.content,
    usage: r.usage,
    duration: apiDuration
  };
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

// ---------- Helper function to get prompts from database ----------
async function getPrompt(name) {
  try {
    const Prompt = require("../models/Prompt");
    const prompt = await Prompt.findOne({ name, isActive: true });
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    return prompt.content;
  } catch (error) {
    console.error(`Error loading prompt ${name}:`, error);
    throw error;
  }
}

// ---------- Helper function to build context ----------
async function buildContext(engagementId, selectedSections = []) {
  // Step 1: Get engagement first to extract clientId
  const engagement = await Engagement.findById(engagementId).lean().select('clientId');

  if (!engagement) {
    throw new Error("Engagement not found");
  }

  // Step 2: Execute all remaining queries in parallel for maximum performance
  const [
    clientProfileResult,
    etb,
    planningProcedure,
    fieldworkProcedure
  ] = await Promise.all([
    // Supabase client profile query
    (async () => {
      try {
        const { data, error: profileErr } = await supabase
          .from("profiles")
          .select("company_summary,industry")
          .eq("user_id", engagement.clientId)
          .single();

        if (profileErr) {
          console.warn("Supabase profiles fetch error:", profileErr.message);
          return null;
        }
        return data;
      } catch (err) {
        console.warn("Error fetching client profile:", err.message);
        return null;
      }
    })(),
    // MongoDB queries
    ExtendedTrialBalance.findOne({ engagement: engagementId }).lean().select('rows'),
    PlanningProcedure.findOne({ engagement: engagementId }).lean().select('materiality selectedSections procedures'),
    Procedure.findOne({ engagement: engagementId }).lean().select('framework selectedClassifications questions recommendations')
  ]);

  const clientProfile = clientProfileResult;

  const etbRows = etb?.rows || [];

  // Summarize ETB for context
  const summarizeETB = (rows, materialityNum) => {
    const top = [...rows]
      .sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
      .slice(0, 20)
      .map(({ account, amount, type }) => ({ account, amount, type }));
    const material = top.filter(r => Math.abs(r.amount || 0) >= (Number(materialityNum) || 0) * 0.5);
    return { top, material, count: rows.length };
  };

  return {
    clientProfile: clientProfile || null,
    etbRows: summarizeETB(etbRows, planningProcedure?.materiality || 0),
    planningProcedure: planningProcedure ? {
      materiality: planningProcedure.materiality,
      selectedSections: planningProcedure.selectedSections,
      procedures: planningProcedure.procedures?.map(p => ({
        sectionId: p.sectionId,
        title: p.title,
        keyAnswers: p.fields?.filter(f => f.answer).map(f => `${f.label}: ${f.answer}`)
      }))
    } : null,
    fieldworkProcedure: fieldworkProcedure ? {
      framework: fieldworkProcedure.framework,
      selectedClassifications: fieldworkProcedure.selectedClassifications,
      questions: fieldworkProcedure.questions?.length,
      recommendations: fieldworkProcedure.recommendations?.length
    } : null,
    selectedSections
  };
}

// ---------- public endpoints ----------
exports.get = async (req, res) => {
  const { engagementId } = req.params;
  const doc = await CompletionProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Completion procedure not found" });
  res.json(doc);
};

exports.save = async (req, res) => {
  try {
    const { engagementId } = req.params;
    if (!engagementId) return res.status(400).json({ error: "Missing engagementId" });

    const raw = req.body?.data ? JSON.parse(req.body.data) : req.body || {};
    const fileMap = req.body?.fileMap ? JSON.parse(req.body.fileMap) : [];

    const payload = normalize(raw);

    // Fetch the document to update
    let doc = await CompletionProcedure.findOne({ engagement: engagementId });

    // If document doesn't exist, create a new one
    if (!doc) {
      doc = new CompletionProcedure({
        engagement: engagementId,
        procedureType: "completion",
      });
    }

    // Save the rest of the fields (procedures, recommendations, etc.)
    doc.procedures = payload.procedures || [];

    // Persist per-section recommendations if provided. Frontend may supply either:
    // - payload.sectionRecommendations: { <sectionId>: [items] }
    // - payload.recommendationsBySection: same shape
    // Also preserve any sectionRecommendations included inside each procedure entry.
    const bySectionFromPayload =
      (payload.sectionRecommendations && typeof payload.sectionRecommendations === 'object')
        ? payload.sectionRecommendations
        : (payload.recommendationsBySection && typeof payload.recommendationsBySection === 'object')
          ? payload.recommendationsBySection
          : {};

    // Attach sectionRecommendations to each procedure in doc.procedures when available
    if (doc.procedures && Array.isArray(doc.procedures)) {
      doc.procedures = doc.procedures.map((sec) => {
        const sectionId = sec.sectionId || sec.id;
        const fromPayload = Array.isArray(sec.sectionRecommendations) && sec.sectionRecommendations.length
          ? sec.sectionRecommendations
          : Array.isArray(bySectionFromPayload?.[sectionId])
            ? bySectionFromPayload[sectionId]
            : [];

        return {
          ...sec,
          sectionRecommendations: fromPayload,
        };
      });
    }

    // Normalize recommendationsBySection and store on document
    let recommendationsBySection = {};
    if (payload.recommendationsBySection && typeof payload.recommendationsBySection === 'object') {
      recommendationsBySection = payload.recommendationsBySection;
    } else if (Object.keys(bySectionFromPayload || {}).length) {
      recommendationsBySection = bySectionFromPayload;
    } else {
      // If no by-section map provided, but procedures have sectionRecommendations, build map from them
      recommendationsBySection = {};
      (doc.procedures || []).forEach((sec) => {
        const sid = sec.sectionId || sec.id;
        if (Array.isArray(sec.sectionRecommendations) && sec.sectionRecommendations.length) {
          recommendationsBySection[sid] = sec.sectionRecommendations;
        }
      });
    }

    // Ensure it's an object (not a Map) for mongoose pre-validate
    doc.recommendationsBySection = recommendationsBySection;

    // Build flat recommendations array either from payload.recommendations or from recommendationsBySection
    if (Array.isArray(payload.recommendations)) {
      doc.recommendations = payload.recommendations;
    } else {
      // Flatten the by-section map into an array preserving item shape
      const flat = [];
      Object.keys(recommendationsBySection || {}).forEach((k) => {
        const arr = Array.isArray(recommendationsBySection[k]) ? recommendationsBySection[k] : [];
        arr.forEach((it) => {
          // ensure item has id/text/checked/section
          const item = {
            id: it.id || `${k}-${flat.length + 1}`,
            text: it.text || it || String(it),
            checked: typeof it.checked === 'boolean' ? it.checked : false,
            section: it.section || k,
          };
          flat.push(item);
        });
      });
      doc.recommendations = flat;
    }

    doc.status = payload.status;
    doc.mode = payload.mode;
    doc.materiality = payload.materiality;
    doc.selectedSections = payload.selectedSections;

    // Handle file uploads
    const uploaded = [];
    const files = req.files || [];
    for (const f of files) {
      const sanitizedFileName = f.originalname.replace(/\s+/g, "_");
      const filePath = `${engagementId}/Completion/${sanitizedFileName}`;

      // Upload file to Supabase storage
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
        } catch { }
        ({ data, error } = await upload());
      }
      if (error) throw error;

      const { data: pub } = supabase.storage.from("engagement-documents").getPublicUrl(data.path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const meta = { name: sanitizedFileName, url, size: f.size, mimetype: f.mimetype };
      uploaded.push(meta);

      await EngagementLibrary.create({
        engagement: engagementId,
        category: "Completion",
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

        fld.answer = url;
      }

      doc.files = [...(doc.files || []), ...uploaded];
    }

  // Save the document
  await doc.save();

  // Re-query to ensure we return the fully persisted, casted object
  const saved = await CompletionProcedure.findOne({ engagement: engagementId }).lean();
  console.log(`CompletionProcedure saved for engagement=${engagementId} id=${saved?._id}`);
  res.json(saved);
  } catch (e) {
    console.error("Error saving completion procedure:", e);
    res.status(400).json({ error: e.message });
  }
};

exports.generateSectionQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  // Start timing
  const startTime = Date.now();
  const timings = {};

  try {
    console.log(`[COMPLETION TIMING] Starting section questions generation for section: ${sectionId}`);

    // Step 1: Fetch engagement
    let stepStart = Date.now();
    const engagement = await Engagement.findById(engagementId);
    timings.fetchEngagement = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 1 - Fetch engagement: ${timings.fetchEngagement}ms`);

    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Step 2: Build context (includes client profile, ETB, planning, fieldwork)
    stepStart = Date.now();
    const context = await buildContext(engagementId, [sectionId]);
    timings.buildContext = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 2 - Build context: ${timings.buildContext}ms`);

    // Step 3: Get section info
    stepStart = Date.now();
    const section = sectionsById.get(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });
    timings.getSection = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 3 - Get section metadata: ${timings.getSection}ms`);

    // field palette (examples only; NOT actual fields)
    const fieldPalette = [
      { type: "text", example: { key: "short_text", label: "Short input", required: false, help: "One-line text." } },
      { type: "textarea", example: { key: "long_text", label: "Describe...", required: true, help: "Multi-line narrative." } },
      { type: "checkbox", example: { key: "flag", label: "Is applicable?", required: true, help: "True/false flag." } },
      { type: "select", example: { key: "choice", label: "Pick one", required: true, options: ["A", "B", "C"], help: "Choose best fit." } },
      { type: "multiselect", example: { key: "tags", label: "Select all that apply", required: false, options: ["X", "Y", "Z"], help: "Multiple choices." } },
      { type: "number", example: { key: "count", label: "Quantity", required: false, min: 0, help: "Numeric value." } },
      { type: "currency", example: { key: "amount", label: "Amount (€)", required: false, min: 0, help: "Monetary input." } },
      { type: "user", example: { key: "owner", label: "Assignee", required: false, help: "Select staff user." } },
      { type: "date", example: { key: "as_of", label: "As of date", required: false, help: "Select a date." } }
    ];

    // Step 4: Build base prompt from database
    stepStart = Date.now();
    const promptContent = await getPrompt("completionAiSectionQuestionsPrompt");
    timings.fetchPrompt = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 4 - Fetch prompt template from DB: ${timings.fetchPrompt}ms`);

    stepStart = Date.now();
    const basePrompt = String(promptContent)
      .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(context.etbRows))
      .replace("{section}", JSON.stringify({ sectionId: section.sectionId, title: section.title }))
      .replace("{fieldPalette}", JSON.stringify(fieldPalette))
      .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
      .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));
    timings.buildPrompt = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 5 - Build base prompt (${basePrompt.length} chars): ${timings.buildPrompt}ms`);

    // Step 6: Create 3 specialized prompts for parallel processing (HYBRID APPROACH)
    stepStart = Date.now();
    console.log(`[COMPLETION TIMING] Step 6 - Creating 3 parallel batch prompts...`);

    const batch1Prompt = String(basePrompt)
      + "\n\nFOCUS: Generate the FIRST 10-12 fields focusing on INITIAL COMPLETION steps, AUDIT WRAP-UP activities, and DOCUMENTATION requirements. Ensure unique field keys.";

    const batch2Prompt = String(basePrompt)
      + "\n\nFOCUS: Generate the MIDDLE 10-12 fields focusing on FINAL ANALYTICAL REVIEW, KEY RATIOS, and SIGNIFICANT VARIANCES analysis. Ensure unique field keys different from completion/wrap-up fields.";

    const batch3Prompt = String(basePrompt)
      + "\n\nFOCUS: Generate the LAST 8-10 fields focusing on CLIENT MEETINGS, POINTS FORWARD, REAPPOINTMENT considerations, and UNADJUSTED ERRORS summary. Ensure unique field keys.";

    timings.buildBatchPrompts = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 6 - Built 3 batch prompts: ${timings.buildBatchPrompts}ms`);

    // Step 7: Execute 3 parallel API calls
    stepStart = Date.now();
    console.log(`[COMPLETION TIMING] Step 7 - Executing 3 parallel OpenAI API calls...`);

    const [result1, result2, result3] = await Promise.all([
      callOpenAI(batch1Prompt, "batch-1-completion"),
      callOpenAI(batch2Prompt, "batch-2-analytics"),
      callOpenAI(batch3Prompt, "batch-3-followup")
    ]);

    timings.parallelOpenAICalls = Date.now() - stepStart;
    const totalTokens = (result1.usage?.total_tokens || 0) + (result2.usage?.total_tokens || 0) + (result3.usage?.total_tokens || 0);
    console.log(`[COMPLETION TIMING] Step 7 - All 3 parallel API calls completed in: ${timings.parallelOpenAICalls}ms`);
    console.log(`[COMPLETION TIMING] Step 7 - Total tokens used across batches: ${totalTokens}`);

    // Step 8: Parse all 3 responses in parallel
    stepStart = Date.now();
    console.log(`[COMPLETION TIMING] Step 8 - Parsing 3 JSON responses in parallel...`);

    const [parsed1, parsed2, parsed3] = await Promise.all([
      robustParseJSON(result1.content, openai, { debugLabel: "completion-batch-1" }),
      robustParseJSON(result2.content, openai, { debugLabel: "completion-batch-2" }),
      robustParseJSON(result3.content, openai, { debugLabel: "completion-batch-3" })
    ]);

    timings.parseJSON = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 8 - All 3 JSON responses parsed in: ${timings.parseJSON}ms`);

    // Step 9: Merge and deduplicate fields from all 3 batches
    stepStart = Date.now();
    const mergedFields = [
      ...(parsed1?.fields || []),
      ...(parsed2?.fields || []),
      ...(parsed3?.fields || [])
    ];

    // Deduplicate by key (keep first occurrence)
    const seenKeys = new Set();
    const deduplicatedFields = mergedFields.filter(f => {
      if (seenKeys.has(f?.key)) {
        console.log(`[COMPLETION TIMING] Step 9 - Removing duplicate field: ${f?.key}`);
        return false;
      }
      seenKeys.add(f?.key);
      return true;
    });

    console.log(`[COMPLETION TIMING] Step 9 - Merged ${mergedFields.length} fields, deduplicated to ${deduplicatedFields.length} fields`);
    timings.mergeAndDeduplicate = Date.now() - stepStart;

    // Step 10: Normalize & validate fields
    stepStart = Date.now();
    const ALLOWED_TYPES = new Set(["text", "textarea", "checkbox", "multiselect", "number", "currency", "select", "user", "date"]);

    const sectionFields = deduplicatedFields
      .filter(f => f && typeof f === 'object' && ALLOWED_TYPES.has(f?.type))
      .map((f) => {
        const field = {
          key: String(f.key || `field_${Date.now()}_${Math.random()}`).trim(),
          type: f.type,
          label: String(f.label || "Untitled Field").trim(),
          required: !!f.required,
          help: String(f.help || "").trim(),
          answer: undefined
        };

        // Only add optional properties if they exist
        if (Array.isArray(f.options)) {
          field.options = f.options.slice(0, 20);
        }
        if (f.visibleIf && typeof f.visibleIf === 'object') {
          field.visibleIf = f.visibleIf;
        }
        if (typeof f.min === "number") {
          field.min = f.min;
        }
        if (typeof f.max === "number") {
          field.max = f.max;
        }
        if (typeof f.placeholder === "string") {
          field.placeholder = f.placeholder;
        }

        return field;
      })
      .filter(field => field.key && field.type && field.label);

    timings.normalizeFields = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 10 - Normalize & validate fields (${sectionFields.length} fields): ${timings.normalizeFields}ms`);

    // Step 11: Fetch or create procedure document
    stepStart = Date.now();
    let doc = await CompletionProcedure.findOne({ engagement: engagementId });
    timings.fetchProcedureDoc = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 11 - Fetch procedure document: ${timings.fetchProcedureDoc}ms`);

    // Step 12: Prepare document structure
    stepStart = Date.now();
    if (!doc) {
      doc = new CompletionProcedure({
        engagement: engagementId,
        procedureType: "completion",
        mode: "ai",
        materiality,
        selectedSections: [sectionId],
        procedures: [],
        status: "in-progress",
      });
    }

    // Ensure procedures is always an array of valid objects
    if (!Array.isArray(doc.procedures)) {
      doc.procedures = [];
    }

    // Clean existing procedures to remove any invalid entries
    doc.procedures = doc.procedures
      .filter(proc => proc && typeof proc === 'object')
      .map(proc => ({
        id: proc?.id || `sec-${Date.now()}`,
        sectionId: proc?.sectionId,
        title: proc?.title || "Untitled Section",
        standards: Array.isArray(proc?.standards) ? proc.standards : undefined,
        currency: proc?.currency,
        footer: proc?.footer ?? null,
        fields: Array.isArray(proc?.fields) 
          ? proc.fields.filter(f => f && typeof f === 'object')
          : []
      }));

    // Update the specific section
    const existingSectionIndex = doc.procedures.findIndex(s => s && s.sectionId === sectionId);
    
    const sectionData = {
      id: `sec-${doc.procedures.length + 1}`,
      sectionId: section.sectionId,
      title: section.title,
      standards: section.standards,
      currency: section.currency,
      fields: sectionFields,
      footer: section.footer || null
    };

    if (existingSectionIndex >= 0) {
      doc.procedures[existingSectionIndex] = sectionData;
    } else {
      doc.procedures.push(sectionData);
    }

    doc.questionsGeneratedAt = new Date();
    timings.prepareDocument = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 12 - Prepare document structure: ${timings.prepareDocument}ms`);

    // Step 13: Validate document
    stepStart = Date.now();
    try {
      await doc.validate();
      timings.validateDocument = Date.now() - stepStart;
      console.log(`[COMPLETION TIMING] Step 13 - Validate document: ${timings.validateDocument}ms`);
    } catch (validationError) {
      timings.validateDocument = Date.now() - stepStart;
      console.error(`[COMPLETION TIMING] Step 13 - Document validation failed: ${timings.validateDocument}ms`);
      console.error('Document validation failed:', validationError);
      throw new Error(`Document validation failed: ${validationError.message}`);
    }

    // Step 14: Save to MongoDB
    stepStart = Date.now();
    await doc.save();
    timings.saveDocument = Date.now() - stepStart;
    console.log(`[COMPLETION TIMING] Step 14 - Save document to MongoDB: ${timings.saveDocument}ms`);

    // Calculate total time
    timings.totalTime = Date.now() - startTime;
    console.log(`[COMPLETION TIMING] ===== TOTAL TIME: ${timings.totalTime}ms =====`);
    console.log(`[COMPLETION TIMING] Summary:`, JSON.stringify(timings, null, 2));

    res.json({
      sectionId: section.sectionId,
      fields: sectionFields,
      _timings: timings
    });

  } catch (e) {
    const totalTime = Date.now() - startTime;
    console.error(`[COMPLETION TIMING] Error occurred after ${totalTime}ms`);
    console.error("Error generating section questions:", e);
    
    // Extract error message - check for quota errors and other specific errors
    let errorMessage = e.message || "Failed to generate questions";
    let statusCode = 400;
    
    // Check for quota exceeded error
    if (e.message && (e.message.includes("429") || e.message.includes("quota") || e.message.includes("insufficient_quota"))) {
      errorMessage = "OpenAI API quota exceeded. Please check your OpenAI account billing and quota limits.";
      statusCode = 429;
    } else if (e.status === 429 || (e.response && e.response.status === 429)) {
      errorMessage = "OpenAI API quota exceeded. Please check your OpenAI account billing and quota limits.";
      statusCode = 429;
    }
    
    res.status(statusCode).json({ error: errorMessage, message: errorMessage });
  }
};

// ---------- Generate answers for a specific section ----------
exports.generateSectionAnswers = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId } = req.body;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const doc = await CompletionProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Completion procedure not found" });

  // Find the section to answer
  const sectionIndex = doc.procedures.findIndex(s => s.sectionId === sectionId);
  if (sectionIndex === -1) return res.status(404).json({ message: "Section not found in procedure" });

  const section = doc.procedures[sectionIndex];

  // Build context including planning and fieldwork procedures
  const context = await buildContext(engagementId, [sectionId]);

  // Build prompt from database
  const promptContent = await getPrompt("completionAiSectionAnswersPrompt");
  const prompt = String(promptContent)
    .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
    .replace("{materiality}", String(doc.materiality || 0))
    .replace("{etbRows}", JSON.stringify(context.etbRows))
    .replace("{section}", JSON.stringify(section))
    .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
    .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));

  const result = await callOpenAI(prompt, "section-answers");
  const parsed = await robustParseJSON(result.content, openai, { debugLabel: "completion_section_answers" });

  // Normalize AI output: accept arrays, objects, or missing wrapper
  let parsedFieldsRaw = [];
  try {
    if (Array.isArray(parsed)) {
      parsedFieldsRaw = parsed;
    } else if (parsed && Array.isArray(parsed.fields)) {
      parsedFieldsRaw = parsed.fields;
    } else if (parsed && parsed.fields && typeof parsed.fields === 'object') {
      // fields might be an object mapping keys to answers
      parsedFieldsRaw = Object.entries(parsed.fields).map(([k, v]) => ({ key: k, answer: v }));
    } else if (parsed && typeof parsed === 'object' && Object.keys(parsed).length && !parsed.fields) {
      // Sometimes AI returns a flat map of key->answer
      const possible = Object.entries(parsed).filter(([k, v]) => typeof k === 'string' && (typeof v === 'string' || typeof v === 'number' || Array.isArray(v) || (v && typeof v === 'object')));
      // Heuristic: if many keys look like field keys and no wrapper, use it
      if (possible.length > 0 && !parsed.sectionId) {
        parsedFieldsRaw = possible.map(([k, v]) => ({ key: k, answer: v }));
      }
    }
  } catch (err) {
    console.warn('Could not normalize parsed.fields', err);
  }

  // Normalize each field item to { key, answer }
  const parsedFields = (parsedFieldsRaw || [])
    .filter(f => f && typeof f === 'object')
    .map((f) => {
      const docf = f._doc || f;
      const key = String(docf.key || docf.name || docf.id || "").trim();
      // Try several places for the answer
      const answer = docf.answer !== undefined
        ? docf.answer
        : (docf.value !== undefined ? docf.value : (docf.content !== undefined ? docf.content : undefined));
      return { key, answer };
    })
    .filter(f => f.key);

  // If AI provided sectionId but it doesn't match, log a warning and continue using requested sectionId
  if (parsed && parsed.sectionId && parsed.sectionId !== sectionId) {
    console.warn(`AI returned sectionId=${parsed.sectionId} but request was for ${sectionId}; proceeding with requested id.`);
  }

  if (parsedFields.length > 0) {
    const answeredFields = section.fields.map(field => {
      const answeredField = parsedFields.find(f => f.key === field.key);
      return answeredField ? { ...field, answer: answeredField.answer } : field;
    });

    // Handle section recommendations (accept multiple keys)
    const sectionRecommendations = Array.isArray(parsed.sectionRecommendations)
      ? parsed.sectionRecommendations
      : Array.isArray(parsed.section_recommendations)
        ? parsed.section_recommendations
        : Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [];

    doc.procedures[sectionIndex].fields = answeredFields;
    doc.procedures[sectionIndex].sectionRecommendations = sectionRecommendations;

    // Add section recommendations to the main recommendations array with section attribute
    if (sectionRecommendations.length > 0) {
      if (!Array.isArray(doc.recommendations)) {
        doc.recommendations = [];
      }

      const recommendationsWithSection = sectionRecommendations.map((rec, index) => ({
        ...rec,
        section: section.title || sectionId,
        id: `${sectionId}-${index + 1}`
      }));

      doc.recommendations.push(...recommendationsWithSection);
    }

    await doc.save();

    res.json({
      sectionId,
      fields: answeredFields,
      sectionRecommendations: sectionRecommendations
    });
  } else {
    // No parsable fields found in AI output
    console.error('AI output did not contain parsable fields for section', { engagementId, sectionId, parsed });
    res.status(500).json({ message: "Failed to generate answers for section" });
  }
};

// ---------- Generate recommendations ----------
exports.generateRecommendations = async (req, res) => {
  const { engagementId } = req.params;

  const engagement = await Engagement.findById(engagementId);
  if (!engagement) return res.status(404).json({ message: "Engagement not found" });

  const doc = await CompletionProcedure.findOne({ engagement: engagementId });
  if (!doc) return res.status(404).json({ message: "Completion procedure not found" });

  // Build context including planning and fieldwork procedures
  const context = await buildContext(engagementId, doc.selectedSections);

  // Prepare concise answers for your recommendations prompt
  const keyAnswers = doc.procedures.map((s) => ({
    section: s.title,
    answers: (s.fields || [])
      .slice(0, 6)
      .map((f) => `${f.label}: ${typeof f.answer === "object" ? JSON.stringify(f.answer) : String(f.answer ?? "")}`),
  }));

  const promptContent = await getPrompt("completionRecommendationsPrompt");
  const recPrompt = String(promptContent)
    .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
    .replace("{materiality}", String(doc.materiality || 0))
    .replace("{etbSummary}", JSON.stringify(context.etbRows))
    .replace("{keyAnswers}", JSON.stringify(keyAnswers))
    .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
    .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));

  console.log(recPrompt, " rec");
  const recommendationsResult = await callOpenAI(recPrompt, "recommendations");
  const recommendations = await robustParseJSON(recommendationsResult.content, openai, { debugLabel: "completion_recommendations" });

  // Process the sectioned recommendations into flat array and by-section map
  let allRecommendations = [];
  let recommendationsBySection = {};

  // Canonical section ids in the expected order
  const canonicalSections = [
    'initial_completion',
    'audit_highlights_report',
    'final_analytical_review',
    'points_forward_next_year',
    'final_client_meeting_notes',
    'summary_unadjusted_errors',
    'reappointment_schedule'
  ];

  function mapSectionKeyToCanonical(key, idx) {
    if (!key || typeof key !== 'string') return canonicalSections[idx] || key;
    const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    // match section1..section7
    const m = k.match(/section(\d)/i);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (n >= 1 && n <= canonicalSections.length) return canonicalSections[n - 1];
    }
    // heuristics by keywords
    if (k.includes('initial')) return 'initial_completion';
    if (k.includes('highlight') || k.includes('audit')) return 'audit_highlights_report';
    if (k.includes('analytical') || k.includes('ratio')) return 'final_analytical_review';
    if (k.includes('points') || k.includes('forward')) return 'points_forward_next_year';
    if (k.includes('client') || k.includes('meeting')) return 'final_client_meeting_notes';
    if (k.includes('unadjust') || k.includes('error')) return 'summary_unadjusted_errors';
    if (k.includes('reappoint') || k.includes('reappointment')) return 'reappointment_schedule';
    // fallback to positional mapping if possible
    if (idx >= 0 && idx < canonicalSections.length) return canonicalSections[idx];
    return key;
  }

  if (recommendations && typeof recommendations === 'object') {
    const entries = Object.entries(recommendations);
    entries.forEach(([sectionKey, sectionRecs], idx) => {
      const canonicalKey = mapSectionKeyToCanonical(String(sectionKey), idx);

      // Normalize sectionRecs to an array of objects with text/checked
      const normalized = Array.isArray(sectionRecs)
        ? sectionRecs.map((rec) => {
            if (!rec) return null;
            if (typeof rec === 'string') return { text: rec.trim(), checked: false };
            if (typeof rec === 'object') {
              // prefer text property, else try other properties
              const text = rec.text || rec.title || rec.description || rec.name || (typeof rec === 'string' ? rec : undefined);
              const checked = typeof rec.checked === 'boolean' ? rec.checked : false;
              return { ...rec, text: text ? String(text) : '', checked };
            }
            return null;
          }).filter(Boolean)
        : [];

      // attach canonical section id on each rec
      const withSection = normalized.map((rec) => ({ ...rec, section: canonicalKey }));

      if (withSection.length > 0) {
        recommendationsBySection[canonicalKey] = withSection;
        allRecommendations.push(...withSection);
      }
    });
  }

  // Reassign stable IDs for all recommendations
  allRecommendations = allRecommendations.map((recommendation, index) => ({
    id: recommendation.id ? String(recommendation.id) : `${index + 1}`,
    text: recommendation.text || '',
    checked: !!recommendation.checked,
    section: recommendation.section || 'general',
  }));

  doc.recommendations = allRecommendations;
  doc.recommendationsBySection = recommendationsBySection;
  doc.answersGeneratedAt = new Date();
  doc.status = "completed";
  await doc.save();

  console.log(recommendations, " recommendations");

  res.json({
    recommendations: allRecommendations,
    recommendationsBySection: recommendationsBySection,
    procedures: doc.procedures
  });
};

// ---------- Hybrid Section Questions ----------
exports.generateHybridSectionQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Build context including planning and fieldwork procedures
    const context = await buildContext(engagementId, [sectionId]);

    // Get section info
    const section = sectionsById.get(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });

    // Get existing procedures for context
    const doc = await CompletionProcedure.findOne({ engagement: engagementId });
    const existingProcedures = doc?.procedures || [];

    // Build prompt from database
    const promptContent = await getPrompt("completionHybridSectionQuestionsPrompt");
    const prompt = String(promptContent)
      .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(context.etbRows))
      .replace("{section}", JSON.stringify(section))
      .replace("{existingProcedures}", JSON.stringify(existingProcedures))
      .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
      .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));

    const result = await callOpenAI(prompt, "hybrid-section-questions");
    const parsed = await robustParseJSON(result.content, openai, { debugLabel: "hybrid_section_questions" });

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

    // Build context including planning and fieldwork procedures
    const context = await buildContext(engagementId, [sectionId]);

    // Get or create the procedure document
    let doc = await CompletionProcedure.findOne({ engagement: engagementId });

    // Use the section data sent from frontend or get predefined section
    const section = sectionData || getPredefinedSection(sectionId);

    if (!doc) {
      // Create a new procedure with the requested section
      doc = new CompletionProcedure({
        engagement: engagementId,
        procedureType: "completion",
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

    // Build prompt from database
    const promptContent = await getPrompt("completionHybridSectionAnswersPrompt");
    const prompt = String(promptContent)
      .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(context.etbRows))
      .replace("{section}", JSON.stringify(section))
      .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
      .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));

    const result = await callOpenAI(prompt, "hybrid-section-answers");
    const parsed = await robustParseJSON(result.content, openai, { debugLabel: "hybrid_section_answers" });

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
  const sections = completionSections;
  return sections.find(s => s.sectionId === sectionId) || { title: "Unknown Section", fields: [] };
}