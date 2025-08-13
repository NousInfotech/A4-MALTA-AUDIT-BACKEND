const msExcel = require("../services/microsoftExcelService");
const Engagement = require("../models/Engagement");
const EngagementLibrary = require("../models/EngagementLibrary");
const { supabase } = require("../config/supabase");
const sheetService = require("../services/googleSheetsService");
const { isQuotaExceededError } = require("../services/googleSheetsService");
const TrialBalance = require("../models/TrialBalance");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const ClassificationSection = require("../models/ClassificationSection");
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx");
const Papa = require("papaparse");

// ===== Helpers =====
const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Convert ETB rows to 2D array for Excel and back
function etbRowsToAOA(rows) {
  const header = [
    "Code",
    "Account Name",
    "Current Year",
    "Prior Year",
    "Adjustments",
    "Final Balance",
    "Classification",
  ];
  const data = (rows || []).map((r) => [
    r.code ?? "",
    r.accountName ?? "",
    Number(r.currentYear) || 0,
    Number(r.priorYear) || 0,
    Number(r.adjustments) || 0,
    Number(r.finalBalance) ||
      (Number(r.currentYear) || 0) + (Number(r.adjustments) || 0),
    r.classification ?? "",
  ]);
  return [header, ...data];
}

function aoaToEtbRows(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return [];
  const [hdr, ...data] = aoa;
  const idx = (name) =>
    hdr.findIndex((h) => String(h).toLowerCase().trim() === name.toLowerCase());
  const iCode = idx("Code"),
    iName = idx("Account Name"),
    iCY = idx("Current Year");
  const iPY = idx("Prior Year"),
    iAdj = idx("Adjustments"),
    iFB = idx("Final Balance");
  const iCls = idx("Classification");
  return data.map((row, k) => {
    const cy = Number(row[iCY] ?? 0);
    const adj = Number(row[iAdj] ?? 0);
    return {
      id: `row-${Date.now()}-${k}`,
      code: row[iCode] ?? "",
      accountName: row[iName] ?? "",
      currentYear: cy,
      priorYear: Number(row[iPY] ?? 0),
      adjustments: adj,
      finalBalance: Number(row[iFB] ?? NaN) || cy + adj,
      classification: row[iCls] ?? "",
    };
  });
}

// POST /api/engagements/:id/etb/excel/init
exports.initEtbExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    // Ensure or create workbook
    const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
      engagementId,
    });

    // Find or create the "ETB" classification holder to keep workbook info
    const ClassificationSection = require("../models/ClassificationSection");
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    });
    if (!section) {
      section = await ClassificationSection.create({
        engagement: engagementId,
        classification: "ETB",
        spreadsheetId: driveItemId, // reusing fields
        spreadsheetUrl: webUrl,
        lastSyncAt: new Date(),
      });
    } else {
      section.spreadsheetId = driveItemId;
      section.spreadsheetUrl = webUrl;
      section.lastSyncAt = new Date();
      await section.save();
    }

    // Get current ETB
    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
    const existing = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
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
            "Classification",
          ],
        ];

    // Push to Excel
    await msExcel.writeSheet({
      driveItemId,
      worksheetName: "ETB",
      values: aoa,
    });

    return res.status(200).json({ spreadsheetId: driveItemId, url: webUrl });
  } catch (err) {
    next(err);
  }
};

// POST /api/engagements/:id/etb/excel/push
exports.pushEtbToExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const ClassificationSection = require("../models/ClassificationSection");
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    });
    if (!section?.spreadsheetId) {
      // if not inited yet, init now
      const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
        engagementId,
      });
      if (!section) {
        section = await ClassificationSection.create({
          engagement: engagementId,
          classification: "ETB",
          spreadsheetId: driveItemId,
          spreadsheetUrl: webUrl,
        });
      } else {
        section.spreadsheetId = driveItemId;
        section.spreadsheetUrl = webUrl;
        await section.save();
      }
    }

    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
    const existing = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
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
            "Classification",
          ],
        ];

    await msExcel.writeSheet({
      driveItemId: section.spreadsheetId,
      worksheetName: "ETB",
      values: aoa,
    });

    section.lastSyncAt = new Date();
    await section.save();

    return res.status(200).json({ ok: true, url: section.spreadsheetUrl });
  } catch (err) {
    next(err);
  }
};

// POST /api/engagements/:id/etb/excel/pull
exports.pullEtbFromExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const ClassificationSection = require("../models/ClassificationSection");
    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    });
    if (!section?.spreadsheetId) {
      return res
        .status(400)
        .json({
          message:
            "Excel workbook not initialized. Click 'Open in Excel Online' first.",
        });
    }

    const aoa = await msExcel.readSheet({
      driveItemId: section.spreadsheetId,
      worksheetName: "ETB",
    });
    const rows = aoaToEtbRows(aoa);

    let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    if (etb) {
      etb.rows = rows;
      etb.updatedAt = new Date();
      await etb.save();
    } else {
      etb = await ExtendedTrialBalance.create({
        engagement: engagementId,
        rows,
      });
    }

    section.lastSyncAt = new Date();
    await section.save();

    return res.status(200).json(etb);
  } catch (err) {
    next(err);
  }
};

// Parse a public Supabase Storage URL into the internal object path
function extractStoragePathFromPublicUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const after = urlObj.pathname.split(
      "/storage/v1/object/public/engagement-documents/"
    )[1];
    return after ? decodeURIComponent(after) : null;
  } catch {
    return null;
  }
}

// Remove ALL existing library resources (DB + Storage) for this engagement+category
async function removeExistingLibraryResource(engagementId, category) {
  const existing = await EngagementLibrary.find({
    engagement: engagementId,
    category,
    url: { $ne: "" },
  });

  if (!existing?.length) return;

  const paths = existing
    .map((doc) => extractStoragePathFromPublicUrl(doc.url))
    .filter(Boolean);

  if (paths.length) {
    // Ignore errors if any objects are already gone
    await supabase.storage.from("engagement-documents").remove(paths);
  }

  await EngagementLibrary.deleteMany({
    engagement: engagementId,
    category,
    url: { $ne: "" },
  });
}

// Remove a specific storage object path (no-throw helper)
async function safeRemoveStoragePath(path) {
  if (!path) return;
  try {
    await supabase.storage.from("engagement-documents").remove([path]);
  } catch {
    // ignore
  }
}

// Upload a Buffer as an .xlsx into Storage and create a Library record.
// --- replace your current uploadBufferToLibrary with this version ---
async function uploadBufferToLibrary({
  engagementId,
  category,
  buffer,
  fileName,
  allowMultiple = false,
}) {
  // If we don't allow multiple per category, keep one (old behavior)
  if (!allowMultiple) {
    await removeExistingLibraryResource(engagementId, category);
  } else {
    // Allow multiple: only remove an existing item *with the same fileName*
    const existingWithSameName = await EngagementLibrary.findOne({
      engagement: engagementId,
      category,
      fileName,
      url: { $ne: "" },
    });

    if (existingWithSameName) {
      const existingPath = extractStoragePathFromPublicUrl(
        existingWithSameName.url
      );
      if (existingPath) {
        await safeRemoveStoragePath(existingPath); // ignore errors
      }
      await EngagementLibrary.deleteOne({ _id: existingWithSameName._id });
    }
  }

  const filePath = `${engagementId}/${category}/${fileName}`;

  async function doUpload() {
    return supabase.storage
      .from("engagement-documents")
      .upload(filePath, buffer, {
        contentType: EXCEL_MIME,
        upsert: false, // prevent silent overwrite
      });
  }

  // Attempt upload, if path already exists, delete that single object and retry
  let { data: uploadData, error: uploadError } = await doUpload();
  if (
    uploadError &&
    String(uploadError.message).toLowerCase().includes("exists")
  ) {
    await safeRemoveStoragePath(filePath);
    ({ data: uploadData, error: uploadError } = await doUpload());
  }
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage
    .from("engagement-documents")
    .getPublicUrl(uploadData.path);

  const entry = await EngagementLibrary.create({
    engagement: engagementId,
    category,
    url: pub.publicUrl,
    fileName,
  });

  return entry;
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
];

// In controllers/engagementController.js
exports.getLibraryFiles = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const files = await EngagementLibrary.find({
      engagement: engagementId,
      url: { $ne: "" },
    }).sort({ createdAt: -1 });

    const filesWithNames = files.map((file) => ({
      ...file.toObject(),
      fileName: file.url.split("/").pop()?.split("?")[0] || "Unknown",
    }));

    res.json(filesWithNames);
  } catch (err) {
    next(err);
  }
};

exports.createEngagement = async (req, res, next) => {
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl, createdBy } =
      req.body;
    // 1) Create the engagement
    const engagement = await Engagement.create({
      createdBy,
      clientId,
      title,
      yearEndDate,
      trialBalanceUrl,
      status: trialBalanceUrl ? "active" : "draft",
    });

    // 2) Seed an “empty folder” entry for each category
    const placeholders = ENGAGEMENT_FOLDERS.map((category) => ({
      engagement: engagement._id,
      category,
      url: "", // empty placeholder
    }));
    await EngagementLibrary.insertMany(placeholders);

    // 3) Return the new engagement
    return res.status(201).json(engagement);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/library
 * multipart/form-data:
 *   - file: the uploaded file
 *   - category: one of ENGAGEMENT_FOLDERS
 *   - replaceExisting?: "true" | "false"  (optional)
 */
exports.uploadToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { category, replaceExisting } = req.body;
    const file = req.file; // from multer

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

    // If client asked to replace, remove any previous resource for this category.
    if (String(replaceExisting).toLowerCase() === "true") {
      await removeExistingLibraryResource(engagementId, category);
    }

    const filePath = `${engagementId}/${category}/${file.originalname}`;

    async function tryUpload() {
      return supabase.storage
        .from("engagement-documents")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
    }

    let { data: uploadData, error: uploadError } = await tryUpload();

    if (
      uploadError &&
      String(uploadError.message).toLowerCase().includes("exists")
    ) {
      // Enforce one-per-category and also drop exact conflicting object, then retry
      await removeExistingLibraryResource(engagementId, category);
      await safeRemoveStoragePath(filePath);
      ({ data: uploadData, error: uploadError } = await tryUpload());
    }

    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage
      .from("engagement-documents")
      .getPublicUrl(uploadData.path);

    const entry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: pub.publicUrl,
      fileName: file.originalname,
    });

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

// Convert a Google Sheet URL to .xlsx and store it in the library (replaces existing)
/// POST /api/engagements/:id/library/google-sheet
/// body: { sheetUrl: string, category?: string }
exports.uploadGoogleSheetToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { sheetUrl, category = "Trial Balance" } = req.body;

    if (!sheetUrl)
      return res
        .status(400)
        .json({ message: "Google Sheets URL is required." });
    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

    // 1) Fetch data from Google Sheets as 2D array
    const allRows = await sheetService.fetch(sheetUrl);
    if (!allRows?.length)
      return res.status(400).json({ message: "No data found in the sheet." });

    // 2) Build .xlsx
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // 3) Upload to storage & create library record (auto-replace)
    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeCat = category.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_");
    const fileName = `${safeCat}_${dateStamp}.xlsx`;

    const entry = await uploadBufferToLibrary({
      engagementId,
      category,
      buffer,
      fileName,
    });

    return res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

exports.changeFolders = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { category, url } = req.body;

    // Validate required fields
    if (!category || !url) {
      return res
        .status(400)
        .json({ message: "Both category and url are required." });
    }

    // Validate folder category
    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

    // Find the existing document by URL
    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    });

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." });
    }

    // If moving to same category, return early
    if (existingEntry.category === category) {
      return res.status(200).json({
        message: "File is already in this category",
        entry: existingEntry,
      });
    }

    // Extract the correct path from Supabase URL
    const oldPath = extractStoragePathFromPublicUrl(url);
    if (!oldPath) {
      return res.status(400).json({ message: "Invalid file URL format" });
    }

    const fileName = oldPath.split("/").pop();
    const newPath = `${engagementId}/${category}/${fileName}`;

    // 1. Verify old file exists
    const { error: checkError } = await supabase.storage
      .from("engagement-documents")
      .download(oldPath);

    if (checkError) {
      console.error("File not found in storage:", checkError);
      return res.status(404).json({ message: "File not found in storage" });
    }

    // 2. Copy file to new location
    const { error: copyError } = await supabase.storage
      .from("engagement-documents")
      .copy(oldPath, newPath);

    if (copyError) {
      console.error("Copy failed:", copyError);
      throw copyError;
    }

    // 3. Get public URL for new location
    const {
      data: { publicUrl },
    } = supabase.storage.from("engagement-documents").getPublicUrl(newPath);

    // 4. Update database record first (before deleting)
    const updatedEntry = await EngagementLibrary.findOneAndUpdate(
      { _id: existingEntry._id },
      {
        category,
        url: publicUrl,
        updatedAt: new Date(),
        fileName: existingEntry.fileName, // Preserve original filename
      },
      { new: true }
    );

    // 5. Delete old file (only after successful update)
    await supabase.storage.from("engagement-documents").remove([oldPath]);

    return res.status(200).json(updatedEntry);
  } catch (err) {
    console.error("Error changing folder:", err);
    return next(err);
  }
};

exports.deleteFile = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { url } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({ message: "File URL is required." });
    }

    // Find the existing document by URL
    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    });

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." });
    }

    // Extract the correct path from Supabase URL
    const filePath = extractStoragePathFromPublicUrl(url);
    if (!filePath) {
      return res.status(400).json({ message: "Invalid file URL format" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete DB record
      await EngagementLibrary.deleteOne(
        { _id: existingEntry._id },
        { session }
      );

      // Delete from storage
      const { error } = await supabase.storage
        .from("engagement-documents")
        .remove([filePath]);
      if (error) throw error;

      await session.commitTransaction();
      return res.status(200).json("File deleted successfully");
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error("Error deleting file:", err);
    return next(err);
  }
};

exports.getAllEngagements = async (req, res, next) => {
  try {
    const engagements = await Engagement.find();
    res.json(engagements);
  } catch (err) {
    next(err);
  }
};

exports.getClientEngagements = async (req, res, next) => {
  try {
    const clientId =
      req.user.role === "client"
        ? req.user.id
        : req.query.clientId || req.user.id;
    const engagements = await Engagement.find({ clientId });
    res.json(engagements);
  } catch (err) {
    next(err);
  }
};

exports.getEngagementById = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id)
      .populate("documentRequests")
      .populate("procedures")
      .populate("trialBalanceDoc");
    if (!engagement) return res.status(404).json({ message: "Not found" });
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

exports.updateEngagement = async (req, res, next) => {
  try {
    const engagement = await Engagement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!engagement) return res.status(404).json({ message: "Not found" });
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all rows, store or update a TrialBalance doc,
 * link it on Engagement.trialBalance, and return it.
 */
exports.fetchTrialBalance = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id);
    if (!engagement)
      return res.status(404).json({ message: "Engagement not found" });

    // 1) pull raw 2D array from Sheets
    const allRows = await sheetService.fetch(
      req.body.sheetUrl || engagement.trialBalanceUrl
    );
    if (!allRows.length)
      return res.status(204).json({ message: "No data returned" });

    // 2) split header + data
    const [headers, ...rows] = allRows;

    // 3) upsert TrialBalance
    let tb = await TrialBalance.findOne({ engagement: engagement._id });
    if (tb) {
      tb.headers = headers;
      tb.rows = rows;
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagement._id,
        headers,
        rows,
      });
    }

    // 4) link & respond
    engagement.trialBalance = tb._id;
    await engagement.save();
    res.json(tb);
  } catch (err) {
    next(err);
  }
};

/** Return the stored TrialBalance for this engagement */
exports.getTrialBalance = async (req, res, next) => {
  try {
    const tb = await TrialBalance.findOne({ engagement: req.params.id });
    if (!tb)
      return res.status(404).json({ message: "No trial balance stored" });
    res.json(tb);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/trial-balance
 * Save trial balance data from file upload
 */
exports.saveTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { data, fileName } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: "Invalid trial balance data" });
    }

    // Validate required columns
    const [headers] = data;
    const requiredColumns = [
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
    ];
    const missingColumns = requiredColumns.filter(
      (col) =>
        !headers.some(
          (header) => header.toLowerCase().trim() === col.toLowerCase()
        )
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      });
    }

    // Update or create trial balance
    let tb = await TrialBalance.findOne({ engagement: engagementId });
    if (tb) {
      tb.headers = headers;
      tb.rows = data.slice(1);
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows: data.slice(1),
      });
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      trialBalance: tb._id,
      status: "active",
    });

    res.json({
      ...tb.toObject(),
      data,
      fileName,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/trial-balance/google-sheets
 * Import trial balance from Google Sheets
 */
exports.importTrialBalanceFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { sheetUrl } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ message: "Google Sheets URL is required" });
    }

    // Fetch data from Google Sheets
    const allRows = await sheetService.fetch(sheetUrl);
    if (!allRows.length) {
      return res.status(400).json({ message: "No data found in the sheet" });
    }

    const [headers, ...rows] = allRows;

    // Validate required columns
    const requiredColumns = [
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
    ];
    const missingColumns = requiredColumns.filter(
      (col) =>
        !headers.some(
          (header) => header.toLowerCase().trim() === col.toLowerCase()
        )
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      });
    }

    // Update or create trial balance
    let tb = await TrialBalance.findOne({ engagement: engagementId });
    if (tb) {
      tb.headers = headers;
      tb.rows = rows;
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows,
      });
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      trialBalance: tb._id,
      trialBalanceUrl: sheetUrl,
      status: "active",
    });

    // --- Also store an .xlsx copy in the Library (Trial Balance), replacing any existing ---
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `Trial_Balance_${dateStamp}.xlsx`;

      await uploadBufferToLibrary({
        engagementId,
        category: "Trial Balance",
        buffer,
        fileName,
      });
    } catch (e) {
      console.error("Failed to archive TB Excel to Library:", e?.message || e);
    }
    // ---------------------------------------------------------------

    res.json({
      ...tb.toObject(),
      data: allRows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/engagements/:id/trial-balance
 * Remove existing trial balance and related files
 */
exports.deleteTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    // Remove trial balance from database
    await TrialBalance.findOneAndDelete({ engagement: engagementId });

    // Remove ETB data
    await ExtendedTrialBalance.findOneAndDelete({ engagement: engagementId });

    // Remove trial balance files from library (DB) and Storage
    const existing = await EngagementLibrary.find({
      engagement: engagementId,
      category: "Trial Balance",
      url: { $ne: "" },
    });

    for (const doc of existing) {
      const filePath = extractStoragePathFromPublicUrl(doc.url);
      if (filePath) {
        await supabase.storage.from("engagement-documents").remove([filePath]);
      }
      await EngagementLibrary.deleteOne({ _id: doc._id });
    }

    // Update engagement
    await Engagement.findByIdAndUpdate(engagementId, {
      $unset: { trialBalance: 1, trialBalanceUrl: 1 },
    });

    res.json({ message: "Trial balance removed successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/etb
 * Save Extended Trial Balance data
 */
exports.saveETB = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    let { rows } = req.body;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ message: "Invalid ETB data" });
    }

    // 1) Sanitize: remove any _id/id coming from the client, coerce types
    const cleaned = rows
      .map((r) => {
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
        } = r || {};

        return {
          code: code != null ? String(code).trim() : "",
          accountName: accountName != null ? String(accountName) : "",
          currentYear: Number(currentYear || 0),
          priorYear: Number(priorYear || 0),
          adjustments: Number(adjustments || 0),
          finalBalance: Number(finalBalance || 0),
          classification:
            classification != null ? String(classification).trim() : "",
          ...rest,
        };
      })
      // 2) Filter out rows that don't meet required fields
      .filter((r) => r.code && r.classification);

    // 3) Upsert ETB
    let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    if (etb) {
      etb.rows = cleaned;
      await etb.save();
    } else {
      etb = await ExtendedTrialBalance.create({
        engagement: engagementId,
        rows: cleaned,
      });
    }

    return res.json(etb);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/engagements/:id/etb
 * Get Extended Trial Balance data
 */
exports.getETB = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
    if (!etb) {
      return res
        .status(404)
        .json({ message: "Extended Trial Balance not found" });
    }

    res.json(etb);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/engagements/:id/etb/classification/:classification
 * Get ETB data for specific classification
 */
exports.getETBByClassification = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
    if (!etb) {
      return res
        .status(404)
        .json({ message: "Extended Trial Balance not found" });
    }

    // Filter rows by classification
    const filteredRows = etb.rows.filter(
      (row) => row.classification === decodedClassification
    );

    // Get section info
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    res.json({
      rows: filteredRows,
      spreadsheetUrl: section?.spreadsheetUrl || null,
      spreadsheetId: section?.spreadsheetId || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/etb/classification/:classification/reload
 * Reload classification data from ETB
 */
exports.reloadClassificationFromETB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
    if (!etb) {
      return res
        .status(404)
        .json({ message: "Extended Trial Balance not found" });
    }

    // Filter rows by classification
    const filteredRows = etb.rows.filter(
      (row) => row.classification === decodedClassification
    );

    // Update section sync time
    await ClassificationSection.findOneAndUpdate(
      {
        engagement: engagementId,
        classification: decodedClassification,
      },
      {
        lastSyncAt: new Date(),
      },
      { upsert: true }
    );

    res.json({
      rows: filteredRows,
    });
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
    const { id: engagementId, classification } = req.params;
    const { data } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Create spreadsheet using Google Sheets API
    const spreadsheetData = [
      [
        "Code",
        "Account Name",
        "Current Year",
        "Prior Year",
        "Adjustments",
        "Final Balance",
      ],
      ...data.map((row) => [
        row.code,
        row.accountName,
        row.currentYear,
        row.priorYear,
        row.adjustments,
        row.finalBalance,
      ]),
    ];

    // Mock response or integrate with Google Sheets API
    const mockSpreadsheetId = `sheet_${Date.now()}`;
    const mockSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${mockSpreadsheetId}/edit`;

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
      { upsert: true }
    );

    res.json({
      spreadsheetId: mockSpreadsheetId,
      spreadsheetUrl: mockSpreadsheetUrl,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/engagements/:id/etb/classification/:classification/spreadsheet/update
 * Update Google Spreadsheet with new data
 */
exports.updateClassificationSpreadsheet = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { data, spreadsheetUrl } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Update spreadsheet using Google Sheets API (not implemented here)

    // Update section sync time
    await ClassificationSection.findOneAndUpdate(
      {
        engagement: engagementId,
        classification: decodedClassification,
      },
      {
        lastSyncAt: new Date(),
      }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/engagements/:id/etb/category/:category
 * Get ETB data for specific category (for Equity, Income, Expenses)
 */
exports.getETBByCategory = async (req, res, next) => {
  try {
    const { id: engagementId, category } = req.params;
    const decodedCategory = decodeURIComponent(category);

    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
    if (!etb) {
      return res
        .status(404)
        .json({ message: "Extended Trial Balance not found" });
    }

    // Filter rows by category (first level of classification)
    const filteredRows = etb.rows.filter(
      (row) =>
        row.classification && row.classification.startsWith(decodedCategory)
    );

    res.json({ rows: filteredRows });
  } catch (err) {
    next(err);
  }
};

exports.createViewOnlySpreadsheet = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { data } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    if (!Array.isArray(data)) {
      return res.status(400).json({ message: "Invalid data provided" });
    }

    const headers = [
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
      "Adjustments",
      "Final Balance",
    ];
    const rows = data.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
    ]);
    const sheetData = [headers, ...rows];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      decodedClassification.slice(0, 28) || "Sheet1"
    );
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeName =
      decodedClassification.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") ||
      "Section";
    const fileName = `${safeName}_${dateStamp}.xlsx`;

    // Store under Library -> Others
    const entry = await uploadBufferToLibrary({
      engagementId,
      category: "Audit Sections",
      buffer,
      fileName,
      allowMultiple: true,
    });

    // Persist a note that we fell back (optional fields)
    await ClassificationSection.findOneAndUpdate(
      { engagement: engagementId, classification: decodedClassification },
      {
        lastSyncAt: new Date(),
        // keep spreadsheet fields empty since no Google Sheet exists
      },
      { upsert: true }
    );

    return res.status(201).json({
      spreadsheetId: null,
      viewUrl: entry.url, // Supabase public URL to the XLSX
      title: fileName,
      fallback: true,
      message:
        "Google Drive quota exceeded. Generated an .xlsx and stored it in Library).",
    });
  } catch (err) {
    console.error("createViewOnlySpreadsheet error:", err?.message || err);
    return next(err);
  }
};
