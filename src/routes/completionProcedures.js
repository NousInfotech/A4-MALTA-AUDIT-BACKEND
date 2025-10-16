// routes/completionProcedures.js
const express = require("express");
const router = express.Router();
const completionCtrl = require("../controllers/completionProcedureController");
const upload = require("../middlewares/upload")

// Get existing completion procedures
router.get("/:engagementId", completionCtrl.get);

// Save (draft or completed) — supports files
router.post("/:engagementId/save", upload.array("files"), completionCtrl.save);

// Generate questions for a specific section
router.post("/:engagementId/generate/section-questions", completionCtrl.generateSectionQuestions);

// Generate answers for a specific section
router.post("/:engagementId/generate/section-answers", completionCtrl.generateSectionAnswers);

// Generate recommendations
router.post("/:engagementId/generate/recommendations", completionCtrl.generateRecommendations);

// Hybrid Section Questions
router.post("/:engagementId/generate/hybrid-section-questions", completionCtrl.generateHybridSectionQuestions)

// Hybrid Section Answers
router.post("/:engagementId/generate/hybrid-section-answers", completionCtrl.generateHybridSectionAnswers)

module.exports = router;