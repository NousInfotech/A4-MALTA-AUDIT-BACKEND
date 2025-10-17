const Workbook = require("../models/ExcelWorkbook.js");
const Sheet = require("../models/Sheet.js");
const XLSX = require("xlsx");
const mongoose = require("mongoose");

// Helper to convert 0-indexed column to Excel column letter
const zeroIndexToExcelCol = (colIndex) => {
  let colLetter = "";
  let tempColIndex = colIndex;

  do {
    const remainder = tempColIndex % 26;
    colLetter = String.fromCharCode(65 + remainder) + colLetter;
    tempColIndex = Math.floor(tempColIndex / 26) - 1;
  } while (tempColIndex >= 0);

  return colLetter;
};

// --- Workbook Operations ---

const listWorkbooks = async (req, res) => {
  try {
    const { engagementId, classification } = req.query;

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required" });
    }

    const query = { engagementId };
    if (classification) {
      query.classification = classification;
    }

    const workbooks = await Workbook.find(query).select(
      "-mappings -namedRanges"
    );
    res.status(200).json({ success: true, data: workbooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getWorkbookById = async (req, res) => {
  try {
    const { workbookId } = req.params;
    const workbook = await Workbook.findById(workbookId);

    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    res.status(200).json({ success: true, data: workbook });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const uploadWorkbookDataAndSheetData = async (req, res) => {
  try {
    const {
      engagementId,
      classification,
      fileName,
      workbookData, // Parsed workbook data [{ name, data }]
      webUrl, // Optional: file link from MS Drive
    } = req.body;

    const userId = req.user?.id; // from requireAuth middleware

    if (!engagementId || !fileName || !workbookData) {
      return res.status(400).json({
        success: false,
        error: "engagementId, fileName, and workbookData are required.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context.",
      });
    }

    // --- Auto versioning: increment version if same workbook name exists for same engagement ---
    const existingWorkbooks = await Workbook.find({
      engagementId,
      name: fileName,
    }).sort({ createdAt: -1 });
    const newVersion =
      existingWorkbooks.length > 0 ? `v${existingWorkbooks.length + 1}` : "v1";

    // --- Create new workbook record ---
    const newWorkbook = new Workbook({
      engagementId,
      classification,
      name: fileName,
      webUrl: webUrl || null,
      uploadedBy: new mongoose.Types.ObjectId(userId),
      lastModifiedBy: new mongoose.Types.ObjectId(userId),
      uploadedDate: new Date(),
      lastModifiedDate: new Date(),
      version: newVersion,
      mappings: [],
      namedRanges: [],
    });

    await newWorkbook.save();

    // --- Save all sheets belonging to this workbook ---
    for (const sheet of workbookData) {
      const { name, data } = sheet;
      if (!name || !Array.isArray(data)) continue;

      const newSheet = new Sheet({
        workbookId: newWorkbook._id,
        name,
        data,
        lastModifiedDate: new Date(),
        lastModifiedBy: new mongoose.Types.ObjectId(userId),
      });

      await newSheet.save();
    }

    return res.status(201).json({
      success: true,
      data: {
        id: newWorkbook._id,
        name: newWorkbook.name,
        version: newWorkbook.version,
        webUrl: newWorkbook.webUrl,
        message: "Workbook uploaded and saved successfully.",
      },
    });
  } catch (error) {
    console.error("Error uploading workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error.",
    });
  }
};

const saveWorkbook = async (req, res) => {
  try {
    const { workbookId, workbookName, version, sheetData, metadata } = req.body;

    if (!workbookId) {
      return res
        .status(400)
        .json({ success: false, error: "workbookId is required" });
    }

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    if (workbookName) workbook.name = workbookName;
    if (version) workbook.version = version;
    if (metadata) {
      if (metadata.lastModifiedBy)
        workbook.lastModifiedBy = metadata.lastModifiedBy;
      workbook.lastModifiedDate = new Date();
    }
    await workbook.save();

    for (const sheetName in sheetData) {
      const data = sheetData[sheetName];
      const cleanData = data.slice(1).map((row) => row.slice(1));

      let sheet = await Sheet.findOne({ workbookId, name: sheetName });

      if (sheet) {
        sheet.data = cleanData;
        sheet.lastModifiedDate = new Date();
        sheet.lastModifiedBy = new mongoose.Types.ObjectId();
        await sheet.save();
      } else {
        const newSheet = new Sheet({
          workbookId: workbook._id,
          name: sheetName,
          data: cleanData,
          lastModifiedDate: new Date(),
          lastModifiedBy: new mongoose.Types.ObjectId(),
        });
        await newSheet.save();
      }
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Workbook and its sheets saved successfully",
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveSheet = async (req, res) => {
  try {
    const { workbookId, sheetName, sheetData, metadata } = req.body;

    if (!workbookId || !sheetName || !sheetData) {
      return res
        .status(400)
        .json({
          success: false,
          error: "workbookId, sheetName, and sheetData are required",
        });
    }

    const cleanData = sheetData.slice(1).map((row) => row.slice(1));

    let sheet = await Sheet.findOne({ workbookId, name: sheetName });

    if (sheet) {
      sheet.data = cleanData;
      sheet.lastModifiedDate = new Date();
      sheet.lastModifiedBy = new mongoose.Types.ObjectId();
      await sheet.save();
    } else {
      const newSheet = new Sheet({
        workbookId,
        name: sheetName,
        data: cleanData,
        lastModifiedDate: new Date(),
        lastModifiedBy: new mongoose.Types.ObjectId(),
      });
      await newSheet.save();
    }

    await Workbook.findByIdAndUpdate(workbookId, {
      lastModifiedDate: new Date(),
    });

    res
      .status(200)
      .json({
        success: true,
        message: `Sheet "${sheetName}" saved successfully`,
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Sheet Operations ---

const listSheets = async (req, res) => {
  try {
    const { workbookId } = req.params;
    const sheets = await Sheet.find({ workbookId }).select("name");

    if (!sheets) {
      return res
        .status(404)
        .json({ success: false, error: "Sheets not found for this workbook" });
    }

    res.status(200).json({ success: true, data: sheets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSheetData = async (req, res) => {
  try {
    const { workbookId, sheetName } = req.params;
    const sheet = await Sheet.findOne({ workbookId, name: sheetName });

    if (!sheet) {
      return res.status(404).json({ success: false, error: "Sheet not found" });
    }

    const rawSheetData = sheet.data;
    let excelLikeData = [[""]];
    if (rawSheetData && rawSheetData.length > 0) {
      const maxCols = Math.max(...rawSheetData.map((row) => row.length));
      const headerRow = [""];
      for (let i = 0; i < maxCols; i++) {
        headerRow.push(zeroIndexToExcelCol(i));
      }

      excelLikeData = [headerRow];
      for (let i = 0; i < rawSheetData.length; i++) {
        const originalRow = rawSheetData[i];
        const newRow = [(i + 1).toString()];
        for (let j = 0; j < maxCols; j++) {
          newRow.push(String(originalRow[j] ?? ""));
        }
        excelLikeData.push(newRow);
      }
    }

    res.status(200).json({ success: true, data: excelLikeData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Mappings Operations ---

const createMapping = async (req, res) => {
  try {
    const { workbookId } = req.params;
    const { sheet, start, end, destinationField, transform, color } = req.body;

    if (
      !workbookId ||
      !sheet ||
      !start ||
      !end ||
      !destinationField ||
      !transform ||
      !color
    ) {
      return res
        .status(400)
        .json({ success: false, error: "All mapping fields are required" });
    }

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const newMapping = {
      _id: new mongoose.Types.ObjectId(),
      destinationField,
      transform,
      color,
      details: { sheet, start, end },
    };

    workbook.mappings.push(newMapping);
    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(201)
      .json({
        success: true,
        data: newMapping,
        message: "Mapping created successfully",
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateMapping = async (req, res) => {
  try {
    const { workbookId, mappingId } = req.params;
    const { sheet, start, end, destinationField, transform, color } = req.body;

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const mapping = workbook.mappings.id(mappingId);
    if (!mapping) {
      return res
        .status(404)
        .json({ success: false, error: "Mapping not found" });
    }

    if (destinationField) mapping.destinationField = destinationField;
    if (transform) mapping.transform = transform;
    if (color) mapping.color = color;
    if (sheet) mapping.details.sheet = sheet;
    if (start) mapping.details.start = start;
    if (end) mapping.details.end = end;

    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(200)
      .json({
        success: true,
        data: mapping,
        message: "Mapping updated successfully",
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteMapping = async (req, res) => {
  try {
    const { workbookId, mappingId } = req.params;

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    workbook.mappings.id(mappingId)?.remove();
    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(200)
      .json({ success: true, message: "Mapping deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- Named Ranges Operations ---

const createNamedRange = async (req, res) => {
  try {
    const { workbookId } = req.params;
    const { name, range } = req.body;

    if (!workbookId || !name || !range) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Name and range are required for named range",
        });
    }

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const newNamedRange = {
      _id: new mongoose.Types.ObjectId(),
      name,
      range,
    };

    workbook.namedRanges.push(newNamedRange);
    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(201)
      .json({
        success: true,
        data: newNamedRange,
        message: "Named range created successfully",
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateNamedRange = async (req, res) => {
  try {
    const { workbookId, namedRangeId } = req.params;
    const { name, range } = req.body;

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const namedRange = workbook.namedRanges.id(namedRangeId);
    if (!namedRange) {
      return res
        .status(404)
        .json({ success: false, error: "Named range not found" });
    }

    if (name) namedRange.name = name;
    if (range) namedRange.range = range;

    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(200)
      .json({
        success: true,
        data: namedRange,
        message: "Named range updated successfully",
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteNamedRange = async (req, res) => {
  try {
    const { workbookId, namedRangeId } = req.params;

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    workbook.namedRanges.id(namedRangeId)?.remove();
    workbook.lastModifiedDate = new Date();
    await workbook.save();

    res
      .status(200)
      .json({ success: true, message: "Named range deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  listWorkbooks,
  getWorkbookById,
  uploadWorkbookDataAndSheetData,
  saveWorkbook,
  saveSheet,
  listSheets,
  getSheetData,
  createMapping,
  updateMapping,
  deleteMapping,
  createNamedRange,
  updateNamedRange,
  deleteNamedRange,
};
