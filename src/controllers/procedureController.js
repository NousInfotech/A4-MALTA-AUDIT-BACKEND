// src/controllers/procedure.controller.js
const Procedure = require("../models/Procedure.js");
const { buildOneShotExamples } = require("../services/classification.service.js");
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

async function buildContext(engagementId, classifications = [], options = {}) {
  const { limitRows = 30, includeWorkingPapers = false } = options;  // Drastically reduced defaults
  const contextStartTime = Date.now();

  // 1) Core engagement
  console.log(engagementId," engagementId")
  const engagement = await Engagement.findById(engagementId).lean();
  if (!engagement) {
    throw new Error("Engagement not found");
  }
  console.log(`[CONTEXT] Engagement fetch: ${Date.now() - contextStartTime}ms`);

  // 2) Supabase profile (server-side)
  const supabaseStart = Date.now();
  const { data: clientProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("company_summary,industry")
    .eq("user_id", engagement.clientId)
    .single();
  if (profileErr) {
    // not fatal; just log
    console.warn("Supabase profiles fetch error:", profileErr.message);
  }
  console.log(`[CONTEXT] Supabase profile fetch: ${Date.now() - supabaseStart}ms`);

  // 3) ETB - limit rows to reduce payload size
  const etbStart = Date.now();
  const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId }).lean();
  let etbRows = etb?.rows || [];
  console.log(`[CONTEXT] ETB fetch: ${Date.now() - etbStart}ms, Total rows: ${etbRows.length}`);

  // Filter ETB rows by classification if specified
  if (Array.isArray(classifications) && classifications.length && etbRows.length > 0) {
    etbRows = etbRows.filter(row =>
      classifications.some(cls => row.classification === cls || row.account?.toLowerCase().includes(cls.toLowerCase()))
    );
  }

  // Limit rows to prevent huge payloads
  if (etbRows.length > limitRows) {
    console.log(`[OPTIMIZATION] Limiting ETB rows from ${etbRows.length} to ${limitRows}`);
    etbRows = etbRows.slice(0, limitRows);
  }

  // 4) Sections (for UX and context)
  const sectionsStart = Date.now();
  const sectionFilter = { engagement: engagementId };
  if (Array.isArray(classifications) && classifications.length) {
    sectionFilter.classification = { $in: classifications };
  }
  const classificationSections = await ClassificationSection.find(sectionFilter).lean();
  console.log(`[CONTEXT] Sections fetch: ${Date.now() - sectionsStart}ms, Count: ${classificationSections.length}`);

  // 5) Working papers — fetch by engagement and (optionally) classification
  let workingpapers = [];
  if (includeWorkingPapers) {
    const wpStart = Date.now();
    const wpFilter = { engagement: engagementId };
    if (Array.isArray(classifications) && classifications.length) {
      wpFilter.classification = { $in: classifications };
    }
    workingpapers = await WorkingPaper.find(wpFilter)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .limit(50) // Limit working papers
      .lean();
    console.log(`[CONTEXT] Working papers fetch: ${Date.now() - wpStart}ms, Count: ${workingpapers.length}`);
  }

  const totalContextTime = Date.now() - contextStartTime;
  console.log(`[CONTEXT] Total context build time: ${totalContextTime}ms (${(totalContextTime/1000).toFixed(2)}s)`);

  const context = {
    clientProfile: clientProfile || null,
    etbRows,
    classificationSections,
    workingpapers,
  };

  // Log context size for debugging
  const contextSize = JSON.stringify(context).length;
  console.log(`[CONTEXT] Context object size: ${contextSize} chars (~${Math.ceil(contextSize/4)} tokens)`);

  return context;
}

// HYBRID STEP-1 — manual + extra AI questions
async function hybridGenerateQuestions(req, res) {
  try {
    const { engagementId, framework = "IFRS", classifications, manualQuestions } = req.body || {};

    const context = await buildContext(engagementId,classifications)
    console.log("Built context:", context);
    const manualPacks = manualQuestions;

    const promptContent = await getPrompt("fieldworkHybridQuestionsPrompt");
    const promptFunction = eval(`(${promptContent})`);
    const prompt = promptFunction({ framework, manualPacks, context });

    console.log("Hybrid ques Built prompt (first 500 chars):", prompt.substring(0, 500));
    console.log(`[PROMPT] Total prompt length: ${prompt.length} chars (~${Math.ceil(prompt.length/4)} tokens)`);

    const startTime = Date.now();
    console.log(`[TIMING] Starting OpenAI call for hybrid questions - ${new Date().toISOString()}`);
    const out = await generateJson({
      prompt,
      model: process.env.LLM_MODEL_QUESTIONS || "gpt-4.1-nano",
      max_tokens: 3000, // Limit output size for faster response
      temperature: 0.3 // Slightly higher for faster generation
    });
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[TIMING] OpenAI call completed for hybrid questions - Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);

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
    console.log(req.body," body")
    // Transform the data structure to match our updated schema
    const transformedData = {
      engagement: engagementId,
      framework: procedureData.framework || "IFRS",
      mode: procedureData.mode || "ai",
      materiality: procedureData.materiality,
      validitySelections: procedureData.validitySelections || [],
      selectedClassifications: procedureData.selectedClassifications || [],
      questions: procedureData.questions || [],
      recommendations: procedureData.recommendations,
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

async function saveProcedurebySection(req, res) {
  try {
    const { engagementId } = req.params;
    const procedureData = req.body;
    console.log(req.body," body")
    // Transform the data structure to match our updated schema
    const transformedData = {
      engagement: engagementId,
      framework: procedureData.framework || "IFRS",
      mode: procedureData.mode || "ai",
      materiality: procedureData.materiality,
      validitySelections: procedureData.validitySelections || [],
      selectedClassifications: procedureData.selectedClassifications || [],
      questions: procedureData.questions || [],
      status: procedureData.status || "completed",
      createdBy: procedureData.createdBy,
      recommendations: procedureData.recommendations,
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

// In the procedureController.js file, replace the generateRecommendations function with this:
async function generateRecommendations(req, res) {
  try {
    const { procedureId, engagementId, framework = "IFRS", classifications, questions = [] } = req.body;
    console.log(req.body, " body")
    
    const context = await buildContext(engagementId, classifications);
    let allRecommendations = [];
    let recommendationsByClassification = {};
    
    // Process each classification individually
    for (let i = 0; i < classifications.length; i++) {
      const classification = classifications[i];
      console.log(`Processing classification ${i+1}/${classifications.length}:`, classification);
      
      const promptContent = await getPrompt("fieldworkRecommendationsPrompt");
      const promptFunction = eval(`(${promptContent})`);
      const prompt = promptFunction({
        framework,
        context,
        classifications: [classification],
        questions: questions.filter(q => q.classification === classification),
        batchIndex: i,
        totalBatches: classifications.length
      });

      console.log("Prompt for", classification, ":", prompt.substring(0, 200) + "...");

      const startTime = Date.now();
      console.log(`[TIMING] Starting OpenAI call for recommendations - Classification: ${classification} (${i+1}/${classifications.length}) - ${new Date().toISOString()}`);
      const out = await generateJson({
        prompt,
        model: "gpt-4.1-nano",
        max_tokens: 1500, // Reduced for faster responses
        temperature: 0.3 // Slightly higher for faster generation
      });
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[TIMING] OpenAI call completed for recommendations - Classification: ${classification} - Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
      
      // Handle the new JSON response format with checklist items
      let recommendations = [];
      if (out && out.recommendations && Array.isArray(out.recommendations)) {
        recommendations = out.recommendations.map(item => ({
          ...item,
          classification: classification
        }));

        console.log(`Generated ${recommendations.length} checklist items for ${classification}`);
      } else if (typeof out === "string") {
        // Fallback: parse string format (for backward compatibility)
        const lines = out.split('\n').filter(line => line.trim().startsWith('-'));
        recommendations = lines.map((line, index) => ({
          id: `${classification}-${index + 1}`,
          text: line.replace(/^- /, '').trim(),
          checked: false,
          classification: classification
        }));
        console.log("Fallback: Parsed string format for", classification);
      } else {
        console.log("LLM output for", classification, ":", "No recommendations generated");
        recommendations = [{
          id: `${classification}-1`,
          text: `No specific recommendations generated for ${classification}. Please review manually.`,
          checked: false,
          classification: classification
        }];
      }
      
      recommendationsByClassification[classification] = recommendations;
      allRecommendations.push(...recommendations);
    
      // Add a small delay between requests to avoid rate limiting
      if (i < classifications.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Reassign IDs from 1 to length for all recommendations
    allRecommendations = allRecommendations.map((recommendation, index) => ({
      ...recommendation,
      id: (index + 1).toString()
    }));
    
    // Update procedure with recommendations
    let procedure;
    if (procedureId) {
      procedure = await Procedure.findByIdAndUpdate(
        procedureId, 
        { 
          $set: { 
            recommendations: allRecommendations,
            recommendationsByClassification: recommendationsByClassification
          } 
        }, 
        { new: true }
      );
    } else {
      procedure = await Procedure.findOneAndUpdate(
        { engagement: engagementId },
        {
          recommendations: allRecommendations,
          recommendationsByClassification: recommendationsByClassification,
          status: "draft"
        },
        { upsert: true, new: true }
      );
    }
    
    res.json({ 
      ok: true, 
      procedureId: procedure._id, 
      recommendations: allRecommendations,
      recommendationsByClassification: recommendationsByClassification
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

    const promptContent = await getPrompt("fieldworkAiQuestionsPrompt");
    const promptFunction = eval(`(${promptContent})`);
    const prompt = promptFunction({
      framework,
      classifications: [classification],
      context,
      oneShotExamples
    });

    console.log("AI classification ques Built prompt (first 500 chars):", prompt.substring(0, 500));
    console.log(`[PROMPT] Total prompt length: ${prompt.length} chars (~${Math.ceil(prompt.length/4)} tokens)`);

    const startTime = Date.now();
    console.log(`[TIMING] Starting OpenAI call for AI questions - Classification: ${classification} - ${new Date().toISOString()}`);
    const out = await generateJson({
      prompt,
      model: process.env.LLM_MODEL_QUESTIONS || "gpt-4.1-nano",
      max_tokens: 2048, // Increased to prevent truncation
      temperature: 0.3 // Slightly higher for faster generation
    });
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[TIMING] OpenAI call completed for AI questions - Classification: ${classification} - Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
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
    
    // Extract error message - check for quota errors and other specific errors
    let errorMessage = "Failed to generate questions";
    let statusCode = 500;
    
    if (err.message) {
      // Check for quota exceeded error
      if (err.message.includes("429") || err.message.includes("quota") || err.message.includes("insufficient_quota")) {
        errorMessage = "OpenAI API quota exceeded. Please check your OpenAI account billing and quota limits.";
        statusCode = 429;
      } else if (err.message.includes("LLM error")) {
        // Extract the actual error from LLM service
        const match = err.message.match(/LLM error: (\d+) (.+)/);
        if (match) {
          const httpStatus = parseInt(match[1]);
          const errorText = match[2];
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.message) {
              errorMessage = errorJson.error.message;
            } else {
              errorMessage = errorText.slice(0, 200);
            }
          } catch {
            errorMessage = errorText.slice(0, 200);
          }
          statusCode = httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500;
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = err.message;
      }
    }
    
    res.status(statusCode).json({ ok: false, error: errorMessage, message: errorMessage });
  }
}

// AI classification-specific answers
async function generateAIClassificationAnswers(req, res) {
  try {
    console.log(req.body," body")
    const { procedureId, engagementId, framework = "IFRS", classification, questions = [] } = req.body;

    const context = await buildContext(engagementId, [classification]);
    console.log("Built context for classification answers:", classification);

    const promptContent = await getPrompt("fieldworkAnswersPrompt");
    const promptFunction = eval(`(${promptContent})`);
    const prompt = promptFunction({
      framework,
      context,
      questions,
      classifications: [classification]
    });

    console.log("AI classification answers Built prompt:", prompt);

    const startTime = Date.now();
    console.log(`[TIMING] Starting OpenAI call for AI answers - Classification: ${classification} - ${new Date().toISOString()}`);
    const out = await generateJson({
      prompt,
      model: process.env.LLM_MODEL_ANSWERS || "gpt-4.1-nano",
      max_tokens: 2500, // Reduced for faster responses
      temperature: 0.3 // Slightly higher for faster generation
    });
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[TIMING] OpenAI call completed for AI answers - Classification: ${classification} - Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
    
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

// AI classification-specific answers
async function generateAIClassificationAnswersSeparate(req, res) {
  try {
    console.log(req.body," body")
    const { procedureId, engagementId, framework = "IFRS", classification, questions = [] } = req.body;

    const context = await buildContext(engagementId, [classification]);
    console.log("Built context for classification answers:", classification);

    const promptContent = await getPrompt("fieldworkAnswersPrompt");
    const promptFunction = eval(`(${promptContent})`);
    const prompt = promptFunction({
      framework,
      context,
      questions,
      classifications: [classification]
    });

    console.log("AI classification answers Built prompt:", prompt);

    const startTime = Date.now();
    console.log(`[TIMING] Starting OpenAI call for AI answers (separate) - Classification: ${classification} - ${new Date().toISOString()}`);
    const out = await generateJson({
      prompt,
      model: process.env.LLM_MODEL_ANSWERS || "gpt-4.1-nano",
      max_tokens: 2500, // Reduced for faster responses
      temperature: 0.3 // Slightly higher for faster generation
    });
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[TIMING] OpenAI call completed for AI answers (separate) - Classification: ${classification} - Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`);
    
    // Update questions with answers
    const questionsWithAnswers = questions.map((question, index) => {
      return {
        ...question,
        answer: out.answers && out.answers[index] ? out.answers[index].answer : "",
        classification
      };
    });
    
    res.json({ 
      ok: true, 
      questions: questionsWithAnswers, 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error (ai classification answers)" });
  }
}
  
module.exports = {
  saveProcedure,
  hybridGenerateQuestions,
  generateAIClassificationAnswers,
  generateAIClassificationQuestions,
  generateAIClassificationAnswersSeparate,
  getProcedure,
  generateRecommendations,
  saveProcedurebySection,
};