const WorkingPaper = require("../models/WorkingPaper");
const msExcel = require("../services/microsoftExcelService");
const Engagement = require("../models/Engagement");
const EngagementLibrary = require("../models/EngagementLibrary");
const EngagementFolder = require("../models/EngagementFolder");
const { supabase } = require("../config/supabase");
const sheetService = require("../services/googleSheetsService");
const TrialBalance = require("../models/TrialBalance");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const ClassificationSection = require("../models/ClassificationSection");
const Adjustment = require("../models/Adjustment");
const Reclassification = require("../models/Reclassification");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const https = require("https");
const http = require("http");
const PDFDocument = require("pdfkit");
const Workbook = require("../models/ExcelWorkbook");
const {
  uploadWorkbookFile,
  uploadTrialBalance,
  listWorkbooks,
  listWorksheets,
  readSheet,
  writeSheet,
  getFileVersionHistory,
  restoreFileVersion,
} = require("../services/microsoftExcelService");
const { populatePriorYearData } = require("../services/engagement.service");

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Parse accounting number formats: (55,662) → 55662, 42,127 → 42127
// Removes parentheses and special characters, preserves any existing minus sign
// Returns rounded integer value
function parseAccountingNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  // If already a number, round and return it
  if (typeof value === "number") return Math.round(value);

  // Convert to string and clean
  let str = String(value).trim();

  // Remove parentheses, commas, and currency symbols (preserves existing minus sign if present)
  str = str.replace(/[(),\$€£¥]/g, "").trim();

  // Parse to number
  const num = Number(str);

  // Return rounded number (no negative conversion for parentheses)
  return isNaN(num) ? 0 : Math.round(num);
}

// utils/referenceHelpers.js
function parseReference(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { type: "none" };

  const text = raw.trim();

  // Format: Sheet:Sheet2   → whole sheet
  if (text.startsWith("Sheet:")) {
    const sheetName = text.slice("Sheet:".length).trim();
    if (!sheetName) return { type: "none" };
    return { type: "sheet", sheetName };
  }

  // Format: Sheet2 Row#3   → one row on a sheet
  if (text.includes(" Row#")) {
    const [sheetNameRaw, rowToken] = text.split(" Row#");
    const sheetName = (sheetNameRaw || "").trim();
    const rowIndex = Number.parseInt((rowToken || "").trim(), 10);
    if (!sheetName || Number.isNaN(rowIndex) || rowIndex <= 0) {
      return { type: "none" };
    }
    return { type: "row", sheetName, rowIndex };
  }

  return { type: "none" };
}

function etbRowsToAOA(rows) {
  const header = [
    "Code",
    "Account Name",
    "Current Year",
    "Re-Classification",
    "Adjustments",
    "Final Balance",
    "Prior Year",
    "Grouping 1",
    "Grouping 2",
    "Grouping 3",
    "Grouping 4",
  ];

  const data = (rows || []).map((r) => {
    // Extract classification parts as fallback for grouping
    const classificationParts = String(r.classification || "")
      .split(" > ")
      .map((s) => s.trim())
      .filter(Boolean);

    // Use grouping fields from row first, fallback to classification parts
    const g1 = String(r.grouping1 || "").trim() || classificationParts[0] || "";
    const g2 = String(r.grouping2 || "").trim() || classificationParts[1] || "";
    const g3 = String(r.grouping3 || "").trim() || classificationParts[2] || "";
    const g4 = String(r.grouping4 || "").trim() || classificationParts[3] || "";

    const cy = Number(r.currentYear) || 0;
    const py = Number(r.priorYear) || 0;
    const adj = Number(r.adjustments) || 0;
    const reclassification = Number(r.reclassification) || 0;
    const fb = Number(r.finalBalance);
    const computedFinal = cy + adj + reclassification;

    return [
      r.code ?? "",
      r.accountName ?? "",
      cy,
      reclassification,
      adj,
      Number.isFinite(fb) ? fb : computedFinal,
      py,
      g1,
      g2,
      g3,
      g4,
    ];
  });

  const aoa = [header, ...data];

  if (data.length > 0) {
    const startRow = 2;
    const endRow = 1 + data.length;
    aoa.push([
      "TOTALS",
      "",
      `=SUM(C${startRow}:C${endRow})`,
      "",
      `=SUM(E${startRow}:E${endRow})`,
      `=SUM(F${startRow}:F${endRow})`,
      `=SUM(G${startRow}:G${endRow})`,
      "",
      "",
      "",
      "",
    ]);
  }

  return aoa;
}

function aoaToEtbRows(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return [];
  const [hdr, ...raw] = aoa;

  const data = raw.filter((r) => {
    const firstCell = String(r?.[0] ?? "")
      .trim()
      .toLowerCase();
    return firstCell !== "totals";
  });

  const idx = (name) =>
    hdr.findIndex(
      (h) => String(h).toLowerCase().trim() === String(name).toLowerCase()
    );

  const iCode = idx("Code");
  const iName = idx("Account Name");
  const iCY = idx("Current Year");
  const iPY = idx("Prior Year");
  const iAdj = idx("Adjustments");
  const iFB = idx("Final Balance");
  const iReclass = idx("Re-Classification");

  const iG1 = idx("Grouping 1");
  const iG2 = idx("Grouping 2");
  const iG3 = idx("Grouping 3");
  const iG4 = idx("Grouping 4");
  const iCls = idx("Classification");

  return data.map((row, k) => {
    // Parse numeric values with accounting format support: (55,662) → -55662
    const cy = parseAccountingNumber(row?.[iCY]);
    const py = parseAccountingNumber(row?.[iPY]);
    const adj = parseAccountingNumber(row?.[iAdj]);
    const reclassification = parseAccountingNumber(row?.[iReclass]);
    const fb =
      iFB !== -1 && row?.[iFB] !== undefined && row?.[iFB] !== ""
        ? parseAccountingNumber(row?.[iFB])
        : cy + adj + reclassification;

    // Extract grouping data as separate fields
    const g1 = (iG1 !== -1 ? String(row?.[iG1] ?? "") : "").trim();
    const g2 = (iG2 !== -1 ? String(row?.[iG2] ?? "") : "").trim();
    const g3 = (iG3 !== -1 ? String(row?.[iG3] ?? "") : "").trim();
    const g4 = (iG4 !== -1 ? String(row?.[iG4] ?? "") : "").trim();

    // Extract re-classification field

    // Build classification from grouping if no explicit Classification column exists
    // This supports both: explicit classification OR derived from grouping
    let classification = "";
    if (iCls !== -1) {
      // Prefer explicit Classification column
      classification = String(row?.[iCls] ?? "").trim();
    } else if (g1 || g2 || g3 || g4) {
      // Fallback: build classification from grouping columns
      classification = [g1, g2, g3, g4].filter(Boolean).join(" > ");
    }

    return {
      id: `row-${Date.now()}-${k}`,
      code: row?.[iCode] ?? "",
      accountName: row?.[iName] ?? "",
      currentYear: cy,
      priorYear: py,
      adjustments: adj,
      finalBalance: fb,
      classification,
      reclassification,
      grouping1: g1,
      grouping2: g2,
      grouping3: g3,
      grouping4: g4,
    };
  });
}

exports.initEtbExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
      engagementId,
    });
    await Engagement.findByIdAndUpdate(engagementId, { excelURL: webUrl });

    const ClassificationSection = require("../models/ClassificationSection");
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    });
    if (!section) {
      section = await ClassificationSection.create({
        engagement: engagementId,
        classification: "ETB",
        spreadsheetId: driveItemId,
        spreadsheetUrl: webUrl,
        lastSyncAt: new Date(),
      });
    } else {
      section.spreadsheetId = driveItemId;
      section.spreadsheetUrl = webUrl;
      section.lastSyncAt = new Date();
      await section.save();
    }
    const headersOnly = [
      [
        "Code",
        "Account Name",
        "Current Year",
        "Re-Classification",
        "Adjustments",
        "Final Balance",
        "Prior Year",
        "Grouping 1",
        "Grouping 2",
        "Grouping 3",
        "Grouping 4",
      ],
    ];

    await msExcel.writeSheet({
      driveItemId,
      worksheetName: "ETB",
      values: headersOnly,
    });

    return res
      .status(200)
      .json({ spreadsheetId: driveItemId, url: webUrl, section });
  } catch (err) {
    next(err);
  }
};

exports.pushEtbToExcel = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const ClassificationSection = require("../models/ClassificationSection");
    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: "ETB",
    });
    if (!section?.spreadsheetId) {
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
            "Re-Classification",
            "Adjustments",
            "Final Balance",
            "Prior Year",
            "Grouping 1",
            "Grouping 2",
            "Grouping 3",
            "Grouping 4",
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
      return res.status(400).json({
        message:
          "Excel workbook not initialized. Click 'Initialize Excel' first.",
      });
    }

    const result = await msExcel.readSheet({
      driveItemId: section.spreadsheetId,
      worksheetName: "ETB",
    });

    // Extract the values array from the result object
    const aoa = result.values || result;

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

    return res.status(200).json(etb.toObject ? etb.toObject() : etb);
  } catch (err) {
    next(err);
  }
};

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

function getFileNameFromPublicUrl(url) {
  const path = extractStoragePathFromPublicUrl(url);
  if (!path) return null;
  const last = path.split("/").pop() || "";
  return last.split("?")[0];
}
async function readLeadSheet(section) {
  const worksheetName = "Sheet1";
  const result = await msExcel.readSheet({
    driveItemId: section.workingPapersId,
    worksheetName,
  });
  return result.values || result;
}

async function writeLeadSheet(section, values) {
  const worksheetName = "Sheet1";
  await msExcel.writeSheet({
    driveItemId: section.workingPapersId,
    worksheetName,
    values,
  });
}

exports.fetchTabsFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res
        .status(400)
        .json({ message: "Working papers not initialized." });
    }

    const token = await msExcel.getAccessToken();
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await listRes.json();
    const all = Array.isArray(json.value) ? json.value.map((s) => s.name) : [];
    const tabs = all.filter((n) => n !== "Sheet1");

    return res.json({ tabs });
  } catch (err) {
    next(err);
  }
};

exports.selectTabFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, sheetName } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    if (!sheetName)
      return res.status(400).json({ message: "sheetName required." });

    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res
        .status(400)
        .json({ message: "Working papers not initialized." });
    }

    const data = await readLeadSheet(section);
    if (!data || data.length === 0) {
      return res.status(400).json({ message: "Lead sheet is empty." });
    }

    const updated = data.map((row, idx) => {
      if (idx === 0) return row;
      const currentRowId = `row-${idx - 1}`;
      if (currentRowId === rowId) {
        const newRow = [...row];
        newRow[6] = `Sheet:${sheetName}`;
        return newRow;
      }
      return row;
    });

    await writeLeadSheet(section, updated);

    const rows = updated.slice(1).map((row, index) => ({
      id: `row-${index}`,
      code: row[0] || "",
      accountName: row[1] || "",
      currentYear: parseAccountingNumber(row[2]),
      priorYear: parseAccountingNumber(row[3]),
      adjustments: parseAccountingNumber(row[4]),
      finalBalance: parseAccountingNumber(row[5]),
      classification: decodedClassification,
      reference: row[6] || "",
      grouping1: row[7] || "",
      grouping2: row[8] || "",
      grouping3: row[9] || "",
      grouping4: row[10] || "",
    }));

    section.lastSyncAt = new Date();
    await section.save();

    return res.json({ rows });
  } catch (err) {
    next(err);
  }
};

exports.viewSelectedFromDB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    }).lean();

    if (!doc)
      return res.status(404).json({ message: "Working paper not found." });

    // rowId like "row-12"
    const idx = Number.parseInt(String(rowId).replace("row-", ""), 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= doc.rows.length) {
      return res.status(404).json({ message: "Row not found." });
    }

    const r = doc.rows[idx];

    return res.json({
      leadSheetRow: {
        code: r.code || "",
        accountName: r.accountName || "",
        currentYear: Number(r.currentYear) || 0,
        priorYear: Number(r.priorYear) || 0,
        adjustments: Number(r.adjustments) || 0,
        finalBalance:
          Number(r.finalBalance) ||
          (Number(r.currentYear) || 0) +
            (Number(r.adjustments) || 0) +
            (Number(r.reclassification) || 0),
      },
      reference: r.reference || "",
      referenceData: r.referenceData || "", // <- hydrated at save time
    });
  } catch (err) {
    next(err);
  }
};

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
    await supabase.storage.from("engagement-documents").remove(paths);
  }

  await EngagementLibrary.deleteMany({
    engagement: engagementId,
    category,
    url: { $ne: "" },
  });
}

async function safeRemoveStoragePath(path) {
  if (!path) return;
  try {
    await supabase.storage.from("engagement-documents").remove([path]);
  } catch {}
}

async function uploadBufferToLibrary({
  engagementId,
  category,
  buffer,
  fileName,
  allowMultiple = false,
}) {
  if (!allowMultiple) {
    await removeExistingLibraryResource(engagementId, category);
  } else {
    const existing = await EngagementLibrary.find({
      engagement: engagementId,
      category,
      url: { $ne: "" },
    });
    for (const doc of existing) {
      const existingName = getFileNameFromPublicUrl(doc.url);
      if (existingName && existingName === fileName) {
        const existingPath = extractStoragePathFromPublicUrl(doc.url);
        if (existingPath) {
          try {
            await supabase.storage
              .from("engagement-documents")
              .remove([existingPath]);
          } catch {}
        }
        try {
          await EngagementLibrary.deleteOne({ _id: doc._id });
        } catch {}
      }
    }
  }

  const filePath = `${engagementId}/${category}/${fileName}`;

  const doUpload = () =>
    supabase.storage.from("engagement-documents").upload(filePath, buffer, {
      contentType: EXCEL_MIME,
      upsert: false,
      cacheControl: "0",
    });

  let { data: uploadData, error } = await doUpload();
  if (error && String(error.message).toLowerCase().includes("exists")) {
    try {
      await supabase.storage.from("engagement-documents").remove([filePath]);
    } catch {}
    ({ data: uploadData, error } = await doUpload());
  }
  if (error) throw error;

  const { data: pub } = supabase.storage
    .from("engagement-documents")
    .getPublicUrl(uploadData.path);

  const viewUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const entry = await EngagementLibrary.create({
    engagement: engagementId,
    category,
    url: viewUrl,
  });

  return entry;
}

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
  "Audit Sections",
  "Adjustments",
  "Reclassifications",
];

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

    // Get folders for this engagement
    const folders = await EngagementFolder.find({
      engagement: engagementId,
    }).populate('parentId', 'name path').sort({ createdAt: -1 });

    res.json({ files: filesWithNames, folders });
  } catch (err) {
    next(err);
  }
};

exports.createEngagement = async (req, res, next) => {
  console.log(req.user);
  
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl, createdBy, companyId } =
      req.body;
    const engagement = await Engagement.create({
      createdBy,
      clientId,
      organizationId: req.user.organizationId, 
      companyId,
      title,
      yearEndDate,
      trialBalanceUrl,
      status: trialBalanceUrl ? "active" : "draft",
    });
    
    const placeholders = ENGAGEMENT_FOLDERS.map((category) => ({
      engagement: engagement._id,
      category,
      url: "",
    }));
    await EngagementLibrary.insertMany(placeholders);

    return res.status(201).json(engagement);
  } catch (err) {
    next(err);
  }
};

exports.uploadToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { category, replaceExisting } = req.body;
    const file = req.file;

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

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
          cacheControl: "0",
        });
    }

    let { data: uploadData, error: uploadError } = await tryUpload();

    if (
      uploadError &&
      String(uploadError.message).toLowerCase().includes("exists")
    ) {
      await removeExistingLibraryResource(engagementId, category);
      await safeRemoveStoragePath(filePath);
      ({ data: uploadData, error: uploadError } = await tryUpload());
    }

    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage
      .from("engagement-documents")
      .getPublicUrl(uploadData.path);

    const versionedUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const entry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: versionedUrl,
    });

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

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

    const allRows = await sheetService.fetch(sheetUrl);
    if (!allRows?.length)
      return res.status(400).json({ message: "No data found in the sheet." });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

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

    if (!category || !url) {
      return res
        .status(400)
        .json({ message: "Both category and url are required." });
    }

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    });

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." });
    }

    if (existingEntry.category === category) {
      return res.status(200).json({
        message: "File is already in this category",
        entry: existingEntry,
      });
    }

    const oldPath = extractStoragePathFromPublicUrl(url);
    if (!oldPath) {
      return res.status(400).json({ message: "Invalid file URL format" });
    }

    const fileName = oldPath.split("/").pop();
    const newPath = `${engagementId}/${category}/${fileName}`;

    const { error: checkError } = await supabase.storage
      .from("engagement-documents")
      .download(oldPath);

    if (checkError) {
      console.error("File not found in storage:", checkError);
      return res.status(404).json({ message: "File not found in storage" });
    }

    const { error: copyError } = await supabase.storage
      .from("engagement-documents")
      .copy(oldPath, newPath);

    if (copyError) {
      console.error("Copy failed:", copyError);
      throw copyError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("engagement-documents").getPublicUrl(newPath);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    const updatedEntry = await EngagementLibrary.findOneAndUpdate(
      { _id: existingEntry._id },
      {
        category,
        url: versionedUrl,
        updatedAt: new Date(),
      },
      { new: true }
    );

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

    if (!url) {
      return res.status(400).json({ message: "File URL is required." });
    }

    const existingEntry = await EngagementLibrary.findOne({
      url: url,
      engagement: engagementId,
    });

    if (!existingEntry) {
      return res.status(404).json({ message: "File not found in library." });
    }

    const filePath = extractStoragePathFromPublicUrl(url);
    if (!filePath) {
      return res.status(400).json({ message: "Invalid file URL format" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await EngagementLibrary.deleteOne(
        { _id: existingEntry._id },
        { session }
      );

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
    const query = {};
    
    // Organization scoping: only super-admin can see all engagements
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }
    
    const engagements = await Engagement.find(query);
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
    
    const query = { clientId };
    
    // Organization scoping: only super-admin can see all engagements
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }
    
    const engagements = await Engagement.find(query);
    res.json(engagements);
  } catch (err) {
    next(err);
  }
};

exports.getEngagementById = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    
    // Organization scoping: only super-admin can access engagements from other orgs
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }
    
    const engagement = await Engagement.findOne(query)
    .populate("documentRequests")
    .populate("procedures")
    .populate("trialBalanceDoc")
    .populate({
      path: "companyId",
      populate: [
        {
          path: "shareHolders.personId",
          model: "Person",
          select: "name nationality email phoneNumber address"
        },
        {
          path: "representationalSchema.personId",
          model: "Person",
          select: "name nationality email phoneNumber address"
        },
        {
          path: "shareHoldingCompanies.companyId",
          model: "Company",
          populate: {
            path: "shareHolders.personId",
            model: "Person",
            select: "name nationality address"
          }
        }
      ]
    });
    if (!engagement) return res.status(404).json({ message: "Not found or access denied" });
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

exports.updateEngagement = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    
    // Organization scoping: only super-admin can update engagements from other orgs
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }
    
    const engagement = await Engagement.findOneAndUpdate(
      query,
      req.body,
      { new: true }
    );
    if (!engagement) return res.status(404).json({ message: "Not found or access denied" });
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

exports.fetchTrialBalance = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id);
    if (!engagement)
      return res.status(404).json({ message: "Engagement not found" });

    const allRows = await sheetService.fetch(
      req.body.sheetUrl || engagement.trialBalanceUrl
    );
    if (!allRows.length)
      return res.status(204).json({ message: "No data returned" });

    const [headers, ...rows] = allRows;

    // Find column indices for numeric fields
    const currentYearIndex = headers.findIndex(h => h.toLowerCase().includes("current year"));
    const priorYearIndex = headers.findIndex(h => h.toLowerCase().includes("prior year"));

    // Round numeric values in raw rows before saving to TrialBalance
    const roundedRows = rows.map((row) => {
      const roundedRow = [...row];
      if (currentYearIndex !== -1 && row[currentYearIndex] !== undefined && row[currentYearIndex] !== null && row[currentYearIndex] !== "") {
        roundedRow[currentYearIndex] = parseAccountingNumber(row[currentYearIndex]);
      }
      if (priorYearIndex !== -1 && row[priorYearIndex] !== undefined && row[priorYearIndex] !== null && row[priorYearIndex] !== "") {
        roundedRow[priorYearIndex] = parseAccountingNumber(row[priorYearIndex]);
      }
      return roundedRow;
    });

    let tb = await TrialBalance.findOne({ engagement: engagement._id });
    if (tb) {
      tb.headers = headers;
      tb.rows = roundedRows; // Use rounded rows
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagement._id,
        headers,
        rows: roundedRows, // Use rounded rows
      });
    }

    engagement.trialBalance = tb._id;
    await engagement.save();
    res.json(tb);
  } catch (err) {
    next(err);
  }
};

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

exports.saveTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { data, fileName } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: "Invalid trial balance data" });
    }

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

    // Find the latest trial balance file URL from EngagementLibrary
    const libraryEntry = await EngagementLibrary.findOne({
      engagement: engagementId,
      category: "Trial Balance",
      url: { $ne: "" },
    }).sort({ createdAt: -1 });

    // Find column indices for numeric fields
    const currentYearIndex = headers.findIndex(h => h.toLowerCase().includes("current year"));
    const priorYearIndex = headers.findIndex(h => h.toLowerCase().includes("prior year"));

    // Round numeric values in raw rows before saving to TrialBalance
    const roundedRows = data.slice(1).map((row) => {
      const roundedRow = [...row];
      if (currentYearIndex !== -1 && row[currentYearIndex] !== undefined && row[currentYearIndex] !== null && row[currentYearIndex] !== "") {
        roundedRow[currentYearIndex] = parseAccountingNumber(row[currentYearIndex]);
      }
      if (priorYearIndex !== -1 && row[priorYearIndex] !== undefined && row[priorYearIndex] !== null && row[priorYearIndex] !== "") {
        roundedRow[priorYearIndex] = parseAccountingNumber(row[priorYearIndex]);
      }
      return roundedRow;
    });

    let tb = await TrialBalance.findOne({ engagement: engagementId });
    if (tb) {
      tb.headers = headers;
      tb.rows = roundedRows; // Use rounded rows
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows: roundedRows, // Use rounded rows
      });
    }

    // Update engagement with trial balance ID and Supabase URL
    const updateData = {
      trialBalance: tb._id,
      status: "active",
    };

    if (libraryEntry && libraryEntry.url) {
      updateData.trialBalanceUrl = libraryEntry.url;
    }

    await Engagement.findByIdAndUpdate(engagementId, updateData);

    // Attempt to populate prior year data from previous year's engagement
    // This is a non-blocking operation - if it fails, we still return the uploaded trial balance
    let priorYearResult = null;
    try {
      priorYearResult = await populatePriorYearData(engagementId);
      console.log(`[saveTrialBalance] Prior year population result:`, priorYearResult);
    } catch (priorYearError) {
      console.error(`[saveTrialBalance] Error populating prior year data:`, priorYearError.message);
      // Log the error but don't fail the request
      priorYearResult = {
        success: false,
        message: `Error populating prior year data: ${priorYearError.message}`,
        populated: false
      };
    }

    // Create or update Extended Trial Balance from the (now updated) Trial Balance
    // This ensures ETB has the populated prior year data
    let etbCreated = false;
    try {
      // Fetch the updated trial balance (with prior year populated)
      // Use lean() to bypass Mongoose cache
      const updatedTB = await TrialBalance.findOne({ engagement: engagementId }).lean();
      if (updatedTB && updatedTB.rows && updatedTB.rows.length > 0) {
        const { headers: tbHeaders, rows: tbRows } = updatedTB;
        
        // Get isNewAccount status map and classification map from populatePriorYearData result
        const accountCodeStatusMap = (priorYearResult && priorYearResult.accountCodeStatusMap) || {};
        const accountCodeClassificationMap = (priorYearResult && priorYearResult.accountCodeClassificationMap) || {};
        console.log(`[saveTrialBalance] Account code status map has ${Object.keys(accountCodeStatusMap).length} entries`);
        console.log(`[saveTrialBalance] Classification map has ${Object.keys(accountCodeClassificationMap).length} entries`);
        
        // Find column indices
        const codeIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("code"));
        const nameIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("account name"));
        const currentYearIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("current year"));
        const priorYearIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("prior year"));
        const grouping1Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 1");
        const grouping2Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 2");
        const grouping3Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 3");
        const grouping4Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 4");

        // Build ETB rows from TB data
        const etbRows = tbRows.map((row, index) => {
          const code = row[codeIndex] || "";
          const accountName = row[nameIndex] || "";
          const currentYear = parseAccountingNumber(row[currentYearIndex]); // Already rounded
          const priorYear = parseAccountingNumber(row[priorYearIndex]); // Already rounded
          
          const g1 = grouping1Index !== -1 ? (row[grouping1Index] || "").trim() : "";
          const g2 = grouping2Index !== -1 ? (row[grouping2Index] || "").trim() : "";
          const g3 = grouping3Index !== -1 ? (row[grouping3Index] || "").trim() : "";
          const g4 = grouping4Index !== -1 ? (row[grouping4Index] || "").trim() : "";

          // Build classification from Trial Balance grouping columns (if they exist)
          let classification = [g1, g2, g3, g4].filter(Boolean).join(" > ");
          
          // Get isNewAccount flag and classification data from the maps
          const codeKey = String(code).trim();
          const isNewAccount = accountCodeStatusMap[codeKey] === true;
          const previousYearClassification = accountCodeClassificationMap[codeKey];
          
          // If current year doesn't have classification, use previous year's
          let finalGrouping1 = g1;
          let finalGrouping2 = g2;
          let finalGrouping3 = g3;
          let finalGrouping4 = g4;
          let finalClassification = classification;
          
          if ((!classification || classification === "") && previousYearClassification) {
            // Use previous year's classification and grouping
            finalClassification = previousYearClassification.classification || "";
            finalGrouping1 = previousYearClassification.grouping1 || "";
            finalGrouping2 = previousYearClassification.grouping2 || "";
            finalGrouping3 = previousYearClassification.grouping3 || "";
            finalGrouping4 = previousYearClassification.grouping4 || "";
            console.log(`[saveTrialBalance] Applied previous year classification to ${code}: ${finalClassification}`);
          }
          
          if (isNewAccount) {
            console.log(`[saveTrialBalance] Building ETB row with isNewAccount=true: Code=${code}`);
          }
          
          return {
            _id: code || `row-${index}`,
            code,
            accountName,
            currentYear, // Already rounded via parseAccountingNumber
            priorYear, // Already rounded via parseAccountingNumber
            adjustments: 0,
            reclassification: 0,
            finalBalance: currentYear, // Already rounded
            classification: finalClassification, // ✅ Use previous year's classification if current is empty
            grouping1: finalGrouping1, // ✅ From previous year
            grouping2: finalGrouping2, // ✅ From previous year
            grouping3: finalGrouping3, // ✅ From previous year
            grouping4: finalGrouping4, // ✅ From previous year
            isNewAccount, // ✅ Use the flag from populatePriorYearData
          };
        });

        console.log(`[saveTrialBalance] Built ${etbRows.length} ETB rows, ${etbRows.filter(r => r.isNewAccount).length} marked as NEW`);

        // Create or update ETB
        let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
        if (etb) {
          // Update existing ETB, preserving adjustments, reclassifications, AND isNewAccount flag
          etb.rows = etb.rows.map(existingRow => {
            // Find matching row in new data
            const newRow = etbRows.find(r => r.code === existingRow.code);
            if (newRow) {
              // Keep existing adjustments/reclassifications/flags, update other fields
              return {
                ...newRow,
                adjustments: existingRow.adjustments || 0,
                reclassification: existingRow.reclassification || 0,
                finalBalance: newRow.currentYear + (existingRow.adjustments || 0) + (existingRow.reclassification || 0),
                adjustmentRefs: existingRow.adjustmentRefs || [],
                reclassificationRefs: existingRow.reclassificationRefs || [],
                linkedExcelFiles: existingRow.linkedExcelFiles || [],
                mappings: existingRow.mappings || [],
                classification: existingRow.classification || newRow.classification,
                isNewAccount: newRow.isNewAccount, // ✅ Use flag from new data (from populatePriorYearData)
              };
            }
            return existingRow;
          });
          
          // Add any new rows that don't exist in ETB yet
          const existingCodes = new Set(etb.rows.map(r => r.code));
          const newRows = etbRows.filter(r => !existingCodes.has(r.code));
          etb.rows = [...etb.rows, ...newRows];
          
          await etb.save();
          etbCreated = true;
        } else {
          // Create new ETB
          etb = await ExtendedTrialBalance.create({
            engagement: engagementId,
            rows: etbRows,
          });
          etbCreated = true;
        }
      }
    } catch (etbError) {
      console.error(`[saveTrialBalance] Error creating/updating Extended Trial Balance:`, etbError.message);
      // Don't fail the request, ETB can be created later
    }

    // Fetch the final updated TB (with populated prior year) to return to frontend
    // Use lean() to ensure we get fresh data from database
    const finalTB = await TrialBalance.findOne({ engagement: engagementId }).lean();
    const finalData = finalTB ? [finalTB.headers, ...finalTB.rows] : data;

    res.json({
      ...tb.toObject(),
      data: finalData, // ✅ Return updated data with populated prior year
      fileName,
      priorYearPopulation: priorYearResult,
      etbCreated: etbCreated // ✅ Flag indicating ETB was created/updated
    });
  } catch (err) {
    next(err);
  }
};

exports.importTrialBalanceFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { sheetUrl } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({ message: "Google Sheets URL is required" });
    }

    const allRows = await sheetService.fetch(sheetUrl);
    if (!allRows.length) {
      return res.status(400).json({ message: "No data found in the sheet" });
    }

    const [headers, ...rows] = allRows;

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

    // Find column indices for numeric fields
    const currentYearIndex = headers.findIndex(h => h.toLowerCase().includes("current year"));
    const priorYearIndex = headers.findIndex(h => h.toLowerCase().includes("prior year"));

    // Round numeric values in raw rows before saving to TrialBalance
    const roundedRows = rows.map((row) => {
      const roundedRow = [...row];
      if (currentYearIndex !== -1 && row[currentYearIndex] !== undefined && row[currentYearIndex] !== null && row[currentYearIndex] !== "") {
        roundedRow[currentYearIndex] = parseAccountingNumber(row[currentYearIndex]);
      }
      if (priorYearIndex !== -1 && row[priorYearIndex] !== undefined && row[priorYearIndex] !== null && row[priorYearIndex] !== "") {
        roundedRow[priorYearIndex] = parseAccountingNumber(row[priorYearIndex]);
      }
      return roundedRow;
    });

    let tb = await TrialBalance.findOne({ engagement: engagementId });
    if (tb) {
      tb.headers = headers;
      tb.rows = roundedRows; // Use rounded rows
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagementId,
        headers,
        rows: roundedRows, // Use rounded rows
      });
    }

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `Trial_Balance_${dateStamp}.xlsx`;

      const libraryEntry = await uploadBufferToLibrary({
        engagementId,
        category: "Trial Balance",
        buffer,
        fileName,
      });

      // Update engagement with trial balance ID and Supabase URL
      await Engagement.findByIdAndUpdate(engagementId, {
        trialBalance: tb._id,
        trialBalanceUrl: libraryEntry?.url || sheetUrl,
        status: "active",
      });
    } catch (e) {
      console.error("Failed to archive TB Excel to Library:", e?.message || e);
      // Fallback: update engagement without Supabase URL
      await Engagement.findByIdAndUpdate(engagementId, {
        trialBalance: tb._id,
        trialBalanceUrl: sheetUrl,
        status: "active",
      });
    }

    // Attempt to populate prior year data from previous year's engagement
    // This is a non-blocking operation - if it fails, we still return the uploaded trial balance
    let priorYearResult = null;
    try {
      priorYearResult = await populatePriorYearData(engagementId);
      console.log(`[importTrialBalanceFromSheets] Prior year population result:`, priorYearResult);
    } catch (priorYearError) {
      console.error(`[importTrialBalanceFromSheets] Error populating prior year data:`, priorYearError.message);
      // Log the error but don't fail the request
      priorYearResult = {
        success: false,
        message: `Error populating prior year data: ${priorYearError.message}`,
        populated: false
      };
    }

    // Create or update Extended Trial Balance from the (now updated) Trial Balance
    // This ensures ETB has the populated prior year data
    let etbCreated = false;
    try {
      // Fetch the updated trial balance (with prior year populated)
      const updatedTB = await TrialBalance.findOne({ engagement: engagementId }).lean();
      if (updatedTB && updatedTB.rows && updatedTB.rows.length > 0) {
        const { headers: tbHeaders, rows: tbRows } = updatedTB;
        
        // Get isNewAccount status map and classification map from populatePriorYearData result
        const accountCodeStatusMap = (priorYearResult && priorYearResult.accountCodeStatusMap) || {};
        const accountCodeClassificationMap = (priorYearResult && priorYearResult.accountCodeClassificationMap) || {};
        console.log(`[importTrialBalanceFromSheets] Account code status map has ${Object.keys(accountCodeStatusMap).length} entries`);
        console.log(`[importTrialBalanceFromSheets] Classification map has ${Object.keys(accountCodeClassificationMap).length} entries`);
        
        // Find column indices
        const codeIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("code"));
        const nameIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("account name"));
        const currentYearIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("current year"));
        const priorYearIndex = tbHeaders.findIndex(h => h.toLowerCase().includes("prior year"));
        const grouping1Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 1");
        const grouping2Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 2");
        const grouping3Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 3");
        const grouping4Index = tbHeaders.findIndex(h => h.toLowerCase().trim() === "grouping 4");

        // Build ETB rows from TB data
        const etbRows = tbRows.map((row, index) => {
          const code = row[codeIndex] || "";
          const accountName = row[nameIndex] || "";
          const currentYear = parseAccountingNumber(row[currentYearIndex]); // Already rounded
          const priorYear = parseAccountingNumber(row[priorYearIndex]); // Already rounded
          
          const g1 = grouping1Index !== -1 ? (row[grouping1Index] || "").trim() : "";
          const g2 = grouping2Index !== -1 ? (row[grouping2Index] || "").trim() : "";
          const g3 = grouping3Index !== -1 ? (row[grouping3Index] || "").trim() : "";
          const g4 = grouping4Index !== -1 ? (row[grouping4Index] || "").trim() : "";

          // Build classification from Trial Balance grouping columns (if they exist)
          let classification = [g1, g2, g3, g4].filter(Boolean).join(" > ");
          
          // Get isNewAccount flag and classification data from the maps
          const codeKey = String(code).trim();
          const isNewAccount = accountCodeStatusMap[codeKey] === true;
          const previousYearClassification = accountCodeClassificationMap[codeKey];
          
          // If current year doesn't have classification, use previous year's
          let finalGrouping1 = g1;
          let finalGrouping2 = g2;
          let finalGrouping3 = g3;
          let finalGrouping4 = g4;
          let finalClassification = classification;
          
          if ((!classification || classification === "") && previousYearClassification) {
            // Use previous year's classification and grouping
            finalClassification = previousYearClassification.classification || "";
            finalGrouping1 = previousYearClassification.grouping1 || "";
            finalGrouping2 = previousYearClassification.grouping2 || "";
            finalGrouping3 = previousYearClassification.grouping3 || "";
            finalGrouping4 = previousYearClassification.grouping4 || "";
            console.log(`[importTrialBalanceFromSheets] Applied previous year classification to ${code}: ${finalClassification}`);
          }
          
          if (isNewAccount) {
            console.log(`[importTrialBalanceFromSheets] Building ETB row with isNewAccount=true: Code=${code}`);
          }
          
          return {
            _id: code || `row-${index}`,
            code,
            accountName,
            currentYear, // Already rounded via parseAccountingNumber
            priorYear, // Already rounded via parseAccountingNumber
            adjustments: 0,
            reclassification: 0,
            finalBalance: currentYear, // Already rounded
            classification: finalClassification, // ✅ Use previous year's classification if current is empty
            grouping1: finalGrouping1, // ✅ From previous year
            grouping2: finalGrouping2, // ✅ From previous year
            grouping3: finalGrouping3, // ✅ From previous year
            grouping4: finalGrouping4, // ✅ From previous year
            isNewAccount, // ✅ Use the flag from populatePriorYearData
          };
        });

        console.log(`[importTrialBalanceFromSheets] Built ${etbRows.length} ETB rows, ${etbRows.filter(r => r.isNewAccount).length} marked as NEW`);

        // Create or update ETB
        let etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
        if (etb) {
          // Update existing ETB, preserving adjustments, reclassifications, AND isNewAccount flag
          etb.rows = etb.rows.map(existingRow => {
            // Find matching row in new data
            const newRow = etbRows.find(r => r.code === existingRow.code);
            if (newRow) {
              // Keep existing adjustments/reclassifications/flags, update other fields
              return {
                ...newRow,
                adjustments: existingRow.adjustments || 0,
                reclassification: existingRow.reclassification || 0,
                finalBalance: newRow.currentYear + (existingRow.adjustments || 0) + (existingRow.reclassification || 0),
                adjustmentRefs: existingRow.adjustmentRefs || [],
                reclassificationRefs: existingRow.reclassificationRefs || [],
                linkedExcelFiles: existingRow.linkedExcelFiles || [],
                mappings: existingRow.mappings || [],
                classification: existingRow.classification || newRow.classification,
                isNewAccount: newRow.isNewAccount, // ✅ Use flag from new data (from populatePriorYearData)
              };
            }
            return existingRow;
          });
          
          // Add any new rows that don't exist in ETB yet
          const existingCodes = new Set(etb.rows.map(r => r.code));
          const newRows = etbRows.filter(r => !existingCodes.has(r.code));
          etb.rows = [...etb.rows, ...newRows];
          
          await etb.save();
          etbCreated = true;
        } else {
          // Create new ETB
          etb = await ExtendedTrialBalance.create({
            engagement: engagementId,
            rows: etbRows,
          });
          etbCreated = true;
        }
      }
    } catch (etbError) {
      console.error(`[importTrialBalanceFromSheets] Error creating/updating Extended Trial Balance:`, etbError.message);
      // Don't fail the request, ETB can be created later
    }

    // Fetch the final updated TB (with populated prior year) to return to frontend
    const finalTB = await TrialBalance.findOne({ engagement: engagementId }).lean();
    const finalData = finalTB ? [finalTB.headers, ...finalTB.rows] : allRows;

    res.json({
      ...tb.toObject(),
      data: finalData, // ✅ Return updated data with populated prior year
      priorYearPopulation: priorYearResult,
      etbCreated: etbCreated // ✅ Flag indicating ETB was created/updated
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTrialBalance = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    await TrialBalance.findOneAndDelete({ engagement: engagementId });

    await ExtendedTrialBalance.findOneAndDelete({ engagement: engagementId });

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

    await Engagement.findByIdAndUpdate(engagementId, {
      $unset: { trialBalance: 1, trialBalanceUrl: 1 },
    });

    res.json({ message: "Trial balance removed successfully" });
  } catch (err) {
    next(err);
  }
};

exports.manuallyPopulatePriorYear = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    // Call the populate prior year service
    const result = await populatePriorYearData(engagementId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        populated: result.populated,
        details: result.details,
        updatedRows: result.updatedRows,
        newAccounts: result.newAccounts,
        matchPercentage: result.matchPercentage,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        populated: false,
      });
    }
  } catch (err) {
    console.error("[manuallyPopulatePriorYear] Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to populate prior year data",
      error: err.message,
    });
  }
};

exports.saveETB = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ message: "Invalid ETB data" });
    }

    const cleaned = rows.map((r) => {
      const {
        _id,
        id,
        code,
        accountName,
        currentYear,
        priorYear,
        adjustments,
        finalBalance,
        classification,
        reclassification,
        ...rest
      } = r || {};

      // Use existing _id or id, or generate one from code
      const rowId = _id || id || String(code).trim();

      const current = parseAccountingNumber(currentYear); // Already rounded
      const prior = parseAccountingNumber(priorYear); // Already rounded
      const adjValue = parseAccountingNumber(adjustments); // Already rounded
      const reclassValue = parseAccountingNumber(reclassification); // Already rounded
      const providedFinal =
        finalBalance !== undefined && finalBalance !== null && finalBalance !== ""
          ? parseAccountingNumber(finalBalance) // Already rounded
          : undefined;
      const computedFinal = current + adjValue + reclassValue; // All values already rounded

      return {
        _id: rowId,
        code: code != null ? String(code).trim() : "",
        accountName: accountName != null ? String(accountName) : "",
        currentYear: current, // Rounded
        priorYear: prior, // Rounded
        adjustments: adjValue, // Rounded
        finalBalance: Number.isFinite(providedFinal) ? providedFinal : computedFinal, // Rounded
        classification:
          classification != null ? String(classification).trim() : "",
        reclassification: reclassValue, // Rounded
        ...rest,
      };
    });

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

    // Auto-populate prior year data if not already done
    // Check if any row has isNewAccount field set (indicates prior year has been populated)
    const hasBeenPopulated = etb.rows.some(row => 
      row.isNewAccount === true || row.isNewAccount === false
    );
    
    if (!hasBeenPopulated && etb.rows.length > 0) {
      // Silently attempt to populate prior year data in the background
      try {
        await populatePriorYearData(engagementId);
        // Re-fetch ETB after population
        const updatedEtb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
        if (updatedEtb) {
          const etbObject = updatedEtb.toObject();
          etbObject.rows = etbObject.rows.map((row) => {
            if (!row._id) {
              row._id = row.id || row.code || `row_${Math.random().toString(36).slice(2)}`;
            }
            return row;
          });
          return res.json(etbObject);
        }
      } catch (populateError) {
        console.log('[getETB] Auto-populate prior year failed (non-critical):', populateError.message);
        // Continue with original ETB if population fails
      }
    }

    // Ensure all rows have an _id field (for adjustments support)
    const etbObject = etb.toObject();
    etbObject.rows = etbObject.rows.map((row) => {
      // Use existing _id, or generate from code
      if (!row._id) {
        row._id = row.id || row.code || `row_${Math.random().toString(36).slice(2)}`;
      }
      return row;
    });

    res.json(etbObject);
  } catch (err) {
    next(err);
  }
};

exports.getETBByClassification = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);
    
    const etb = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });

    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: { $regex: `^${decodedClassification}`, $options: "i" },
    });

    if (!etb) {
      // If ETB is not found at all for the engagement,
      // we still return the classification section if it exists.
      return res.status(200).json({
        rows: [], // No ETB rows to return
        spreadsheetUrl: section?.spreadsheetUrl || null,
        spreadsheetId: section?.spreadsheetId || null,
        section: section, // Include the section details
        message: "Extended Trial Balance not found for this engagement.",
      });
    }

    const filteredRows = etb.rows
      .filter((row) => row.classification.startsWith(decodedClassification))
      .map((row) => {
        // Ensure _id field exists
        const rowObj = row.toObject ? row.toObject() : { ...row };
        if (!rowObj._id) {
          rowObj._id = rowObj.id || rowObj.code || `row_${Math.random().toString(36).slice(2)}`;
        }
        return rowObj;
      });

    // If ETB is found, but no rows match the classification,
    // this will return an empty 'rows' array, which is correct.
    res.json({
      rows: filteredRows,
      spreadsheetUrl: section?.spreadsheetUrl || null,
      spreadsheetId: section?.spreadsheetId || null,
      section: section,
      // You might optionally add a message here too, e.g.,
      // message: filteredRows.length > 0 ? "ETB rows found." : "No ETB rows found for this classification."
    });
  } catch (err) {
    next(err);
  }
};

exports.reloadClassificationFromETB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

    const etbDoc = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });
    const allRows = Array.isArray(etbDoc?.rows) ? etbDoc.rows : [];

    const filtered = allRows.filter(
      (r) => (r?.classification || "") === decodedClassification
    );

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

    const mergedRows = filtered.map((row, idx) => {
      const key = `${(row.code || "").trim()}::${(
        row.accountName || ""
      ).trim()}`;
      const preservedRef = refMap.get(key);
      const rowId = row._id || row.id || row.code || `row-${idx}`;
      const current = parseAccountingNumber(row.currentYear);
      const adjustments = parseAccountingNumber(row.adjustments);
      const reclassification = parseAccountingNumber(row.reclassification);
      const final = parseAccountingNumber(row.finalBalance);
      return {
        _id: rowId,
        id: rowId,
        code: row.code || "",
        accountName: row.accountName || "",
        currentYear: current,
        priorYear: parseAccountingNumber(row.priorYear),
        adjustments: adjustments,
        reclassification,
        finalBalance: Number.isFinite(final) ? final : current + adjustments + reclassification,
        classification: decodedClassification,
        reference: preservedRef ? preservedRef : "",
        grouping1: row.grouping1 || "",
        grouping2: row.grouping2 || "",
        grouping3: row.grouping3 || "",
        grouping4: row.grouping4 || "",
      };
    });

    return res.json({ rows: mergedRows });
  } catch (err) {
    next(err);
  }
};
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

    const filteredRows = etb.rows
      .filter((row) => row.classification && row.classification.startsWith(decodedCategory))
      .map((row) => {
        // Ensure _id field exists
        const rowObj = row.toObject ? row.toObject() : { ...row };
        if (!rowObj._id) {
          rowObj._id = rowObj.id || rowObj.code || `row_${Math.random().toString(36).slice(2)}`;
        }
        return rowObj;
      });

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

    const getTopCategory = (cls) => {
      if (!cls || typeof cls !== "string") return "";
      const top = cls.split(" > ")[0] || "";
      return top;
    };

    const n = (v) => {
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    };

    const groups = new Map();
    for (const row of data) {
      const top = getTopCategory(row?.classification || "");
      if (!groups.has(top)) groups.set(top, []);
      groups.get(top).push(row);
    }

    const headers = [
      "Top Category",
      "Classification",
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
      "Adjustments",
      "Final Balance",
    ];

    const sheetData = [headers];

    let gCY = 0,
      gPY = 0,
      gADJ = 0,
      gFB = 0;

    for (const [top, rows] of groups.entries()) {
      if (!rows || rows.length === 0) continue;

      let tCY = 0,
        tPY = 0,
        tADJ = 0,
        tFB = 0;

      for (const r of rows) {
        const cy = n(r.currentYear);
        const py = n(r.priorYear);
        const adj = n(r.adjustments);
        const reclass = n(r.reclassification);
        const fb = Number.isFinite(Number(r.finalBalance))
          ? n(r.finalBalance)
          : cy + adj + reclass;

        sheetData.push([
          top || "",
          String(r.classification || ""),
          String(r.code ?? ""),
          String(r.accountName ?? ""),
          cy,
          py,
          adj,
          fb,
        ]);

        tCY += cy;
        tPY += py;
        tADJ += adj;
        tFB += fb;
        gCY += cy;
        gPY += py;
        gADJ += adj;
        gFB += fb;
      }

      sheetData.push([
        `Subtotal - ${top || "-"}`,
        "",
        "",
        "",
        tCY,
        tPY,
        tADJ,
        tFB,
      ]);
    }

    sheetData.push(["TOTALS", "", "", "", gCY, gPY, gADJ, gFB]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = 4; C <= 7; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddr];
        if (!cell) continue;
        const val = Number(cell.v);
        if (Number.isFinite(val)) {
          ws[cellAddr] = { t: "n", v: val };
        }
      }
    }

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      decodedClassification.slice(0, 28) || "Sheet1"
    );

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeName =
      decodedClassification.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_") ||
      "Section";
    const fileName = `${safeName}.xlsx`;
    const entry = await uploadBufferToLibrary({
      engagementId,
      category: "Audit Sections",
      buffer,
      fileName,
      allowMultiple: true,
    });

    await ClassificationSection.findOneAndUpdate(
      { engagement: engagementId, classification: decodedClassification },
      { lastSyncAt: new Date() },
      { upsert: true }
    );

    return res.status(201).json({
      spreadsheetId: null,
      viewUrl: entry.url,
      title: fileName,
      fallback: true,
      message: "Saved a fixed-values spreadsheet in Library (Audit Sections).",
    });
  } catch (err) {
    console.error("createViewOnlySpreadsheet error:", err?.message || err);
    return next(err);
  }
};

exports.getWorkingPapersStatus = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const ClassificationSection = require("../models/ClassificationSection");
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res.json({
        initialized: false,
        url: null,
        spreadsheetId: null,
        sheets: [],
      });
    }

    const msExcel = require("../services/microsoftExcelService");
    try {
      const token = await msExcel.getAccessToken();
      const sheetsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const sheetsData = await sheetsResponse.json();
      const sheets = sheetsData.value?.map((sheet) => sheet.name) || [];

      return res.json({
        initialized: true,
        url: section.workingPapersUrl,
        spreadsheetId: section.workingPapersId,
        sheets: sheets,
      });
    } catch (error) {
      console.error("Error fetching sheets:", error);
      return res.json({
        initialized: true,
        url: section.workingPapersUrl,
        spreadsheetId: section.workingPapersId,
        sheets: [],
      });
    }
  } catch (err) {
    next(err);
  }
};

exports.initWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { leadSheetData } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const msExcel = require("../services/microsoftExcelService");
    const ClassificationSection = require("../models/ClassificationSection");

    const { id: driveItemId, webUrl } = await msExcel.ensureWorkbook({
      engagementId,
      classification: decodedClassification,
    });

    const headers = [
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
      "Adjustments",
      "Final Balance",
      "Reference",
      "Grouping 1",
      "Grouping 2",
      "Grouping 3",
      "Grouping 4",
    ];

    const dataRows = leadSheetData.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      "",
      row.grouping1 || "",
      row.grouping2 || "",
      row.grouping3 || "",
      row.grouping4 || "",
    ]);

    const worksheetData = [headers, ...dataRows];

    const worksheetName = "Sheet1";
    await msExcel.writeSheet({
      driveItemId,
      worksheetName: worksheetName,
      values: worksheetData,
    });

    let section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section) {
      section = await ClassificationSection.create({
        engagement: engagementId,
        classification: decodedClassification,
        workingPapersId: driveItemId,
        workingPapersUrl: webUrl,
        lastSyncAt: new Date(),
      });
    } else {
      section.workingPapersId = driveItemId;
      section.workingPapersUrl = webUrl;
      section.lastSyncAt = new Date();
      await section.save();
    }

    const token = await msExcel.getAccessToken();
    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${driveItemId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const sheetsData = await sheetsResponse.json();
    const sheets = sheetsData.value?.map((sheet) => sheet.name) || [];

    return res.json({
      spreadsheetId: driveItemId,
      url: webUrl,
      sheets: sheets,
    });
  } catch (err) {
    next(err);
  }
};

exports.pushToWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { data } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const ClassificationSection = require("../models/ClassificationSection");
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized. Initialize first.",
      });
    }

    const msExcel = require("../services/microsoftExcelService");

    const headers = [
      "Code",
      "Account Name",
      "Current Year",
      "Prior Year",
      "Adjustments",
      "Final Balance",
      "Reference",
      "Grouping 1",
      "Grouping 2",
      "Grouping 3",
      "Grouping 4",
    ];

    const dataRows = data.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      row.reference || "",
      row.grouping1 || "",
      row.grouping2 || "",
      row.grouping3 || "",
      row.grouping4 || "",
    ]);

    const worksheetData = [headers, ...dataRows];
    const worksheetName = "Sheet1";

    await msExcel.writeSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
      values: worksheetData,
    });

    section.lastSyncAt = new Date();
    await section.save();

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.pullFromWorkingPapers = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const ClassificationSection = require("../models/ClassificationSection");
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized. Initialize first.",
      });
    }

    const msExcel = require("../services/microsoftExcelService");
    const worksheetName = "Sheet1";

    const result = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    });
    const data = result.values || result;

    const rows = data.slice(1).map((row, index) => ({
      id: `row-${index}`,
      code: row[0] || "",
      accountName: row[1] || "",
      currentYear: parseAccountingNumber(row[2]),
      priorYear: parseAccountingNumber(row[3]),
      adjustments: parseAccountingNumber(row[4]),
      finalBalance: parseAccountingNumber(row[5]),
      classification: decodedClassification,
      reference: row[6] || "",
      grouping1: row[7] || "",
      grouping2: row[8] || "",
      grouping3: row[9] || "",
      grouping4: row[10] || "",
    }));

    const token = await msExcel.getAccessToken();
    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const sheetsData = await sheetsResponse.json();
    const sheets = sheetsData.value?.map((sheet) => sheet.name) || [];

    section.lastSyncAt = new Date();
    await section.save();

    return res.json({ rows, sheets });
  } catch (err) {
    next(err);
  }
};

exports.fetchRowsFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const ClassificationSection = require("../models/ClassificationSection");
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized.",
      });
    }

    const msExcel = require("../services/microsoftExcelService");
    const token = await msExcel.getAccessToken();

    const sheetsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${process.env.MS_DRIVE_ID}/items/${section.workingPapersId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const sheetsData = await sheetsResponse.json();
    const sheets = sheetsData.value || [];

    const mainSheetName = "Sheet1";
    const otherSheets = sheets.filter((sheet) => sheet.name !== mainSheetName);

    const availableRows = [];

    for (const sheet of otherSheets) {
      try {
        const result = await msExcel.readSheet({
          driveItemId: section.workingPapersId,
          worksheetName: sheet.name,
        });
        const sheetData = result.values || result;

        sheetData.forEach((row, index) => {
          if (row.some((cell) => cell && cell.toString().trim())) {
            availableRows.push({
              sheetName: sheet.name,
              rowIndex: index + 1,
              data: row,
            });
          }
        });
      } catch (error) {
        console.error(`Error reading sheet ${sheet.name}:`, error);
      }
    }

    return res.json({ rows: availableRows });
  } catch (err) {
    next(err);
  }
};

exports.selectRowFromSheets = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, selectedRow } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    const ClassificationSection = require("../models/ClassificationSection");
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!section?.workingPapersId) {
      return res.status(400).json({
        message: "Working papers not initialized.",
      });
    }

    const msExcel = require("../services/microsoftExcelService");
    const worksheetName = "Sheet1";

    const result = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    });
    const data = result.values || result;

    const updatedData = data.map((row, index) => {
      if (index === 0) return row;

      const currentRowId = `row-${index - 1}`;
      if (currentRowId === rowId) {
        const newRow = [...row];
        newRow[6] = `${selectedRow.sheetName} Row#${selectedRow.rowIndex}`;
        return newRow;
      }
      return row;
    });

    await msExcel.writeSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
      values: updatedData,
    });

    const rows = updatedData.slice(1).map((row, index) => ({
      id: `row-${index}`,
      code: row[0] || "",
      accountName: row[1] || "",
      currentYear: parseAccountingNumber(row[2]),
      priorYear: parseAccountingNumber(row[3]),
      adjustments: parseAccountingNumber(row[4]),
      finalBalance: parseAccountingNumber(row[5]),
      classification: decodedClassification,
      reference: row[6] || "",
      grouping1: row[7] || "",
      grouping2: row[8] || "",
      grouping3: row[9] || "",
      grouping4: row[10] || "",
    }));

    section.lastSyncAt = new Date();
    await section.save();

    return res.json({ rows });
  } catch (err) {
    next(err);
  }
};

exports.saveWorkingPaperToDB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rows } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // 1) Basic clean (keep reference string for later hydration)
    const cleaned = Array.isArray(rows)
      ? rows.map((r) => ({
          id: r.id || "",
          code: r.code || "",
          accountName: r.accountName || "",
          currentYear: parseAccountingNumber(r.currentYear),
          priorYear: parseAccountingNumber(r.priorYear),
          adjustments: parseAccountingNumber(r.adjustments),
          finalBalance: parseAccountingNumber(r.finalBalance),
          classification: decodedClassification,
          reference: r.reference ?? "",
          referenceData: "", // temp; will hydrate below
          grouping1: r.grouping1 || "",
          grouping2: r.grouping2 || "",
          grouping3: r.grouping3 || "",
          grouping4: r.grouping4 || "",
        }))
      : [];

    // If there are no references, upsert immediately
    const anyHasReference = cleaned.some(
      (r) => typeof r.reference === "string" && r.reference.trim()
    );
    if (!anyHasReference) {
      const doc = await WorkingPaper.findOneAndUpdate(
        { engagement: engagementId, classification: decodedClassification },
        { rows: cleaned },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json({ rows: doc.rows });
    }

    // 2) Resolve working papers location to read referenced sheets once
    const section = await ClassificationSection.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    // If we can't read from Excel now, still save rows without referenceData
    if (!section?.workingPapersId) {
      const doc = await WorkingPaper.findOneAndUpdate(
        { engagement: engagementId, classification: decodedClassification },
        { rows: cleaned },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json({
        rows: doc.rows,
        note: "Working papers not initialized; referenceData left empty.",
      });
    }

    const driveItemId = section.workingPapersId;

    // 3) Collect distinct sheets to load (for both 'sheet' and 'row' refs)
    const sheetNeeds = new Set();
    const parsedRefs = cleaned.map((r) => parseReference(r.reference));
    parsedRefs.forEach((p) => {
      if ((p.type === "sheet" || p.type === "row") && p.sheetName) {
        sheetNeeds.add(p.sheetName);
      }
    });

    // 4) Load each needed sheet once
    const sheetCache = Object.create(null); // { [sheetName]: [][] }
    for (const sheetName of sheetNeeds) {
      try {
        const result = await msExcel.readSheet({
          driveItemId,
          worksheetName: sheetName,
        });
        const data = result.values || result;
        sheetCache[sheetName] = Array.isArray(data) ? data : [];
      } catch (e) {
        // If a sheet fails to load, mark as empty to avoid throwing the whole save
        sheetCache[sheetName] = [];
      }
    }

    // 5) Hydrate referenceData for each row
    const hydrated = cleaned.map((row, idx) => {
      const pref = parsedRefs[idx];

      if (pref.type === "sheet") {
        const full = sheetCache[pref.sheetName] || [];
        return {
          ...row,
          referenceData: {
            type: "sheet",
            sheet: {
              sheetName: pref.sheetName,
              data: full,
            },
          },
        };
      }

      if (pref.type === "row") {
        const full = sheetCache[pref.sheetName] || [];
        const target = full[pref.rowIndex - 1] || [];
        return {
          ...row,
          referenceData: {
            type: "row",
            reference: {
              sheetName: pref.sheetName,
              rowIndex: pref.rowIndex,
              data: target,
            },
          },
        };
      }

      // No/invalid reference
      return { ...row, referenceData: "" };
    });

    // 6) Upsert with hydrated rows
    const doc = await WorkingPaper.findOneAndUpdate(
      { engagement: engagementId, classification: decodedClassification },
      { rows: hydrated },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ rows: doc.rows });
  } catch (err) {
    next(err);
  }
};

exports.getWorkingPaperFromDB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc)
      return res
        .status(404)
        .json({ message: "No working paper saved for this section" });

    return res.json({ rows: doc.rows });
  } catch (err) {
    next(err);
  }
};

exports.getWorkingPapersWithLinkedFiles = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    // Find working paper and populate linked Excel files with ALL Workbook model fields
    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    }).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
      // No select clause - populate ALL fields from Workbook model
    });

    if (!doc) {
      return res
        .status(404)
        .json({ message: "No working paper found for this section" });
    }

    // Transform the data to include ALL populated workbook information
    const transformedRows = doc.rows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(), // Include ALL fields from Workbook model
      })),
    }));

    return res.json({
      engagement: doc.engagement,
      classification: doc.classification,
      rows: transformedRows,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateLinkedExcelFiles = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, linkedExcelFiles } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Validate input
    if (!rowId) {
      return res.status(400).json({
        message: "rowId is required",
      });
    }

    if (!Array.isArray(linkedExcelFiles)) {
      return res.status(400).json({
        message: "linkedExcelFiles must be an array",
      });
    }

    // Validate that all linkedExcelFiles are valid ObjectIds
    const validObjectIds = linkedExcelFiles.every((fileId) =>
      mongoose.Types.ObjectId.isValid(fileId)
    );

    if (!validObjectIds) {
      return res.status(400).json({
        message: "All linkedExcelFiles must be valid ObjectIds",
      });
    }

    // Find the working paper document
    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc) {
      return res.status(404).json({
        message: "Working paper not found for this section",
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({
        message: "Row not found in working paper",
      });
    }

    // Update the linkedExcelFiles for the specific row
    doc.rows[rowIndex].linkedExcelFiles = linkedExcelFiles;

    // Save the updated document
    await doc.save();

    // Return the updated working paper with populated linked files
    const updatedDoc = await WorkingPaper.findById(doc._id).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
    });

    // Transform the response to include populated workbook information
    const transformedRows = updatedDoc.rows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(),
      })),
    }));

    return res.json({
      message: "Linked Excel files updated successfully",
      engagement: updatedDoc.engagement,
      classification: updatedDoc.classification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteWorkbookFromLinkedFiles = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, workbookId } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Validate input
    if (!rowId) {
      return res.status(400).json({
        message: "rowId is required",
      });
    }

    if (!workbookId) {
      return res.status(400).json({
        message: "workbookId is required",
      });
    }

    // Validate that workbookId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(workbookId)) {
      return res.status(400).json({
        message: "workbookId must be a valid ObjectId",
      });
    }

    // Find the working paper document
    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc) {
      return res.status(404).json({
        message: "Working paper not found for this section",
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({
        message: "Row not found in working paper",
      });
    }

    // Check if the workbook exists in the linkedExcelFiles array
    const workbookExists =
      doc.rows[rowIndex].linkedExcelFiles.includes(workbookId);
    if (!workbookExists) {
      return res.status(404).json({
        message: "Workbook not found in linked Excel files for this row",
      });
    }

    // Remove the workbook from the linkedExcelFiles array
    doc.rows[rowIndex].linkedExcelFiles = doc.rows[
      rowIndex
    ].linkedExcelFiles.filter(
      (fileId) => fileId.toString() !== workbookId.toString()
    );

    // Save the updated document
    await doc.save();

    // Return the updated working paper with populated linked files
    const updatedDoc = await WorkingPaper.findById(doc._id).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
    });

    // Transform the response to include populated workbook information
    const transformedRows = updatedDoc.rows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(),
      })),
    }));

    return res.json({
      message: "Workbook removed from linked Excel files successfully",
      engagement: updatedDoc.engagement,
      classification: updatedDoc.classification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ETB with Linked Files Functions

exports.getExtendedTBWithLinkedFiles = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const decodedClassification = decodeURIComponent(classification);

    // Find ETB and populate linked Excel files with ALL Workbook model fields
    const doc = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    }).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
      // No select clause - populate ALL fields from Workbook model
    });

    if (!doc) {
      return res.status(404).json({
        message: "No Extended Trial Balance found for this engagement",
      });
    }

    // Filter rows by classification if provided
    let filteredRows = doc.rows;
    if (classification && classification !== "ETB") {
      filteredRows = doc.rows.filter(
        (row) => row.classification === decodedClassification
      );
    }

    // Transform the data to include ALL populated workbook information
    const transformedRows = filteredRows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(), // Include ALL fields from Workbook model
      })),
    }));

    return res.json({
      engagement: doc.engagement,
      classification: decodedClassification,
      rows: transformedRows,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateLinkedExcelFilesInExtendedTB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, linkedExcelFiles } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Validate input
    if (!rowId) {
      return res.status(400).json({
        message: "rowId is required",
      });
    }

    if (!Array.isArray(linkedExcelFiles)) {
      return res.status(400).json({
        message: "linkedExcelFiles must be an array",
      });
    }

    // Validate that all linkedExcelFiles are valid ObjectIds
    const validObjectIds = linkedExcelFiles.every((fileId) =>
      mongoose.Types.ObjectId.isValid(fileId)
    );

    if (!validObjectIds) {
      return res.status(400).json({
        message: "All linkedExcelFiles must be valid ObjectIds",
      });
    }

    // Find the ETB document
    const doc = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });

    if (!doc) {
      return res.status(404).json({
        message: "Extended Trial Balance not found for this engagement",
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex(
      (row) => row._id === rowId || row.code === rowId
    );
    if (rowIndex === -1) {
      return res.status(404).json({
        message: "Row not found in Extended Trial Balance",
      });
    }

    // Update the linkedExcelFiles for the specific row
    doc.rows[rowIndex].linkedExcelFiles = linkedExcelFiles;

    // Save the updated document
    await doc.save();

    // Return the updated ETB with populated linked files
    const updatedDoc = await ExtendedTrialBalance.findById(doc._id).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
    });

    // Filter rows by classification if provided
    let filteredRows = updatedDoc.rows;
    if (classification && classification !== "ETB") {
      filteredRows = updatedDoc.rows.filter(
        (row) => row.classification === decodedClassification
      );
    }

    // Transform the response to include populated workbook information
    const transformedRows = filteredRows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(),
      })),
    }));

    return res.json({
      message:
        "Linked Excel files updated successfully in Extended Trial Balance",
      engagement: updatedDoc.engagement,
      classification: decodedClassification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteWorkbookFromLinkedFilesInExtendedTB = async (req, res, next) => {
  try {
    const { id: engagementId, classification } = req.params;
    const { rowId, workbookId } = req.body;
    const decodedClassification = decodeURIComponent(classification);

    // Validate input
    if (!rowId) {
      return res.status(400).json({
        message: "rowId is required",
      });
    }

    if (!workbookId) {
      return res.status(400).json({
        message: "workbookId is required",
      });
    }

    // Validate that workbookId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(workbookId)) {
      return res.status(400).json({
        message: "workbookId must be a valid ObjectId",
      });
    }

    // Find the ETB document
    const doc = await ExtendedTrialBalance.findOne({
      engagement: engagementId,
    });

    if (!doc) {
      return res.status(404).json({
        message: "Extended Trial Balance not found for this engagement",
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex(
      (row) => row._id === rowId || row.code === rowId
    );
    if (rowIndex === -1) {
      return res.status(404).json({
        message: "Row not found in Extended Trial Balance",
      });
    }

    // Check if the workbook exists in the linkedExcelFiles array
    const workbookExists =
      doc.rows[rowIndex].linkedExcelFiles.includes(workbookId);
    if (!workbookExists) {
      return res.status(404).json({
        message: "Workbook not found in linked Excel files for this row",
      });
    }

    // Remove the workbook from the linkedExcelFiles array
    doc.rows[rowIndex].linkedExcelFiles = doc.rows[
      rowIndex
    ].linkedExcelFiles.filter(
      (fileId) => fileId.toString() !== workbookId.toString()
    );

    // Save the updated document
    await doc.save();

    // Return the updated ETB with populated linked files
    const updatedDoc = await ExtendedTrialBalance.findById(doc._id).populate({
      path: "rows.linkedExcelFiles",
      model: "Workbook",
    });

    // Filter rows by classification if provided
    let filteredRows = updatedDoc.rows;
    if (classification && classification !== "ETB") {
      filteredRows = updatedDoc.rows.filter(
        (row) => row.classification === decodedClassification
      );
    }

    // Transform the response to include populated workbook information
    const transformedRows = filteredRows.map((row) => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map((workbook) => ({
        ...workbook.toObject(),
      })),
    }));

    return res.json({
      message:
        "Workbook removed from linked Excel files successfully in Extended Trial Balance",
      engagement: updatedDoc.engagement,
      classification: decodedClassification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// workbooks from MsEXcel Service

exports.uploadWorkbook = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded." });
    }

    const { engagementId, classification } = req.body;
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer; // The file content as a Buffer

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required." });
    }

    const result = await uploadWorkbookFile({
      engagementId,
      classification,
      fileName,
      fileBuffer,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error uploading workbook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.uploadTrialBalances = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded." });
    }

    const { engagementId } = req.body; // trial balance doesn't use classification in the path
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required." });
    }

    const result = await uploadTrialBalance({
      engagementId,
      fileName,
      fileBuffer,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error uploading trial balance:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listWorkbooksInFolder = async (req, res, next) => {
  try {
    const { engagementId, classification } = req.query; // Use req.query for GET parameters

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required." });
    }

    const workbooks = await listWorkbooks({ engagementId, classification });
    res.json({ success: true, data: workbooks });
  } catch (error) {
    console.error("Error listing workbooks:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listTrialbalancesInFolder = async (req, res, next) => {
  try {
    const { engagementId } = req.query;

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required." });
    }

    const trialBalances = await listTrialbalanceWorkbooks({ engagementId });
    res.json({ success: true, data: trialBalances });
  } catch (error) {
    console.error("Error listing trial balances:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listWorksheetsInWorkbook = async (req, res, next) => {
  try {
    const { workbookId } = req.params;
    const worksheets = await listWorksheets(workbookId);
    res.json({ success: true, data: worksheets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.readSpecificSheetFromWorkbook = async (req, res, next) => {
  try {
    const { workbookId, sheetName } = req.params;
    // Note: readSheet returns { values, address }
    const result = await readSheet({
      driveItemId: workbookId,
      worksheetName: sheetName,
    });
    const sheetData = result.values || result;
    res.json({ success: true, data: sheetData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.SaveOrWriteEntireWorkbook = async (req, res, next) => {
  try {
    const { workbookId } = req.params;
    // Assuming req.body.sheetData is an object like { "Sheet1": [[...]], "Sheet2": [[...]] }
    const { sheetData } = req.body;

    // Now call the new dedicated function
    const result = await writeWorkbook({
      driveItemId: workbookId,
      workbookData: sheetData,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error saving workbook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.SaveOrwriteSpecificSheet = async (req, res, next) => {
  try {
    const { workbookId, sheetName } = req.params;
    const { sheetData } = req.body; // sheetData is the 2D array for THIS sheet

    if (!Array.isArray(sheetData)) {
      return res
        .status(400)
        .json({ success: false, error: "Sheet data must be a 2D array." });
    }

    // Your backend's `writeSheet` expects raw values without the prepended
    // column letters or row numbers. You might need to strip these off here
    // before passing to `writeSheet`.
    const dataToWrite = sheetData.slice(1).map((row) => row.slice(1)); // Remove Excel-like headers

    const result = await writeSheet({
      driveItemId: workbookId,
      worksheetName: sheetName,
      values: dataToWrite,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error saving sheet:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getFileVersionsHistory = async (req, res, next) => {
  // Get driveItemId from request parameters or query string
  // For production, always validate and sanitize user input.
  const driveItemId = req.params.id || req.query.driveItemId;

  if (!driveItemId) {
    return res
      .status(400)
      .json({ success: false, message: "driveItemId is required." });
  }

  try {
    const versions = await getFileVersionHistory(driveItemId);

    if (versions && versions.length > 0) {
      console.log(
        `[Controller] Found ${versions.length} versions for ${driveItemId}`
      );
      // You might want to format the versions for the client if needed
      const formattedVersions = versions.map((version) => ({
        id: version.id,
        lastModifiedDateTime: version.lastModifiedDateTime,
        size: version.size,
        webUrl: version.driveItem?.webUrl, // Provide a URL to view this specific version
        // Add any other relevant fields
      }));
      return res.json({ success: true, data: formattedVersions });
    } else {
      console.log(`[Controller] No versions found for ${driveItemId}.`);
      return res.json({
        success: true,
        message: "No versions created for this file.",
        data: [],
      });
    }
  } catch (error) {
    console.error(
      `[Controller] Error getting file versions for ${driveItemId}:`,
      error.message
    );
    // You could also pass the error to Express's error handling middleware: next(error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.revertToPrevVersion = async (req, res, next) => {
  // Get driveItemId from request parameters or body
  const driveItemId = req.params.id || req.body.driveItemId;
  // If you want to allow the user to specify a version to restore to:
  // const versionIdToRestore = req.body.versionId;

  if (!driveItemId) {
    return res
      .status(400)
      .json({ success: false, message: "driveItemId is required." });
  }

  try {
    console.log(`[Controller] Getting version history for ${driveItemId}...`);
    const versions = await getFileVersionHistory(driveItemId);

    if (!versions || versions.length < 2) {
      const message =
        "Not enough versions to revert. Need at least 2 versions.";
      console.log(`[Controller] ${message}`);
      return res.status(400).json({
        success: false,
        message: message,
        currentVersions: versions
          ? versions.map((v) => ({
              id: v.id,
              date: new Date(v.lastModifiedDateTime).toLocaleString(),
            }))
          : [],
      });
    }

    // This example reverts to the SECOND-TO-LAST version in the history.
    // If you implemented versionIdToRestore, you would use that here.
    const versionToRestore = versions[versions.length - 2];
    const targetVersionId = versionToRestore.id; // Or use req.body.versionId if provided

    console.log(`[Controller] Attempting to restore ${driveItemId} to version ID: ${targetVersionId} 
        (modified: ${new Date(
          versionToRestore.lastModifiedDateTime
        ).toLocaleString()})`);

    const restored = await restoreFileVersion(driveItemId, targetVersionId);

    if (restored) {
      console.log(
        `[Controller] File ${driveItemId} successfully restored to version ${targetVersionId}!`
      );

      // Optionally, fetch and return the new version history for confirmation
      const newVersions = await getFileVersionHistory(driveItemId);
      const formattedNewVersions = newVersions.map((version) => ({
        id: version.id,
        lastModifiedDateTime: version.lastModifiedDateTime,
        size: version.size,
        webUrl: version.driveItem?.webUrl,
      }));

      return res.json({
        success: true,
        message: `File restored to version ${targetVersionId}.`,
        newCurrentVersion: formattedNewVersions[0] || null, // The newest version will be the restored one
        newVersionHistory: formattedNewVersions,
      });
    } else {
      // This path should ideally not be hit if restoreFileVersion throws on failure.
      console.log(
        `[Controller] Restore operation for ${driveItemId} did not return success status.`
      );
      return res.status(500).json({
        success: false,
        message: "Restore operation failed unexpectedly.",
      });
    }
  } catch (error) {
    console.error(
      `[Controller] Error reverting file ${driveItemId} to previous version:`,
      error.message
    );
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ========================================
// Assigned Auditors Functions
// ========================================

/**
 * Assign an auditor to an engagement
 * POST /:id/auditors/assign
 * Body: { auditorId, assignedBy }
 */
exports.assignAuditor = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { auditorId, assignedBy } = req.body;

    // Validation
    if (!auditorId || !assignedBy) {
      return res.status(400).json({
        message: "auditorId and assignedBy are required",
      });
    }

    const query = { _id: engagementId };
    
    // Organization scoping
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    // Check if engagement exists
    const engagement = await Engagement.findOne(query);
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found or access denied" });
    }

    // Check if auditor is already assigned
    const alreadyAssigned = engagement.assignedAuditors.some(
      (auditor) => auditor.auditorId === auditorId
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        message: "Auditor is already assigned to this engagement",
      });
    }

    // Fetch auditor name from Supabase profiles
    let auditorName = "Unknown User";
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("user_id", auditorId)
        .single();

      if (!error && profile) {
        auditorName = profile.name || profile.email || "Unknown User";
      }
    } catch (err) {
      console.error("Error fetching auditor name:", err);
      // Continue with default name if fetch fails
    }

    // Add auditor to the array
    const newAuditor = {
      auditorId,
      auditorName,
      assignedBy,
      assignedAt: new Date(),
    };

    engagement.assignedAuditors.push(newAuditor);
    await engagement.save();

    res.status(200).json({
      message: "Auditor assigned successfully",
      assignedAuditors: engagement.assignedAuditors,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unassign an auditor from an engagement
 * DELETE /:id/auditors/unassign
 * Body: { auditorId }
 */
exports.unassignAuditor = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { auditorId } = req.body;

    if (!auditorId) {
      return res.status(400).json({
        message: "auditorId is required",
      });
    }

    const query = { _id: engagementId };
    
    // Organization scoping
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    // Remove auditor from the array using $pull
    const engagement = await Engagement.findOneAndUpdate(
      query,
      {
        $pull: {
          assignedAuditors: { auditorId: auditorId },
        },
      },
      { new: true }
    );

    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found or access denied" });
    }

    res.status(200).json({
      message: "Auditor unassigned successfully",
      assignedAuditors: engagement.assignedAuditors,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all auditors assigned to an engagement
 * GET /:id/auditors
 */
exports.getAssignedAuditors = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;

    const query = { _id: engagementId };
    
    // Organization scoping
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const engagement = await Engagement.findOne(query).select("assignedAuditors title");
    
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found or access denied" });
    }

    res.status(200).json({
      engagementId: engagement._id,
      title: engagement.title,
      assignedAuditors: engagement.assignedAuditors || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all engagements assigned to a specific auditor
 * GET /auditors/:auditorId/engagements
 */
exports.getAuditorEngagements = async (req, res, next) => {
  try {
    const { auditorId } = req.params;

    const query = {
      "assignedAuditors.auditorId": auditorId,
    };

    // Organization scoping
    if (req.user.role !== 'super-admin' && req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    }

    const engagements = await Engagement.find(query).select(
      "title yearEndDate status clientId organizationId assignedAuditors createdAt"
    );

    // Filter the assignedAuditors array to only show the specific auditor's info
    const formattedEngagements = engagements.map((eng) => {
      const auditorInfo = eng.assignedAuditors.find(
        (a) => a.auditorId === auditorId
      );
      
      return {
        _id: eng._id,
        title: eng.title,
        yearEndDate: eng.yearEndDate,
        status: eng.status,
        clientId: eng.clientId,
        organizationId: eng.organizationId,
        createdAt: eng.createdAt,
        auditorAssignment: auditorInfo,
      };
    });

    res.status(200).json({
      auditorId,
      engagements: formattedEngagements,
      totalEngagements: formattedEngagements.length,
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to build full path from parent hierarchy
async function buildEngagementFolderPath(folderId) {
  if (!folderId) return "";
  
  const folder = await EngagementFolder.findById(folderId);
  if (!folder) return "";
  
  const parentPath = folder.parentId 
    ? await buildEngagementFolderPath(folder.parentId) 
    : "";
  
  return parentPath ? `${parentPath}${folder.name}/` : `${folder.name}/`;
}

function sanitizeEngagementFolderName(name) {
  const cleaned = (name || "").trim();
  const valid = cleaned.replace(/[^a-zA-Z0-9 _.-]/g, "");
  if (!valid || /[\\/]/.test(valid)) {
    throw new Error("Invalid folder name");
  }
  return valid;
}

// List folders for an engagement
exports.listEngagementFolders = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const folders = await EngagementFolder.find({
      engagement: engagementId,
    }).populate('parentId', 'name path').sort({ createdAt: -1 });
    
    res.json(folders);
  } catch (err) {
    next(err);
  }
};

// Create folder in engagement library
exports.createEngagementFolder = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const rawName = req.body.name;
    const name = sanitizeEngagementFolderName(rawName);
    const parentId = req.body.parentId || null;
    const category = req.body.category || "Others"; // Default category

    // Check if parent exists (if parentId is provided)
    if (parentId) {
      const parent = await EngagementFolder.findOne({ _id: parentId, engagement: engagementId });
      if (!parent) {
        return res.status(404).json({ message: "Parent folder not found" });
      }
    }

    // Check if folder with same name already exists in the same parent and engagement
    const exists = await EngagementFolder.findOne({ name, parentId, engagement: engagementId });
    if (exists) {
      return res.status(409).json({ message: "Folder with this name already exists in the selected location" });
    }

    // Build full path including parent hierarchy
    const parentPath = parentId ? await buildEngagementFolderPath(parentId) : "";
    const fullPath = `${parentPath}${name}/`;
    const storagePath = `${engagementId}/${category}/${fullPath}.keep`;

    const { error: upErr } = await supabase.storage
      .from("engagement-documents")
      .upload(storagePath, Buffer.from(""), {
        contentType: "text/plain",
        upsert: false,
      });
    if (upErr && upErr.statusCode !== "409") throw upErr;
    
    const folder = await EngagementFolder.create({ 
      name, 
      path: fullPath,
      parentId: parentId || null,
      engagement: engagementId,
      category,
      createdBy: req.user?.name || req.user?.id,
    });
    
    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
};

// Rename folder
exports.renameEngagementFolder = async (req, res, next) => {
  try {
    const { id: engagementId, folderId } = req.params;
    const rawNewName = req.body.newName;
    const newName = sanitizeEngagementFolderName(rawNewName);

    const folder = await EngagementFolder.findOne({ _id: folderId, engagement: engagementId });
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    if (newName === folder.name) return res.json(folder);

    const dupe = await EngagementFolder.findOne({ name: newName, parentId: folder.parentId, engagement: engagementId });
    if (dupe) return res.status(409).json({ message: "Target folder name already exists" });

    const oldPrefix = `${engagementId}/${folder.category}/${folder.path}`;
    const parentPath = folder.parentId ? await buildEngagementFolderPath(folder.parentId) : "";
    const newPrefix = `${engagementId}/${folder.category}/${parentPath}${newName}/`;

    const { data: items, error: listErr } = await supabase.storage
      .from("engagement-documents")
      .list(oldPrefix, { limit: 1000 });
    if (listErr) throw listErr;

    for (const item of items || []) {
      if (item.name === ".keep") continue;
      const oldPath = `${oldPrefix}${item.name}`;
      const newPath = `${newPrefix}${item.name}`;
      const { error: copyErr } = await supabase.storage.from("engagement-documents").copy(oldPath, newPath);
      if (copyErr) throw copyErr;
    }

    const deletePaths = (items || []).filter(i => i.name !== ".keep").map((i) => `${oldPrefix}${i.name}`);
    if (deletePaths.length) {
      const { error: delErr } = await supabase.storage.from("engagement-documents").remove(deletePaths);
      if (delErr) throw delErr;
    }

    await supabase.storage.from("engagement-documents").upload(`${newPrefix}.keep`, Buffer.from(""), {
      contentType: "text/plain",
      upsert: true,
    });

    folder.name = newName;
    folder.path = `${parentPath}${newName}/`;
    await folder.save();

    res.json(folder);
  } catch (err) {
    next(err);
  }
};

// Delete folder
exports.deleteEngagementFolder = async (req, res, next) => {
  try {
    const { id: engagementId, folderId } = req.params;
    const folder = await EngagementFolder.findOne({ _id: folderId, engagement: engagementId });
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    // Check for subfolders
    const subfolders = await EngagementFolder.find({ parentId: folderId, engagement: engagementId });
    if (subfolders.length > 0) {
      return res.status(400).json({ message: "Cannot delete folder with subfolders. Please delete subfolders first." });
    }

    // Check for files in this folder
    const filesInFolder = await EngagementLibrary.find({ folderId, engagement: engagementId, url: { $ne: "" } });
    if (filesInFolder.length > 0) {
      return res.status(400).json({ message: "Cannot delete folder with files. Please move or delete files first." });
    }

    const prefix = `${engagementId}/${folder.category}/${folder.path}`;
    const { data: items } = await supabase.storage
      .from("engagement-documents")
      .list(prefix, { limit: 1000 });

    const pathsToDelete = (items || []).map((i) => `${prefix}${i.name}`);
    if (pathsToDelete.length) {
      const { error } = await supabase.storage.from("engagement-documents").remove(pathsToDelete);
      if (error) throw error;
    }

    await EngagementFolder.deleteOne({ _id: folderId });
    res.json({ message: "Folder deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Export Extended Trial Balance as Excel
 * GET /api/engagements/:id/export/etb
 */
exports.exportETB = async (req, res) => {
  try {
    const { id: engagementId } = req.params;
    const { format } = req.query; // 'xlsx' or 'pdf'

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required",
      });
    }

    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({
        success: false,
        message: "Engagement not found",
      });
    }

    const engagementName = engagement.name || `Engagement_${engagementId}`;
    const sanitizedEngagementName = engagementName.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Get ETB with populated linked Excel files
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
      .populate({
        path: "rows.linkedExcelFiles",
        model: "Workbook",
        select: "name",
      })
      .lean();

    if (!etb || !etb.rows || etb.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Extended Trial Balance data found",
      });
    }

    if (format === "pdf") {
      return await exports.exportETBAsPDF(req, res, etb, sanitizedEngagementName);
    }

    // Excel export
    const etbHeaders = [
      "Code",
      "Account Name",
      "Opening Balances",
      "Adjustments",
      "Reclassifications",
      "Final Balances",
      "Grouping1",
      "Grouping2",
      "Grouping3",
      "Grouping4",
      "Linked Files",
    ];

    const etbRows = etb.rows.map((row) => {
      // Get linked file names
      const linkedFileNames = row.linkedExcelFiles
        ?.map((file) => file.name || "")
        .filter(Boolean)
        .join("; ") || "None";

      return [
        row.code || "",
        row.accountName || "",
        row.priorYear || 0, // Opening Balance = priorYear
        row.adjustments || 0,
        row.reclassification || 0,
        row.finalBalance || 0, // Final Balance = finalBalance
        row.grouping1 || "",
        row.grouping2 || "",
        row.grouping3 || "",
        row.grouping4 || "",
        linkedFileNames,
      ];
    });

    // Create workbook with ExcelJS for styling
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Extended Trial Balance");

    // Define column widths
    worksheet.columns = [
      { width: 15 }, // Code
      { width: 30 }, // Account Name
      { width: 18 }, // Opening Balances
      { width: 15 }, // Adjustments
      { width: 18 }, // Reclassifications
      { width: 18 }, // Final Balances
      { width: 20 }, // Grouping1
      { width: 20 }, // Grouping2
      { width: 20 }, // Grouping3
      { width: 20 }, // Grouping4
      { width: 40 }, // Linked Files
    ];

    // Style for header row - highlighted background, black text, bold
    const headerRow = worksheet.addRow(etbHeaders);
    headerRow.font = { bold: true, color: { argb: "FF000000" } }; // Black text, bold
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" }, // Light gray background
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;

    // Enable auto filter (adds filter icons to headers)
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: etbHeaders.length },
    };

    // Add data rows with styling and alternating row colors
    etbRows.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(row);
      const isEvenRow = rowIndex % 2 === 0;
      
      // Apply alternating row background colors
      const rowBgColor = isEvenRow ? "FFFFFFFF" : "FFF5F5F5"; // White for even, light grey for odd
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowBgColor },
      };
      
      row.forEach((cellValue, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        
        // Check if value is a number (excluding "None" and empty strings)
        const isNumeric = typeof cellValue === "number" || 
          (typeof cellValue === "string" && cellValue.trim() !== "" && 
           cellValue !== "None" && !isNaN(Number(cellValue)) && 
           cellValue.trim() !== "");
        
        if (isNumeric) {
          // Numbers: black text
          cell.font = { color: { argb: "FF000000" } };
          if (typeof cellValue === "number") {
            cell.numFmt = "#,##0"; // Format numbers with commas
          } else {
            // Convert string number to actual number
            const numValue = Number(cellValue);
            cell.value = numValue;
            cell.numFmt = "#,##0";
          }
        } else {
          // Strings: blue text
          cell.font = { color: { argb: "FF0000FF" } }; // Blue text
        }
        cell.alignment = { vertical: "middle" };
        // Right align numeric columns (Opening Balances, Adjustments, Reclassifications, Final Balances)
        if ([2, 3, 4, 5].includes(colIndex)) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      });
      dataRow.height = 18;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Extended_Trial_Balance.xlsx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting ETB:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export Extended Trial Balance",
    });
  }
};

/**
 * Export Extended Trial Balance as PDF
 */
exports.exportETBAsPDF = async (req, res, etb, sanitizedEngagementName) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Extended_Trial_Balance.pdf"`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(18).text("Extended Trial Balance", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Engagement: ${sanitizedEngagementName}`, { align: "center" });
    doc.moveDown(1);

    // Table headers
    const startX = 50;
    let y = 120;
    const rowHeight = 20;
    const colWidths = [50, 120, 70, 60, 70, 70, 60, 60, 60, 60, 100];

    // Headers
    const headers = [
      "Code",
      "Account Name",
      "Opening",
      "Adjustments",
      "Reclass",
      "Final",
      "Group1",
      "Group2",
      "Group3",
      "Group4",
      "Linked Files",
    ];

    doc.fontSize(8).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });

    y += rowHeight + 5; // Add spacing after header
    doc.moveTo(50, y).lineTo(950, y).stroke();
    y += 5; // Add spacing before first data row

    // Data rows
    doc.font("Helvetica");
    doc.fontSize(7);
    etb.rows.forEach((row, index) => {
      if (y > 500) {
        // New page
        doc.addPage();
        y = 50;
        // Redraw headers
        x = startX;
        doc.fontSize(8).font("Helvetica-Bold");
        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });
        y += rowHeight + 5; // Add spacing after header
        doc.moveTo(50, y).lineTo(950, y).stroke();
        y += 5; // Add spacing before first data row
        doc.font("Helvetica");
        doc.fontSize(7);
      }

      const linkedFileNames = row.linkedExcelFiles
        ?.map((file) => file.name || "")
        .filter(Boolean)
        .join("; ") || "None";

      const rowData = [
        row.code || "",
        row.accountName || "",
        (row.priorYear || 0).toLocaleString(),
        (row.adjustments || 0).toLocaleString(),
        (row.reclassification || 0).toLocaleString(),
        (row.finalBalance || 0).toLocaleString(),
        row.grouping1 || "",
        row.grouping2 || "",
        row.grouping3 || "",
        row.grouping4 || "",
        linkedFileNames,
      ];

      // Calculate maximum height needed for this row
      let maxHeight = rowHeight;
      x = startX;
      rowData.forEach((cell, i) => {
        const cellText = String(cell);
        const textHeight = doc.heightOfString(cellText, {
          width: colWidths[i],
          align: "left",
        });
        maxHeight = Math.max(maxHeight, textHeight);
      });

      // Draw all cells at the same y position
      x = startX;
      rowData.forEach((cell, i) => {
        const cellText = String(cell);
        doc.text(cellText, x, y, {
          width: colWidths[i],
          align: "left",
          height: maxHeight,
        });
        x += colWidths[i];
      });

      // Move y position by the actual height used plus padding
      y += maxHeight + 3;
    });

    doc.end();
  } catch (error) {
    console.error("Error exporting ETB as PDF:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export Extended Trial Balance as PDF",
      });
    }
  }
};

/**
 * Export Adjustments as Excel
 * GET /api/engagements/:id/export/adjustments
 */
exports.exportAdjustments = async (req, res) => {
  try {
    const { id: engagementId } = req.params;
    const { format } = req.query; // 'xlsx' or 'pdf'

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required",
      });
    }

    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({
        success: false,
        message: "Engagement not found",
      });
    }

    const engagementName = engagement.name || `Engagement_${engagementId}`;
    const sanitizedEngagementName = engagementName.replace(/[^a-zA-Z0-9_-]/g, "_");

    const adjustments = await Adjustment.find({ engagementId }).sort({ createdAt: -1 }).lean();

    if (adjustments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No adjustments found for this engagement",
      });
    }

    if (format === "pdf") {
      return await exports.exportAdjustmentsAsPDF(req, res, adjustments, sanitizedEngagementName);
    }

    // Excel export
    const adjHeaders = [
      "Adjustment No",
      "Type",
      "Debit/Credit",
      "Description",
      "Account Code",
      "Account Name",
      "Amount",
      "Details",
      "Status",
      "Posted By",
      "Posted Date",
      "Created Date",
      "Linked Evidence Filenames",
    ];

    const adjRows = [];
    for (const adj of adjustments) {
      const postedHistory = adj.history?.find((h) => h.action === "posted");
      const postedBy = postedHistory?.userName || "N/A";
      const postedDate = postedHistory?.timestamp
        ? new Date(postedHistory.timestamp).toLocaleDateString()
        : "N/A";
      const createdDate = adj.createdAt
        ? new Date(adj.createdAt).toLocaleDateString()
        : "N/A";
      const evidenceFilenames = adj.evidenceFiles
        ?.map((f) => f.fileName)
        .join("; ") || "None";

      if (adj.entries && adj.entries.length > 0) {
        for (const entry of adj.entries) {
          const type = entry.dr > 0 ? "Debit" : "Credit";
          const amount = entry.dr > 0 ? entry.dr : entry.cr;

          adjRows.push([
            adj.adjustmentNo,
            "Adjustment",
            type,
            adj.description || "",
            entry.code,
            entry.accountName,
            amount,
            entry.details || "",
            adj.status,
            postedBy,
            postedDate,
            createdDate,
            evidenceFilenames,
          ]);
        }
      } else {
        adjRows.push([
          adj.adjustmentNo,
          "Adjustment",
          "N/A",
          adj.description || "",
          "",
          "",
          0,
          "",
          adj.status,
          postedBy,
          postedDate,
          createdDate,
          evidenceFilenames,
        ]);
      }
    }

    // Create workbook with ExcelJS for styling
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Adjustments");

    // Define column widths
    worksheet.columns = [
      { width: 15 }, // Adjustment No
      { width: 12 }, // Type
      { width: 12 }, // Debit/Credit
      { width: 30 }, // Description
      { width: 12 }, // Account Code
      { width: 25 }, // Account Name
      { width: 15 }, // Amount
      { width: 30 }, // Details
      { width: 10 }, // Status
      { width: 15 }, // Posted By
      { width: 12 }, // Posted Date
      { width: 12 }, // Created Date
      { width: 40 }, // Linked Evidence Filenames
    ];

    // Style for header row - highlighted background, black text, bold
    const headerRow = worksheet.addRow(adjHeaders);
    headerRow.font = { bold: true, color: { argb: "FF000000" } }; // Black text, bold
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" }, // Light gray background
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;

    // Enable auto filter (adds filter icons to headers)
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: adjHeaders.length },
    };

    // Add data rows with styling and alternating row colors
    adjRows.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(row);
      const isEvenRow = rowIndex % 2 === 0;
      
      // Apply alternating row background colors
      const rowBgColor = isEvenRow ? "FFFFFFFF" : "FFF5F5F5"; // White for even, light grey for odd
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowBgColor },
      };
      
      row.forEach((cellValue, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        
        // Check if value is a number (excluding "None" and empty strings)
        const isNumeric = typeof cellValue === "number" || 
          (typeof cellValue === "string" && cellValue.trim() !== "" && 
           cellValue !== "None" && !isNaN(Number(cellValue)) && 
           cellValue.trim() !== "");
        
        if (isNumeric) {
          // Numbers: black text
          cell.font = { color: { argb: "FF000000" } };
          if (typeof cellValue === "number") {
            cell.numFmt = "#,##0"; // Format numbers with commas
          } else {
            // Convert string number to actual number
            const numValue = Number(cellValue);
            cell.value = numValue;
            cell.numFmt = "#,##0";
          }
        } else {
          // Strings: blue text
          cell.font = { color: { argb: "FF0000FF" } }; // Blue text
        }
        cell.alignment = { vertical: "middle" };
        if (colIndex === 6) { // Amount column - right align
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      });
      dataRow.height = 18;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Adjustments.xlsx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting adjustments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export adjustments",
    });
  }
};

/**
 * Export Adjustments as PDF
 */
exports.exportAdjustmentsAsPDF = async (req, res, adjustments, sanitizedEngagementName) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Adjustments.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(18).text("Adjustments", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Engagement: ${sanitizedEngagementName}`, { align: "center" });
    doc.moveDown(1);

    const startX = 50;
    let y = 120;
    const rowHeight = 20;
    const colWidths = [60, 50, 50, 100, 50, 100, 60, 80, 50, 60, 60, 60, 100];

    const headers = [
      "Adj No",
      "Type",
      "D/C",
      "Description",
      "Code",
      "Account",
      "Amount",
      "Details",
      "Status",
      "Posted By",
      "Posted",
      "Created",
      "Evidence",
    ];

    doc.fontSize(8).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });

    y += rowHeight + 5; // Add spacing after header
    doc.moveTo(50, y).lineTo(950, y).stroke();
    y += 5; // Add spacing before first data row

    doc.font("Helvetica");
    doc.fontSize(7);
    adjustments.forEach((adj) => {
      const postedHistory = adj.history?.find((h) => h.action === "posted");
      const postedBy = postedHistory?.userName || "N/A";
      const postedDate = postedHistory?.timestamp
        ? new Date(postedHistory.timestamp).toLocaleDateString()
        : "N/A";
      const createdDate = adj.createdAt
        ? new Date(adj.createdAt).toLocaleDateString()
        : "N/A";
      const evidenceFilenames = adj.evidenceFiles
        ?.map((f) => f.fileName)
        .join("; ") || "None";

      if (adj.entries && adj.entries.length > 0) {
        adj.entries.forEach((entry) => {
          if (y > 500) {
            doc.addPage();
            y = 50;
            x = startX;
            doc.fontSize(8).font("Helvetica-Bold");
            headers.forEach((header, i) => {
              doc.text(header, x, y, { width: colWidths[i], align: "left" });
              x += colWidths[i];
            });
            y += rowHeight + 5; // Add spacing after header
            doc.moveTo(50, y).lineTo(950, y).stroke();
            y += 5; // Add spacing before first data row
            doc.font("Helvetica");
            doc.fontSize(7);
          }

          const type = entry.dr > 0 ? "Debit" : "Credit";
          const amount = entry.dr > 0 ? entry.dr : entry.cr;

          const rowData = [
            adj.adjustmentNo,
            "Adj",
            type,
            adj.description || "",
            entry.code || "",
            entry.accountName || "",
            amount.toLocaleString(),
            entry.details || "",
            adj.status,
            postedBy,
            postedDate,
            createdDate,
            evidenceFilenames,
          ];

          // Calculate maximum height needed for this row
          let maxHeight = rowHeight;
          x = startX;
          rowData.forEach((cell, i) => {
            const cellText = String(cell);
            const textHeight = doc.heightOfString(cellText, {
              width: colWidths[i],
              align: "left",
            });
            maxHeight = Math.max(maxHeight, textHeight);
          });

          // Draw all cells at the same y position
          x = startX;
          rowData.forEach((cell, i) => {
            const cellText = String(cell);
            doc.text(cellText, x, y, {
              width: colWidths[i],
              align: "left",
              height: maxHeight,
            });
            x += colWidths[i];
          });

          // Move y position by the actual height used plus padding
          y += maxHeight + 3;
        });
      }
    });

    doc.end();
  } catch (error) {
    console.error("Error exporting adjustments as PDF:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export adjustments as PDF",
      });
    }
  }
};

/**
 * Export Reclassifications as Excel
 * GET /api/engagements/:id/export/reclassifications
 */
exports.exportReclassifications = async (req, res) => {
  try {
    const { id: engagementId } = req.params;
    const { format } = req.query; // 'xlsx' or 'pdf'

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required",
      });
    }

    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({
        success: false,
        message: "Engagement not found",
      });
    }

    const engagementName = engagement.name || `Engagement_${engagementId}`;
    const sanitizedEngagementName = engagementName.replace(/[^a-zA-Z0-9_-]/g, "_");

    const reclassifications = await Reclassification.find({ engagementId })
      .sort({ createdAt: -1 })
      .lean();

    if (reclassifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No reclassifications found for this engagement",
      });
    }

    if (format === "pdf") {
      return await exports.exportReclassificationsAsPDF(req, res, reclassifications, sanitizedEngagementName);
    }

    // Excel export
    const rclsHeaders = [
      "Reclassification No",
      "From Account Code",
      "From Account Name",
      "To Account Code",
      "To Account Name",
      "Amount",
      "Reason",
      "Status",
      "Posted By",
      "Posted Date",
      "Created Date",
      "Linked Evidence Filenames",
    ];

    const rclsRows = [];
    for (const rc of reclassifications) {
      const postedHistory = rc.history?.find((h) => h.action === "posted");
      const postedBy = postedHistory?.userName || "N/A";
      const postedDate = postedHistory?.timestamp
        ? new Date(postedHistory.timestamp).toLocaleDateString()
        : "N/A";
      const createdDate = rc.createdAt
        ? new Date(rc.createdAt).toLocaleDateString()
        : "N/A";
      const evidenceFilenames = rc.evidenceFiles
        ?.map((f) => f.fileName)
        .join("; ") || "None";

      const drEntries = rc.entries.filter((e) => e.dr > 0);
      const crEntries = rc.entries.filter((e) => e.cr > 0);

      for (const drEntry of drEntries) {
        for (const crEntry of crEntries) {
          if (drEntry.dr === crEntry.cr || drEntries.length === 1 || crEntries.length === 1) {
            rclsRows.push([
              rc.reclassificationNo,
              drEntry.code,
              drEntry.accountName,
              crEntry.code,
              crEntry.accountName,
              drEntry.dr,
              rc.description || drEntry.details || crEntry.details || "",
              rc.status,
              postedBy,
              postedDate,
              createdDate,
              evidenceFilenames,
            ]);
            break;
          }
        }
      }

      if (rc.entries.length === 0) {
        rclsRows.push([
          rc.reclassificationNo,
          "",
          "",
          "",
          "",
          0,
          rc.description || "",
          rc.status,
          postedBy,
          postedDate,
          createdDate,
          evidenceFilenames,
        ]);
      }
    }

    // Create workbook with ExcelJS for styling
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reclassifications");

    // Define column widths
    worksheet.columns = [
      { width: 18 }, // Reclassification No
      { width: 15 }, // From Account Code
      { width: 25 }, // From Account Name
      { width: 15 }, // To Account Code
      { width: 25 }, // To Account Name
      { width: 15 }, // Amount
      { width: 30 }, // Reason
      { width: 10 }, // Status
      { width: 15 }, // Posted By
      { width: 12 }, // Posted Date
      { width: 12 }, // Created Date
      { width: 40 }, // Linked Evidence Filenames
    ];

    // Style for header row - highlighted background, black text, bold
    const headerRow = worksheet.addRow(rclsHeaders);
    headerRow.font = { bold: true, color: { argb: "FF000000" } }; // Black text, bold
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" }, // Light gray background
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;

    // Enable auto filter (adds filter icons to headers)
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: rclsHeaders.length },
    };

    // Add data rows with styling and alternating row colors
    rclsRows.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(row);
      const isEvenRow = rowIndex % 2 === 0;
      
      // Apply alternating row background colors
      const rowBgColor = isEvenRow ? "FFFFFFFF" : "FFF5F5F5"; // White for even, light grey for odd
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowBgColor },
      };
      
      row.forEach((cellValue, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        
        // Check if value is a number (excluding "None" and empty strings)
        const isNumeric = typeof cellValue === "number" || 
          (typeof cellValue === "string" && cellValue.trim() !== "" && 
           cellValue !== "None" && !isNaN(Number(cellValue)) && 
           cellValue.trim() !== "");
        
        if (isNumeric) {
          // Numbers: black text
          cell.font = { color: { argb: "FF000000" } };
          if (typeof cellValue === "number") {
            cell.numFmt = "#,##0"; // Format numbers with commas
          } else {
            // Convert string number to actual number
            const numValue = Number(cellValue);
            cell.value = numValue;
            cell.numFmt = "#,##0";
          }
        } else {
          // Strings: blue text
          cell.font = { color: { argb: "FF0000FF" } }; // Blue text
        }
        cell.alignment = { vertical: "middle" };
        if (colIndex === 5) { // Amount column - right align
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      });
      dataRow.height = 18;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Reclassifications.xlsx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting reclassifications:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export reclassifications",
    });
  }
};

/**
 * Export Reclassifications as PDF
 */
exports.exportReclassificationsAsPDF = async (req, res, reclassifications, sanitizedEngagementName) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_Reclassifications.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(18).text("Reclassifications", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Engagement: ${sanitizedEngagementName}`, { align: "center" });
    doc.moveDown(1);

    const startX = 50;
    let y = 120;
    const rowHeight = 20;
    const colWidths = [70, 60, 100, 60, 100, 60, 100, 50, 60, 60, 60, 100];

    const headers = [
      "Rcls No",
      "From Code",
      "From Account",
      "To Code",
      "To Account",
      "Amount",
      "Reason",
      "Status",
      "Posted By",
      "Posted",
      "Created",
      "Evidence",
    ];

    doc.fontSize(8).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(header, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });

    y += rowHeight + 5; // Add spacing after header
    doc.moveTo(50, y).lineTo(950, y).stroke();
    y += 5; // Add spacing before first data row

    doc.font("Helvetica");
    doc.fontSize(7);
    reclassifications.forEach((rc) => {
      const postedHistory = rc.history?.find((h) => h.action === "posted");
      const postedBy = postedHistory?.userName || "N/A";
      const postedDate = postedHistory?.timestamp
        ? new Date(postedHistory.timestamp).toLocaleDateString()
        : "N/A";
      const createdDate = rc.createdAt
        ? new Date(rc.createdAt).toLocaleDateString()
        : "N/A";
      const evidenceFilenames = rc.evidenceFiles
        ?.map((f) => f.fileName)
        .join("; ") || "None";

      const drEntries = rc.entries.filter((e) => e.dr > 0);
      const crEntries = rc.entries.filter((e) => e.cr > 0);

      drEntries.forEach((drEntry) => {
        crEntries.forEach((crEntry) => {
          if (drEntry.dr === crEntry.cr || drEntries.length === 1 || crEntries.length === 1) {
            if (y > 500) {
              doc.addPage();
              y = 50;
              x = startX;
              doc.fontSize(8).font("Helvetica-Bold");
              headers.forEach((header, i) => {
                doc.text(header, x, y, { width: colWidths[i], align: "left" });
                x += colWidths[i];
              });
              y += rowHeight + 5; // Add spacing after header
              doc.moveTo(50, y).lineTo(950, y).stroke();
              y += 5; // Add spacing before first data row
              doc.font("Helvetica");
              doc.fontSize(7);
            }

            const rowData = [
              rc.reclassificationNo,
              drEntry.code || "",
              drEntry.accountName || "",
              crEntry.code || "",
              crEntry.accountName || "",
              drEntry.dr.toLocaleString(),
              rc.description || drEntry.details || crEntry.details || "",
              rc.status,
              postedBy,
              postedDate,
              createdDate,
              evidenceFilenames,
            ];

            // Calculate maximum height needed for this row
            let maxHeight = rowHeight;
            x = startX;
            rowData.forEach((cell, i) => {
              const cellText = String(cell);
              const textHeight = doc.heightOfString(cellText, {
                width: colWidths[i],
                align: "left",
              });
              maxHeight = Math.max(maxHeight, textHeight);
            });

            // Draw all cells at the same y position
            x = startX;
            rowData.forEach((cell, i) => {
              const cellText = String(cell);
              doc.text(cellText, x, y, {
                width: colWidths[i],
                align: "left",
                height: maxHeight,
              });
              x += colWidths[i];
            });

            // Move y position by the actual height used plus padding
            y += maxHeight + 3;
          }
        });
      });
    });

    doc.end();
  } catch (error) {
    console.error("Error exporting reclassifications as PDF:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export reclassifications as PDF",
      });
    }
  }
};

/**
 * Export Extended Trial Balance, Adjustments, and Reclassifications as multi-sheet Excel (DEPRECATED - kept for backward compatibility)
 * GET /api/engagements/:id/export/all
 */
exports.exportAll = async (req, res) => {
  try {
    const { id: engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required",
      });
    }

    // Get engagement details
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({
        success: false,
        message: "Engagement not found",
      });
    }

    const engagementName = engagement.name || `Engagement_${engagementId}`;
    const sanitizedEngagementName = engagementName.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Create workbook
    const wb = XLSX.utils.book_new();

    // ========== Sheet 1: Extended Trial Balance ==========
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId }).lean();
    if (etb && etb.rows && etb.rows.length > 0) {
      const etbHeaders = [
        "Account Code",
        "Account Name",
        "Opening Balance",
        "Adjustments",
        "Reclassification",
        "Closing Balance",
        "Classification",
      ];

      const etbRows = etb.rows.map((row) => [
        row.code || "",
        row.accountName || "",
        row.openingBalance || 0,
        row.adjustments || 0,
        row.reclassification || 0,
        row.closingBalance || 0,
        row.classification || "",
      ]);

      const etbWs = XLSX.utils.aoa_to_sheet([etbHeaders, ...etbRows]);
      etbWs["!cols"] = [
        { wch: 15 }, // Account Code
        { wch: 30 }, // Account Name
        { wch: 18 }, // Opening Balance
        { wch: 15 }, // Adjustments
        { wch: 18 }, // Reclassification
        { wch: 18 }, // Closing Balance
        { wch: 40 }, // Classification
      ];
      XLSX.utils.book_append_sheet(wb, etbWs, "Extended Trial Balance");
    } else {
      // Create empty sheet if no ETB data
      const emptyEtbWs = XLSX.utils.aoa_to_sheet([["No Extended Trial Balance data available"]]);
      XLSX.utils.book_append_sheet(wb, emptyEtbWs, "Extended Trial Balance");
    }

    // ========== Sheet 2: Adjustments ==========
    const adjustments = await Adjustment.find({ engagementId }).sort({ createdAt: -1 }).lean();
    if (adjustments.length > 0) {
      const adjHeaders = [
        "Adjustment No",
        "Type",
        "Debit/Credit",
        "Description",
        "Account Code",
        "Account Name",
        "Amount",
        "Details",
        "Status",
        "Posted By",
        "Posted Date",
        "Created Date",
        "Linked Evidence Filenames",
      ];

      const adjRows = [];
      for (const adj of adjustments) {
        const postedHistory = adj.history?.find((h) => h.action === "posted");
        const postedBy = postedHistory?.userName || "N/A";
        const postedDate = postedHistory?.timestamp
          ? new Date(postedHistory.timestamp).toLocaleDateString()
          : "N/A";
        const createdDate = adj.createdAt
          ? new Date(adj.createdAt).toLocaleDateString()
          : "N/A";
        const evidenceFilenames = adj.evidenceFiles
          ?.map((f) => f.fileName)
          .join("; ") || "None";

        if (adj.entries && adj.entries.length > 0) {
          for (const entry of adj.entries) {
            const type = entry.dr > 0 ? "Debit" : "Credit";
            const amount = entry.dr > 0 ? entry.dr : entry.cr;

            adjRows.push([
              adj.adjustmentNo,
              "Adjustment",
              type,
              adj.description || "",
              entry.code,
              entry.accountName,
              amount,
              entry.details || "",
              adj.status,
              postedBy,
              postedDate,
              createdDate,
              evidenceFilenames,
            ]);
          }
        } else {
          adjRows.push([
            adj.adjustmentNo,
            "Adjustment",
            "N/A",
            adj.description || "",
            "",
            "",
            0,
            "",
            adj.status,
            postedBy,
            postedDate,
            createdDate,
            evidenceFilenames,
          ]);
        }
      }

      const adjWs = XLSX.utils.aoa_to_sheet([adjHeaders, ...adjRows]);
      adjWs["!cols"] = [
        { wch: 15 }, // Adjustment No
        { wch: 12 }, // Type
        { wch: 12 }, // Debit/Credit
        { wch: 30 }, // Description
        { wch: 12 }, // Account Code
        { wch: 25 }, // Account Name
        { wch: 15 }, // Amount
        { wch: 30 }, // Details
        { wch: 10 }, // Status
        { wch: 15 }, // Posted By
        { wch: 12 }, // Posted Date
        { wch: 12 }, // Created Date
        { wch: 40 }, // Linked Evidence Filenames
      ];
      XLSX.utils.book_append_sheet(wb, adjWs, "Adjustments");
    } else {
      const emptyAdjWs = XLSX.utils.aoa_to_sheet([["No Adjustments data available"]]);
      XLSX.utils.book_append_sheet(wb, emptyAdjWs, "Adjustments");
    }

    // ========== Sheet 3: Reclassifications ==========
    const reclassifications = await Reclassification.find({ engagementId })
      .sort({ createdAt: -1 })
      .lean();
    if (reclassifications.length > 0) {
      const rclsHeaders = [
        "Reclassification No",
        "From Account Code",
        "From Account Name",
        "To Account Code",
        "To Account Name",
        "Amount",
        "Reason",
        "Status",
        "Posted By",
        "Posted Date",
        "Created Date",
        "Linked Evidence Filenames",
      ];

      const rclsRows = [];
      for (const rc of reclassifications) {
        const postedHistory = rc.history?.find((h) => h.action === "posted");
        const postedBy = postedHistory?.userName || "N/A";
        const postedDate = postedHistory?.timestamp
          ? new Date(postedHistory.timestamp).toLocaleDateString()
          : "N/A";
        const createdDate = rc.createdAt
          ? new Date(rc.createdAt).toLocaleDateString()
          : "N/A";
        const evidenceFilenames = rc.evidenceFiles
          ?.map((f) => f.fileName)
          .join("; ") || "None";

        const drEntries = rc.entries.filter((e) => e.dr > 0);
        const crEntries = rc.entries.filter((e) => e.cr > 0);

        for (const drEntry of drEntries) {
          for (const crEntry of crEntries) {
            if (drEntry.dr === crEntry.cr || drEntries.length === 1 || crEntries.length === 1) {
              rclsRows.push([
                rc.reclassificationNo,
                drEntry.code,
                drEntry.accountName,
                crEntry.code,
                crEntry.accountName,
                drEntry.dr,
                rc.description || drEntry.details || crEntry.details || "",
                rc.status,
                postedBy,
                postedDate,
                createdDate,
                evidenceFilenames,
              ]);
              break;
            }
          }
        }

        if (rc.entries.length === 0) {
          rclsRows.push([
            rc.reclassificationNo,
            "",
            "",
            "",
            "",
            0,
            rc.description || "",
            rc.status,
            postedBy,
            postedDate,
            createdDate,
            evidenceFilenames,
          ]);
        }
      }

      const rclsWs = XLSX.utils.aoa_to_sheet([rclsHeaders, ...rclsRows]);
      rclsWs["!cols"] = [
        { wch: 18 }, // Reclassification No
        { wch: 15 }, // From Account Code
        { wch: 25 }, // From Account Name
        { wch: 15 }, // To Account Code
        { wch: 25 }, // To Account Name
        { wch: 15 }, // Amount
        { wch: 30 }, // Reason
        { wch: 10 }, // Status
        { wch: 15 }, // Posted By
        { wch: 12 }, // Posted Date
        { wch: 12 }, // Created Date
        { wch: 40 }, // Linked Evidence Filenames
      ];
      XLSX.utils.book_append_sheet(wb, rclsWs, "Reclassifications");
    } else {
      const emptyRclsWs = XLSX.utils.aoa_to_sheet([["No Reclassifications data available"]]);
      XLSX.utils.book_append_sheet(wb, emptyRclsWs, "Reclassifications");
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}.xlsx"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting all data:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export data",
    });
  }
};

/**
 * Export evidence files as ZIP
 * GET /api/engagements/:id/export/evidence
 */
exports.exportEvidenceFiles = async (req, res) => {
  try {
    const { id: engagementId } = req.params;

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required",
      });
    }

    // Get engagement details
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({
        success: false,
        message: "Engagement not found",
      });
    }

    const engagementName = engagement.name || `Engagement_${engagementId}`;
    const sanitizedEngagementName = engagementName.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Get all adjustments and reclassifications with evidence files
    const adjustments = await Adjustment.find({ engagementId }).lean();
    const reclassifications = await Reclassification.find({ engagementId }).lean();

    // Collect all evidence files
    const evidenceFiles = [];

    // From adjustments
    for (const adj of adjustments) {
      if (adj.evidenceFiles && adj.evidenceFiles.length > 0) {
        for (const file of adj.evidenceFiles) {
          evidenceFiles.push({
            fileName: `Adjustments_${adj.adjustmentNo}_${file.fileName}`,
            fileUrl: file.fileUrl,
            uploadedAt: file.uploadedAt,
            uploadedBy: file.uploadedBy?.userName || "Unknown",
          });
        }
      }
    }

    // From reclassifications
    for (const rc of reclassifications) {
      if (rc.evidenceFiles && rc.evidenceFiles.length > 0) {
        for (const file of rc.evidenceFiles) {
          evidenceFiles.push({
            fileName: `Reclassifications_${rc.reclassificationNo}_${file.fileName}`,
            fileUrl: file.fileUrl,
            uploadedAt: file.uploadedAt,
            uploadedBy: file.uploadedBy?.userName || "Unknown",
          });
        }
      }
    }

    if (evidenceFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No evidence files found for this engagement",
      });
    }

    // Create ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Set response headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedEngagementName}_EvidenceFiles.zip"`
    );

    // Pipe archive to response
    archive.pipe(res);

    // Helper function to download file from URL or Supabase
    const downloadFile = async (url, fileName) => {
      try {
        // Check if it's a Supabase storage URL
        if (url.includes("supabase.co") && url.includes("/storage/v1/object/public/")) {
          // Extract bucket and path from Supabase URL
          const urlParts = url.split("/storage/v1/object/public/");
          if (urlParts.length === 2) {
            const bucketAndPath = urlParts[1];
            const [bucket, ...pathParts] = bucketAndPath.split("/");
            const filePath = pathParts.join("/");

            // Download from Supabase storage
            const { data, error } = await supabase.storage
              .from(bucket)
              .download(filePath);

            if (error) {
              throw new Error(`Supabase download error: ${error.message}`);
            }

            // Convert blob to buffer
            const arrayBuffer = await data.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
        }

        // For other URLs, use HTTP/HTTPS download
        return new Promise((resolve, reject) => {
          const protocol = url.startsWith("https") ? https : http;
          protocol
            .get(url, (response) => {
              if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirect
                return downloadFile(response.headers.location, fileName)
                  .then(resolve)
                  .catch(reject);
              }
              if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
              }
              const chunks = [];
              response.on("data", (chunk) => chunks.push(chunk));
              response.on("end", () => resolve(Buffer.concat(chunks)));
              response.on("error", reject);
            })
            .on("error", reject);
        });
      } catch (error) {
        console.error(`Error downloading file ${fileName} from ${url}:`, error);
        throw error;
      }
    };

    // Add files to archive
    for (const file of evidenceFiles) {
      try {
        const fileBuffer = await downloadFile(file.fileUrl, file.fileName);
        archive.append(fileBuffer, { name: file.fileName });
      } catch (error) {
        console.error(`Error downloading file ${file.fileName}:`, error);
        // Continue with other files even if one fails
        // Optionally, add an error file to the archive
        archive.append(
          Buffer.from(`Error: Could not download ${file.fileName}\nURL: ${file.fileUrl}\nError: ${error.message}`),
          { name: `ERROR_${file.fileName}.txt` }
        );
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("Error exporting evidence files:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export evidence files",
      });
    }
  }
};