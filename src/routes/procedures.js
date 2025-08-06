// routes/procedures.js
const router = require('express').Router();
const pc = require('../controllers/procedureController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Auditor seeds the fixed checklist for an engagement
router.post(
  '/',
  requireAuth,
  requireRole('employee'),
  pc.seedProcedures
);

// List all procedures for an engagement
router.get(
  '/engagement/:engagementId',
  requireAuth,
  pc.getProceduresByEngagement
);

// Update one task’s completion status
router.patch(
  '/:procedureId/tasks/:taskId',
  requireAuth,
  pc.updateTask
);

module.exports = router;
