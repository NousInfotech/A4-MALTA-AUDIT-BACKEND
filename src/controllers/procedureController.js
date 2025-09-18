// src/controllers/procedure.controller.js
const Procedure = require("../models/Procedure.js");
const { buildOneShotExamples } = require("../services/classification.service.js");
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

async function generateRecommendations(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", classifications, questions = [] } = req.body;
    console.log(req.body, " body")
    
    const context = await buildContext(engagementId, classifications);
    let allRecommendations = [];
    
    // Process each classification individually
    for (let i = 0; i < classifications.length; i++) {
      const classification = classifications[i];
      console.log(`Processing classification ${i+1}/${classifications.length}:`, classification);
      
      const prompt = buildProceduresRecommendationsPrompt({ 
        framework, 
        context, 
        classifications: [classification],
        questions: questions.filter(q => q.classification === classification),
        batchIndex: i,
        totalBatches: classifications.length
      });
      
      console.log("Prompt for", classification, ":", prompt.substring(0, 200) + "...");
      
      const out = await generateJson({ 
        prompt, 
        model: "gpt-4o-mini",
        max_tokens: 2000 // Limit tokens per classification
      });
      
      // Handle different response formats from LLM
      let recommendations = "";
      if (typeof out === "string") {
        recommendations = out;
        console.log("LLM output for", classification, ":", out.substring(0, 200) + "...");
      } else if (out && typeof out.recommendations === "string") {
        recommendations = out.recommendations;
        console.log("LLM output for", classification, ":", out.recommendations.substring(0, 200) + "...");
      } else if (out && Array.isArray(out.recommendations)) {
        // Handle array of recommendations
        recommendations = `*${classification}*\n` + out.recommendations.map(rec => `- ${rec}`).join('\n');
        console.log("LLM output for", classification, ":", recommendations.substring(0, 200) + "...");
      } else if (out && typeof out === "object") {
        // Try to find a string field that might contain recommendations
        for (const key in out) {
          if (typeof out[key] === "string" && out[key].length > 100) {
            recommendations = out[key];
            console.log("LLM output for", classification, ":", out[key].substring(0, 200) + "...");
            break;
          }
        }
        // If no string field found, stringify the object
        if (!recommendations) {
          recommendations = `*${classification}*\n- Error: Invalid response format from AI`;
          console.log("LLM output for", classification, ":", JSON.stringify(out).substring(0, 200) + "...");
        }
      } else {
        console.log("LLM output for", classification, ":", "No output or unexpected format");
        recommendations = `*${classification}*\n- No specific recommendations generated for this classification.`;
      }
      
      // Ensure the format is correct for the frontend
      if (!recommendations.startsWith(`*${classification}*`)) {
        recommendations = `*${classification}*\n${recommendations}`;
      }
      
      // Clean up any JSON artifacts
      recommendations = recommendations
        .replace(/\{"classification":".*?",/g, '')
        .replace(/"recommendations":\[/g, '')
        .replace(/\]\}/g, '')
        .replace(/",/g, '')
        .replace(/"/g, '');
      
      allRecommendations.push(recommendations);
      
      // Add a small delay between requests to avoid rate limiting
      if (i < classifications.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Combine all recommendations into a single formatted string
    const combinedRecommendations = allRecommendations.join('\n\n');
    
    // Update procedure with recommendations
    let procedure;
    if (procedureId) {
      procedure = await Procedure.findByIdAndUpdate(
        procedureId, 
        { 
          $set: { 
            recommendations: combinedRecommendations || ""
          } 
        }, 
        { new: true }
      );
    } else {
      procedure = await Procedure.findOneAndUpdate(
        { engagement: engagementId },
        {
          recommendations: combinedRecommendations || "",
          status: "draft"
        },
        { upsert: true, new: true }
      );
    }
    
    res.json({ 
      ok: true, 
      procedureId: procedure._id, 
      recommendations: combinedRecommendations || "" 
    });
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

  
// async function generateHybridClassificationQuestion (req, res) {
//   try {
//     const { engagementId, materiality, classification, manualQuestions } = req.body;
    
//     // Get engagement data
//     const engagement = await Engagement.findById(engagementId);
//     if (!engagement) {
//       return res.status(404).json({ message: "Engagement not found" });
//     }
    
//     // Get context for the AI prompt
//     const context = {
//       materiality,
//       industry: engagement.industry,
//       riskAssessment: engagement.riskAssessment,
//       // Add other relevant context here
//     };
    
//     // Build the prompt for hybrid question generation
//     const prompt = buildHybridQuestionsPrompt({
//       framework: engagement.framework || "IFRS",
//       manualPacks: manualQuestions.filter(q => q.classification === classification),
//       context,
//     });
    
//     // Call your AI service
//     const aiResponse = await callAIService(prompt);
    
//     // Parse and return the response
//     const aiQuestions = aiResponse.questions || [];
    
//     res.json({
//       aiQuestions,
//       recommendations: aiResponse.recommendations || ""
//     });
//   } catch (error) {
//     console.error("Error generating hybrid classification questions:", error);
//     res.status(500).json({ message: error.message });
//   }
// }
module.exports = {
  saveProcedure,
  hybridGenerateQuestions,
  generateAIClassificationAnswers,
  // generateHybridClassificationQuestion,
  generateAIClassificationQuestions,
  getProcedure,
  generateRecommendations,
};