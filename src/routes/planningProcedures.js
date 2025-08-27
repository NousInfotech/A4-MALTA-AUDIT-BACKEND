// routes/planningProcedures.js
const express = require("express");
const router = express.Router();
const planningCtrl = require("../controllers/planningProcedureController");
const upload = require("../middlewares/upload")

// Get existing planning procedures
router.get("/:engagementId", planningCtrl.get);

// Save (draft or completed) — supports files
router.post("/:engagementId/save", upload.array("files"), planningCtrl.save);

// AI/Hybrid Step-1: generate ONLY questions+help
router.post("/:engagementId/generate/questions", planningCtrl.generateQuestions);

// AI/Hybrid Step-2: fill answers (+ optional files)
router.post("/:engagementId/generate/answers", upload.array("files"), planningCtrl.generateAnswers);

module.exports = router;
