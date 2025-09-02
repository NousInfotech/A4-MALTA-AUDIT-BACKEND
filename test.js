/* eslint-disable no-console */
// tests/procedures.e2e.test.js
// Usage:
//   QUICK (no LLM calls):    node tests/procedures.e2e.test.js
//   FULL (with LLM calls):   RUN_LLM=1 node tests/procedures.e2e.test.js
//
// Notes:
// - If RUN_LLM=1, your backend must have OPENAI_API_KEY set, otherwise AI steps will 500.
// - This script assumes your server is listening on http://localhost:8000

const axios = require("axios");
const assert = require("assert");
require("dotenv").config();

const BASE = process.env.API_BASE || "http://localhost:8000";
const RUN_LLM = 1; // toggle AI/hybrid calls

// Minimal fake context you can tweak
const SAMPLE_CONTEXT = {
  entity: "DemoCo Ltd.",
  period: "FY2024",
  materiality: { overall: 100000, perf: 60000 },
  etb: [
    { code: "1001", name: "Trade Receivables", balance: 350000 },
    { code: "2001", name: "Trade Payables", balance: 270000 },
    { code: "3001", name: "Revenue", balance: 2500000 },
  ],
  notes: "Synthetic test context for API E2E."
};

const headers = { "Content-Type": "application/json" };

function engagementId() {
  return `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function post(path, payload) {
  const url = `${BASE}${path}`;
  const res = await axios.post(url, payload, { headers, validateStatus: () => true });
  if (res.status >= 400) {
    const msg = res.data && res.data.error ? res.data.error : res.statusText;
    throw new Error(`${res.status} ${msg} on ${path}`);
  }
  return res.data;
}

function expectManualPackShape(packs) {
  assert(Array.isArray(packs), "manualPacks must be an array");
  for (const p of packs) {
    assert(typeof p.sectionId === "string" && p.sectionId.length > 0, "manual pack needs sectionId");
    assert(typeof p.title === "string" && p.title.length > 0, "manual pack needs title");
    assert(Array.isArray(p.fields) && p.fields.length > 0, "manual pack needs fields[]");
    // spot-check one field
    const f = p.fields[0];
    assert(f && (f.type || f.question), "field must have type/question");
  }
}

function expectQuestionsShape(questions) {
  assert(Array.isArray(questions), "questions must be array");
  const q = questions[0];
  assert(q, "at least one question expected");
  assert(typeof (q.question || q.label) === "string", "question/label must be string");
}

function expectAnswersShape(answers, recommendations) {
  assert(Array.isArray(answers), "answers must be array");
  assert(Array.isArray(recommendations), "recommendations must be array");
}

(async () => {
  const eid = engagementId();
  const user = "tester@local";
  const framework = "IFRS";

  // ---- MANUAL --------------------------------------------------------------
  // Selections include:
  // - Assets>Current>Trade Receivables  -> should resolve to deepest (Receivables pack)
  // - Liabilities>Current>Trade Payables-> deepest (Payables pack)
  // - Expenses>Administrative Expenses>Payroll -> top-level P&L pack only (per your rule)
  const manualSelections = [
    "Assets > Current > Trade Receivables",
    "Liabilities > Current > Trade Payables",
    "Expenses > Administrative Expenses > Payroll"
  ];

  console.log("▶ MANUAL /api/procedures/manual");
  const manualResp = await post("/api/procedures/manual", {
    engagementId: eid,
    framework,
    classifications: manualSelections,
    createdBy: user
  });

  assert(manualResp.ok === true, "manual ok flag");
  assert(manualResp.procedureId, "manual procedureId missing");
  expectManualPackShape(manualResp.manualPacks);

  // Heuristic checks for routing rule:
  const joinedTitles = manualResp.manualPacks.map(p => p.title).join(" | ").toLowerCase();
  assert(joinedTitles.includes("receivables"), "expected a Receivables-related pack for Trade Receivables");
  assert(joinedTitles.includes("payables"), "expected a Payables-related pack for Trade Payables");
  assert(joinedTitles.includes("profit & loss") || joinedTitles.includes("profit and loss"),
    "expected P&L pack for Expenses top-level mapping");

  console.log("✅ MANUAL passed");

  if (!RUN_LLM) {
    console.log("\n(LLM steps skipped — set RUN_LLM=1 to exercise AI/Hybrid flows)\n");
    console.log("ALL DONE (manual-only)");
    process.exit(0);
  }

  // ---- AI (STEP 1: Questions) ---------------------------------------------
  console.log("▶ AI STEP-1 /api/procedures/ai/questions");
  const aiQResp = await post("/api/procedures/ai/questions", {
    engagementId: eid,
    framework,
    classifications: manualSelections,
    context: SAMPLE_CONTEXT,
    createdBy: user
  });

  assert(aiQResp.ok === true, "ai questions ok flag");
  assert(aiQResp.procedureId, "ai questions procedureId missing");
  expectQuestionsShape(aiQResp.aiQuestions);
  console.log("✅ AI STEP-1 (questions) passed");

  // ---- AI (STEP 2: Answers + Recs) ----------------------------------------
  console.log("▶ AI STEP-2 /api/procedures/ai/answers");
  const aiAResp = await post("/api/procedures/ai/answers", {
    procedureId: aiQResp.procedureId,
    engagementId: eid,
    framework,
    context: SAMPLE_CONTEXT,
    // include all generated questions + simulate one user-added
    questions: [
      ...aiQResp.aiQuestions.slice(0, 5), // keep payload light
      {
        key: "user_added_1",
        classificationTag: "Custom",
        question: "Have all contra-revenue credit notes after year-end been matched to invoices?",
        assertions: ["Completeness", "Cut-off"],
        commentable: true
      }
    ]
  });

  assert(aiAResp.ok === true, "ai answers ok flag");
  assert(aiAResp.procedureId === aiQResp.procedureId, "ai answers should update same doc");
  expectAnswersShape(aiAResp.aiAnswers, aiAResp.recommendations);
  console.log("✅ AI STEP-2 (answers+recs) passed");

  // ---- HYBRID (STEP 1: Manual + extra AI Questions) -----------------------
  console.log("▶ HYBRID STEP-1 /api/procedures/hybrid/questions");
  const hyQResp = await post("/api/procedures/hybrid/questions", {
    engagementId: eid,
    framework,
    classifications: [
      "Assets > Non-current > Property, Plant & Equipment",
      "Income > Operating > Revenue (Goods)"
    ],
    context: SAMPLE_CONTEXT,
    createdBy: user
  });

  assert(hyQResp.ok === true, "hybrid questions ok flag");
  assert(hyQResp.procedureId, "hybrid procedureId missing");
  expectManualPackShape(hyQResp.manualPacks);
  expectQuestionsShape(hyQResp.aiQuestions);
  console.log("✅ HYBRID STEP-1 passed");

  // ---- HYBRID (STEP 2: Answers + Recs for all questions) ------------------
  console.log("▶ HYBRID STEP-2 /api/procedures/hybrid/answers");
  const allQs = [
    // flatten a small set of manual fields to question-like items (label → question)
    ...hyQResp.manualPacks.flatMap(p =>
      p.fields.slice(0, 3).map(f => ({
        key: f.key || `${p.sectionId}_${Math.random().toString(36).slice(2,8)}`,
        classificationTag: p.title,
        question: f.question || f.label || "(manual field)",
        assertions: f.assertions || [],
        commentable: true
      }))
    ),
    // and include a few AI questions from STEP-1
    ...hyQResp.aiQuestions.slice(0, 5)
  ];

  const hyAResp = await post("/api/procedures/hybrid/answers", {
    procedureId: hyQResp.procedureId,
    framework,
    context: SAMPLE_CONTEXT,
    allQuestions: allQs
  });

  assert(hyAResp.ok === true, "hybrid answers ok flag");
  assert(hyAResp.procedureId === hyQResp.procedureId, "hybrid answers should update same doc");
  expectAnswersShape(hyAResp.aiAnswers, hyAResp.recommendations);
  console.log("✅ HYBRID STEP-2 passed");

  // -------------------------------------------------------------------------
  console.log("\n🎉 ALL TESTS PASSED\n");
})().catch((err) => {
  console.error("\n❌ TEST FAILED");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
