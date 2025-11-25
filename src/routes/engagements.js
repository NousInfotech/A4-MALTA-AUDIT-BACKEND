const router = require("express").Router();
const ec = require("../controllers/engagementController");
const arc = require("../controllers/analyticalReviewController");
const etbc = require("../controllers/ExtendedTrialBalanceController");
const { requireAuth, requireRole } = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const multer = require("multer")
const multer_upload = multer({ storage: multer.memoryStorage() })
router.post("/", requireAuth, requireRole("employee"), ec.createEngagement);
router.get("/", requireAuth, ec.getAllEngagements);
router.get("/getClientEngagements", requireAuth, ec.getClientEngagements);
router.get("/:id", requireAuth, ec.getEngagementById);
router.patch("/:id", requireAuth, requireRole("employee"), ec.updateEngagement);

router.post(
  "/:id/library",
  requireAuth,
  requireRole("employee"),
  upload.single("file"),
  ec.uploadToLibrary
);

router.post(
  "/:id/library/change",
  requireAuth,
  requireRole("employee"),
  ec.changeFolders
);

router.post("/:id/etb/excel/init", requireAuth, ec.initEtbExcel);
router.post("/:id/etb/excel/push", requireAuth, ec.pushEtbToExcel);
router.post("/:id/etb/excel/pull", requireAuth, ec.pullEtbFromExcel);

router.delete(
  "/:id/library",
  requireAuth,
  requireRole("employee"),
  ec.deleteFile
);

router.get(
  "/:id/library",
  requireAuth,
  requireRole("employee"),
  ec.getLibraryFiles
);

router.post("/:id/trial-balance", requireAuth, ec.saveTrialBalance);
router.post(
  "/:id/trial-balance/google-sheets",
  requireAuth,
  ec.importTrialBalanceFromSheets
);
router.delete("/:id/trial-balance", requireAuth, ec.deleteTrialBalance);

router.post("/:id/etb", requireAuth, ec.saveETB);
router.get("/:id/etb", requireAuth, ec.getETB);

// Export routes
router.get("/:id/export/all", requireAuth, ec.exportAll); // Deprecated - kept for backward compatibility
router.get("/:id/export/etb", requireAuth, ec.exportETB);
router.get("/:id/export/adjustments", requireAuth, ec.exportAdjustments);
router.get("/:id/export/reclassifications", requireAuth, ec.exportReclassifications);
router.get("/:id/export/evidence", requireAuth, ec.exportEvidenceFiles);
router.get(
  "/:id/etb/classification/:classification",
  requireAuth,
  ec.getETBByClassification
);
router.post(
  "/:id/etb/classification/:classification/reload",
  requireAuth,
  ec.reloadClassificationFromETB
);
router.get("/:id/etb/category/:category", requireAuth, ec.getETBByCategory);

// ETB with Linked Files Routes
router.get(
  "/:id/etb/:classification/with-linked-files",
  requireAuth,
  ec.getExtendedTBWithLinkedFiles
);

router.patch(
  "/:id/etb/:classification/update-linked-files",
  requireAuth,
  ec.updateLinkedExcelFilesInExtendedTB
);

router.delete(
  "/:id/etb/:classification/delete-linked-file",
  requireAuth,
  ec.deleteWorkbookFromLinkedFilesInExtendedTB
);

// ========================================
// Extended Trial Balance with Mappings Routes
// ========================================

// Get Extended Trial Balance with mappings (supports classification filter)
router.get(
  "/:id/extended-trial-balance",
  requireAuth, // Re-enabled authentication
  (req, res, next) => {
    console.log('Route: GET /:id/extended-trial-balance called with:', {
      id: req.params.id,
      classification: req.query.classification,
      user: req.user?.id
    });
    next();
  },
  etbc.getExtendedTrialBalanceWithMappings
);

// Create or update Extended Trial Balance
router.post(
  "/:id/extended-trial-balance",
  requireAuth,
  requireRole(["employee", "admin"]),
  etbc.createOrUpdateExtendedTrialBalance
);

// Add mapping to a specific ETB row
router.post(
  "/:id/extended-trial-balance/rows/:rowId/mappings",
  requireAuth,
  requireRole(["employee", "admin"]),
  etbc.addMappingToRow
);

// Update a specific mapping
router.put(
  "/:id/extended-trial-balance/rows/:rowId/mappings/:mappingId",
  requireAuth,
  requireRole(["employee", "admin"]),
  etbc.updateMapping
);

// Remove a mapping from a specific ETB row
router.delete(
  "/:id/extended-trial-balance/rows/:rowId/mappings/:mappingId",
  requireAuth,
  requireRole(["employee", "admin"]),
  etbc.removeMappingFromRow
);

// Toggle mapping active status
router.patch(
  "/:id/extended-trial-balance/rows/:rowId/mappings/:mappingId/toggle",
  requireAuth,
  requireRole(["employee", "admin"]),
  etbc.toggleMappingStatus
);

// Get mappings for a specific workbook (across all ETBs)
router.get(
  "/extended-trial-balance/mappings/workbook/:workbookId",
  requireAuth,
  etbc.getMappingsByWorkbook
);

router.post(
  "/:id/sections/:classification/view-spreadsheet",
  requireAuth,
  ec.createViewOnlySpreadsheet
);

//workbooks

router.post(
  "/engagement/classification/excel/upload-workbook",
  requireAuth,
  multer_upload.single("file"),
  ec.uploadWorkbook
);

router.post(
  "/engagement/excel/upload-trial-balance",
  requireAuth,
  multer_upload.single("file"),
  ec.uploadTrialBalances
);



router.get(
  "/engagement/classification/excel/workbooks",
  requireAuth,
  ec.listWorkbooksInFolder
);

router.get(
  "/engagement/excel/trial-balances",
  requireAuth,
  ec.listTrialbalancesInFolder
);

router.get(
  "/engagement/classification/excel/workbooks/:workbookId/worksheets",
  requireAuth,
  ec.listWorksheetsInWorkbook
);

router.get(
  "/engagement/classification/excel/workbooks/:workbookId/sheets/:sheetName/read",
  requireAuth,
  ec.readSpecificSheetFromWorkbook
);

router.put(
  "/engagement/classification/excel/workbooks/:workbookId",
  requireAuth,
  ec.SaveOrWriteEntireWorkbook
);

router.put(
  "/engagement/classification/excel/workbooks/:workbookId/sheets/:sheetName",
  requireAuth,
  ec.SaveOrwriteSpecificSheet
);



// end workbooks

  
router.post("/:id/fetch-trial-balance", requireAuth, ec.fetchTrialBalance);

router.get("/:id/trial-balance", requireAuth, ec.getTrialBalance);

// Manually trigger prior year population for existing engagements
router.post("/:id/trial-balance/populate-prior-year", requireAuth, ec.manuallyPopulatePriorYear);

router.get(
  "/:id/sections/:classification/working-papers/db",
  requireAuth,
  ec.getWorkingPaperFromDB
);

router.get(
  "/:id/sections/:classification/working-papers/with-linked-files",
  requireAuth,
  ec.getWorkingPapersWithLinkedFiles
);

router.patch(
  "/:id/sections/:classification/working-papers/update-linked-files",
  requireAuth,
  ec.updateLinkedExcelFiles
);

router.delete(
  "/:id/sections/:classification/working-papers/delete-linked-file",
  requireAuth,
  ec.deleteWorkbookFromLinkedFiles
);
router.post(
  "/:id/sections/:classification/working-papers/db",
  requireAuth,
  ec.saveWorkingPaperToDB
);

router.get(
  "/:id/sections/:classification/working-papers/status",
  ec.getWorkingPapersStatus
);
router.post(
  "/:id/sections/:classification/working-papers/init",
  ec.initWorkingPapers
);
router.post(
  "/:id/sections/:classification/working-papers/push",
  ec.pushToWorkingPapers
);
router.post(
  "/:id/sections/:classification/working-papers/pull",
  ec.pullFromWorkingPapers
);

router.post(
  "/:id/sections/:classification/working-papers/fetch-rows",
  ec.fetchRowsFromSheets
);
router.post(
  "/:id/sections/:classification/working-papers/select-row",
  ec.selectRowFromSheets
);
router.post(
  "/:id/sections/:classification/working-papers/fetch-tabs",
  ec.fetchTabsFromSheets
);
router.post(
  "/:id/sections/:classification/working-papers/select-tab",
  ec.selectTabFromSheets
);
router.post(
  "/:id/sections/:classification/working-papers/view-reference",
  ec.viewSelectedFromDB
);

// ========================================
// Analytical Review Routes (Engagement-Nested)
// ========================================

// Create analytical review for engagement
router.post(
  "/:id/analytical-review",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.createAnalyticalReview
);

// Get analytical review by engagement
router.get(
  "/:id/analytical-review",
  requireAuth,
  arc.getAnalyticalReviewByEngagement
);

// Update analytical review
router.put(
  "/:id/analytical-review",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.updateAnalyticalReview
);

// Delete analytical review
router.delete(
  "/:id/analytical-review",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.deleteAnalyticalReview
);

// Get all versions
router.get(
  "/:id/analytical-review/versions",
  requireAuth,
  arc.getVersions
);

// Get specific version
router.get(
  "/:id/analytical-review/versions/:versionNumber",
  requireAuth,
  arc.getVersionByNumber
);

// Restore to specific version
router.post(
  "/:id/analytical-review/versions/:versionNumber/restore",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.restoreVersion
);

// Submit for review
router.post(
  "/:id/analytical-review/submit",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.submitForReview
);

// Approve review
router.post(
  "/:id/analytical-review/approve",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.approveReview
);

// Reject review
router.post(
  "/:id/analytical-review/reject",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.rejectReview
);

// Update status
router.patch(
  "/:id/analytical-review/status",
  requireAuth,
  requireRole(["employee", "admin"]),
  arc.updateStatus
);

// ========================================
// Assigned Auditors Routes
// ========================================

// Assign an auditor to an engagement
router.post(
  "/:id/auditors/assign",
  requireAuth,
  requireRole(["employee", "admin"]),
  ec.assignAuditor
);

// Unassign an auditor from an engagement
router.delete(
  "/:id/auditors/unassign",
  requireAuth,
  requireRole(["employee", "admin"]),
  ec.unassignAuditor
);

// Get all auditors assigned to an engagement
router.get(
  "/:id/auditors",
  requireAuth,
  ec.getAssignedAuditors
);

// Get all engagements for a specific auditor
router.get(
  "/auditors/:auditorId/engagements",
  requireAuth,
  ec.getAuditorEngagements
);

module.exports = router;
