// controllers/engagementController.js
const Engagement = require("../models/Engagement")
const EngagementLibrary = require("../models/EngagementLibrary")
const { supabase } = require("../config/supabase")
const sheetService = require("../services/googleSheetsService")
const TrialBalance = require("../models/TrialBalance")
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")
const ClassificationSection = require("../models/ClassificationSection")
const mongoose = require("mongoose")
const multer = require("multer")
const XLSX = require("xlsx")
const Papa = require("papaparse")

// list of folder names
const ENGAGEMENT_FOLDERS = [
  "Trial Balance",
  "Planning",
  "Capital & Reserves",
  "Property, plant and equipment",
  "Intangible Assets",
  "Investment Property",
  "Investment in Subsidiaries & Associates investments",
  "Receivables",
  "Payables",
  "Inventory",
  "Bank & Cash",
  "Borrowings & loans",
  "Taxation",
  "Going Concern",
  "Others",
]

// In controllers/engagementController.js
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

    // 3) Return the new engagement (folders can be fetched via a populate or separate query)
    return res.status(201).json(engagement)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/engagements/:id/library
 * multipart/form-data:
 *   - file: the uploaded file
 *   - category: one of ENGAGEMENT_FOLDERS
 */
exports.uploadToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params
    const { category } = req.body
    const file = req.file // from multer

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." })
    }
    // 1) Upload to Supabase storage
    const filePath = `${engagementId}/${category}/${file.originalname}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("engagement-documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })
    if (uploadError) throw uploadError

    // 2) Build public URL
    const { publicUrl } = supabase.storage.from("engagement-documents").getPublicUrl(uploadData.path).data

    // 3) Save library record
    const entry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: publicUrl,
    })

    res.status(201).json(entry)
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
    const urlObj = new URL(url)
    let oldPath = urlObj.pathname.split("/storage/v1/object/public/engagement-documents/")[1]

    if (!oldPath) {
      return res.status(400).json({ message: "Invalid file URL format" })
    }

    // Decode URI components in the path (handles %20 etc.)
    oldPath = decodeURIComponent(oldPath)

    const fileName = oldPath.split("/").pop()
    const newPath = `${engagementId}/${category}/${fileName}`

    // 1. Verify old file exists
    const { error: checkError } = await supabase.storage.from("engagement-documents").download(oldPath)

    if (checkError) {
      console.error("File not found in storage:", checkError)
      return res.status(404).json({ message: "File not found in storage" })
    }

    // 2. Copy file to new location
    const { data: copiedFile, error: copyError } = await supabase.storage
      .from("engagement-documents")
      .copy(oldPath, newPath)

    if (copyError) {
      console.error("Copy failed:", copyError)
      throw copyError
    }

    // 3. Get public URL for new location
    const {
      data: { publicUrl },
    } = supabase.storage.from("engagement-documents").getPublicUrl(newPath)

    // 4. Update database record first (before deleting)
    const updatedEntry = await EngagementLibrary.findOneAndUpdate(
      { _id: existingEntry._id },
      {
        category,
        url: publicUrl,
        updatedAt: new Date(),
        fileName: existingEntry.fileName, // Preserve original filename
      },
      { new: true },
    )

    // 5. Delete old file (only after successful update)
    const { error: deleteError } = await supabase.storage.from("engagement-documents").remove([oldPath])

    if (deleteError) {
      console.error("Failed to delete old file (non-critical):", deleteError)
      // Continue despite delete error since we've already updated the record
    }

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
    const urlObj = new URL(url)
    const filePath = urlObj.pathname.split("/storage/v1/object/public/engagement-documents/")[1]

    if (!filePath) {
      return res.status(400).json({ message: "Invalid file URL format" })
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Delete DB record
      const result = await EngagementLibrary.deleteOne({ _id: existingEntry._id }, { session })

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
    // const clientId = req.user.role === 'client'
    //   ? req.user.id
    //   : req.query.clientId || req.user.id;
    const engagements = await Engagement.find()
    res.json(engagements)
  } catch (err) {
    next(err)
  }
}

exports.getClientEngagements = async (req, res, next) => {
  try {
    const clientId = req.user.role === "client" ? req.user.id : req.query.clientId || req.user.id
    const engagements = await Engagement.find()
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

/**
 * Fetch all rows, store or update a TrialBalance doc,
 * link it on Engagement.trialBalance, and return it.
 */
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

/**
 * POST /api/engagements/:id/trial-balance
 * Save trial balance data from file upload
 */
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

    res.json({
      ...tb.toObject(),
      data: allRows,
    })
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
    let { rows } = req.body

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ message: "Invalid ETB data" })
    }

    // Clean rows before saving
    rows = rows
      .filter(r => r.code && r.classification) // skip missing required
      .map(({ _id, id, ...rest }) => ({
        ...rest,
        // Optional: keep frontend id for reference
        clientId: id || undefined
      }))

    // Update or create ETB
    let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
    if (etb) {
      etb.rows = rows
      await etb.save()
    } else {
      etb = await ExtendedTrialBalance.create({
        engagement: engagementId,
        rows,
      })
    }

    res.json(etb)
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

    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
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

    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
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
exports.reloadClassificationFromETB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params
    const decodedClassification = decodeURIComponent(classification)

    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
    if (!etb) {
      return res.status(404).json({ message: "Extended Trial Balance not found" })
    }

    // Filter rows by classification
    const filteredRows = etb.rows.filter((row) => row.classification === decodedClassification)

    // Update section sync time
    await ClassificationSection.findOneAndUpdate(
      {
        engagement: engagementId,
        classification: decodedClassification,
      },
      {
        lastSyncAt: new Date(),
      },
      { upsert: true },
    )

    res.json({
      rows: filteredRows,
    })
  } catch (err) {
    next(err)
  }
}

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

    // This would integrate with Google Sheets API
    // For now, we'll create a mock response
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

    // Update spreadsheet using Google Sheets API
    // This would integrate with the actual Google Sheets API

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
