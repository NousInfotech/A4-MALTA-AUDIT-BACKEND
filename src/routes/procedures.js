// src/routes/procedure.routes.js
const { Router } = require("express");
const {
  getManualProcedures,
  generateAIQuestions,
  generateAIAnswers,
  hybridGenerateQuestions,
  hybridGenerateAnswers,
  saveProcedure,
  getProcedure,
} = require("../controllers/procedureController");

const router = Router();

router.post("/manual", getManualProcedures);
router.post("/ai/questions", generateAIQuestions);
router.post("/ai/answers", generateAIAnswers);
router.post("/hybrid/questions", hybridGenerateQuestions);
router.post("/hybrid/answers", hybridGenerateAnswers);
router.post("/:engagementId", saveProcedure);
router.get("/:engagementId", getProcedure);

module.exports = router;
