const router = require('express').Router();
const pbcController = require('../controllers/pbcController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * PBC Workflow Routes
 */

// Create PBC workflow
router.post(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can create PBC workflows
  pbcController.createPBC
);

// Get PBC by engagement ID
router.get(
  '/engagement/:engagementId',
  requireAuth,
  pbcController.getPBCByEngagement
);

// Update PBC workflow
router.patch(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can update PBC workflows
  pbcController.updatePBC
);

// Delete PBC workflow
router.delete(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can delete PBC workflows
  pbcController.deletePBC
);

// Get all PBC workflows (for dashboard)
router.get(
  '/',
  requireAuth,
  requireRole('employee'), // Only auditors can view all PBCs
  pbcController.getAllPBCs
);

/**
 * QnA Category Routes
 */

// Create QnA category
router.post(
  '/categories',
  requireAuth,
  requireRole('employee'), // Only auditors can create categories
  pbcController.createCategory
);

// Get categories by PBC ID
router.get(
  '/categories/pbc/:pbcId',
  requireAuth,
  pbcController.getCategoriesByPBC
);

// Add question to category
router.post(
  '/categories/:categoryId/questions',
  requireAuth,
  requireRole('employee'), // Only auditors can add questions
  pbcController.addQuestionToCategory
);

// Update question status
router.patch(
  '/categories/:categoryId/questions/:questionIndex',
  requireAuth,
  pbcController.updateQuestionStatus
);

// Add discussion to question (for doubt resolution)
router.post(
  '/categories/:categoryId/questions/:questionIndex/discussions',
  requireAuth,
  pbcController.addDiscussion
);

// Delete category
router.delete(
  '/categories/:categoryId',
  requireAuth,
  requireRole('employee'), // Only auditors can delete categories
  pbcController.deleteCategory
);

module.exports = router;
