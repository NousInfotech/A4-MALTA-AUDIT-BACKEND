const router = require('express').Router();
const pc = require('../controllers/procedureController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post(
  '/',
  requireAuth,
  requireRole('employee'),
  pc.seedProcedures
);

router.get(
  '/engagement/:engagementId',
  requireAuth,
  pc.getProceduresByEngagement
);

router.patch(
  '/:procedureId/tasks/:taskId',
  requireAuth,
  pc.updateTask
);

module.exports = router;
