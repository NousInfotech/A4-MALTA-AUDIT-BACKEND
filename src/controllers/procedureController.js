// src/controllers/procedure.controller.js
const Procedure = require("../models/Procedure.js");
const { buildManualPacks, buildOneShotExamples } = require("../services/classification.service.js");
const buildProceduresQuestionsPrompt = require("../prompts/proceduresQuestionsPrompt.js");
const buildProceduresAnswersPrompt = require("../prompts/proceduresAnswersPrompt.js");
const buildHybridQuestionsPrompt = require("../prompts/proceduresHybridQuestionsPrompt.js");
const { generateJson } = require("../services/llm.service.js");
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
    const { engagementId, framework = "IFRS", classifications = [], context = {}, createdBy } = req.body || {};
    const oneShotExamples = buildOneShotExamples(framework, classifications);
    const prompt = buildProceduresQuestionsPrompt({ framework, classifications, context, oneShotExamples });

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_QUESTIONS || "gpt-4o-mini" });
const aiQuestions = coerceQuestionsArray(out);

    const doc = await Procedure.create({
      engagementId,
      framework,
      mode: "ai",
      classificationsSelected: classifications,
      aiQuestions,
      status: "draft",
      createdBy
    });

    res.json({ ok: true, procedureId: doc._id, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai questions)" });
  }
}

// AI STEP-2 — answers + recommendations
async function generateAIAnswers(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", context = {}, questions = [] } = req.body || {};
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions });

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
    const { engagementId, framework = "IFRS", classifications = [], context = {}, createdBy } = req.body || {};
    const manualPacks = buildManualPacks(framework, classifications);

    const prompt = buildHybridQuestionsPrompt({ framework, manualPacks, context });
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
      createdBy
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
    const { procedureId, framework = "IFRS", context = {}, allQuestions = [] } = req.body || {};
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions: allQuestions });

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
