// reordering

const router = require("express").Router();
const workbookController = require('../controllers/workbookController');
const { requireAuth } = require("../middlewares/auth");



// ===================================================================
// 1. SPECIFIC ROUTES (No path parameters in the main segment)
//    These must come first to avoid being caught by generic routes.
// ===================================================================

router.post('/', requireAuth, workbookController.saveWorkbookAndSheets);
router.post('/work-bookdata', requireAuth, workbookController.uploadWorkbookDataAndSheetData);
router.post('/save-workbook', requireAuth, workbookController.saveWorkbook);
router.post('/save-sheet', requireAuth, workbookController.saveSheet);


// ===================================================================
// 2. SEMI-SPECIFIC ROUTES (Have a specific structure with parameters)
//    These are more specific than a simple /:id, so they come next.
// ===================================================================

router.get('/engagement/:engagementId/all', requireAuth, workbookController.listAllWorkbooksForEngagement); // ✅ NEW: Fetch all workbooks for engagement (no classification filter)
router.get('/:engagementId/:classification/workbooks/list', requireAuth, workbookController.listWorkbooks);
router.get('/engagement/:engagementId/trial-balance/list', requireAuth, workbookController.listTrialBalanceWorkbooks);


// ===================================================================
// 3. GENERIC ROUTES (Catch-all routes with path parameters)
//    These are the most general and MUST come last.
// ===================================================================

// Routes for a specific workbook by its ID

router.get('/:workbookId/sheets/:sheetName/data/:versionTag?', requireAuth, workbookController.getSpecificSheetData);
router.get('/:workbookId/sheets', requireAuth, workbookController.listSheets);
router.get('/:workbookId/logs', requireAuth, workbookController.getWorkbookLogs);
router.post('/:workbookId/update-sheets', requireAuth, workbookController.updateSheetsData);

// NOTE: The two routes below are the most generic and were causing the issue.
// They are now placed at the very end.
router.get('/:id', requireAuth, workbookController.getWorkbookWithSheets);
// router.get('/:workbookId', requireAuth, workbookController.getWorkbookById);

// Other generic routes for a specific workbook
router.delete('/:workbookId', requireAuth, workbookController.deleteWorkbook);
router.patch("/:id/custom-fields", requireAuth, workbookController.addOrUpdateCustomField);

// Nested resource routes for a specific workbook
router.post('/:workbookId/mappings', requireAuth, workbookController.createMapping);
router.put('/:workbookId/mappings/:mappingId', requireAuth, workbookController.updateMapping);
router.delete('/:workbookId/mappings/:mappingId', requireAuth, workbookController.deleteMapping);

router.post('/:workbookId/named-ranges', requireAuth, workbookController.createNamedRange);
router.put('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.updateNamedRange);
router.delete('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.deleteNamedRange);


module.exports = router;