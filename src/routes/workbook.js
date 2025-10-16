// routes/workbookRoutes.ts
const router = require("express").Router();
const workbookController = require('../controllers/workbookController');
const { requireAuth } = require("../middlewares/auth");




// Workbooks
router.get('/:engagementId/:classification/workbooks/list', requireAuth, workbookController.listWorkbooks); // List all workbooks for an engagement
router.get('/:workbookId', requireAuth, workbookController.getWorkbookById); // Get a single workbook and its sheets

// store parsed workbook, sheet data
router.post('/work-bookdata', requireAuth, workbookController.uploadWorkbookDataAndSheetData);

// Sheets
router.get('/:workbookId/sheets', requireAuth, workbookController.listSheets); // Get list of sheet names for a workbook
router.get('/:workbookId/sheets/:sheetName', requireAuth, workbookController.getSheetData); // Get data for a specific sheet

// Save operations (for edited workbook/sheet data)
router.post('/save-workbook', requireAuth, workbookController.saveWorkbook); // Save/update entire workbook data
router.post('/save-sheet', requireAuth, workbookController.saveSheet); // Save/update a single sheet's data

// Mappings (embedded in Workbook, so update workbook to manage them)
// No direct mapping routes needed if embedded, use workbook update routes
router.post('/:workbookId/mappings', requireAuth, workbookController.createMapping);
router.put('/:workbookId/mappings/:mappingId', requireAuth, workbookController.updateMapping);
router.delete('/:workbookId/mappings/:mappingId', requireAuth, workbookController.deleteMapping);

// Named Ranges (embedded in Workbook, so update workbook to manage them)
// No direct named range routes needed if embedded, use workbook update routes
router.post('/:workbookId/named-ranges', requireAuth, workbookController.createNamedRange);
router.put('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.updateNamedRange);
router.delete('/:workbookId/named-ranges/:namedRangeId', requireAuth, workbookController.deleteNamedRange);


module.exports = router;