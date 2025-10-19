// routes/workbookRoutes.ts
const router = require("express").Router();
const workbookController = require('../controllers/workbookController');
const { requireAuth } = require("../middlewares/auth");


router.post('/', requireAuth, workbookController.saveWorkbookAndSheets);

// Route to get a specific workbook with all its current sheets populated
router.get('/:id', requireAuth, workbookController.getWorkbookWithSheets);

// DELETE /api/workbooks/:workbookId
router.delete('/:workbookId', requireAuth, workbookController.deleteWorkbook);

// Route to get a specific historical version of a workbook
router.get('/:workbookId/versions/:versionTag', requireAuth, workbookController.getHistoricalWorkbookVersion);

// Route to get data for a specific sheet within a workbook, supporting versionTag
router.get('/:workbookId/sheets/:sheetName/data/:versionTag?', requireAuth, workbookController.getSpecificSheetData);

// Workbooks
router.get('/:engagementId/:classification/workbooks/list', requireAuth, workbookController.listWorkbooks);
router.get('/:workbookId', requireAuth, workbookController.getWorkbookById); // Get a single workbook and its sheets

// store parsed workbook, sheet data
router.post('/work-bookdata', requireAuth, workbookController.uploadWorkbookDataAndSheetData);

// Sheets
router.get('/:workbookId/sheets', requireAuth, workbookController.listSheets); // Get list of sheet names for a workbook

// Save operations (for edited workbook/sheet data)
router.post('/save-workbook', requireAuth, workbookController.saveWorkbook); // Save/update entire workbook data
router.post('/save-sheet', requireAuth, workbookController.saveSheet); // Save/update a single sheet's data

// Mappings (embedded in Workbook, so update workbook to manage them)
router.post('/:workbookId/mappings', requireAuth, workbookController.createMapping);
router.put('/:workbookId/mappings/:mappingId', requireAuth, workbookController.updateMapping);
router.delete('/:workbookId/mappings/:mappingId', requireAuth, workbookController.deleteMapping);

// Named Ranges (embedded in Workbook, so update workbook to manage them)
router.post('/:workbookId/named-ranges', requireAuth, workbookController.createNamedRange);
router.put('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.updateNamedRange);
router.delete('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.deleteNamedRange);
router.patch("/:id/custom-fields", requireAuth,  workbookController.addOrUpdateCustomField);
router.get("/:workbookId/logs/", requireAuth,  workbookController.getWorkbookLogs);

module.exports = router;