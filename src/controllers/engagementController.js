const WorkingPaper = require("../models/WorkingPaper");
const msExcel = require("../services/microsoftExcelService");
const Engagement = require("../models/Engagement");
const EngagementLibrary = require("../models/EngagementLibrary");
const { supabase } = require("../config/supabase");
const sheetService = require("../services/googleSheetsService");
const TrialBalance = require("../models/TrialBalance");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const ClassificationSection = require("../models/ClassificationSection");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
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

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
    "Prior Year",
    "Adjustments",
    "Final Balance",
    "Grouping 1",
    "Grouping 2",
    "Grouping 3",
  ];

  const data = (rows || []).map((r) => {
    const parts = String(r.classification || "")
      .split(" > ")
      .map((s) => s.trim())
      .filter(Boolean);

    const g1 = parts[0] || "";
    const g2 = parts[1] || "";
    const g3 = parts[2] || "";

    const cy = Number(r.currentYear) || 0;
    const py = Number(r.priorYear) || 0;
    const adj = Number(r.adjustments) || 0;

    return [r.code ?? "", r.accountName ?? "", cy, py, adj, "", g1, g2, g3];
  });

  const aoa = [header, ...data];

  if (data.length > 0) {
    const startRow = 2;
    const endRow = 1 + data.length;
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

  const iG1 = idx("Grouping 1");
  const iG2 = idx("Grouping 2");
  const iG3 = idx("Grouping 3");
  const iCls = idx("Classification");

  return data.map((row, k) => {
    const cy = Number(row?.[iCY] ?? 0);
    const adj = Number(row?.[iAdj] ?? 0);
    const fb = Number(row?.[iFB] ?? Number.NaN) || cy + adj;

    let classification = "";
    if (iG1 !== -1 || iG2 !== -1 || iG3 !== -1) {
      const g1 = (iG1 !== -1 ? String(row?.[iG1] ?? "") : "").trim();
      const g2 = (iG2 !== -1 ? String(row?.[iG2] ?? "") : "").trim();
      const g3 = (iG3 !== -1 ? String(row?.[iG3] ?? "") : "").trim();
      classification = [g1, g2, g3].filter(Boolean).join(" > ");
    } else if (iCls !== -1) {
      classification = String(row?.[iCls] ?? "").trim();
    }

    return {
      id: `row-${Date.now()}-${k}`,
      code: row?.[iCode] ?? "",
      accountName: row?.[iName] ?? "",
      currentYear: cy,
      priorYear: Number(row?.[iPY] ?? 0),
      adjustments: adj,
      finalBalance: fb,
      classification,
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
        "Prior Year",
        "Adjustments",
        "Final Balance",
        "Grouping 1",
        "Grouping 2",
        "Grouping 3",
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
            "Prior Year",
            "Adjustments",
            "Final Balance",
            "Grouping 1",
            "Grouping 2",
            "Grouping 3",
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
  const data = await msExcel.readSheet({
    driveItemId: section.workingPapersId,
    worksheetName,
  });
  return data;
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
      currentYear: Number(row[2]) || 0,
      priorYear: Number(row[3]) || 0,
      adjustments: Number(row[4]) || 0,
      finalBalance: Number(row[5]) || 0,
      classification: decodedClassification,
      reference: row[6] || "",
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
        finalBalance: Number(r.finalBalance) || 0,
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

    res.json(filesWithNames);
  } catch (err) {
    next(err);
  }
};

exports.createEngagement = async (req, res, next) => {
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl, createdBy } =
      req.body;
    const engagement = await Engagement.create({
      createdBy,
      clientId,
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

    await Engagement.findByIdAndUpdate(engagementId, {
      trialBalance: tb._id,
      trialBalanceUrl: sheetUrl,
      status: "active",
    });

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

    res.json({
      ...tb.toObject(),
      data: allRows,
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

    res.json(etb);
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
      classification: decodedClassification,
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

    const filteredRows = etb.rows.filter(
      (row) => row.classification === decodedClassification
    );

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
      return {
        id: row.id || `row-${idx}`,
        code: row.code || "",
        accountName: row.accountName || "",
        currentYear: Number(row.currentYear) || 0,
        priorYear: Number(row.priorYear) || 0,
        adjustments: Number(row.adjustments) || 0,
        finalBalance: Number(row.finalBalance) || 0,
        classification: decodedClassification,
        reference: preservedRef ? preservedRef : "",
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
        const fb = Number.isFinite(Number(r.finalBalance))
          ? n(r.finalBalance)
          : cy + adj;

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
    ];

    const dataRows = leadSheetData.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      "",
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
    ];

    const dataRows = data.map((row) => [
      row.code,
      row.accountName,
      row.currentYear,
      row.priorYear,
      row.adjustments,
      row.finalBalance,
      row.reference || "",
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

    const data = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    });

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
        const sheetData = await msExcel.readSheet({
          driveItemId: section.workingPapersId,
          worksheetName: sheet.name,
        });

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

    const data = await msExcel.readSheet({
      driveItemId: section.workingPapersId,
      worksheetName: worksheetName,
    });

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
      currentYear: Number(row[2]) || 0,
      priorYear: Number(row[3]) || 0,
      adjustments: Number(row[4]) || 0,
      finalBalance: Number(row[5]) || 0,
      classification: decodedClassification,
      reference: row[6] || "",
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
          currentYear: Number(r.currentYear) || 0,
          priorYear: Number(r.priorYear) || 0,
          adjustments: Number(r.adjustments) || 0,
          finalBalance: Number(r.finalBalance) || 0,
          classification: decodedClassification,
          reference: r.reference ?? "",
          referenceData: "", // temp; will hydrate below
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
        const data = await msExcel.readSheet({
          driveItemId,
          worksheetName: sheetName,
        });
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
      path: 'rows.linkedExcelFiles',
      model: 'Workbook'
      // No select clause - populate ALL fields from Workbook model
    });

    if (!doc) {
      return res
        .status(404)
        .json({ message: "No working paper found for this section" });
    }

    // Transform the data to include ALL populated workbook information
    const transformedRows = doc.rows.map(row => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map(workbook => ({
        ...workbook.toObject() // Include ALL fields from Workbook model
      }))
    }));

    return res.json({
      engagement: doc.engagement,
      classification: doc.classification,
      rows: transformedRows,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
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
        message: "rowId is required" 
      });
    }

    if (!Array.isArray(linkedExcelFiles)) {
      return res.status(400).json({ 
        message: "linkedExcelFiles must be an array" 
      });
    }

    // Validate that all linkedExcelFiles are valid ObjectIds
    const validObjectIds = linkedExcelFiles.every(fileId => 
      mongoose.Types.ObjectId.isValid(fileId)
    );

    if (!validObjectIds) {
      return res.status(400).json({ 
        message: "All linkedExcelFiles must be valid ObjectIds" 
      });
    }

    // Find the working paper document
    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc) {
      return res.status(404).json({ 
        message: "Working paper not found for this section" 
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex(row => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({ 
        message: "Row not found in working paper" 
      });
    }

    // Update the linkedExcelFiles for the specific row
    doc.rows[rowIndex].linkedExcelFiles = linkedExcelFiles;
    
    // Save the updated document
    await doc.save();

    // Return the updated working paper with populated linked files
    const updatedDoc = await WorkingPaper.findById(doc._id).populate({
      path: 'rows.linkedExcelFiles',
      model: 'Workbook'
    });

    // Transform the response to include populated workbook information
    const transformedRows = updatedDoc.rows.map(row => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map(workbook => ({
        ...workbook.toObject()
      }))
    }));

    return res.json({
      message: "Linked Excel files updated successfully",
      engagement: updatedDoc.engagement,
      classification: updatedDoc.classification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt
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
        message: "rowId is required" 
      });
    }

    if (!workbookId) {
      return res.status(400).json({ 
        message: "workbookId is required" 
      });
    }

    // Validate that workbookId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(workbookId)) {
      return res.status(400).json({ 
        message: "workbookId must be a valid ObjectId" 
      });
    }

    // Find the working paper document
    const doc = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: decodedClassification,
    });

    if (!doc) {
      return res.status(404).json({ 
        message: "Working paper not found for this section" 
      });
    }

    // Find the specific row to update
    const rowIndex = doc.rows.findIndex(row => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({ 
        message: "Row not found in working paper" 
      });
    }

    // Check if the workbook exists in the linkedExcelFiles array
    const workbookExists = doc.rows[rowIndex].linkedExcelFiles.includes(workbookId);
    if (!workbookExists) {
      return res.status(404).json({ 
        message: "Workbook not found in linked Excel files for this row" 
      });
    }

    // Remove the workbook from the linkedExcelFiles array
    doc.rows[rowIndex].linkedExcelFiles = doc.rows[rowIndex].linkedExcelFiles.filter(
      fileId => fileId.toString() !== workbookId.toString()
    );
    
    // Save the updated document
    await doc.save();

    // Return the updated working paper with populated linked files
    const updatedDoc = await WorkingPaper.findById(doc._id).populate({
      path: 'rows.linkedExcelFiles',
      model: 'Workbook'
    });

    // Transform the response to include populated workbook information
    const transformedRows = updatedDoc.rows.map(row => ({
      ...row.toObject(),
      linkedExcelFiles: row.linkedExcelFiles.map(workbook => ({
        ...workbook.toObject()
      }))
    }));

    return res.json({
      message: "Workbook removed from linked Excel files successfully",
      engagement: updatedDoc.engagement,
      classification: updatedDoc.classification,
      rows: transformedRows,
      updatedAt: updatedDoc.updatedAt
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
    // Note: readSheet returns raw values, which is good.
    const sheetData = await readSheet({
      driveItemId: workbookId,
      worksheetName: sheetName,
    });
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
    return res.status(400).json({ success: false, message: "driveItemId is required." });
  }

  try {
    const versions = await getFileVersionHistory(driveItemId);

    if (versions && versions.length > 0) {
      console.log(`[Controller] Found ${versions.length} versions for ${driveItemId}`);
      // You might want to format the versions for the client if needed
      const formattedVersions = versions.map(version => ({
        id: version.id,
        lastModifiedDateTime: version.lastModifiedDateTime,
        size: version.size,
        webUrl: version.driveItem?.webUrl, // Provide a URL to view this specific version
        // Add any other relevant fields
      }));
      return res.json({ success: true, data: formattedVersions });
    } else {
      console.log(`[Controller] No versions found for ${driveItemId}.`);
      return res.json({ success: true, message: "No versions created for this file.", data: [] });
    }
  } catch (error) {
    console.error(`[Controller] Error getting file versions for ${driveItemId}:`, error.message);
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
    return res.status(400).json({ success: false, message: "driveItemId is required." });
  }

  try {
    console.log(`[Controller] Getting version history for ${driveItemId}...`);
    const versions = await getFileVersionHistory(driveItemId);

    if (!versions || versions.length < 2) {
      const message = "Not enough versions to revert. Need at least 2 versions.";
      console.log(`[Controller] ${message}`);
      return res.status(400).json({ 
        success: false, 
        message: message,
        currentVersions: versions ? versions.map(v => ({ id: v.id, date: new Date(v.lastModifiedDateTime).toLocaleString() })) : []
      });
    }

    // This example reverts to the SECOND-TO-LAST version in the history.
    // If you implemented versionIdToRestore, you would use that here.
    const versionToRestore = versions[versions.length - 2]; 
    const targetVersionId = versionToRestore.id; // Or use req.body.versionId if provided

    console.log(`[Controller] Attempting to restore ${driveItemId} to version ID: ${targetVersionId} 
        (modified: ${new Date(versionToRestore.lastModifiedDateTime).toLocaleString()})`);

    const restored = await restoreFileVersion(driveItemId, targetVersionId);

    if (restored) {
      console.log(`[Controller] File ${driveItemId} successfully restored to version ${targetVersionId}!`);
      
      // Optionally, fetch and return the new version history for confirmation
      const newVersions = await getFileVersionHistory(driveItemId);
      const formattedNewVersions = newVersions.map(version => ({
        id: version.id,
        lastModifiedDateTime: version.lastModifiedDateTime,
        size: version.size,
        webUrl: version.driveItem?.webUrl,
      }));

      return res.json({ 
        success: true, 
        message: `File restored to version ${targetVersionId}.`, 
        newCurrentVersion: formattedNewVersions[0] || null, // The newest version will be the restored one
        newVersionHistory: formattedNewVersions 
      });
    } else {
      // This path should ideally not be hit if restoreFileVersion throws on failure.
      console.log(`[Controller] Restore operation for ${driveItemId} did not return success status.`);
      return res.status(500).json({ success: false, message: "Restore operation failed unexpectedly." });
    }
  } catch (error) {
    console.error(`[Controller] Error reverting file ${driveItemId} to previous version:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};