const { Workbook } = require("../models/ExcelWorkbook.js");
const Sheet = require("../models/Sheet.js");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance.js");
const XLSX = require("xlsx");
const mongoose = require("mongoose");

const saveWorkbookAndSheets = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { workbook: workbookData, fileData } = req.body;

    if (!workbookData || !fileData) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "Workbook data and fileData are required.",
      });
    }

    if (!workbookData.cloudFileId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "cloudFileId is required for workbook operations.",
      });
    }

    let workbook;
    let currentSheetIds = [];
    const currentUser = req.user ? req.user.id : null;
    let newWorkbookCreated = false;

    if (workbookData.id) {
      workbook = await Workbook.findById(workbookData.id)
        .populate("sheets")
        .session(session);

      if (workbook) {
        workbook.cloudFileId = workbookData.cloudFileId;
        workbook.name = workbookData.name || workbook.name;
        workbook.webUrl = workbookData.webUrl || workbook.webUrl;
        workbook.classification =
          workbookData.classification || workbook.classification;
        workbook.category = workbookData.category || workbook.category;
        workbook.mappings = workbookData.mappings || [];
        workbook.namedRanges = workbookData.namedRanges || [];
        workbook.lastModifiedBy = currentUser;
        workbook.lastModifiedDate = new Date();

        await Sheet.deleteMany({ workbookId: workbook._id }, { session });
      }
    }

    if (!workbook) {
      newWorkbookCreated = true;
      workbook = new Workbook({
        engagementId: workbookData.engagementId,
        classification: workbookData.classification,
        cloudFileId: workbookData.cloudFileId,
        name: workbookData.name,
        webUrl: workbookData.webUrl,
        uploadedBy: currentUser,
        lastModifiedBy: currentUser,
        uploadedDate: new Date(),
        lastModifiedDate: new Date(),
        category: workbookData.category,
        mappings: workbookData.mappings || [],
        namedRanges: workbookData.namedRanges || [],
      });
    }

    await workbook.save({ session });

    // OPTIMIZATION: Only save sheet names/metadata, don't process the data
    // Actual sheet data will be loaded on-demand from MS Drive
    for (const sheetName in fileData) {
      if (Object.prototype.hasOwnProperty.call(fileData, sheetName)) {
        // Create minimal sheet record - just name and default dimensions
        // Actual data will be fetched on-demand from MS Drive
        const newSheet = new Sheet({
          workbookId: workbook._id,
          name: sheetName,
          rowCount: 0, // Will be updated when sheet is first loaded
          columnCount: 0, // Will be updated when sheet is first loaded
          address: `${sheetName}!A1`, // Default address
          lastModifiedBy: currentUser,
        });
        await newSheet.save({ session });
        currentSheetIds.push(newSheet._id);
      }
    }

    workbook.sheets = currentSheetIds;
    await workbook.save({ session });

    const finalWorkbook = await Workbook.findById(workbook._id)
      .populate({ path: "sheets", session: session })
      .session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        workbook: finalWorkbook.toObject({ getters: true }),
        sheetsSaved: currentSheetIds.length,
      },
      message: newWorkbookCreated
        ? "Workbook and sheets saved successfully."
        : "Workbook and sheets updated successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error saving workbook and sheets:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getWorkbookWithSheets = async (req, res) => {
  try {
    const { id } = req.params;

    const workbook = await Workbook.findById(id).populate("sheets");

    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found." });
    }

    res.status(200).json({ success: true, data: workbook });
  } catch (error) {
    console.error("Error fetching workbook with sheets:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSpecificSheetData = async (req, res) => {
  try {
    const { workbookId, sheetName } = req.params;

    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res.status(404).json({
        success: false,
        error: "Workbook not found.",
      });
    }

    // Fetch sheet metadata from DB
    const sheet = await Sheet.findOne({
      workbookId: workbookId,
      name: sheetName,
    });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: "Sheet not found for this workbook.",
      });
    }

    // Fetch actual data from MS Drive
    const { readSheet } = require("../services/microsoftExcelService");
    const sheetData = await readSheet({
      driveItemId: workbook.cloudFileId,
      worksheetName: sheetName,
    });

    res.status(200).json({ 
      success: true, 
      data: {
        metadata: {
          name: sheet.name,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
          address: sheet.address,
        },
        values: sheetData.values || [],
        address: sheetData.address,
      }
    });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const listWorkbooks = async (req, res) => {
  try {
    const { engagementId, classification } = req.params;

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      engagementId,
      classification,
      cloudFileId,
      fileName,
      workbookData,
      webUrl,
      category,
    } = req.body;

    const userId = req.user?.id;

    if (!engagementId || !fileName || !workbookData || !cloudFileId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "engagementId, fileName, and workbookData are required.",
      });
    }

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context.",
      });
    }

    const newWorkbook = new Workbook({
      engagementId,
      classification,
      cloudFileId,
      name: fileName,
      webUrl: webUrl || null,
      uploadedBy: userId,
      lastModifiedBy: userId,
      uploadedDate: new Date(),
      lastModifiedDate: new Date(),

      category: category,
      mappings: [],
      namedRanges: [],
      sheets: [],
    });

    await newWorkbook.save({ session });

    const savedSheetIds = [];
    for (const sheet of workbookData) {
      const { name, data } = sheet;
      if (!name || !Array.isArray(data)) continue;

      // Calculate dimensions
      const rowCount = data ? data.length : 0;
      const columnCount = data && data[0] ? data[0].length : 0;

      const newSheet = new Sheet({
        workbookId: newWorkbook._id,
        name,
        rowCount: Math.max(0, rowCount - 1), // Subtract 1 for header row
        columnCount: Math.max(0, columnCount - 1), // Subtract 1 for row numbers
        address: `${name}!A1`, // Default address
        lastModifiedDate: new Date(),
        lastModifiedBy: userId,
      });

      await newSheet.save({ session });
      savedSheetIds.push(newSheet._id);
    }

    newWorkbook.sheets = savedSheetIds;

    await newWorkbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      data: {
        id: newWorkbook._id,
        cloudFileId: newWorkbook.cloudFileId,
        name: newWorkbook.name,

        webUrl: newWorkbook.webUrl,
        message: "Workbook uploaded and saved successfully.",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error uploading workbook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error.",
    });
  }
};

const saveWorkbook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      workbookId,
      workbookcloudFileId,
      workbookName,
      sheetData,
      metadata,
      savedByUserId,
      category,
    } = req.body;
    const userId = savedByUserId || req.user?.id;

    if (!workbookId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, error: "workbookId is required" });
    }

    const workbook = await Workbook.findById(workbookId)
      .populate("sheets")
      .session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context for saving.",
      });
    }

    let sheetChangesDetected = false;

    if (sheetData) {
      const existingSheets = await Sheet.find({
        workbookId: workbook._id,
      }).session(session);

      const existingSheetsMap = new Map(existingSheets.map((s) => [s.name, s]));

      const incomingSheetNames = Object.keys(sheetData);

      if (incomingSheetNames.length !== existingSheets.length) {
        sheetChangesDetected = true;
      } else {
        for (const sheetName of incomingSheetNames) {
          if (!existingSheetsMap.has(sheetName)) {
            sheetChangesDetected = true;
            break;
          }
        }
      }
    }

    if (sheetChangesDetected) {
      await Sheet.deleteMany({ workbookId: workbook._id }, { session });

      const updatedSheetIds = [];
      for (const sheetName in sheetData) {
        const data = sheetData[sheetName];
        
        // Calculate dimensions from the data
        const rowCount = data ? data.length : 0;
        const columnCount = data && data[0] ? data[0].length : 0;

        const newSheet = new Sheet({
          workbookId: workbook._id,
          name: sheetName,
          rowCount: Math.max(0, rowCount - 1), // Subtract 1 for header row
          columnCount: Math.max(0, columnCount - 1), // Subtract 1 for row numbers
          address: `${sheetName}!A1`, // Default address
          lastModifiedDate: new Date(),
          lastModifiedBy: userId,
        });
        await newSheet.save({ session });
        updatedSheetIds.push(newSheet._id);
      }
      workbook.sheets = updatedSheetIds;
    }

    if (workbookcloudFileId) workbook.cloudFileId = workbookcloudFileId;
    if (workbookName) workbook.name = workbookName;
    if (category !== undefined) workbook.category = category;
    if (req.body.mappings) workbook.mappings = req.body.mappings;
    if (req.body.namedRanges) workbook.namedRanges = req.body.namedRanges;
    if (metadata) {
      if (metadata.lastModifiedBy)
        workbook.lastModifiedBy = metadata.lastModifiedBy;
    }
    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: sheetChangesDetected
        ? "Workbook and its sheets saved successfully."
        : "Workbook metadata updated successfully.",
      data: {
        workbookId: workbook._id,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error saving workbook:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteWorkbook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId } = req.params;
    const userId = req.user?.id;

    if (!workbookId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, error: "Workbook ID is required." });
    }

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context for deleting workbook.",
      });
    }

    const workbook = await Workbook.findById(workbookId).session(session);

    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found." });
    }

    await Sheet.deleteMany({ workbookId: workbook._id }, { session });

    // Delete all mappings that reference this workbook from ExtendedTrialBalance
    await ExtendedTrialBalance.updateMany(
      {},
      {
        $pull: {
          "rows.$[].mappings": { workbookId: workbook._id }
        }
      },
      { session }
    );

    // Also remove workbook from linkedExcelFiles array in ExtendedTrialBalance
    await ExtendedTrialBalance.updateMany(
      {},
      {
        $pull: {
          "rows.$[].linkedExcelFiles": workbook._id
        }
      },
      { session }
    );

    await Workbook.deleteOne({ _id: workbook._id }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Workbook '${workbook.name}' (ID: ${workbook._id}), all associated sheets, mappings, and ETB references deleted successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting workbook and associated data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveSheet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId, sheetName, sheetData, metadata, savedByUserId } =
      req.body;
    const userId = savedByUserId || req.user?.id;

    if (!workbookId || !sheetName || !sheetData) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "workbookId, sheetName, and sheetData are required",
      });
    }

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context.",
      });
    }

    const workbook = await Workbook.findById(workbookId)
      .populate("sheets")
      .session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    let sheet = await Sheet.findOne({ workbookId, name: sheetName }).session(
      session
    );
    let currentSheetIds = workbook.sheets.map((s) => s._id);
    let sheetChangeOccurred = false;
    
    // Calculate dimensions from the data
    const rowCount = sheetData ? sheetData.length : 0;
    const columnCount = sheetData && sheetData[0] ? sheetData[0].length : 0;

    if (sheet) {
      // Compare dimensions instead of full data
      if (sheet.rowCount !== rowCount || sheet.columnCount !== columnCount) {
        sheetChangeOccurred = true;
      }
    } else {
      sheetChangeOccurred = true;
    }

    if (sheetChangeOccurred) {
      if (sheet) {
        sheet.rowCount = rowCount - 1; // Subtract 1 for header row
        sheet.columnCount = columnCount - 1; // Subtract 1 for row numbers
        sheet.address = `${sheetName}!A1`;
        sheet.lastModifiedDate = new Date();
        sheet.lastModifiedBy = userId;
        await sheet.save({ session });
      } else {
        const newSheet = new Sheet({
          workbookId,
          name: sheetName,
          rowCount: Math.max(0, rowCount - 1),
          columnCount: Math.max(0, columnCount - 1),
          address: `${sheetName}!A1`,
          lastModifiedDate: new Date(),
          lastModifiedBy: userId,
        });
        await newSheet.save({ session });
        currentSheetIds.push(newSheet._id);
        workbook.sheets = currentSheetIds;
      }
    }

    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;
    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: sheetChangeOccurred
        ? `Sheet "${sheetName}" saved successfully.`
        : `Sheet "${sheetName}" data unchanged.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error saving sheet:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

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

const createMapping = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId } = req.params;
    const { sheet, start, end, color } = req.body;
    const userId = req.user?.id;

    if (
      !workbookId ||
      !sheet ||
      !start ||
      !end ||
      !color
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, error: "All mapping fields are required" });
    }
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const newMapping = {
      _id: new mongoose.Types.ObjectId(),
      color,
      details: { sheet, start, end },
    };

    workbook.mappings.push(newMapping);
    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: newMapping,
      message: "Mapping created successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating mapping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateMapping = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId, mappingId } = req.params;
    const { sheet, start, end, color } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const mapping = workbook.mappings.id(mappingId);
    if (!mapping) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Mapping not found" });
    }

    if (color) mapping.color = color;
    if (sheet) mapping.details.sheet = sheet;
    if (start) mapping.details.start = start;
    if (end) mapping.details.end = end;

    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: mapping,
      message: "Mapping updated successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating mapping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteMapping = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId, mappingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const mappingExists = workbook.mappings.some(
      (m) => m._id.toString() === mappingId
    );
    if (!mappingExists) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Mapping not found" });
    }

    workbook.mappings.pull(mappingId);

    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Mapping deleted successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting mapping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createNamedRange = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId } = req.params;
    const { name, range } = req.body;
    const userId = req.user?.id;

    if (!workbookId || !name || !range) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "Name and range are required for named range",
      });
    }
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
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
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: newNamedRange,
      message: "Named range created successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating named range:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateNamedRange = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId, namedRangeId } = req.params;
    const { name, range } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const namedRange = workbook.namedRanges.id(namedRangeId);
    if (!namedRange) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Named range not found" });
    }

    if (name) namedRange.name = name;
    if (range) namedRange.range = range;

    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: namedRange,
      message: "Named range updated successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating named range:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteNamedRange = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId, namedRangeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: missing user context." });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found" });
    }

    const namedRangeExists = workbook.namedRanges.id(namedRangeId);
    if (!namedRangeExists) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Named range not found" });
    }

    workbook.namedRanges.pull(namedRangeId);
    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;

    await workbook.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Named range deleted successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting named range:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const addOrUpdateCustomField = async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldKey, fieldValue } = req.body;

    if (!fieldKey) {
      return res.status(400).json({ message: "Custom field key is required." });
    }

    const update = {};
    update[`customFields.${fieldKey}`] = fieldValue;

    const workbook = await Workbook.findByIdAndUpdate(
      id,
      {
        $set: update,
        lastModifiedDate: new Date(),
        lastModifiedBy: req.user?.id || "System",
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!workbook) {
      return res.status(404).json({ message: "Workbook not found." });
    }

    res.status(200).json({
      message: `Custom field '${fieldKey}' updated successfully.`,
      workbook: workbook,
    });
  } catch (error) {
    console.error("Error adding/updating custom field:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getWorkbookLogs = async (req, res) => {
  try {
    const { workbookId } = req.params;

    if (!workbookId) {
      return res
        .status(400)
        .json({ success: false, error: "Workbook ID is required." });
    }

    const workbook = await Workbook.findById(workbookId);

    if (!workbook) {
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found." });
    }

    const logs = [];

    logs.push({
      type: "Workbook Uploaded",
      timestamp: workbook.uploadedDate,
      actor: workbook.uploadedBy,
      details: {
        cloudFileId: workbook.cloudFileId,
        name: workbook.name,
        engagementId: workbook.engagementId,
        classification: workbook.classification,
        webUrl: workbook.webUrl,
        category: workbook.category,
      },
      mappingsCount: workbook.mappings ? workbook.mappings.length : 0,
      namedRangesCount: workbook.namedRanges ? workbook.namedRanges.length : 0,
    });

    if (workbook.lastModifiedDate > workbook.uploadedDate) {
      const currentSheets = await Sheet.find({
        workbookId: workbook._id,
      }).select("name lastModifiedDate");
      logs.push({
        type: "Workbook Modified",
        timestamp: workbook.lastModifiedDate,
        actor: workbook.lastModifiedBy,
        details: {
          cloudFileId: workbook.cloudFileId,
          name: workbook.name,
          classification: workbook.classification,
          webUrl: workbook.webUrl,
          category: workbook.category,
        },
        sheets: currentSheets.map((s) => ({
          _id: s._id,
          name: s.name,
          lastModifiedDate: s.lastModifiedDate,
        })),
        mappings: workbook.mappings,
        namedRanges: workbook.namedRanges,
        message:
          "This represents the latest modifications to the workbook (live data).",
      });
    }

    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error("Error fetching workbook logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const listTrialBalanceWorkbooks = async (req, res) => {
  try {
    const { engagementId } = req.params;
    const category = "Trial Balance";

    if (!engagementId) {
      return res
        .status(400)
        .json({ success: false, error: "engagementId is required" });
    }

    const query = { engagementId, category };

    const workbooks = await Workbook.find(query).select(
      "-mappings -namedRanges"
    );

    res.status(200).json({ success: true, data: workbooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateSheetsData = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workbookId } = req.params;
    const { fileData } = req.body;
    const userId = req.user?.id;

    
    if (!workbookId || !fileData || typeof fileData !== 'object') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: "workbookId and fileData (object with sheet data) are required.",
      });
    }

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: "Unauthorized: missing user context.",
      });
    }

    const workbook = await Workbook.findById(workbookId).session(session);
    if (!workbook) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, error: "Workbook not found." });
    }

    // Delete all existing sheets associated with this workbook
    await Sheet.deleteMany({ workbookId: workbook._id }, { session });

    const newSheetIds = [];
    for (const sheetName in fileData) {
      if (Object.prototype.hasOwnProperty.call(fileData, sheetName)) {
        const sheetData = fileData[sheetName];
        
        // Calculate dimensions from the data
        const rowCount = sheetData ? sheetData.length : 0;
        const columnCount = sheetData && sheetData[0] ? sheetData[0].length : 0;

        const newSheet = new Sheet({
          workbookId: workbook._id,
          name: sheetName,
          rowCount: Math.max(0, rowCount - 1), // Subtract 1 for header row
          columnCount: Math.max(0, columnCount - 1), // Subtract 1 for row numbers
          address: `${sheetName}!A1`, // Default address
          lastModifiedDate: new Date(),
          lastModifiedBy: userId,
        });
        await newSheet.save({ session });
        newSheetIds.push(newSheet._id);
      }
    }

    // Update the workbook's sheets array with the new sheet IDs
    workbook.sheets = newSheetIds;
    workbook.lastModifiedDate = new Date();
    workbook.lastModifiedBy = userId;
    await workbook.save({ session });

    // Populate the sheets before returning the response, similar to saveWorkbookAndSheets
    const finalWorkbook = await Workbook.findById(workbook._id)
      .populate({ path: "sheets", session: session })
      .session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: {
        workbook: finalWorkbook.toObject({ getters: true }),
        sheetsUpdated: newSheetIds.length,
      },
      message: `Workbook '${workbook.name}' sheets updated successfully.`,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating workbook sheets data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  saveWorkbookAndSheets,
  getWorkbookWithSheets,
  getSpecificSheetData,
  listWorkbooks,
  getWorkbookById,
  uploadWorkbookDataAndSheetData,
  saveWorkbook,
  deleteWorkbook,
  saveSheet,
  listSheets,
  createMapping,
  updateMapping,
  deleteMapping,
  createNamedRange,
  updateNamedRange,
  deleteNamedRange,
  addOrUpdateCustomField,
  getWorkbookLogs,
  listTrialBalanceWorkbooks,
  updateSheetsData,
};
