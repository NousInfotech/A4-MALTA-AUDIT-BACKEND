// controllers/engagementController.js
// server/controllers/engagementController.js
const WorkingPaper = require("../models/WorkingPaper"); // <-- add this line
const msExcel = require("../services/microsoftExcelService")
const Engagement = require("../models/Engagement")
const EngagementLibrary = require("../models/EngagementLibrary")
const { supabase } = require("../config/supabase")
const sheetService = require("../services/googleSheetsService")
const { isQuotaExceededError } = require("../services/googleSheetsService")
const TrialBalance = require("../models/TrialBalance")
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")
const ClassificationSection = require("../models/ClassificationSection")
const mongoose = require("mongoose")
const multer = require("multer")
const XLSX = require("xlsx")
const Papa = require("papaparse")

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  
function etbRowsToAOA(rows) {
  const header = [
    "Code",
    "Account Name",
    "Current Year",
    "Prior Year",
    "Adjustments",
    "Final Balance",
    "Grouping 1",
    "Grouping 2",
    "Grouping 3",
  ]

  const data = (rows || []).map((r) => {
    const parts = String(r.classification || "")
      .split(" > ")
      .map((s) => s.trim())
      .filter(Boolean)

    const g1 = parts[0] || ""
    const g2 = parts[1] || ""
    const g3 = parts[2] || ""

    const cy = Number(r.currentYear) || 0
    const py = Number(r.priorYear) || 0
    const adj = Number(r.adjustments) || 0

    return [
      r.code ?? "",
      r.accountName ?? "",
      cy,
      py,
      adj,
      "", // Final Balance left blank; formulas applied by writeSheet
      g1,
      g2,
      g3,
    ]
  })

  const aoa = [header, ...data]

  // Append a totals ROW with SUM formulas if there is at least one data row.
  // Column letters (based on header): C=Current Year, D=Prior Year, E=Adjustments, F=Final Balance
  if (data.length > 0) {
    const startRow = 2 // first data row (row 1 is header)
    const endRow = 1 + data.length // last data row index
    aoa.push([
      "TOTALS",
      "",
      `=SUM(C${startRow}:C${endRow})`,
      `=SUM(D${startRow}:D${endRow})`,
      `=SUM(E${startRow}:E${endRow})`,
      `=SUM(F${startRow}:F${endRow})`,
      "",
      "",
      "",
    ])
  }

  return aoa
}

function aoaToEtbRows(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return []
  const [hdr, ...raw] = aoa

  // Drop totals ROW (first cell equals "TOTALS")
  const data = raw.filter((r) => {
    const firstCell = String(r?.[0] ?? "")
      .trim()
      .toLowerCase()
    return firstCell !== "totals"
  })

  const idx = (name) => hdr.findIndex((h) => String(h).toLowerCase().trim() === String(name).toLowerCase())

  const iCode = idx("Code")
  const iName = idx("Account Name")
  const iCY = idx("Current Year")
  const iPY = idx("Prior Year")
  const iAdj = idx("Adjustments")
  const iFB = idx("Final Balance")

  const iG1 = idx("Grouping 1")
  const iG2 = idx("Grouping 2")
  const iG3 = idx("Grouping 3")
  const iCls = idx("Classification") // legacy fallback

  return data.map((row, k) => {
    const cy = Number(row?.[iCY] ?? 0)
    const adj = Number(row?.[iAdj] ?? 0)
    const fb = Number(row?.[iFB] ?? Number.NaN) || cy + adj

    let classification = ""
    if (iG1 !== -1 || iG2 !== -1 || iG3 !== -1) {
      const g1 = (iG1 !== -1 ? String(row?.[iG1] ?? "") : "").trim()
      const g2 = (iG2 !== -1 ? String(row?.[iG2] ?? "") : "").trim()
      const g3 = (iG3 !== -1 ? String(row?.[iG3] ?? "") : "").trim()
      classification = [g1, g2, g3].filter(Boolean).join(" > ")
    } else if (iCls !== -1) {
      // Back-compat: single "Classification" column, if present
      classification = String(row?.[iCls] ?? "").trim()
    }

    return {
      id: `row-${Date.now()}-${k}`,
      code: row?.[iCode] ?? "",
      accountName: row?.[iName] ?? "",
      currentYear: cy,
      priorYear: Number(row?.[iPY] ?? 0),
      adjustments: adj,
      finalBalance: fb,
      classification, // may be "" if unclassified
    }
  })
}

// POST /api/engagements/:id/etb/excel/init
exports.initEtbExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
      engagementId,
    })
    await Engagement.findByIdAndUpdate(engagementId, { excelURL: webUrl })

    const ClassificationSection = require("../models/ClassificationSection")
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    })
    if (!section) {
      section = await ClassificationSection.create({
        engagement: engagementId,
        classification: "ETB",
        spreadsheetId: driveItemId,
        spreadsheetUrl: webUrl,
        lastSyncAt: new Date(),
      })
    } else {
      section.spreadsheetId = driveItemId
      section.spreadsheetUrl = webUrl
      section.lastSyncAt = new Date()
      await section.save()
    }

    // IMPORTANT: write **headers only** on init (no data).
    const headersOnly = [
      [
        "Code",
        "Account Name",
        "Current Year",
        "Prior Year",
        "Adjustments",
        "Final Balance",
        "Grouping 1",
        "Grouping 2",
        "Grouping 3",
      ],
    ]

    await msExcel.writeSheet({
      driveItemId,
      worksheetName: "ETB",
      values: headersOnly,
    })

    return res.status(200).json({ spreadsheetId: driveItemId, url: webUrl })
  } catch (err) {
    next(err)
  }
}

// POST /api/engagements/:id/etb/excel/push
exports.pushEtbToExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    const ClassificationSection = require("../models/ClassificationSection")
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    })
    if (!section?.spreadsheetId) {
      const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
        engagementId,
      })
      if (!section) {
        section = await ClassificationSection.create({
          engagement: engagementId,
          classification: "ETB",
          spreadsheetId: driveItemId,
          spreadsheetUrl: webUrl,
        })
      } else {
        section.spreadsheetId = driveItemId
        section.spreadsheetUrl = webUrl
        await section.save()
      }
    }

    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")
    const existing = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    })

    // On push, write full AOA (includes totals formulas if rows exist).
    const aoa = existing
      ? etbRowsToAOA(existing.rows || [])
      : [
          [
            "Code",
            "Account Name",
            "Current Year",
            "Prior Year",
            "Adjustments",
            "Final Balance",
            "Grouping 1",
            "Grouping 2",
            "Grouping 3",
          ],
        ]

    await msExcel.writeSheet({
      driveItemId: section.spreadsheetId,
      worksheetName: "ETB",
      values: aoa,
    })

    section.lastSyncAt = new Date()
    await section.save()

    return res.status(200).json({ ok: true, url: section.spreadsheetUrl })
  } catch (err) {
    next(err)
  }
}

// POST /api/engagements/:id/etb/excel/pull
exports.pullEtbFromExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    const ClassificationSection = require("../models/ClassificationSection")
    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")

    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    })
    if (!section?.spreadsheetId) {
      return res.status(400).json({
        message: "Excel workbook not initialized. Click 'Initialize Excel' first.",
      })
    }

    const aoa = await msExcel.readSheet({
      driveItemId: section.spreadsheetId,
      worksheetName: "ETB",
    })

    const rows = aoaToEtbRows(aoa)

    let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
    if (etb) {
      etb.rows = rows
      etb.updatedAt = new Date()
      await etb.save()
    } else {
      etb = await ExtendedTrialBalance.create({ engagement: engagementId, rows })
    }

    section.lastSyncAt = new Date()
    await section.save()

    return res.status(200).json(etb)
  } catch (err) {
    next(err)
  }
}

// ----------------------------------------------
// URL ↔ storage helpers (and filename from URL)
// ----------------------------------------------
function extractStoragePathFromPublicUrl(url) {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    const after = urlObj.pathname.split("/storage/v1/object/public/engagement-documents/")[1]
    return after ? decodeURIComponent(after) : null
  } catch {
    return null
  }
}

function getFileNameFromPublicUrl(url) {
  const path = extractStoragePathFromPublicUrl(url)
  if (!path) return null
  const last = path.split("/").pop() || ""
  return last.split("?")[0] // ignore version query param
}

// Remove ALL existing library resources (DB + Storage) for this engagement+category
async function removeExistingLibraryResource(engagementId, category) {
  const existing = await EngagementLibrary.find({
    engagement: engagementId,
    category,
    url: { $ne: "" },
  })

  if (!existing?.length) return

  const paths = existing.map((doc) => extractStoragePathFromPublicUrl(doc.url)).filter(Boolean)

  if (paths.length) {
    // Ignore errors if any objects are already gone
    await supabase.storage.from("engagement-documents").remove(paths)
  }

  await EngagementLibrary.deleteMany({
    engagement: engagementId,
    category,
    url: { $ne: "" },
  })
}

// Remove a specific storage object path (no-throw helper)
async function safeRemoveStoragePath(path) {
  if (!path) return
  try {
    await supabase.storage.from("engagement-documents").remove([path])
  } catch {
    // ignore
  }
}

// Upload a Buffer as an .xlsx into Storage and create a Library record.
async function uploadBufferToLibrary({ engagementId, category, buffer, fileName, allowMultiple = false }) {
  // Remove all or just the same-filename doc
  if (!allowMultiple) {
    await removeExistingLibraryResource(engagementId, category)
  } else {
    const existing = await EngagementLibrary.find({
      engagement: engagementId,
      category,
      url: { $ne: "" },
    })
    for (const doc of existing) {
      const existingName = getFileNameFromPublicUrl(doc.url)
      if (existingName && existingName === fileName) {
        const existingPath = extractStoragePathFromPublicUrl(doc.url)
        if (existingPath) {
          try {
            await supabase.storage.from("engagement-documents").remove([existingPath])
          } catch {
            /* ignore */
          }
        }
        try {
          await EngagementLibrary.deleteOne({ _id: doc._id })
        } catch {
          /* ignore */
        }
      }
    }
  }

  const filePath = `${engagementId}/${category}/${fileName}`

  const doUpload = () =>
    supabase.storage.from("engagement-documents").upload(filePath, buffer, {
      contentType: EXCEL_MIME,
      upsert: false, // do not overwrite silently
      cacheControl: "0", // send Cache-Control: max-age=0
    })

  let { data: uploadData, error } = await doUpload()
  if (error && String(error.message).toLowerCase().includes("exists")) {
    try {
      await supabase.storage.from("engagement-documents").remove([filePath])
    } catch {}
    ;({ data: uploadData, error } = await doUpload())
  }
  if (error) throw error

  const { data: pub } = supabase.storage.from("engagement-documents").getPublicUrl(uploadData.path)

  // IMPORTANT: store a versioned URL so every new save is a different URL
  const viewUrl = `${pub.publicUrl}?v=${Date.now()}`

  const entry = await EngagementLibrary.create({
    engagement: engagementId,
    category,
    url: viewUrl, // <-- versioned link saved to DB
  })

  return entry
}

// list of folder names
const ENGAGEMENT_FOLDERS = [
  "Planning",
  "Capital & Reserves",
  "Property, plant and equipment",
  "Intangible Assets",
  "Investment Property",
  "Investment in Subsidiaries & Associates investments",
  "Receivables",
  "Payables Inventory",
  "Bank & Cash",
  "Borrowings & loans",
  "Taxation",
  "Going Concern",
  "Others",
  "Trial Balance",
  "Audit Sections", // Added for trial balance category
]

exports.getLibraryFiles = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    const files = await EngagementLibrary.find({
      engagement: engagementId,
      url: { $ne: "" },
    }).sort({ createdAt: -1 })

    const filesWithNames = files.map((file) => ({
      ...file.toObject(),
      fileName: file.url.split("/").pop()?.split("?")[0] || "Unknown",
    }))

    res.json(filesWithNames)
  } catch (err) {
    next(err)
  }
}

exports.createEngagement = async (req, res, next) => {
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl, createdBy } = req.body
    // 1) Create the engagement
    const engagement = await Engagement.create({
      createdBy,
      clientId,
      title,
      yearEndDate,
      trialBalanceUrl,
      status: trialBalanceUrl ? "active" : "draft",
    })

    // 2) Seed an “empty folder” entry for each category
    const placeholders = ENGAGEMENT_FOLDERS.map((category) => ({
      engagement: engagement._id,
      category,
      url: "", // empty placeholder
    }))
    await EngagementLibrary.insertMany(placeholders)

    // 3) Return the new engagement
    return res.status(201).json(engagement)
  } catch (err) {
    next(err)
  }
}

// POST /api/engagements/:id/library
exports.uploadToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { category, replaceExisting } = req.body
    const file = req.file // from multer

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." })
    }

    // If client asked to replace, remove any previous resource for this category.
    if (String(replaceExisting).toLowerCase() === "true") {
      await removeExistingLibraryResource(engagementId, category)
    }

    const filePath = `${engagementId}/${category}/${file.originalname}`

    async function tryUpload() {
      return supabase.storage.from("engagement-documents").upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
        cacheControl: "0",
      })
    }

    let { data: uploadData, error: uploadError } = await tryUpload()

    if (uploadError && String(uploadError.message).toLowerCase().includes("exists")) {
      // Enforce one-per-category and also drop exact conflicting object, then retry
      await removeExistingLibraryResource(engagementId, category)
      await safeRemoveStoragePath(filePath)
      ;({ data: uploadData, error: uploadError } = await tryUpload())
    }

    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from("engagement-documents").getPublicUrl(uploadData.path)

    const versionedUrl = `${pub.publicUrl}?v=${Date.now()}`

    const entry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: versionedUrl,
    })

    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
}

/// POST /api/engagements/:id/library/google-sheet
exports.uploadGoogleSheetToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { sheetUrl, category = "Trial Balance" } = req.body

    if (!sheetUrl) return res.status(400).json({ message: "Google Sheets URL is required." })
    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." })
    }

    // 1) Fetch data from Google Sheets as 2D array
    const allRows = await sheetService.fetch(sheetUrl)
    if (!allRows?.length) return res.status(400).json({ message: "No data found in the sheet." })

    // 2) Build .xlsx
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    // 3) Upload to storage & create library record (auto-replace)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const safeCat = category.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_")
    const fileName = `${safeCat}_${dateStamp}.xlsx`

    const entry = await uploadBufferToLibrary({
      engagementId,
      category,
      buffer,
      fileName,
    })

    return res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
}

exports.changeFolders = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { category, url } = req.body

    // Validate required fields
    if (!category || !url) {
      return res.status(400).json({ message: "Both category and url are required." })
    }

    // Validate folder category
    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." })
    }

    // Find the existing document by URL
    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    })

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." })
    }

    // If moving to same category, return early
    if (existingEntry.category === category) {
      return res.status(200).json({
        message: "File is already in this category",
        entry: existingEntry,
      })
    }

    // Extract the correct path from Supabase URL
    const oldPath = extractStoragePathFromPublicUrl(url)
    if (!oldPath) {
      return res.status(400).json({ message: "Invalid file URL format" })
    }

    const fileName = oldPath.split("/").pop()
    const newPath = `${engagementId}/${category}/${fileName}`

    // 1. Verify old file exists
    const { error: checkError } = await supabase.storage.from("engagement-documents").download(oldPath)

    if (checkError) {
      console.error("File not found in storage:", checkError)
      return res.status(404).json({ message: "File not found in storage" })
    }

    // 2. Copy file to new location
    const { error: copyError } = await supabase.storage.from("engagement-documents").copy(oldPath, newPath)

    if (copyError) {
      console.error("Copy failed:", copyError)
      throw copyError
    }

    // 3. Get public URL for new location (add cache buster)
    const {
      data: { publicUrl },
    } = supabase.storage.from("engagement-documents").getPublicUrl(newPath)
    const versionedUrl = `${publicUrl}?v=${Date.now()}`

    // 4. Update database record first (before deleting)
    const updatedEntry = await EngagementLibrary.findOneAndUpdate(
      { _id: existingEntry._id },
      {
        category,
        url: versionedUrl,
        updatedAt: new Date(),
      },
      { new: true },
    )

    // 5. Delete old file (only after successful update)
    await supabase.storage.from("engagement-documents").remove([oldPath])

    return res.status(200).json(updatedEntry)
  } catch (err) {
    console.error("Error changing folder:", err)
    return next(err)
  }
}

exports.deleteFile = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { url } = req.body

    // Validate required fields
    if (!url) {
      return res.status(400).json({ message: "File URL is required." })
    }

    // Find the existing document by URL
    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    })

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." })
    }

    // Extract the correct path from Supabase URL
    const filePath = extractStoragePathFromPublicUrl(url)
    if (!filePath) {
      return res.status(400).json({ message: "Invalid file URL format" })
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Delete DB record
      await EngagementLibrary.deleteOne({ _id: existingEntry._id }, { session })

      // Delete from storage
      const { error } = await supabase.storage.from("engagement-documents").remove([filePath])
      if (error) throw error

      await session.commitTransaction()
      return res.status(200).json("File deleted successfully")
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  } catch (err) {
    console.error("Error deleting file:", err)
    return next(err)
  }
}

exports.getAllEngagements = async (req, res, next) => {
  try {
    const engagements = await Engagement.find()
    res.json(engagements)
  } catch (err) {
    next(err)
  }
}

exports.getClientEngagements = async (req, res, next) => {
  try {
    const clientId = req.user.role === "client" ? req.user.id : req.query.clientId || req.user.id
    const engagements = await Engagement.find({ clientId })
    res.json(engagements)
  } catch (err) {
    next(err)
  }
}

exports.getEngagementById = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id)
      .populate("documentRequests")
      .populate("procedures")
      .populate("trialBalanceDoc")
    if (!engagement) return res.status(404).json({ message: "Not found" })
    res.json(engagement)
  } catch (err) {
    next(err)
  }
}

exports.updateEngagement = async (req, res, next) => {
  try {
    const engagement = await Engagement.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!engagement) return res.status(404).json({ message: "Not found" })
    res.json(engagement)
  } catch (err) {
    next(err)
  }
}

exports.fetchTrialBalance = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id)
    if (!engagement) return res.status(404).json({ message: "Engagement not found" })

    // 1) pull raw 2D array from Sheets
    const allRows = await sheetService.fetch(req.body.sheetUrl || engagement.trialBalanceUrl)
    if (!allRows.length) return res.status(204).json({ message: "No data returned" })

    // 2) split header + data
    const [headers, ...rows] = allRows

    // 3) upsert TrialBalance
    let tb = await TrialBalance.findOne({ engagement: engagement._id })
    if (tb) {
      tb.headers = headers
      tb.rows = rows
      tb.fetchedAt = new Date()
      await tb.save()
    } else {
      tb = await TrialBalance.create({
        engagement: engagement._id,
        headers,
        rows,
      })
    }

    // 4) link & respond
    engagement.trialBalance = tb._id
    await engagement.save()
    res.json(tb)
  } catch (err) {
    next(err)
  }
}

/** Return the stored TrialBalance for this engagement */
exports.getTrialBalance = async (req, res, next) => {
  try {
    const tb = await TrialBalance.findOne({ engagement: req.params.id })
    if (!tb) return res.status(404).json({ message: "No trial balance stored" })
    res.json(tb)
  } catch (err) {
    next(err)
  }
}

// POST /api/engagements/:id/trial-balance
exports.saveTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { data, fileName } = req.body

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: "Invalid trial balance data" })
    }

    // Validate required columns
    const [headers] = data
    const requiredColumns = ["Code", "Account Name", "Current Year", "Prior Year"]
    const missingColumns = requiredColumns.filter(
      (col) => !headers.some((header) => header.toLowerCase().trim() === col.toLowerCase()),
    )

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      })
    }

    // Update or create trial balance
    let tb = await TrialBalance.findOne({ engagement: engagementId })
    if (tb) {
      tb.headers = headers
      tb.rows = data.slice(1)
      tb.fetchedAt = new Date()
      await tb.save()
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows: data.slice(1),
      })
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      trialBalance: tb._id,
      status: "active",
    })

    res.json({
      ...tb.toObject(),
      data,
      fileName,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/engagements/:id/trial-balance/google-sheets
 * Import trial balance from Google Sheets
 */
exports.importTrialBalanceFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { sheetUrl } = req.body

    if (!sheetUrl) {
      return res.status(400).json({ message: "Google Sheets URL is required" })
    }

    // Fetch data from Google Sheets
    const allRows = await sheetService.fetch(sheetUrl)
    if (!allRows.length) {
      return res.status(400).json({ message: "No data found in the sheet" })
    }

    const [headers, ...rows] = allRows

    // Validate required columns
    const requiredColumns = ["Code", "Account Name", "Current Year", "Prior Year"]
    const missingColumns = requiredColumns.filter(
      (col) => !headers.some((header) => header.toLowerCase().trim() === col.toLowerCase()),
    )

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      })
    }

    // Update or create trial balance
    let tb = await TrialBalance.findOne({ engagement: engagementId })
    if (tb) {
      tb.headers = headers
      tb.rows = rows
      tb.fetchedAt = new Date()
      await tb.save()
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows,
      })
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      trialBalance: tb._id,
      trialBalanceUrl: sheetUrl,
      status: "active",
    })

    // --- Also store an .xlsx copy in the Library (Trial Balance), replacing any existing ---
    try {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      XLSX.utils.book_append_sheet(wb, ws, "TrialBalance")
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

      const dateStamp = new Date().toISOString().slice(0, 10)
      const fileName = `Trial_Balance_${dateStamp}.xlsx`

      await uploadBufferToLibrary({
        engagementId,
        category: "Trial Balance",
        buffer,
        fileName,
      })
    } catch (e) {
      console.error("Failed to archive TB Excel to Library:", e?.message || e)
    }
    // ---------------------------------------------------------------

    res.json({
      ...tb.toObject(),
      data: allRows,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/engagements/:id/trial-balance
 * Remove existing trial balance and related files
 */
exports.deleteTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    // Remove trial balance from database
    await TrialBalance.findOneAndDelete({ engagement: engagementId })

    // Remove ETB data
    await ExtendedTrialBalance.findOneAndDelete({ engagement: engagementId })

    // Remove trial balance files from library (DB) and Storage
    const existing = await EngagementLibrary.find({
      engagement: engagementId,
      category: "Trial Balance",
      url: { $ne: "" },
    })

    for (const doc of existing) {
      const filePath = extractStoragePathFromPublicUrl(doc.url)
      if (filePath) {
        await supabase.storage.from("engagement-documents").remove([filePath])
      }
      await EngagementLibrary.deleteOne({ _id: doc._id })
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      $unset: { trialBalance: 1, trialBalanceUrl: 1 },
    })

    res.json({ message: "Trial balance removed successfully" })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/engagements/:id/etb
 * Save Extended Trial Balance data
 */
exports.saveETB = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { rows } = req.body

    if (!Array.isArray(rows)) {
      return res.status(400).json({ message: "Invalid ETB data" })
    }

    // 1) Sanitize: remove any _id/id from client, coerce types
    const cleaned = rows.map((r) => {
      const {
        _id, // strip any mongo id
        id, // strip any client id like "row-1"
        code,
        accountName,
        currentYear,
        priorYear,
        adjustments,
        finalBalance,
        classification,
        ...rest
      } = r || {}

      return {
        code: code != null ? String(code).trim() : "",
        accountName: accountName != null ? String(accountName) : "",
        currentYear: Number(currentYear || 0),
        priorYear: Number(priorYear || 0),
        adjustments: Number(adjustments || 0),
        finalBalance: Number(finalBalance || 0),
        classification: classification != null ? String(classification).trim() : "",
        ...rest,
      }
    })
    // 👆 no filter step - we now keep rows even if classification is empty

    // 2) Upsert ETB
    let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
    if (etb) {
      etb.rows = cleaned
      await etb.save()
    } else {
      etb = await ExtendedTrialBalance.create({
        engagement: engagementId,
        rows: cleaned,
      })
    }

    return res.json(etb)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/engagements/:id/etb
 * Get Extended Trial Balance data
 */
exports.getETB = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    })
    if (!etb) {
      return res.status(404).json({ message: "Extended Trial Balance not found" })
    }

    res.json(etb)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/engagements/:id/etb/classification/:classification
 * Get ETB data for specific classification
 */
exports.getETBByClassification = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const decodedClassification = decodeURIComponent(classification)

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    })
    if (!etb) {
      return res.status(404).json({ message: "Extended Trial Balance not found" })
    }

    // Filter rows by classification
    const filteredRows = etb.rows.filter((row) => row.classification === decodedClassification)

    // Get section info
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    res.json({
      rows: filteredRows,
      spreadsheetUrl: section?.spreadsheetUrl || null,
      spreadsheetId: section?.spreadsheetId || null,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/engagements/:id/etb/classification/:classification/reload
 * Reload classification data from ETB
 */
// Reload a section (classification) from ETB, but preserve any WP reference if present
exports.reloadClassificationFromETB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

    // 1) Get ETB rows for this engagement
    const etbDoc = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    const allRows = Array.isArray(etbDoc?.rows) ? etbDoc.rows : [];

    // 2) Filter by this classification (same as before)
    const filtered = allRows.filter((r) => (r?.classification || "") === decodedClassification);

    // 3) Load WP doc (if exists) to preserve references
    const wpDoc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    const refMap = new Map();
    if (wpDoc?.rows?.length) {
      for (const r of wpDoc.rows) {
        const key = `${(r.code || "").trim()}::${(r.accountName || "").trim()}`;
        if (r.reference) refMap.set(key, r.reference);
      }
    }

    // 4) Merge ETB rows with preserved reference (do not override it)
    const mergedRows = filtered.map((row, idx) => {
      const key = `${(row.code || "").trim()}::${(row.accountName || "").trim()}`;
      const preservedRef = refMap.get(key);
      return {
        id: row.id || `row-${idx}`,
        code: row.code || "",
        accountName: row.accountName || "",
        currentYear: Number(row.currentYear) || 0,
        priorYear: Number(row.priorYear) || 0,
        adjustments: Number(row.adjustments) || 0,
        finalBalance: Number(row.finalBalance) || 0,
        classification: decodedClassification,
        reference: preservedRef ? preservedRef : "", // keep empty if none
      };
    });

    return res.json({ rows: mergedRows });
  } catch (err) {
    next(err);
  }
};


/**
 * POST /api/engagements/:id/etb/classification/:classification/spreadsheet
 * Create Google Spreadsheet for classification
 */
exports.createClassificationSpreadsheet = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { data } = req.body
    const decodedClassification = decodeURIComponent(classification)

    // Create spreadsheet using Google Sheets API
    const spreadsheetData = [
      ["Code", "Account Name", "Current Year", "Prior Year", "Adjustments", "Final Balance"],
      ...data.map((row) => [
        row.code,
        row.accountName,
        row.currentYear,
        row.priorYear,
        row.adjustments,
        row.finalBalance,
      ]),
    ]

    // Mock response or integrate with Google Sheets API
    const mockSpreadsheetId = `sheet_${Date.now()}`
    const mockSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${mockSpreadsheetId}/edit`

    // Save section info
    await ClassificationSection.findOneAndUpdate(
      {
        engagement: engagementId,
        classification: decodedClassification,
      },
      {
        spreadsheetId: mockSpreadsheetId,
        spreadsheetUrl: mockSpreadsheetUrl,
        lastSyncAt: new Date(),
      },
      { upsert: true },
    )

    res.json({
      spreadsheetId: mockSpreadsheetId,
      spreadsheetUrl: mockSpreadsheetUrl,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/engagements/:id/etb/classification/:classification/spreadsheet/update
 * Update Google Spreadsheet with new data
 */
exports.updateClassificationSpreadsheet = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { data, spreadsheetUrl } = req.body
    const decodedClassification = decodeURIComponent(classification)

    // Update spreadsheet using Google Sheets API (not implemented here)

    // Update section sync time
    await ClassificationSection.findOneAndUpdate(
      {
        engagement: engagementId,
        classification: decodedClassification,
      },
      {
        lastSyncAt: new Date(),
      },
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/engagements/:id/etb/category/:category
 * Get ETB data for specific category (for Equity, Income, Expenses)
 */
exports.getETBByCategory = async (req, res, next) => {
  try {
    const { id: engagementId, category } = req.params
    const decodedCategory = decodeURIComponent(category)

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    })
    if (!etb) {
      return res.status(404).json({ message: "Extended Trial Balance not found" })
    }

    // Filter rows by category (first level of classification)
    const filteredRows = etb.rows.filter((row) => row.classification && row.classification.startsWith(decodedCategory))

    res.json({ rows: filteredRows })
  } catch (err) {
    next(err)
  }
}

// ---------------------------
// FIXED-VALUES SECTION EXCEL
// ---------------------------
exports.createViewOnlySpreadsheet = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { data } = req.body
    const decodedClassification = decodeURIComponent(classification)

    if (!Array.isArray(data)) {
      return res.status(400).json({ message: "Invalid data provided" })
    }

    // --- helpers ------------------------------------------------------------
    const getTopCategory = (cls) => {
      if (!cls || typeof cls !== "string") return ""
      const top = cls.split(" > ")[0] || ""
      return top
    }

    // numeric guard (handles "", null, undefined, strings, etc.)
    const n = (v) => {
      const num = Number(v)
      return Number.isFinite(num) ? num : 0
    }

    // group rows by top category to build subtotals
    const groups = new Map() // key -> rows[]
    for (const row of data) {
      const top = getTopCategory(row?.classification || "")
      if (!groups.has(top)) groups.set(top, [])
      groups.get(top).push(row)
    }

    // headers (now include Top Category)
    const headers = [
      "Top Category",
      "Classification",
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
      "Adjustments",
      "Final Balance",
    ]

    const sheetData = [headers]

    // running grand totals (only data rows contribute; subtotals added afterwards)
    let gCY = 0,
      gPY = 0,
      gADJ = 0,
      gFB = 0

    // emit each group: rows then a fixed-values Subtotal row
    for (const [top, rows] of groups.entries()) {
      if (!rows || rows.length === 0) continue

      let tCY = 0,
        tPY = 0,
        tADJ = 0,
        tFB = 0

      for (const r of rows) {
        const cy = n(r.currentYear)
        const py = n(r.priorYear)
        const adj = n(r.adjustments)
        // prefer provided finalBalance if numeric; else compute cy + adj
        const fb = Number.isFinite(Number(r.finalBalance)) ? n(r.finalBalance) : cy + adj

        // push the raw row (Top Category + details) - all numeric cells are numbers
        sheetData.push([
          top || "", // Top Category
          String(r.classification || ""), // Classification
          String(r.code ?? ""), // Code
          String(r.accountName ?? ""), // Account Name
          cy,
          py,
          adj,
          fb, // numeric values (no formulas)
        ])

        // update group & grand totals
        tCY += cy
        tPY += py
        tADJ += adj
        tFB += fb
        gCY += cy
        gPY += py
        gADJ += adj
        gFB += fb
      }

      // Subtotal row for this top category (fixed values, not formulas)
      sheetData.push([`Subtotal - ${top || "-"}`, "", "", "", tCY, tPY, tADJ, tFB])
    }

    // GRAND TOTAL row (fixed values, not formulas)
    sheetData.push(["TOTALS", "", "", "", gCY, gPY, gADJ, gFB])

    // --- build workbook -----------------------------------------------------
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // Make numeric columns actually numeric (XLSX sometimes needs help).
    // Columns: E, F, G, H (0-indexed -> 4..7)
    const range = XLSX.utils.decode_range(ws["!ref"])
    for (let R = 1; R <= range.e.r; R++) {
      // skip header row (R=0)
      for (let C = 4; C <= 7; C++) {
        // numeric cols only
        const cellAddr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[cellAddr]
        if (!cell) continue
        const val = Number(cell.v)
        if (Number.isFinite(val)) {
          ws[cellAddr] = { t: "n", v: val } // enforce numeric cell
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, decodedClassification.slice(0, 28) || "Sheet1")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    // ---- naming & replacement rules ---------------------------------------
    // Use a stable filename per section so we REPLACE the older one for this section only.
    const safeName = decodedClassification.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") || "Section"
    const fileName = `${safeName}.xlsx` // stable name -> previous gets replaced

    // Store under Library -> Audit Sections, replacing existing with same filename
    const entry = await uploadBufferToLibrary({
      engagementId,
      category: "Audit Sections",
      buffer,
      fileName,
      // allowMultiple=true: our helper deletes any existing item with the **same filename**
      // (so we keep other sections’ files intact).
      allowMultiple: true,
    })

    // Persist sync note (no Google Sheet here)
    await ClassificationSection.findOneAndUpdate(
      { engagement: engagementId, classification: decodedClassification },
      { lastSyncAt: new Date() },
      { upsert: true },
    )

    return res.status(201).json({
      spreadsheetId: null,
      viewUrl: entry.url,
      title: fileName,
      fallback: true,
      message: "Saved a fixed-values spreadsheet in Library (Audit Sections).",
    })
  } catch (err) {
    console.error("createViewOnlySpreadsheet error:", err?.message || err)
    return next(err)
  }
}

exports.getWorkingPapersStatus = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const decodedClassification = decodeURIComponent(classification)

    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.json({
        initialized: false,
        url: null,
        spreadsheetId: null,
        sheets: [],
      })
    }

    // Get available sheets from Excel
    const msExcel = require("../services/microsoftExcelService")
    try {
      const token = await msExcel.getAccessToken()
      const sheetsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const sheetsData = await sheetsResponse.json()
      const sheets = sheetsData.value?.map((sheet) => sheet.name) || []

      return res.json({
        initialized: true,
        url: section.workingPapersUrl,
        spreadsheetId: section.workingPapersId,
        sheets: sheets,
      })
    } catch (error) {
      console.error("Error fetching sheets:", error)
      return res.json({
        initialized: true,
        url: section.workingPapersUrl,
        spreadsheetId: section.workingPapersId,
        sheets: [],
      })
    }
  } catch (err) {
    next(err)
  }
}

exports.initWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { leadSheetData } = req.body
    const decodedClassification = decodeURIComponent(classification)

    const msExcel = require("../services/microsoftExcelService")
    const ClassificationSection = require("../models/ClassificationSection")

    const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
      engagementId,
      classification: decodedClassification,
    })

    // Prepare data with reference column
    const headers = ["Code", "Account Name", "Current Year", "Prior Year", "Adjustments", "Final Balance", "Reference"]

    const dataRows = leadSheetData.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      "", // Empty reference column
    ])

    const worksheetData = [headers, ...dataRows]

    const worksheetName = "Sheet1"
    await msExcel.writeSheet({
      driveItemId,
      worksheetName: worksheetName,
      values: worksheetData,
    })

    // Save section info
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section) {
      section = await ClassificationSection.create({
        engagement: engagementId,
        classification: decodedClassification,
        workingPapersId: driveItemId,
        workingPapersUrl: webUrl,
        lastSyncAt: new Date(),
      })
    } else {
      section.workingPapersId = driveItemId
      section.workingPapersUrl = webUrl
      section.lastSyncAt = new Date()
      await section.save()
    }

    // Get available sheets
    const token = await msExcel.getAccessToken()
    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${driveItemId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    const sheetsData = await sheetsResponse.json()
    const sheets = sheetsData.value?.map((sheet) => sheet.name) || []

    return res.json({
      spreadsheetId: driveItemId,
      url: webUrl,
      sheets: sheets,
    })
  } catch (err) {
    next(err)
  }
}

exports.pushToWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { data } = req.body
    const decodedClassification = decodeURIComponent(classification)

    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized. Initialize first.",
      })
    }

    const msExcel = require("../services/microsoftExcelService")

    // Prepare data with reference column
    const headers = ["Code", "Account Name", "Current Year", "Prior Year", "Adjustments", "Final Balance", "Reference"]

    const dataRows = data.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      row.reference || "",
    ])

    const worksheetData = [headers, ...dataRows]
    const worksheetName = "Sheet1"

    await msExcel.writeSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
      values: worksheetData,
    })

    section.lastSyncAt = new Date()
    await section.save()

    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

exports.pullFromWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const decodedClassification = decodeURIComponent(classification)

    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized. Initialize first.",
      })
    }

    const msExcel = require("../services/microsoftExcelService")
    const worksheetName = "Sheet1"

    const data = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    })

    // Convert back to ETB format
    const rows = data.slice(1).map((row, index) => ({
      id: `row-${index}`,
      code: row[0] || "",
      accountName: row[1] || "",
      currentYear: Number(row[2]) || 0,
      priorYear: Number(row[3]) || 0,
      adjustments: Number(row[4]) || 0,
      finalBalance: Number(row[5]) || 0,
      classification: decodedClassification,
      reference: row[6] || "",
    }))

    // Get available sheets
    const token = await msExcel.getAccessToken()
    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    const sheetsData = await sheetsResponse.json()
    const sheets = sheetsData.value?.map((sheet) => sheet.name) || []

    section.lastSyncAt = new Date()
    await section.save()

    return res.json({ rows, sheets })
  } catch (err) {
    next(err)
  }
}

exports.fetchRowsFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { rowId } = req.body
    const decodedClassification = decodeURIComponent(classification)

    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized.",
      })
    }

    const msExcel = require("../services/microsoftExcelService")
    const token = await msExcel.getAccessToken()

    // Get all worksheets
    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    const sheetsData = await sheetsResponse.json()
    const sheets = sheetsData.value || []

    const mainSheetName = "Sheet1"
    const otherSheets = sheets.filter((sheet) => sheet.name !== mainSheetName)

    const availableRows = []

    // Fetch data from each other sheet
    for (const sheet of otherSheets) {
      try {
        const sheetData = await msExcel.readSheet({
          driveItemId: section.workingPapersId,
          worksheetName: sheet.name,
        })

        // Skip header row and add each data row
        sheetData.forEach((row, index) => {
          if (row.some((cell) => cell && cell.toString().trim())) {
            // Only non-empty rows
            availableRows.push({
              sheetName: sheet.name,
              rowIndex: index + 1, // +2 because we skip header and 0-based index
              data: row,
            })
          }
        })
      } catch (error) {
        console.error(`Error reading sheet ${sheet.name}:`, error)
      }
    }

    return res.json({ rows: availableRows })
  } catch (err) {
    next(err)
  }
}

exports.selectRowFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { rowId, selectedRow } = req.body
    const decodedClassification = decodeURIComponent(classification)

    // For now, just update the reference field
    // In a real implementation, you might want to store this relationship in the database

    // Get current data
    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized.",
      })
    }

    const msExcel = require("../services/microsoftExcelService")
    const worksheetName = "Sheet1"

    const data = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    })

    // Update the reference for the specific row
    const updatedData = data.map((row, index) => {
      if (index === 0) return row // Keep header

      const currentRowId = `row-${index - 1}`
      if (currentRowId === rowId) {
        // Update reference column (index 6)
        const newRow = [...row]
        newRow[6] = `${selectedRow.sheetName} Row#${selectedRow.rowIndex}`
        return newRow
      }
      return row
    })

    // Write back to Excel
    await msExcel.writeSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
      values: updatedData,
    })

    // Convert back to ETB format for response
    const rows = updatedData.slice(1).map((row, index) => ({
      id: `row-${index}`,
      code: row[0] || "",
      accountName: row[1] || "",
      currentYear: Number(row[2]) || 0,
      priorYear: Number(row[3]) || 0,
      adjustments: Number(row[4]) || 0,
      finalBalance: Number(row[5]) || 0,
      classification: decodedClassification,
      reference: row[6] || "",
    }))

    section.lastSyncAt = new Date()
    await section.save()

    return res.json({ rows })
  } catch (err) {
    next(err)
  }
}

exports.viewSelectedRow = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const { rowId } = req.body
    const decodedClassification = decodeURIComponent(classification)

    const ClassificationSection = require("../models/ClassificationSection")
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    })

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized.",
      })
    }

    const msExcel = require("../services/microsoftExcelService")
    const worksheetName = "Sheet1"

    const data = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    })

    // Find the row with the specified ID
    const targetRowIndex = Number.parseInt(rowId.replace("row-", ""))+1 // +1 for header
    if (targetRowIndex >= data.length) {
      return res.status(404).json({ message: "Row not found" })
    }

    const targetRow = data[targetRowIndex]
    const reference = targetRow[6] // Reference column

    if (!reference || !reference.includes(" Row#")) {
      return res.status(404).json({ message: "No reference found for this row" })
    }

    // Parse reference (e.g., "Sheet2!5")
    const [sheetName, rowNumber] = reference.split(" Row#")

    try {
      // Get the referenced row data
      const referencedSheetData = await msExcel.readSheet({
        driveItemId: section.workingPapersId,
        worksheetName: sheetName,
      })

      const referencedRowIndex = Number.parseInt(rowNumber) - 1 // Convert to 0-based index
      if (referencedRowIndex >= 0 && referencedRowIndex < referencedSheetData.length) {
        const referencedRow = referencedSheetData[referencedRowIndex]

        return res.json({
          reference: {
            sheetName,
            rowIndex: Number.parseInt(rowNumber),
            data: referencedRow,
          },
          leadSheetRow: {
            code: targetRow[0],
            accountName: targetRow[1],
            currentYear: targetRow[2],
            priorYear: targetRow[3],
            adjustments: targetRow[4],
            finalBalance: targetRow[5],
          },
        })
      } else {
        return res.status(404).json({ message: "Referenced row not found" })
      }
    } catch (error) {
      console.error("Error reading referenced sheet:", error)
      return res.status(500).json({ message: "Error reading referenced data" })
    }
  } catch (err) {
    next(err)
  }
}
// Save Working Paper rows to DB (upsert)
exports.saveWorkingPaperToDB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rows } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const cleaned = Array.isArray(rows) ? rows.map((r) => ({
      id: r.id || "",
      code: r.code || "",
      accountName: r.accountName || "",
      currentYear: Number(r.currentYear) || 0,
      priorYear: Number(r.priorYear) || 0,
      adjustments: Number(r.adjustments) || 0,
      finalBalance: Number(r.finalBalance) || 0,
      classification: decodedClassification,
      reference: r.reference ?? "",
    })) : [];

    const doc = await WorkingPaper.findOneAndUpdate(
      { engagement: engagementId, classification: decodedClassification },
      { rows: cleaned },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ rows: doc.rows });
  } catch (err) {
    next(err);
  }
};

// Get Working Paper rows from DB
exports.getWorkingPaperFromDB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc) return res.status(404).json({ message: "No working paper saved for this section" });

    return res.json({ rows: doc.rows });
  } catch (err) {
    next(err);
  }
};
