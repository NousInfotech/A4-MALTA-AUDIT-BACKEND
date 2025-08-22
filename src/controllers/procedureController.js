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
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2) jsonrepair
  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired);
  } catch {}

  // 3) JSON5
  try {
    return JSON5.parse(cleaned);
  } catch {}

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

    // unwrap fences if present
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

// ---------- Helper to call OpenAI ----------
async function callOpenAI(prompt, { maxTokens = 4000 } = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert financial auditor. Follow the instructions exactly and provide structured output as requested.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`AI processing failed: ${error.message}`);
  }
}

// ---------- Controllers ----------

// Get procedure for an engagement
exports.getProcedure = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const procedure = await Procedure.findOne({ engagement: engagementId });

    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" });
    }

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
      { upsert: true, new: true },
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

    // Engagement
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" });
    }

    // Client profile (Supabase)
    const { data: clientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", engagement.clientId)
      .single();
    if (profileError) {
      console.error("Error fetching client profile:", profileError);
    }

    // ETB for selected classifications
    const etbData = await ExtendedTrialBalance.find({
      engagement: engagementId,
      classification: { $in: selectedClassifications },
    });

    // Procedure shell doc / upsert
    const procedure = await Procedure.findOneAndUpdate(
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
      { upsert: true, new: true },
    );

    // ---------- Manual path ----------
    if (mode === "manual") {
      const procedures = [];
      const questions = [];
      for (const classification of selectedClassifications) {
        const classificationProcedures =
          staticProcedures[classification] || staticProcedures.default || [];

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

        // questions for backward compatibility
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

    // ---------- AI / Hybrid paths ----------
    const allProcedures = [];
    const allQuestions = [];
    const processingResults = [];

    for (const classification of selectedClassifications) {
      try {
        // status -> loading
        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          { $set: { "aiProcessingStatus.$.status": "loading" } },
        );

        // working paper for classification
        const workingPaper = await WorkingPaper.findOne({
          engagement: engagementId,
          classification,
        });

        const classificationETB = etbData.filter((etb) => etb.classification === classification);

        // prepare prompt
        let prompt;
        let predefined = [];

        if (mode === "ai") {
          prompt = proceduresPrompt[classification] || proceduresPrompt.default;
        } else {
          // hybrid
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
        const aiResponse = await callOpenAI(prompt, { maxTokens: 4000 });

        // --- inside generateProcedures ---
try {
  const parsed = await robustParseJSON(aiResponse, openai, {
    debugLabel: `procedures_${classification}`,
  });

  // Normalize procedures whether nested or flat
  const parsedProcedures =
    parsed?.procedures?.procedures || parsed?.procedures || [];

  if (Array.isArray(parsedProcedures) && parsedProcedures.length > 0) {
    allProcedures.push(...parsedProcedures);

    parsedProcedures.forEach((proc, i) => {
      allQuestions.push({
        id: `${classification}-${i + 1}`,
        question: proc.title || `Procedure ${i + 1}`,
        // fallback to proc.objective instead of parsed.narrative
        answer: proc.objective || parsed?.narrative || "",
        classification,
        procedure: proc,
      });
    });
  } else {
    console.warn(
      `⚠️ No procedures parsed for classification ${classification}`,
      parsed
    );
  }
} catch (err) {
  console.error("Error parsing AI response", err);
}


        // status -> completed
        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          { $set: { "aiProcessingStatus.$.status": "completed" } },
        );

        processingResults.push({ classification, status: "completed" });
      } catch (error) {
        console.error(`Error processing classification ${classification}:`, error);

        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          {
            $set: {
              "aiProcessingStatus.$.status": "error",
              "aiProcessingStatus.$.error": error.message,
            },
          },
        );

        processingResults.push({ classification, status: "error", error: error.message });
      }
    }

    // Recommendations
    let recommendations = "";
    try {
      if (allQuestions.length > 0) {
        const proceduresAndFindings = allQuestions
          .map((q) => `${q.question}: ${q.answer}`)
          .join("\n");

        const recPrompt = String(recommendationsPrompt)
          .replace("{proceduresAndFindings}", proceduresAndFindings)
          .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
          .replace("{etbData}", JSON.stringify(etbData || []))
          .replace("{materiality}", String(materiality));

        recommendations = await callOpenAI(recPrompt, { maxTokens: 2000 });
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      recommendations = "Error generating recommendations. Please review procedures manually.";
    }

    // Save final (avoid stale doc save / VersionError)
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
  { new: true } // return the updated doc
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
      { new: true },
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
