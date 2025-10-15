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

  try { return JSON.parse(cleaned); } catch { }
  try { return JSON.parse(jsonrepair(cleaned)); } catch { }
  try { return JSON5.parse(cleaned); } catch { }
  try {
    const noComments = stripJsonComments(cleaned);
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(noTrailing);
  } catch { }

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
  console.log("prompt " + prompt)
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
  const engagement = await Engagement.findById(engagementId).lean();
  if (!engagement) {
    throw new Error("Engagement not found");
  }

  // Get client profile
  const { data: clientProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();
  if (profileErr) {
    console.warn("Supabase profiles fetch error:", profileErr.message);
  }

  // Get ETB data
  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId }).lean();
  const etbRows = etb?.rows || [];

  // Get planning and fieldwork procedures for context
  const planningProcedure = await PlanningProcedure.findOne({ engagement: engagementId }).lean();
  const fieldworkProcedure = await Procedure.findOne({ engagement: engagementId }).lean();

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
    doc.procedures = payload.procedures;

    if (Array.isArray(payload.recommendations)) {
      doc.recommendations = payload.recommendations;
    } else {
      doc.recommendations = [];
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

    res.json(doc);
  } catch (e) {
    console.error("Error saving completion procedure:", e);
    res.status(400).json({ error: e.message });
  }
};

exports.generateSectionQuestions = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  try {
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    const context = await buildContext(engagementId, [sectionId]);

    // Get section info
    const section = sectionsById.get(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });

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

    // build prompt from database
    const promptContent = await getPrompt("completionAiSectionQuestionsPrompt");
    const prompt = String(promptContent)
      .replace("{clientProfile}", JSON.stringify(context.clientProfile || {}))
      .replace("{materiality}", String(materiality))
      .replace("{etbRows}", JSON.stringify(context.etbRows))
      .replace("{section}", JSON.stringify({ sectionId: section.sectionId, title: section.title }))
      .replace("{fieldPalette}", JSON.stringify(fieldPalette))
      .replace("{planningProcedure}", JSON.stringify(context.planningProcedure || {}))
      .replace("{fieldworkProcedure}", JSON.stringify(context.fieldworkProcedure || {}));

    const raw = await callOpenAI(prompt);
    const parsed = await robustParseJSON(raw, openai, { debugLabel: "completion_section_questions" });

    // Enhanced normalization & validation
    const ALLOWED_TYPES = new Set(["text", "textarea", "checkbox", "multiselect", "number", "currency", "select", "user", "date"]);
    
    const sectionFields = (parsed?.fields || [])
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

    // Update or create the procedure document with enhanced validation
    let doc = await CompletionProcedure.findOne({ engagement: engagementId });
    
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
    
    // Validate the document before saving
    try {
      await doc.validate();
    } catch (validationError) {
      console.error('Document validation failed:', validationError);
      throw new Error(`Document validation failed: ${validationError.message}`);
    }

    await doc.save();

    res.json({
      sectionId: section.sectionId,
      fields: sectionFields
    });

  } catch (e) {
    console.error("Error generating section questions:", e);
    res.status(400).json({ error: e.message });
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

  const raw = await callOpenAI(prompt);
  const parsed = await robustParseJSON(raw, openai, { debugLabel: "completion_section_answers" });

  if (parsed && parsed.sectionId === sectionId && Array.isArray(parsed.fields)) {
    const answeredFields = section.fields.map(field => {
      const answeredField = parsed.fields.find(f => f.key === field.key);
      return answeredField ? { ...field, answer: answeredField.answer } : field;
    });

    // Handle section recommendations as checklist items
    const sectionRecommendations = Array.isArray(parsed.sectionRecommendations)
      ? parsed.sectionRecommendations
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
  const recommendationsRaw = await callOpenAI(recPrompt);
  const recommendations = await robustParseJSON(recommendationsRaw, openai, { debugLabel: "completion_recommendations" });

  // Process the sectioned recommendations into flat array and by-section map
  let allRecommendations = [];
  let recommendationsBySection = {};

  if (recommendations && typeof recommendations === 'object') {
    Object.entries(recommendations).forEach(([sectionKey, sectionRecs]) => {
      if (Array.isArray(sectionRecs)) {
        const sectionWithId = sectionRecs.map(rec => ({
          ...rec,
          section: sectionKey
        }));

        recommendationsBySection[sectionKey] = sectionWithId;
        allRecommendations.push(...sectionWithId);
      }
    });
  }

  // Reassign IDs from 1 to length for all recommendations
  allRecommendations = allRecommendations.map((recommendation, index) => ({
    ...recommendation,
    id: (index + 1).toString()
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
  const sections = completionSections;
  return sections.find(s => s.sectionId === sectionId) || { title: "Unknown Section", fields: [] };
}