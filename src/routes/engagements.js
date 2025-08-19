const router = require("express").Router()
const ec = require("../controllers/engagementController")
const { requireAuth, requireRole } = require("../middlewares/auth")
const upload = require("../middlewares/upload")

router.post("/", requireAuth, requireRole("employee"), ec.createEngagement)
router.get("/", requireAuth, ec.getAllEngagements)
router.get("/getClientEngagements", requireAuth, ec.getClientEngagements)
router.get("/:id", requireAuth, ec.getEngagementById)
router.patch("/:id", requireAuth, requireRole("employee"), ec.updateEngagement)
// routes/engagements.js (or wherever)
router.post("/:id/library", requireAuth, requireRole("employee"), upload.single("file"), ec.uploadToLibrary)

router.post("/:id/library/change", requireAuth, requireRole("employee"), ec.changeFolders)
// Excel Online (Microsoft) integration for ETB
router.post("/:id/etb/excel/init", requireAuth, ec.initEtbExcel);
router.post("/:id/etb/excel/push", requireAuth, ec.pushEtbToExcel);
router.post("/:id/etb/excel/pull", requireAuth, ec.pullEtbFromExcel);

router.delete("/:id/library", requireAuth, requireRole("employee"), ec.deleteFile)
// In routes/engagements.js
router.get("/:id/library", requireAuth, requireRole("employee"), ec.getLibraryFiles)

// Trial Balance routes
router.post("/:id/trial-balance", requireAuth, ec.saveTrialBalance)
router.post("/:id/trial-balance/google-sheets", requireAuth, ec.importTrialBalanceFromSheets)
router.delete("/:id/trial-balance", requireAuth, ec.deleteTrialBalance)

// Extended Trial Balance routes
router.post("/:id/etb", requireAuth, ec.saveETB)
router.get("/:id/etb", requireAuth, ec.getETB)
router.get("/:id/etb/classification/:classification", requireAuth, ec.getETBByClassification)
router.post("/:id/etb/classification/:classification/reload", requireAuth, ec.reloadClassificationFromETB)
router.post("/:id/etb/classification/:classification/spreadsheet", requireAuth, ec.createClassificationSpreadsheet)
router.put(
  "/:id/etb/classification/:classification/spreadsheet/update",
  requireAuth,
  ec.updateClassificationSpreadsheet,
)

router.get("/:id/etb/category/:category", requireAuth, ec.getETBByCategory)

router.post("/:id/sections/:classification/view-spreadsheet", requireAuth, ec.createViewOnlySpreadsheet)

// fetch & store a fresh copy from Google Sheets
router.post(
  "/:id/fetch-trial-balance",
  requireAuth,
  // requireRole('employee'),
  ec.fetchTrialBalance,
)

// retrieve the stored table
router.get("/:id/trial-balance", requireAuth, ec.getTrialBalance)

router.get("/:id/sections/:classification/working-papers/db", requireAuth, ec.getWorkingPaperFromDB);
router.post("/:id/sections/:classification/working-papers/db", requireAuth, ec.saveWorkingPaperToDB);

router.get("/:id/sections/:classification/working-papers/status", ec.getWorkingPapersStatus)
router.post("/:id/sections/:classification/working-papers/init", ec.initWorkingPapers)
router.post("/:id/sections/:classification/working-papers/push", ec.pushToWorkingPapers)
router.post("/:id/sections/:classification/working-papers/pull", ec.pullFromWorkingPapers)
router.post("/:id/sections/:classification/working-papers/fetch-rows", ec.fetchRowsFromSheets)
router.post("/:id/sections/:classification/working-papers/select-row", ec.selectRowFromSheets)
router.post("/:id/sections/:classification/working-papers/view-row", ec.viewSelectedRow)
module.exports = router
