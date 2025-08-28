// controllers/procedureController.js

const Procedure = require("../models/Procedure");
const Engagement = require("../models/Engagement");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const WorkingPaper = require("../models/WorkingPaper");
const staticProcedures = require("../static/procedures");
const proceduresPrompt = require("../static/proceduresPrompt");
const proceduresPromptHybrid = require("../static/proceduresPromptHybrid");
const recommendationsPrompt = require("../static/recommendationsPrompt");
const { supabase } = require("../config/supabase");

const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");
const JSON5 = require("json5");
const stripJsonComments = require("strip-json-comments");

// ---------- OpenAI client ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Robust JSON parsing helper ----------
async function robustParseJSON(raw, client, { debugLabel = "" } = {}) {
  if (typeof raw !== "string") raw = String(raw ?? "");
  let cleaned = raw.trim();

  // unwrap fenced blocks
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }

  // remove leading text before first { or [
  const firstBrace = Math.min(
    ...["{", "["].map((c) => {
      const i = cleaned.indexOf(c);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    }),
  );
  if (firstBrace !== Number.MAX_SAFE_INTEGER) {
    cleaned = cleaned.slice(firstBrace);
  }

  // normalize quotes and strip most control chars (but keep \n \r \t)
  cleaned = cleaned
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

  // 1) Plain JSON
  try { return JSON.parse(cleaned); } catch {}

  // 2) jsonrepair
  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired);
  } catch {}

  // 3) JSON5
  try { return JSON5.parse(cleaned); } catch {}

  // 4) Strip comments + trailing commas
  try {
    const noComments = stripJsonComments(cleaned);
    const noTrailing = noComments.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(noTrailing);
  } catch {}

  // 5) Last resort: ask OpenAI to fix
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a strict JSON fixer. Return ONLY valid JSON. No comments, no explanations." },
        { role: "user", content: `Fix this into valid JSON:\n\n${cleaned}` },
      ],
      temperature: 0,
    });

    const candidate = (response.choices?.[0]?.message?.content || "").trim();
    let jsonCandidate = candidate;
    if (jsonCandidate.startsWith("```")) {
      jsonCandidate = jsonCandidate.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    }
    return JSON.parse(jsonCandidate);
  } catch (err) {
    console.error(`[robustParseJSON:${debugLabel}] Failed to repair JSON`, err);
    throw new Error("Could not parse AI JSON output.");
  }
}

// ---------- OpenAI wrapper (returns { content, usage, model }) ----------
async function callOpenAI(
  prompt,
  { maxTokens = 4000, model = process.env.OPENAI_MODEL || "gpt-4o", temperature = 0.2 } = {}
) {
  try {
    console.log("prompt " + prompt);
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert financial auditor. Follow the instructions exactly and provide structured output as requested.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    });
    return { content: response.choices[0].message.content, usage: response.usage, model };
  } catch (error) {
    const enriched = Object.assign(new Error(`AI processing failed: ${error.message}`), {
      status: error?.status,
      code: error?.code || error?.error?.code,
      type: error?.type || error?.error?.type,
      headers: error?.headers || error?.response?.headers,
      response: error?.response,
    });
    console.error("OpenAI API error:", enriched);
    throw enriched;
  }
}

// ---------- Rate-limit / retry helpers ----------
const SLEEP_BETWEEN_CALLS_MS = Number(process.env.OPENAI_CALL_DELAY_MS || 1500);
const MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 3);
const BASE_BACKOFF_MS = Number(process.env.OPENAI_BASE_BACKOFF_MS || 800);
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  const s = err?.status;
  const code = (err?.code || "").toLowerCase();
  // Retry 429 (rate limit) and 5xx; DO NOT retry insufficient_quota
  if (code === "insufficient_quota") return false;
  if (s === 429) return true;
  if (s >= 500 && s < 600) return true;
  return false;
}

async function callOpenAIRetry(makeCall, { maxRetries = MAX_RETRIES, baseMs = BASE_BACKOFF_MS } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await makeCall();
    } catch (err) {
      if (!isRetryable(err) || attempt >= maxRetries) throw err;
      const retryAfterHeader = err?.headers?.["retry-after"] || err?.response?.headers?.["retry-after"];
      const wait = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : Math.round(baseMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.6));
      console.warn(`Rate/server limit hit (attempt ${attempt + 1}/${maxRetries}). Backing off for ${wait}ms...`);
      await sleep(wait);
      attempt++;
    }
  }
}

// ---------- Small helper to mark AI status ----------
async function markAIStatus(engagementId, classification, status, error = null) {
  await Procedure.findOneAndUpdate(
    { engagement: engagementId, "aiProcessingStatus.classification": classification },
    { $set: { "aiProcessingStatus.$.status": status, "aiProcessingStatus.$.error": error } }
  );
}

// ---------- Controllers ----------

// Get procedure for an engagement
exports.getProcedure = async (req, res) => {
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

// Create or update procedure (manual edits)
exports.saveProcedure = async (req, res) => {
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

// Generate procedures using Manual / AI / Hybrid
exports.generateProcedures = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const { mode, materiality, selectedClassifications = [], validitySelections = [] } = req.body;

    const engagement = await Engagement.findById(engagementId);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    // Client profile (Supabase)
    const { data: clientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("company_summary,industry")
      .eq("user_id", engagement.clientId)
      .single();
    if (profileError) console.error("Error fetching client profile:", profileError);

    // ETB for selected classifications
    const etbData = await ExtendedTrialBalance.find({
      engagement: engagementId,
      classification: { $in: selectedClassifications },
    });

    // Upsert shell doc
    let procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      {
        engagement: engagementId,
        mode,
        materiality,
        selectedClassifications,
        validitySelections,
        status: mode === "manual" ? "completed" : "in-progress",
        aiProcessingStatus:
          mode !== "manual"
            ? selectedClassifications.map((c) => ({ classification: c, status: "queued" }))
            : [],
      },
      { upsert: true, new: true }
    );

    // ---------- Manual path ----------
    if (mode === "manual") {
      const procedures = [];
      const questions = [];
      for (const classification of selectedClassifications) {
        const classificationProcedures = staticProcedures[classification] || staticProcedures.default || [];
        const detail = {
          id: `manual-${classification}-${Date.now()}`,
          title: `Manual Procedures for ${classification}`,
          objective: `Perform audit procedures for ${classification} accounts`,
          assertions: ["EX", "CO", "VA", "RO", "PD"],
          linkedRisks: [],
          procedureType: "Test of Details",
          tests: classificationProcedures.map((proc, idx) => ({
            id: `${classification}-test-${idx + 1}`,
            label: proc.question || proc.label || `Test ${idx + 1}`,
            assertions: ["EX", "CO", "VA", "RO", "PD"],
            linkedRiskIds: [],
            procedureType: "Test of Details",
            threshold: null,
            population: null,
            sampleMethod: null,
            evidenceExpected: ["Documentation review"],
            notes: null,
            etbRefs: [],
          })),
          expectedResults: "All tests should provide sufficient appropriate audit evidence.",
          standards: { isa: ["ISA 500"], gapsme: [] },
        };
        procedures.push(detail);

        classificationProcedures.forEach((proc, i) => {
          questions.push({
            id: `${classification}-q-${i + 1}`,
            question: proc.question || proc.label || `Procedure ${i + 1}`,
            answer: "",
            isRequired: !!proc.isRequired,
            classification,
          });
        });
      }

      procedure.procedures = procedures;
      procedure.questions = questions;
      procedure.recommendations = "";
      procedure.status = "completed";
      await procedure.save();
      return res.json(procedure);
    }

    // ---------- AI / Hybrid paths (rate-limited; one-by-one with fallback & backoff) ----------
    const allProcedures = [];
    const allQuestions = [];
    const processingResults = [];

    // Resume support: skip classifications already completed
    const already = new Map((procedure.aiProcessingStatus || []).map((s) => [s.classification, s.status]));
    const toProcess = selectedClassifications.filter((c) => already.get(c) !== "completed");

    let abortFurther = false;

    for (const classification of toProcess) {
      if (abortFurther) break;

      // mark loading
      await markAIStatus(engagementId, classification, "loading", null);

      const doOne = async () => {
        try {
          const workingPaper = await WorkingPaper.findOne({ engagement: engagementId, classification });
          const classificationETB = etbData.filter((etb) => etb.classification === classification);

          // select prompt (AI vs Hybrid)
          let prompt;
          let predefined = [];
          if (mode === "ai") {
            prompt = proceduresPrompt[classification] || proceduresPrompt.default;
          } else {
            prompt = proceduresPromptHybrid[classification] || proceduresPromptHybrid.default;
            predefined = staticProcedures[classification] || staticProcedures.default || [];
          }

          // hydrate prompt
          prompt = String(prompt)
            .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
            .replace("{workingPapers}", JSON.stringify(workingPaper?.rows || []))
            .replace("{etbData}", JSON.stringify(classificationETB || []))
            .replace("{materiality}", String(materiality))
            .replace("{classification}", classification)
            .replace("{predefinedProcedures}", JSON.stringify(predefined));

          // Primary model with retry/backoff for rate/5xx
          let ai;
          try {
            ai = await callOpenAIRetry(
              () => callOpenAI(prompt, { maxTokens: 3600, temperature: 0.2, model: process.env.OPENAI_MODEL || "gpt-4o" }),
              { maxRetries: MAX_RETRIES, baseMs: BASE_BACKOFF_MS }
            );
          } catch (err) {
            if ((err?.code || "").toLowerCase() === "insufficient_quota") {
              console.warn("Primary model quota exceeded. Trying fallback model:", FALLBACK_MODEL);
              try {
                ai = await callOpenAIRetry(
                  () => callOpenAI(prompt, { maxTokens: 3200, temperature: 0.2, model: FALLBACK_MODEL }),
                  { maxRetries: 1, baseMs: BASE_BACKOFF_MS }
                );
              } catch (err2) {
                if ((err2?.code || "").toLowerCase() === "insufficient_quota") {
                  // mark classification and abort entire run
                  await markAIStatus(
                    engagementId,
                    classification,
                    "quota-exceeded",
                    "OpenAI insufficient_quota on both primary and fallback models"
                  );
                  processingResults.push({ classification, status: "quota-exceeded", error: "insufficient_quota" });
                  // Signal caller to abort further classifications
                  abortFurther = true;
                  return;
                }
                // other error after fallback -> propagate
                throw err2;
              }
            } else {
              // non-quota error after retries -> propagate
              throw err;
            }
          }

          if (!ai) {
            await markAIStatus(engagementId, classification, "error", "No AI response (unknown)");
            processingResults.push({ classification, status: "error", error: "no_response" });
            return;
          }

          const content = ai.content;

          // parse content
          const parsed = await robustParseJSON(content, openai, { debugLabel: `procedures_${classification}` });

          // Normalize procedures whether nested or flat
          const parsedProcedures = parsed?.procedures?.procedures || parsed?.procedures || [];

          if (Array.isArray(parsedProcedures) && parsedProcedures.length > 0) {
            parsedProcedures.forEach((p) => {
              p.tests = Array.isArray(p.tests) ? p.tests : [];
              p.assertions = Array.isArray(p.assertions) ? p.assertions : [];
              p.linkedRisks = Array.isArray(p.linkedRisks) ? p.linkedRisks : [];
              p.standards = p.standards || { isa: [], gapsme: [] };
            });

            allProcedures.push(...parsedProcedures);

            parsedProcedures.forEach((proc, i) => {
              allQuestions.push({
                id: `${classification}-${Date.now()}-${i + 1}`,
                question: proc.title || `Procedure ${i + 1}`,
                answer: proc.objective || parsed?.narrative || "",
                classification,
                procedure: proc,
              });
            });
          } else {
            console.warn(`⚠️ No procedures parsed for classification ${classification}`, parsed);
          }

          await markAIStatus(engagementId, classification, "completed", null);
          processingResults.push({ classification, status: "completed" });
        } catch (error) {
          console.error(`Error processing classification ${classification}:`, error);
          await markAIStatus(engagementId, classification, "error", error.message);
          processingResults.push({ classification, status: "error", error: error.message });
        }
      };

      await doOne();

      // spacing delay between calls (unless we aborted)
      if (!abortFurther && SLEEP_BETWEEN_CALLS_MS > 0) {
        await sleep(SLEEP_BETWEEN_CALLS_MS);
      }
    }

    // Recommendations (single pass; skip if run aborted before any questions)
    let recommendations = "";
    try {
      if (allQuestions.length > 0) {
        const proceduresAndFindings = allQuestions.map((q) => `${q.question}: ${q.answer}`).join("\n");
        const recPrompt = String(recommendationsPrompt)
          .replace("{proceduresAndFindings}", proceduresAndFindings)
          .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
          .replace("{etbData}", JSON.stringify(etbData || []))
          .replace("{materiality}", String(materiality));

        try {
          const { content: recContent } = await callOpenAI(recPrompt, { maxTokens: 2000, temperature: 0.2 });
          recommendations = recContent;
        } catch (err) {
          if ((err?.code || "").toLowerCase() === "insufficient_quota") {
            recommendations = "Recommendations not generated due to model quota limits.";
          } else {
            throw err;
          }
        }
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      recommendations = "Error generating recommendations. Please review procedures manually.";
    }

    // Save final
    const updated = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      {
        $set: {
          procedures: allProcedures,
          questions: allQuestions,
          recommendations,
          status: "completed",
        },
      },
      { new: true }
    );

    res.json({ procedure: updated, processingResults });
  } catch (error) {
    console.error("Error generating procedures:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update procedure status
exports.updateProcedureStatus = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const { status } = req.body;

    const procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      { status },
      { new: true }
    );

    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" });
    }

    res.json(procedure);
  } catch (error) {
    console.error("Error updating procedure status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete procedure
exports.deleteProcedure = async (req, res) => {
  try {
    const { engagementId } = req.params;

    const procedure = await Procedure.findOneAndDelete({ engagement: engagementId });
    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" });
    }

    res.json({ message: "Procedure deleted successfully" });
  } catch (error) {
    console.error("Error deleting procedure:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
