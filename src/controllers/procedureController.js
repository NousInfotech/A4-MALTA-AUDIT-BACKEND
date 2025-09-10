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
// Add this import at the top
const buildProceduresRecommendationsPrompt = require("../prompts/proceduresRecommendationsPrompt.js");

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

    // Check if a procedure already exists for this engagement
    let procedure = await Procedure.findOne({ engagement: engagementId });
    
    if (procedure) {
      // Update existing procedure
      procedure = await Procedure.findByIdAndUpdate(
        procedure._id,
        {
          framework,
          mode: "manual",
          classificationsSelected: classifications,
          manualPacks,
          status: "draft",
          createdBy
        },
        { new: true }
      );
    } else {
      // Create new procedure
      procedure = await Procedure.create({
        engagement: engagementId,
        framework,
        mode: "manual",
        classificationsSelected: classifications,
        manualPacks,
        status: "draft",
        createdBy
      });
    }

    res.json({ ok: true, procedureId: procedure._id, manualPacks });
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

    // Check if a procedure already exists for this engagement
    let procedure = await Procedure.findOne({ engagement: engagementId });
    
    if (procedure) {
      // Update existing procedure
      procedure = await Procedure.findByIdAndUpdate(
        procedure._id,
        {
          framework,
          mode: "ai",
          classificationsSelected: classifications,
          aiQuestions,
          status: "draft",
        },
        { new: true }
      );
    } else {
      // Create new procedure
      procedure = await Procedure.create({
        engagement: engagementId,
        framework,
        mode: "ai",
        classificationsSelected: classifications,
        aiQuestions,
        status: "draft",
      });
    }
    
    console.log("Created/Updated Procedure doc:", procedure);

    res.json({ ok: true, procedureId: procedure._id, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai questions)" });
  }
}

// AI STEP-2 — answers + recommendations
async function generateAIAnswers(req, res) {
  try {
    const { procedureId, engagementId,classifications, framework = "IFRS", questions = [] } = req.body || {};

    const context = await buildContext(engagementId)
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions,classifications });
    
    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_ANSWERS || "gpt-4o-mini" });
    
    // Update questions with answers
    const questionsWithAnswers = questions.map((question, index) => {
      return {
        ...question,
        answer: out.answers && out.answers[index] ? out.answers[index].answer : ""
      };
    });

    let procedure;
    if (procedureId) {
      procedure = await Procedure.findByIdAndUpdate(
        procedureId, 
        { 
          $set: { 
            questions: questionsWithAnswers,
            recommendations: out.recommendations || ""
          } 
        }, 
        { new: true }
      );
    } else {
      procedure = await Procedure.findOneAndUpdate(
        { engagement: engagementId },
        {
          engagement: engagementId,
          framework,
          mode: "ai",
          questions: questionsWithAnswers,
          recommendations: out.recommendations || "",
          status: "draft"
        },
        { upsert: true, new: true }
      );
    }
    
    res.json({ ok: true, procedureId: procedure._id, questions: questionsWithAnswers, recommendations: out.recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai answers)" });
  }
}
// HYBRID STEP-1 — manual + extra AI questions
async function hybridGenerateQuestions(req, res) {
  try {
    const { engagementId, framework = "IFRS", classifications, manualQuestions } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const manualPacks = manualQuestions;
    const prompt = buildHybridQuestionsPrompt({ framework, manualPacks, context });
    console.log("Hybrid ques Built prompt:", prompt);

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_QUESTIONS || "gpt-4o-mini" });
    const aiQuestions = coerceQuestionsArray(out);
    
    // Check if a procedure already exists for this engagement
    let procedure = await Procedure.findOne({ engagement: engagementId });
    
    if (procedure) {
      // Update existing procedure
      procedure = await Procedure.findByIdAndUpdate(
        procedure._id,
        {
          framework,
          mode: "hybrid",
          classificationsSelected: classifications,
          manualPacks,
          aiQuestions,
          status: "draft",
        },
        { new: true }
      );
    } else {
      // Create new procedure
      procedure = await Procedure.create({
        engagement: engagementId,
        framework,
        mode: "hybrid",
        classificationsSelected: classifications,
        manualPacks,
        aiQuestions,
        status: "draft",
      });
    }

    res.json({ ok: true, procedureId: procedure._id, manualPacks, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (hybrid questions)" });
  }
}

// HYBRID STEP-2 — answers + recommendations using all questions (manual+AI+user-added)
async function hybridGenerateAnswers(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", classifications, allQuestions = [] } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const prompt = buildProceduresAnswersPrompt({ framework, context, questions: allQuestions,classifications });
    console.log("Hybrid answer Built prompt:", prompt);

    const out = await generateJson({ prompt, model: process.env.LLM_MODEL_ANSWERS || "gpt-4o-mini" });
    const aiAnswers = out.answers || [];
    const recommendations = out.recommendations || "";

    let procedure;
    if (procedureId) {
      // Update the existing procedure
      procedure = await Procedure.findByIdAndUpdate(
        procedureId,
        { 
          $set: { 
            aiAnswers, 
            recommendations,
            classificationsSelected: classifications || []
          } 
        },
        { new: true }
      );
    } else {
      // Try to find an existing procedure for this engagement
      procedure = await Procedure.findOne({ engagement: engagementId });
      
      if (procedure) {
        // Update existing procedure
        procedure = await Procedure.findByIdAndUpdate(
          procedure._id,
          {
            framework,
            mode: "hybrid",
            classificationsSelected: classifications || [],
            aiAnswers,
            recommendations,
            status: "draft"
          },
          { new: true }
        );
      } else {
        // Create new procedure if none exists
        procedure = await Procedure.create({
          engagement: engagementId,
          framework,
          mode: "hybrid",
          classificationsSelected: classifications || [],
          aiAnswers,
          recommendations,
          status: "draft"
        });
      }
    }

    res.json({ ok: true, procedureId: procedure._id, aiAnswers, recommendations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (hybrid answers)" });
  }
}

// Create or update procedure (manual edits)
async function saveProcedure(req, res) {
  try {
    const { engagementId } = req.params;
    const procedureData = req.body;
    
    // Transform the data structure to match our updated schema
    const transformedData = {
      engagement: engagementId,
      framework: procedureData.framework || "IFRS",
      mode: procedureData.mode || "ai",
      materiality: procedureData.materiality,
      validitySelections: procedureData.validitySelections || [],
      selectedClassifications: procedureData.selectedClassifications || [],
      questions: procedureData.questions || [],
      recommendations: procedureData.recommendations || "",
      status: procedureData.status || "draft",
      createdBy: procedureData.createdBy
    };

    const procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      transformedData,
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ ok: true, procedure });
  } catch (error) {
    console.error("Error saving procedure:", error);
    res.status(500).json({ ok: false, message: "Server error", error: error.message });
  }
}
// Get procedure for an engagement
async function getProcedure(req, res) {
  try {
    const { engagementId } = req.params;
    const procedure = await Procedure.findOne({ engagement: engagementId });
    
    if (!procedure) {
      return res.status(404).json({ ok: false, message: "Procedure not found" });
    }
    
    // Return the procedure as-is since we've updated the schema
    res.json({ ok: true, procedure });
  } catch (error) {
    console.error("Error fetching procedure:", error);
    res.status(500).json({ ok: false, message: "Server error", error: error.message });
  }
}
// Add these new functions to procedureController.js
async function generateRecommendations(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", classifications, questions = [] } = req.body;
    console.log(req.body," body")
    const context = await buildContext(engagementId, classifications);
    
    const prompt = buildProceduresRecommendationsPrompt({ 
      framework, 
      context, 
      classifications,
      questions 
    });
    console.log(prompt," prompt")
    
    const out = await generateJson({ 
      prompt, 
      model: "gpt-4o-mini",
    });
    console.log(out," out")
    
    // Handle different response formats from LLM
    let recommendations = "";
    if (typeof out === "string") {
      recommendations = out;
    } else if (out && typeof out.recommendations === "string") {
      recommendations = out.recommendations;
    } else if (out && typeof out === "object") {
      // Try to find a string field that might contain recommendations
      for (const key in out) {
        if (typeof out[key] === "string" && out[key].length > 100) {
          recommendations = out[key];
          break;
        }
      }
    }
    
    // Update procedure with recommendations
    let procedure;
    if (procedureId) {
      procedure = await Procedure.findByIdAndUpdate(
        procedureId, 
        { 
          $set: { 
            recommendations: recommendations || ""
          } 
        }, 
        { new: true }
      );
    } else {
      procedure = await Procedure.findOneAndUpdate(
        { engagement: engagementId },
        {
          recommendations: recommendations || "",
          status: "draft"
        },
        { upsert: true, new: true }
      );
    }
    
    res.json({ ok: true, procedureId: procedure._id, recommendations: recommendations || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (recommendations)" });
  }
}
// AI classification-specific questions
async function generateAIClassificationQuestions(req, res) {
  try {
    const { engagementId, framework = "IFRS", classification } = req.body;
    console.log("generateAIClassificationQuestions called for:", classification);

    const context = await buildContext(engagementId, [classification]);
    console.log("Built context for classification:", classification);

    let oneShotExamples = buildOneShotExamples(framework, [classification]);
    if (!Array.isArray(oneShotExamples)) oneShotExamples = [];

    const prompt = buildProceduresQuestionsPrompt({ 
      framework, 
      classifications: [classification], 
      context, 
      oneShotExamples 
    });
    console.log("AI classification ques Built prompt:", prompt);

    const out = await generateJson({ 
      prompt, 
      model: process.env.LLM_MODEL_QUESTIONS || "gpt-4o-mini",
      max_tokens: 4000 // Increased for more detailed responses
    });
    console.log("LLM output:", out);

    const aiQuestions = coerceQuestionsArray(out);
    console.log("Coerced aiQuestions:", aiQuestions);

    // Update procedure with classification-specific questions
    let procedure = await Procedure.findOne({ engagement: engagementId });
    
    if (procedure) {
      // Remove existing questions for this classification
      procedure.questions = procedure.questions.filter(q => q.classification !== classification);
      // Add new questions
      procedure.questions.push(...aiQuestions.map(q => ({ ...q, classification })));
      await procedure.save();
    } else {
      procedure = await Procedure.create({
        engagement: engagementId,
        framework,
        mode: "ai",
        classificationsSelected: [classification],
        questions: aiQuestions.map(q => ({ ...q, classification })),
        status: "draft",
      });
    }
    
    console.log("Updated Procedure doc with classification questions:", procedure);

    res.json({ ok: true, procedureId: procedure._id, aiQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai classification questions)" });
  }
}

// AI classification-specific answers
async function generateAIClassificationAnswers(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", classification, questions = [] } = req.body;

    const context = await buildContext(engagementId, [classification]);
    console.log("Built context for classification answers:", classification);
    
    const prompt = buildProceduresAnswersPrompt({ 
      framework, 
      context, 
      questions, 
      classifications: [classification] 
    });
    console.log("AI classification answers Built prompt:", prompt);

    const out = await generateJson({ 
      prompt, 
      model: process.env.LLM_MODEL_ANSWERS || "gpt-4o-mini",
      max_tokens: 4000 // Increased for more detailed responses
    });
    
    // Update questions with answers
    const questionsWithAnswers = questions.map((question, index) => {
      return {
        ...question,
        answer: out.answers && out.answers[index] ? out.answers[index].answer : "",
        classification
      };
    });

    let procedure;
    if (procedureId) {
      procedure = await Procedure.findById(procedureId);
      if (procedure) {
        // Remove existing questions for this classification
        procedure.questions = procedure.questions.filter(q => q.classification !== classification);
        // Add updated questions with answers
        procedure.questions.push(...questionsWithAnswers);
        
        await procedure.save();
      }
    } else {
      procedure = await Procedure.findOneAndUpdate(
        { engagement: engagementId },
        {
          engagement: engagementId,
          framework,
          mode: "ai",
          questions: questionsWithAnswers,
          recommendationsByClassification: { [classification]: out.recommendations || "" },
          recommendations: out.recommendations || "",
          status: "draft"
        },
        { upsert: true, new: true }
      );
    }
    
    res.json({ 
      ok: true, 
      procedureId: procedure._id, 
      questions: questionsWithAnswers, 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai classification answers)" });
  }
}

  
async function generateHybridClassificationQuestion (req, res) {
  try {
    const { engagementId, materiality, classification, manualQuestions } = req.body;
    
    // Get engagement data
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" });
    }
    
    // Get context for the AI prompt
    const context = {
      materiality,
      industry: engagement.industry,
      riskAssessment: engagement.riskAssessment,
      // Add other relevant context here
    };
    
    // Build the prompt for hybrid question generation
    const prompt = buildHybridQuestionsPrompt({
      framework: engagement.framework || "IFRS",
      manualPacks: manualQuestions.filter(q => q.classification === classification),
      context,
    });
    
    // Call your AI service
    const aiResponse = await callAIService(prompt);
    
    // Parse and return the response
    const aiQuestions = aiResponse.questions || [];
    
    res.json({
      aiQuestions,
      recommendations: aiResponse.recommendations || ""
    });
  } catch (error) {
    console.error("Error generating hybrid classification questions:", error);
    res.status(500).json({ message: error.message });
  }
}
module.exports = {
  saveProcedure,
  getManualProcedures,
  generateAIQuestions,
  generateAIAnswers,
  hybridGenerateQuestions,
  generateAIClassificationAnswers,
  generateHybridClassificationQuestion,
  generateAIClassificationQuestions,
  hybridGenerateAnswers,
  getProcedure,
  generateRecommendations,
};