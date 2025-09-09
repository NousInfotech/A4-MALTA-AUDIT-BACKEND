// src/routes/procedure.routes.js
const { Router } = require("express");
const {
  getManualProcedures,
  generateAIQuestions,
  generateAIAnswers,
  hybridGenerateQuestions,
  hybridGenerateAnswers,
  saveProcedure,
  generateHybridClassificationQuestion,
  getProcedure,
  generateAIClassificationAnswers,
generateAIClassificationQuestions,
} = require("../controllers/procedureController");

const router = Router();

router.post("/manual", getManualProcedures);
router.post("/ai/questions", generateAIQuestions);
router.post("/ai/answers", generateAIAnswers);
router.post("/hybrid/questions", hybridGenerateQuestions);
router.post("/hybrid/answers", hybridGenerateAnswers);
router.post("/:engagementId", saveProcedure);
router.get("/:engagementId", getProcedure);
// Add these new routes
router.post("/ai/classification-questions", generateAIClassificationQuestions);
router.post("/ai/classification-answers", generateAIClassificationAnswers);
// Add this new route for hybrid classification questions
router.post("/hybrid/classification-questions", generateHybridClassificationQuestion);

module.exports = router;
