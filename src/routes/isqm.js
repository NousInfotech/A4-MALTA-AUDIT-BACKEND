const router = require('express').Router();
const isqmController = require('../controllers/isqmController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * ISQM Parent Routes
 */

// Create ISQM Parent (from JSON upload)
router.post(
  '/parents',
  requireAuth,
  requireRole('employee'), // Only auditors can create ISQM packs
  isqmController.createISQMParent
);

// Get all ISQM Parents
router.get(
  '/parents',
  requireAuth,
  requireRole('employee'), // Only auditors can view all ISQM packs
  isqmController.getAllISQMParents
);

// Get ISQM Parent by ID
router.get(
  '/parents/:id',
  requireAuth,
  isqmController.getISQMParentById
);

// Update ISQM Parent
router.patch(
  '/parents/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can update ISQM packs
  isqmController.updateISQMParent
);

// Delete ISQM Parent
router.delete(
  '/parents/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can delete ISQM packs
  isqmController.deleteISQMParent
);

/**
 * ISQM Questionnaire Routes
 */

// Create questionnaire
router.post(
  '/questionnaires',
  requireAuth,
  requireRole('employee'), // Only auditors can create questionnaires
  isqmController.createQuestionnaire
);

// Get questionnaires by parent
router.get(
  '/parents/:parentId/questionnaires',
  requireAuth,
  isqmController.getQuestionnairesByParent
);

// Get questionnaire by ID
router.get(
  '/questionnaires/:id',
  requireAuth,
  isqmController.getQuestionnaireById
);

// Update questionnaire
router.patch(
  '/questionnaires/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can update questionnaire structure
  isqmController.updateQuestionnaire
);

// Delete questionnaire
router.delete(
  '/questionnaires/:id',
  requireAuth,
  requireRole('employee'), // Only auditors can delete questionnaires
  isqmController.deleteQuestionnaire
);

// Update question answer
router.patch(
  '/questionnaires/:questionnaireId/sections/:sectionIndex/questions/:questionIndex',
  requireAuth,
  isqmController.updateQuestionAnswer
);

// Add section note
router.post(
  '/questionnaires/:questionnaireId/sections/:sectionIndex/notes',
  requireAuth,
  isqmController.addSectionNote
);

// Get questionnaire statistics
router.get(
  '/questionnaires/:id/stats',
  requireAuth,
  isqmController.getQuestionnaireStats
);

// Bulk update answers
router.patch(
  '/questionnaires/:questionnaireId/answers/bulk',
  requireAuth,
  isqmController.bulkUpdateAnswers
);

// Export questionnaire data
router.get(
  '/questionnaires/:id/export',
  requireAuth,
  isqmController.exportQuestionnaire
);

/**
 * ISQM Supporting Document Routes
 */

// Create supporting document request
router.post(
  '/supporting-documents',
  requireAuth,
  requireRole('employee'), // Only employees can create document requests
  isqmController.createSupportingDocument
);

// Get supporting documents by parent
router.get(
  '/parents/:parentId/supporting-documents',
  requireAuth,
  isqmController.getSupportingDocumentsByParent
);

// Get supporting document by ID
router.get(
  '/supporting-documents/:id',
  requireAuth,
  isqmController.getSupportingDocumentById
);

// Update supporting document
router.patch(
  '/supporting-documents/:id',
  requireAuth,
  requireRole('employee'), // Only employees can update document requests
  isqmController.updateSupportingDocument
);

// Delete supporting document
router.delete(
  '/supporting-documents/:id',
  requireAuth,
  requireRole('employee'), // Only employees can delete document requests
  isqmController.deleteSupportingDocument
);

// Upload document file
router.post(
  '/supporting-documents/:id/upload',
  requireAuth,
  requireRole('employee'), // Only employees can upload files
  isqmController.uploadDocumentFile
);

// Review supporting document
router.patch(
  '/supporting-documents/:id/review',
  requireAuth,
  requireRole('employee'), // Only employees can review documents
  isqmController.reviewSupportingDocument
);

// Add note to supporting document
router.post(
  '/supporting-documents/:id/notes',
  requireAuth,
  isqmController.addDocumentNote
);

// Get supporting document statistics
router.get(
  '/parents/:parentId/supporting-documents/stats',
  requireAuth,
  isqmController.getSupportingDocumentStats
);

module.exports = router;
