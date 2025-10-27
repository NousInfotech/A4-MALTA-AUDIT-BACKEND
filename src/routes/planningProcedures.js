// routes/planningProcedures.js
const express = require("express");
const router = express.Router();
const planningCtrl = require("../controllers/planningProcedureController");
const planningCtrlTest = require("../controllers/planningProcedureController.test");
const upload = require("../middlewares/upload")

// Get existing planning procedures
router.get("/:engagementId", planningCtrl.get);

// Save (draft or completed) — supports files
router.post("/:engagementId/save", upload.array("files"), planningCtrl.save);

// Generate questions for a specific section (ORIGINAL)
router.post("/:engagementId/generate/section-questions", planningCtrl.generateSectionQuestions);

// Generate questions for a specific section (HYBRID BATCH TEST)
router.post("/:engagementId/generate/section-questions-hybrid", planningCtrlTest.generateSectionQuestionsHybrid);

// Generate answers for a specific section
router.post("/:engagementId/generate/section-answers", planningCtrl.generateSectionAnswers);

// Generate recommendations
router.post("/:engagementId/generate/recommendations", planningCtrl.generateRecommendations);

// NEW: Hybrid Section Questions
router.post("/:engagementId/generate/hybrid-section-questions", planningCtrl.generateHybridSectionQuestions)

// NEW: Hybrid Section Answers
router.post("/:engagementId/generate/hybrid-section-answers", planningCtrl.generateHybridSectionAnswers)

module.exports = router;