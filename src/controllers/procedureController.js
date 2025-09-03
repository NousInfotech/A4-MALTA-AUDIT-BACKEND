// src/controllers/procedure.controller.js
const Procedure = require("../models/Procedure.js");
const { buildManualPacks, buildOneShotExamples } = require("../services/classification.service.js");
const buildProceduresQuestionsPrompt = require("../prompts/proceduresQuestionsPrompt.js");
const buildProceduresAnswersPrompt = require("../prompts/proceduresAnswersPrompt.js");
const buildHybridQuestionsPrompt = require("../prompts/proceduresHybridQuestionsPrompt.js");
const { generateJson } = require("../services/llm.service.js");
const Engagement = require("../models/Engagement.js");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance.js")
const WorkingPaper = require("../models/WorkingPaper.js");
const ClassificationSection = require("../models/ClassificationSection.js");
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
// Add this small util near the top of the file:
function coerceQuestionsArray(out) {
  // Handles: raw array, {questions: [...]}, {items: [...]}, {data: [...]}
  if (Array.isArray(out)) return out;
  if (!out || typeof out !== "object") return [];
  if (Array.isArray(out.questions)) return out.questions;
  if (Array.isArray(out.items)) return out.items;
  if (Array.isArray(out.data)) return out.data;
  // Sometimes models return { result: { questions: [...] } }
  if (out.result && Array.isArray(out.result.questions)) return out.result.questions;
  return [];
}
async function buildContext(engagementId, classifications = []) {
  // 1) Core engagement
  const engagement = await Engagement.findById(engagementId).lean();
  if (!engagement) {
    throw new Error("Engagement not found");
  }

  // 2) Supabase profile (server-side)
  const { data: clientProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();
  if (profileErr) {
    // not fatal; just log
    console.warn("Supabase profiles fetch error:", profileErr.message);
  }

  // 3) ETB
  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId }).lean();
  const etbRows = etb?.rows || [];

  // 4) Sections (for UX and context)
  const sectionFilter = { engagement: engagementId };
  if (Array.isArray(classifications) && classifications.length) {
    sectionFilter.classification = { $in: classifications };
  }
  const classificationSections = await ClassificationSection.find(sectionFilter).lean();

  // 5) Working papers — fetch by engagement and (optionally) classification
  const wpFilter = { engagement: engagementId };
  if (Array.isArray(classifications) && classifications.length) {
    wpFilter.classification = { $in: classifications };
  }
  const workingpapers = await WorkingPaper.find(wpFilter).lean();

  return {
    clientProfile: clientProfile || null,
    etbRows,
    classificationSections,
    workingpapers, // full objects, not just ids
  };
}

// MANUAL — returns all manual packs based on selected classifications (deepest or top-level rules)
async function getManualProcedures(req, res) {
  try {
    const { engagementId, framework = "IFRS", classifications = [], createdBy } = req.body || {};
    const manualPacks = buildManualPacks(framework, classifications);

    const doc = await Procedure.create({
      engagementId,
      framework,
      mode: "manual",
      classificationsSelected: classifications,
      manualPacks,
      status: "draft",
      createdBy
    });

    res.json({ ok: true, procedureId: doc._id, manualPacks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (manual)" });
  }
}
// AI STEP-1 — questions only
async function generateAIQuestions(req, res) {
  try {
    const { engagementId, framework = "IFRS", classifications } = req.body || {};
    console.log("generateAIQuestions called with:", { engagementId, framework, classifications });

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);

    let oneShotExamples = buildOneShotExamples(framework, classifications);
    if (!Array.isArray(oneShotExamples)) oneShotExamples = [];
    console.log("Built oneShotExamples:", oneShotExamples);

    const prompt = buildProceduresQuestionsPrompt({ framework, classifications, context, oneShotExamples });
    console.log("AI ques Built prompt:", prompt);

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_QUESTIONS || "gpt-4o-mini" });
    console.log("LLM output:", out);

    const aiQuestions = coerceQuestionsArray(out);
    console.log("Coerced aiQuestions:", aiQuestions);

    const doc = await Procedure.create({
      engagementId,
      framework,
      mode: "ai",
      classificationsSelected: classifications,
      aiQuestions,
      status: "draft",
    });
    console.log("Created Procedure doc:", doc);

    res.json({ ok: true, procedureId: doc._id, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai questions)" });
  }
}

// AI STEP-2 — answers + recommendations
async function generateAIAnswers(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS",classifications, questions = [] } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions });
    console.log("AI ans Built prompt:", prompt);

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_ANSWERS || "gpt-4o-mini" });
    const aiAnswers = out.answers || [];
    const recommendations = out.recommendations || [];

    let doc;
    if (procedureId) {
      doc = await Procedure.findByIdAndUpdate(procedureId, { $set: { aiAnswers, recommendations } }, { new: true });
    } else {
      doc = await Procedure.create({
        engagementId,
        framework,
        mode: "ai",
        aiQuestions: questions,
        aiAnswers,
        recommendations,
        status: "draft"
      });
    }
    res.json({ ok: true, procedureId: doc._id, aiAnswers, recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai answers)" });
  }
}

// HYBRID STEP-1 — manual + extra AI questions
async function hybridGenerateQuestions(req, res) {
  try {
    const { engagementId, framework = "IFRS", classifications,manualQuestions } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const manualPacks = manualQuestions;
    const prompt = buildHybridQuestionsPrompt({ framework, manualPacks, context });
    console.log("Hybrid ques Built prompt:", prompt);

const out = await generateJson({ prompt, model: process.env.LLM_MODEL_QUESTIONS || "gpt-4o-mini" });
const aiQuestions = coerceQuestionsArray(out);
    const doc = await Procedure.create({
      engagementId,
      framework,
      mode: "hybrid",
      classificationsSelected: classifications,
      manualPacks,
      aiQuestions,
      status: "draft",
  
    });

    res.json({ ok: true, procedureId: doc._id, manualPacks, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (hybrid questions)" });
  }
}

// HYBRID STEP-2 — answers + recommendations using all questions (manual+AI+user-added)
async function hybridGenerateAnswers(req, res) {
  try {
    const { procedureId,engagementId, framework = "IFRS", allQuestions = [] } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions: allQuestions });
    console.log("Hybrid answer Built prompt:", prompt);

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_ANSWERS || "gpt-4o-mini" });
    const aiAnswers = out.answers || [];
    const recommendations = out.recommendations || [];

    const doc = await Procedure.findByIdAndUpdate(
      procedureId,
      { $set: { aiAnswers, recommendations } },
      { new: true }
    );

    res.json({ ok: true, procedureId: doc?._id, aiAnswers, recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (hybrid answers)" });
  }
}
// Create or update procedure (manual edits)
async function saveProcedure (req, res) {
  try {
    const { engagementId } = req.params;
    const procedureData = req.body;

    const procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      { ...procedureData, engagement: engagementId },
      { upsert: true, new: true }
    );

    res.json(procedure);
  } catch (error) {
    console.error("Error saving procedure:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get procedure for an engagement
  async function getProcedure (req, res) {
  try {
    const { engagementId } = req.params;
    const procedure = await Procedure.findOne({ engagement: engagementId });
    if (!procedure) return res.status(404).json({ message: "Procedure not found" });
    res.json(procedure);
  } catch (error) {
    console.error("Error fetching procedure:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  saveProcedure,
  getManualProcedures,
  generateAIQuestions,
  generateAIAnswers,
  hybridGenerateQuestions,
  hybridGenerateAnswers,
  getProcedure,
};
