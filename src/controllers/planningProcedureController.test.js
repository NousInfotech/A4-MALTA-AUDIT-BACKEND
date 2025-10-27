/**
 * TEST FILE: Hybrid Batching Approach for Section Questions Generation
 *
 * This file implements a parallel batching strategy to generate section questions
 * faster by splitting the work into multiple concurrent OpenAI API calls.
 *
 * Usage:
 * 1. Add a test route in your routes file
 * 2. Call the test endpoint with the same parameters as the original
 * 3. Compare timing results between original and hybrid approach
 */

const PlanningProcedure = require("../models/PlanningProcedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const planningSections = require("../static/planningSections");
const { supabase } = require("../config/supabase");
const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");
const JSON5 = require("json5");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple comment stripper (fallback if strip-json-comments not available)
const stripJsonComments = (str) => {
  try {
    return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  } catch (e) {
    return str;
  }
};

// Build sections lookup
const sectionsById = new Map(
  Array.isArray(planningSections)
    ? planningSections.map(s => [s.sectionId, s])
    : Object.values(planningSections || {}).map(s => [s.sectionId, s])
);

// ---------- Helper: Get prompt from database ----------
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

// ---------- Helper: Robust JSON parsing ----------
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

  try {
    const result = JSON.parse(cleaned);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 1 (JSON.parse) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  try {
    const result = JSON.parse(jsonrepair(cleaned));
    console.log(`[robustParseJSON:${debugLabel}] Strategy 2 (jsonrepair) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  try {
    const result = JSON5.parse(cleaned);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 3 (JSON5) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

  try {
    const noComments = stripJsonComments(cleaned);
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
    const result = JSON.parse(noTrailing);
    console.log(`[robustParseJSON:${debugLabel}] Strategy 4 (strip comments) succeeded in ${Date.now() - parseStart}ms`);
    return result;
  } catch { }

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

// ---------- Helper: Call OpenAI with timing ----------
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

// ---------- HYBRID BATCHING APPROACH ----------
exports.generateSectionQuestionsHybrid = async (req, res) => {
  const { engagementId } = req.params;
  const { sectionId, materiality = 0 } = req.body;

  const startTime = Date.now();
  const timings = {};
  const tokenUsage = {};

  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[HYBRID BATCH] Starting section questions generation for section: ${sectionId}`);
    console.log(`${"=".repeat(80)}\n`);

    // Step 1: Fetch engagement
    let stepStart = Date.now();
    const engagement = await Engagement.findById(engagementId);
    timings.fetchEngagement = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 1 - Fetch engagement: ${timings.fetchEngagement}ms`);

    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Step 2: Fetch client profile
    stepStart = Date.now();
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();
    timings.fetchClientProfile = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 2 - Fetch client profile: ${timings.fetchClientProfile}ms`);

    // Step 3: Fetch ETB
    stepStart = Date.now();
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const etbRows = Array.isArray(etb?.rows) ? etb.rows : [];
    timings.fetchETB = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 3 - Fetch ETB (${etbRows.length} rows): ${timings.fetchETB}ms`);

    // Step 4: Summarize ETB
    stepStart = Date.now();
    const summarizeETB = (rows, materialityNum) => {
      const top = [...rows]
        .sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
        .slice(0, 20)
        .map(({ account, amount, type }) => ({ account, amount, type }));
      const material = top.filter(r => Math.abs(r.amount || 0) >= (Number(materialityNum) || 0) * 0.5);
      return { top, material, count: rows.length };
    };
    const etbSummary = summarizeETB(etbRows, materiality);
    timings.summarizeETB = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 4 - Summarize ETB: ${timings.summarizeETB}ms`);

    // Step 5: Get section info
    stepStart = Date.now();
    const section = sectionsById.get(sectionId);
    if (!section) return res.status(404).json({ message: "Section not found" });
    timings.getSection = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 5 - Get section metadata: ${timings.getSection}ms`);

    // Field palette
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

    // Step 6: Build base prompt
    stepStart = Date.now();
    const promptContent = await getPrompt("planningAiSectionQuestionsPrompt");
    timings.fetchPrompt = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 6 - Fetch prompt template from DB: ${timings.fetchPrompt}ms`);

    // Common context for all batches
    const contextData = {
      clientProfile: JSON.stringify(clientProfile || {}),
      materiality: String(materiality),
      etbRows: JSON.stringify(etbSummary),
      section: JSON.stringify({ sectionId: section.sectionId, title: section.title }),
      fieldPalette: JSON.stringify(fieldPalette)
    };

    // ---------- HYBRID STRATEGY: Split into 3 parallel batches ----------
    stepStart = Date.now();

    console.log(`\n[HYBRID BATCH] Creating 3 parallel batch prompts...`);

    // Create 3 specialized prompts for parallel processing
    const batch1Prompt = String(promptContent)
      .replace("{clientProfile}", contextData.clientProfile)
      .replace("{materiality}", contextData.materiality)
      .replace("{etbRows}", contextData.etbRows)
      .replace("{section}", contextData.section)
      .replace("{fieldPalette}", contextData.fieldPalette)
      + "\n\nFOCUS: Generate the FIRST 10-12 fields focusing on ENGAGEMENT SETUP, ACCEPTANCE, INDEPENDENCE, and ETHICAL REQUIREMENTS.";

    const batch2Prompt = String(promptContent)
      .replace("{clientProfile}", contextData.clientProfile)
      .replace("{materiality}", contextData.materiality)
      .replace("{etbRows}", contextData.etbRows)
      .replace("{section}", contextData.section)
      .replace("{fieldPalette}", contextData.fieldPalette)
      + "\n\nFOCUS: Generate the MIDDLE 10-12 fields focusing on RISK ASSESSMENT, CONTROL ENVIRONMENT, and BUSINESS UNDERSTANDING.";

    const batch3Prompt = String(promptContent)
      .replace("{clientProfile}", contextData.clientProfile)
      .replace("{materiality}", contextData.materiality)
      .replace("{etbRows}", contextData.etbRows)
      .replace("{section}", contextData.section)
      .replace("{fieldPalette}", contextData.fieldPalette)
      + "\n\nFOCUS: Generate the LAST 8-10 fields focusing on DOCUMENTATION, QUALITY CONTROL, and CONSULTATION requirements.";

    timings.buildPrompts = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 7 - Build 3 batch prompts: ${timings.buildPrompts}ms`);

    // Step 8: Execute 3 parallel API calls
    stepStart = Date.now();
    console.log(`\n[HYBRID BATCH] Step 8 - Executing 3 parallel OpenAI API calls...\n`);

    const [result1, result2, result3] = await Promise.all([
      callOpenAI(batch1Prompt, "batch-1-setup"),
      callOpenAI(batch2Prompt, "batch-2-risk"),
      callOpenAI(batch3Prompt, "batch-3-documentation")
    ]);

    timings.parallelOpenAICalls = Date.now() - stepStart;
    console.log(`\n[HYBRID BATCH] Step 8 - All 3 parallel API calls completed in: ${timings.parallelOpenAICalls}ms`);

    // Track token usage
    tokenUsage.batch1 = result1.usage;
    tokenUsage.batch2 = result2.usage;
    tokenUsage.batch3 = result3.usage;
    tokenUsage.total = {
      prompt_tokens: (result1.usage?.prompt_tokens || 0) + (result2.usage?.prompt_tokens || 0) + (result3.usage?.prompt_tokens || 0),
      completion_tokens: (result1.usage?.completion_tokens || 0) + (result2.usage?.completion_tokens || 0) + (result3.usage?.completion_tokens || 0),
      total_tokens: (result1.usage?.total_tokens || 0) + (result2.usage?.total_tokens || 0) + (result3.usage?.total_tokens || 0)
    };

    console.log(`[HYBRID BATCH] Total tokens across all batches: ${tokenUsage.total.total_tokens}`);

    // Step 9: Parse all 3 responses in parallel
    stepStart = Date.now();
    console.log(`\n[HYBRID BATCH] Step 9 - Parsing 3 JSON responses in parallel...\n`);

    const [parsed1, parsed2, parsed3] = await Promise.all([
      robustParseJSON(result1.content, openai, { debugLabel: "batch-1" }),
      robustParseJSON(result2.content, openai, { debugLabel: "batch-2" }),
      robustParseJSON(result3.content, openai, { debugLabel: "batch-3" })
    ]);

    timings.parseJSON = Date.now() - stepStart;
    console.log(`\n[HYBRID BATCH] Step 9 - All 3 JSON responses parsed in: ${timings.parseJSON}ms`);

    // Step 10: Merge fields from all 3 batches
    stepStart = Date.now();
    const mergedFields = [
      ...(parsed1?.fields || []),
      ...(parsed2?.fields || []),
      ...(parsed3?.fields || [])
    ];

    console.log(`[HYBRID BATCH] Step 10 - Merged ${mergedFields.length} fields from 3 batches`);

    // Normalize & validate
    const ALLOWED_TYPES = new Set(["text", "textarea", "checkbox", "multiselect", "number", "currency", "select", "user", "date"]);

    const sectionFields = mergedFields
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
    console.log(`[HYBRID BATCH] Step 10 - Normalized & validated ${sectionFields.length} fields: ${timings.normalizeFields}ms`);

    // Step 11: Fetch or create procedure document
    stepStart = Date.now();
    let doc = await PlanningProcedure.findOne({ engagement: engagementId });
    timings.fetchProcedureDoc = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 11 - Fetch procedure document: ${timings.fetchProcedureDoc}ms`);

    // Step 12: Prepare document
    stepStart = Date.now();
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

    if (!Array.isArray(doc.procedures)) {
      doc.procedures = [];
    }

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
    console.log(`[HYBRID BATCH] Step 12 - Prepare document structure: ${timings.prepareDocument}ms`);

    // Step 13: Validate
    stepStart = Date.now();
    try {
      await doc.validate();
      timings.validateDocument = Date.now() - stepStart;
      console.log(`[HYBRID BATCH] Step 13 - Validate document: ${timings.validateDocument}ms`);
    } catch (validationError) {
      timings.validateDocument = Date.now() - stepStart;
      console.error(`[HYBRID BATCH] Step 13 - Document validation failed: ${timings.validateDocument}ms`);
      throw new Error(`Document validation failed: ${validationError.message}`);
    }

    // Step 14: Save
    stepStart = Date.now();
    await doc.save();
    timings.saveDocument = Date.now() - stepStart;
    console.log(`[HYBRID BATCH] Step 14 - Save document to MongoDB: ${timings.saveDocument}ms`);

    // Calculate totals
    timings.totalTime = Date.now() - startTime;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`[HYBRID BATCH] ===== TOTAL TIME: ${timings.totalTime}ms =====`);
    console.log(`${"=".repeat(80)}\n`);

    console.log(`[HYBRID BATCH] Detailed Summary:`, JSON.stringify({
      timings,
      tokenUsage,
      fieldsGenerated: sectionFields.length
    }, null, 2));

    res.json({
      approach: "HYBRID_BATCH",
      sectionId: section.sectionId,
      fields: sectionFields,
      _timings: timings,
      _tokenUsage: tokenUsage,
      _comparison: {
        totalFields: sectionFields.length,
        batchCount: 3,
        parallelExecutionTime: timings.parallelOpenAICalls,
        totalTime: timings.totalTime
      }
    });

  } catch (e) {
    const totalTime = Date.now() - startTime;
    console.error(`[HYBRID BATCH] Error occurred after ${totalTime}ms`);
    console.error("[HYBRID BATCH] Error generating section questions:", e);
    res.status(400).json({ error: e.message });
  }
};
