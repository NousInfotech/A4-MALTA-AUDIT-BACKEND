// src/routes/procedure.routes.js
const { Router } = require("express");
const {
  generateAIAnswers,
  hybridGenerateQuestions,
  saveProcedure, 
  generateAIClassificationAnswersSeparate,
  // generateHybridClassificationQuestion,
  getProcedure,
  saveProcedurebySection,
  generateAIClassificationAnswers,
generateAIClassificationQuestions,
} = require("../controllers/procedureController");

const router = Router();
// Add this import
const { generateRecommendations } = require("../controllers/procedureController");

// Add this route before module.exports
router.post("/recommendations", generateRecommendations);
router.post("/hybrid/questions", hybridGenerateQuestions);
router.post("/:engagementId", saveProcedure);
router.post("/:engagementId/section", saveProcedurebySection);
router.get("/:engagementId", getProcedure);
router.get("/:engagementId/section", getProcedure);
// Add these new routes
router.post("/ai/classification-questions", generateAIClassificationQuestions);
router.post("/ai/classification-answers", generateAIClassificationAnswers);
router.post("/ai/classification-answers/separate", generateAIClassificationAnswersSeparate);
// Add this new route for hybrid classification questions
// router.post("/hybrid/classification-questions", generateHybridClassificationQuestion);

module.exports = router;
