// const { Workbook, HistoricalSheet } = require("../models/ExcelWorkbook.js");
// const Sheet = require("../models/Sheet.js");
// const XLSX = require("xlsx");
// const mongoose = require("mongoose");

// // Helper to create a new version entry and associated historical sheets
// async function createNewWorkbookVersion(
//   session,
//   workbook,
//   currentSheets,
//   userId
// ) {
//   const newVersionNumber = workbook.versions.length + 1;
//   const newVersionString = `v${newVersionNumber}`;

//   // Create HistoricalSheet documents for the *current* sheets being superseded
//   const historicalSheetIds = [];
//   for (const currentSheet of currentSheets) {
//     const historicalSheet = new HistoricalSheet({
//       workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder, will be updated with actual version subdocument _id
//       name: currentSheet.name,
//       data: currentSheet.data,
//       savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//     });
//     await historicalSheet.save({ session });
//     historicalSheetIds.push(historicalSheet._id);
//   }

//   // Create the new version entry
//   const newVersionEntry = {
//     _id: new mongoose.Types.ObjectId(), // Explicitly create an ID for the subdocument
//     version: newVersionString,
//     savedAt: new Date(),
//     savedBy: userId,
//     cloudFileId: workbook.cloudFileId,
//     name: workbook.name, // Capture current workbook name
//     classification: workbook.classification, // Capture current classification
//     webUrl: workbook.webUrl, // Capture current webUrl
//     category: workbook.category,
//     sheets: historicalSheetIds, // Link to the newly created historical sheets
//     mappings: JSON.parse(JSON.stringify(workbook.mappings)), // Deep copy of *current* mappings
//     namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)), // Deep copy of *current* named ranges
//   };

//   // Add the new version entry to the workbook's versions array
//   workbook.versions.push(newVersionEntry);
//   workbook.version = newVersionString; // Update the main version field

//   // Assign the actual _id of the new version subdocument to the historical sheets
//   const versionSubdocumentId = newVersionEntry._id;
//   for (const hsId of historicalSheetIds) {
//     await HistoricalSheet.findByIdAndUpdate(
//       hsId,
//       { workbookVersionId: versionSubdocumentId },
//       { session }
//     );
//   }

//   workbook.lastModifiedBy = userId;
//   workbook.lastModifiedDate = new Date();

//   return versionSubdocumentId; // Return the ID of the new version subdocument
// }

// // Controller function to save a new workbook and its sheets
// const saveWorkbookAndSheets = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { workbook: workbookData, fileData } = req.body;

//     if (!workbookData || !fileData) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         error: "Workbook data and fileData are required.",
//       });
//     }

//     // 🌟 Ensure cloudFileId is always present in workbookData when creating/updating
//     if (!workbookData.cloudFileId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         error: "cloudFileId is required for workbook operations.",
//       });
//     }

//     let workbook;
//     let currentSheetIds = [];
//     const currentUser = req.user ? req.user.id : null;
//     let newWorkbookCreated = false;
//     let newVersionSubdocumentId = null; // To store the ID of the newly created version subdocument

//     if (workbookData.id) {
//       workbook = await Workbook.findById(workbookData.id)
//         .populate("sheets")
//         .session(session);

//       if (workbook) {
//         // A workbook already exists, so we are creating a new version of it
//         newVersionSubdocumentId = await createNewWorkbookVersion(
//           session,
//           workbook,
//           workbook.sheets, // Pass current sheets for historical archiving
//           currentUser
//         );

//         // Update workbook metadata
//         workbook.cloudFileId = workbookData.cloudFileId;
//         workbook.name = workbookData.name || workbook.name;
//         workbook.webUrl = workbookData.webUrl || workbook.webUrl;
//         workbook.classification =
//           workbookData.classification || workbook.classification;
//         workbook.category = workbookData.category || workbook.category;
//         workbook.mappings = workbookData.mappings || []; // Update mappings from incoming data
//         workbook.namedRanges = workbookData.namedRanges || []; // Update named ranges from incoming data

//         // Delete existing current sheets as their historical version is now saved
//         await Sheet.deleteMany({ workbookId: workbook._id }, { session });
//       }
//     }

//     if (!workbook) {
//       newWorkbookCreated = true;
//       workbook = new Workbook({
//         engagementId: workbookData.engagementId,
//         classification: workbookData.classification,
//         cloudFileId: workbookData.cloudFileId,
//         name: workbookData.name,
//         webUrl: workbookData.webUrl,
//         uploadedBy: currentUser,
//         lastModifiedBy: currentUser,
//         version: "v1", // Initial version for a new workbook
//         category: workbookData.category,
//         mappings: workbookData.mappings || [],
//         namedRanges: workbookData.namedRanges || [],
//       });
//     }

//     await workbook.save({ session });

//     // Save all new current sheets
//     for (const sheetName in fileData) {
//       if (Object.prototype.hasOwnProperty.call(fileData, sheetName)) {
//         const sheetData = fileData[sheetName];

//         const newSheet = new Sheet({
//           workbookId: workbook._id,
//           name: sheetName,
//           data: sheetData,
//           lastModifiedBy: currentUser,
//         });
//         await newSheet.save({ session });
//         currentSheetIds.push(newSheet._id);
//       }
//     }

//     workbook.sheets = currentSheetIds;
//     await workbook.save({ session }); // Save again to update sheets array on workbook

//     // If it's a completely new workbook, create its initial version entry
//     if (newWorkbookCreated) {
//       const initialVersionEntry = {
//         _id: new mongoose.Types.ObjectId(),
//         version: "v1",
//         savedAt: new Date(),
//         savedBy: currentUser,
//         cloudFileId: workbook.cloudFileId,
//         name: workbook.name,
//         classification: workbook.classification,
//         webUrl: workbook.webUrl,
//         category: workbook.category,
//         sheets: currentSheetIds, // These are the _id's of the *current* sheets, for the initial version they are the same
//         mappings: JSON.parse(JSON.stringify(workbook.mappings)),
//         namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)),
//       };
//       workbook.versions.push(initialVersionEntry);
//       newVersionSubdocumentId = initialVersionEntry._id; // Store for response

//       // Update historical sheets with the correct workbookVersionId
//       for (const sheetId of currentSheetIds) {
//         await HistoricalSheet.findByIdAndUpdate(
//           sheetId,
//           { workbookVersionId: newVersionSubdocumentId },
//           { session }
//         );
//       }
//       await workbook.save({ session });
//     }

//     const finalWorkbook = await Workbook.findById(workbook._id)
//       .populate({ path: "sheets", session: session })
//       .session(session);

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: {
//         workbook: finalWorkbook.toObject({ getters: true }),
//         sheetsSaved: currentSheetIds.length,
//         versionId: newVersionSubdocumentId,
//       },
//       message: "Workbook and sheets saved successfully, new version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error saving workbook and sheets:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const getWorkbookWithSheets = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const workbook = await Workbook.findById(id).populate("sheets");

//     if (!workbook) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found." });
//     }

//     res.status(200).json({ success: true, data: workbook });
//   } catch (error) {
//     console.error("Error fetching workbook with sheets:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const getHistoricalWorkbookVersion = async (req, res) => {
//   try {
//     const { workbookId, versionTag } = req.params;

//     const workbook = await Workbook.findById(workbookId);

//     if (!workbook) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found." });
//     }

//     const historicalVersion = workbook.versions.find(
//       (v) => v.version === versionTag
//     );

//     if (!historicalVersion) {
//       return res.status(404).json({
//         success: false,
//         error: `Version '${versionTag}' not found for this workbook.`,
//       });
//     }

//     const historicalSheets = await HistoricalSheet.find({
//       _id: { $in: historicalVersion.sheets },
//       workbookVersionId: historicalVersion._id,
//     });

//     const historicalWorkbookData = {
//       _id: workbook._id,
//       engagementId: workbook.engagementId,
//       cloudFileId: historicalVersion.cloudFileId,
//       name: historicalVersion.name,
//       classification: historicalVersion.classification,
//       webUrl: historicalVersion.webUrl,
//       category: historicalVersion.category,
//       version: historicalVersion.version,
//       savedAt: historicalVersion.savedAt,
//       savedBy: historicalVersion.savedBy,
//       mappings: historicalVersion.mappings,
//       namedRanges: historicalVersion.namedRanges,
//       sheets: historicalSheets,
//     };

//     res.status(200).json({ success: true, data: historicalWorkbookData });
//   } catch (error) {
//     console.error("Error fetching historical workbook version:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const getSpecificSheetData = async (req, res) => {
//   try {
//     const { workbookId, sheetName, versionTag } = req.params;

//     let sheet = null;

//     if (versionTag && versionTag !== "latest") {
//       const workbook = await Workbook.findById(workbookId);
//       if (!workbook) {
//         return res
//           .status(404)
//           .json({ success: false, error: "Workbook not found." });
//       }

//       const historicalVersion = workbook.versions.find(
//         (v) => v.version === versionTag
//       );
//       if (!historicalVersion) {
//         return res.status(404).json({
//           success: false,
//           error: `Version '${versionTag}' not found for this workbook.`,
//         });
//       }

//       sheet = await HistoricalSheet.findOne({
//         _id: { $in: historicalVersion.sheets },
//         name: sheetName,
//         workbookVersionId: historicalVersion._id,
//       });
//     } else {
//       sheet = await Sheet.findOne({
//         workbookId: workbookId,
//         name: sheetName,
//       });
//     }

//     if (!sheet) {
//       return res.status(404).json({
//         success: false,
//         error: "Sheet not found for this workbook or version.",
//       });
//     }

//     res.status(200).json({ success: true, data: sheet.data });
//   } catch (error) {
//     console.error("Error fetching sheet data:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const listWorkbooks = async (req, res) => {
//   try {
//     const { engagementId, classification } = req.params;

//     if (!engagementId) {
//       return res
//         .status(400)
//         .json({ success: false, error: "engagementId is required" });
//     }

//     const query = { engagementId };
//     if (classification) {
//       query.classification = classification;
//     }

//     const workbooks = await Workbook.find(query).select(
//       "-mappings -namedRanges -versions"
//     );
//     res.status(200).json({ success: true, data: workbooks });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const getWorkbookById = async (req, res) => {
//   try {
//     const { workbookId } = req.params;
//     const workbook = await Workbook.findById(workbookId);

//     if (!workbook) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     res.status(200).json({ success: true, data: workbook });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const uploadWorkbookDataAndSheetData = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const {
//       engagementId,
//       classification,
//       cloudFileId,
//       fileName,
//       workbookData,
//       webUrl,
//       category,
//     } = req.body;

//     const userId = req.user?.id;

//     if (!engagementId || !fileName || !workbookData || !cloudFileId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         error: "engagementId, fileName, and workbookData are required.",
//       });
//     }

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(401).json({
//         success: false,
//         error: "Unauthorized: missing user context.",
//       });
//     }

//     // Auto versioning: increment version if same workbook name exists for same engagement
//     const existingWorkbooksCount = await Workbook.countDocuments({
//       engagementId,
//       name: fileName,
//     }).session(session);
//     const newVersionString = `v${existingWorkbooksCount + 1}`;

//     const newWorkbook = new Workbook({
//       engagementId,
//       classification,
//       cloudFileId,
//       name: fileName,
//       webUrl: webUrl || null,
//       uploadedBy: userId,
//       lastModifiedBy: userId,
//       uploadedDate: new Date(),
//       lastModifiedDate: new Date(),
//       version: newVersionString,
//       category: category,
//       mappings: [],
//       namedRanges: [],
//       sheets: [],
//     });

//     await newWorkbook.save({ session });

//     const savedSheetIds = [];
//     for (const sheet of workbookData) {
//       const { name, data } = sheet;
//       if (!name || !Array.isArray(data)) continue;

//       const newSheet = new Sheet({
//         workbookId: newWorkbook._id,
//         name,
//         data,
//         lastModifiedDate: new Date(),
//         lastModifiedBy: userId,
//       });

//       await newSheet.save({ session });
//       savedSheetIds.push(newSheet._id);
//     }

//     newWorkbook.sheets = savedSheetIds;

//     const initialVersionEntry = {
//       _id: new mongoose.Types.ObjectId(),
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       cloudFileId: newWorkbook.cloudFileId,
//       name: newWorkbook.name,
//       classification: newWorkbook.classification,
//       webUrl: newWorkbook.webUrl,
//       category: newWorkbook.category,
//       sheets: savedSheetIds, // These are the _id's of the *current* sheets, for the initial version they are the same
//       mappings: [],
//       namedRanges: [],
//     };
//     newWorkbook.versions.push(initialVersionEntry);

//     // Update historical sheets with the correct workbookVersionId
//     for (const sheetId of savedSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         sheetId,
//         { workbookVersionId: initialVersionEntry._id },
//         { session }
//       );
//     }

//     await newWorkbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       data: {
//         id: newWorkbook._id,
//         cloudFileId: newWorkbook.cloudFileId,
//         name: newWorkbook.name,
//         version: newWorkbook.version,
//         webUrl: newWorkbook.webUrl,
//         message: "Workbook uploaded and saved successfully.",
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error uploading workbook:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message || "Internal server error.",
//     });
//   }
// };

// const saveWorkbook = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const {
//       workbookId,
//       workbookcloudFileId,
//       workbookName,
//       sheetData,
//       metadata,
//       savedByUserId,
//       category,
//     } = req.body;
//     const userId = savedByUserId || req.user?.id;

//     if (!workbookId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(400)
//         .json({ success: false, error: "workbookId is required" });
//     }

//     const workbook = await Workbook.findById(workbookId)
//       .populate("sheets")
//       .session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(401).json({
//         success: false,
//         error: "Unauthorized: missing user context for saving version.",
//       });
//     }

//     let sheetChangesDetected = false;
//     let versionSubdocumentId = null;

//     // Check for sheet data changes
//     if (sheetData) {
//       const existingSheets = await Sheet.find({
//         workbookId: workbook._id,
//       }).session(session);

//       // Create a map for easier lookup of existing sheets by name
//       const existingSheetsMap = new Map(existingSheets.map((s) => [s.name, s]));

//       const incomingSheetNames = Object.keys(sheetData);
//       const existingSheetNames = existingSheets.map((s) => s.name);

//       // Check for added, deleted, or modified sheets
//       if (incomingSheetNames.length !== existingSheetNames.length) {
//         sheetChangesDetected = true; // Sheets added or deleted
//       } else {
//         for (const sheetName of incomingSheetNames) {
//           const incomingData = sheetData[sheetName]
//             .slice(1)
//             .map((row) => row.slice(1)); // Assuming cleaning here

//           const existingSheet = existingSheetsMap.get(sheetName);

//           if (!existingSheet) {
//             sheetChangesDetected = true; // New sheet added
//             break;
//           }
//           if (
//             JSON.stringify(existingSheet.data) !== JSON.stringify(incomingData)
//           ) {
//             sheetChangesDetected = true; // Sheet data modified
//             break;
//           }
//         }
//       }
//     }

//     if (sheetChangesDetected) {
//       // Create a new version only if sheet data has changed
//       versionSubdocumentId = await createNewWorkbookVersion(
//         session,
//         workbook,
//         workbook.sheets, // These are the *old* sheets for the historical version
//         userId
//       );

//       // Delete *all* old current sheets
//       await Sheet.deleteMany({ workbookId: workbook._id }, { session });

//       // Save all *new* current sheets
//       const updatedSheetIds = [];
//       for (const sheetName in sheetData) {
//         const data = sheetData[sheetName];
//         const cleanData = data.slice(1).map((row) => row.slice(1)); // Assuming cleaning is needed

//         const newSheet = new Sheet({
//           workbookId: workbook._id,
//           name: sheetName,
//           data: cleanData,
//           lastModifiedDate: new Date(),
//           lastModifiedBy: userId,
//         });
//         await newSheet.save({ session });
//         updatedSheetIds.push(newSheet._id);
//       }
//       workbook.sheets = updatedSheetIds; // Update workbook's current sheets array
//     }

//     // Apply other workbook updates (name, metadata, etc.)
//     if (workbookcloudFileId) workbook.cloudFileId = workbookcloudFileId;
//     if (workbookName) workbook.name = workbookName;
//     if (category !== undefined) workbook.category = category;
//     if (req.body.mappings) workbook.mappings = req.body.mappings; // Be careful with direct assignments, consider merging
//     if (req.body.namedRanges) workbook.namedRanges = req.body.namedRanges;
//     if (metadata) {
//       if (metadata.lastModifiedBy)
//         workbook.lastModifiedBy = metadata.lastModifiedBy;
//       workbook.lastModifiedDate = new Date(); // Always update last modified date
//     }

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;
//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: sheetChangesDetected
//         ? "Workbook and its sheets saved successfully, new version created."
//         : "Workbook metadata updated successfully.",
//       data: {
//         workbookId: workbook._id,
//         version: workbook.version,
//         versionId: versionSubdocumentId,
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error saving workbook:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const deleteWorkbook = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId } = req.params;
//     const userId = req.user?.id;

//     if (!workbookId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(400)
//         .json({ success: false, error: "Workbook ID is required." });
//     }

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(401).json({
//         success: false,
//         error: "Unauthorized: missing user context for deleting workbook.",
//       });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session);

//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found." });
//     }

//     await Sheet.deleteMany({ workbookId: workbook._id }, { session });

//     const versionSubdocumentIds = workbook.versions.map((v) => v._id);

//     await HistoricalSheet.deleteMany(
//       { workbookVersionId: { $in: versionSubdocumentIds } },
//       { session }
//     );

//     await Workbook.deleteOne({ _id: workbook._id }, { session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: `Workbook '${workbook.name}' (ID: ${workbook._id}) and all associated data deleted successfully.`,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error deleting workbook and associated data:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const saveSheet = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId, sheetName, sheetData, metadata, savedByUserId } =
//       req.body;
//     const userId = savedByUserId || req.user?.id;

//     if (!workbookId || !sheetName || !sheetData) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         error: "workbookId, sheetName, and sheetData are required",
//       });
//     }

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(401).json({
//         success: false,
//         error: "Unauthorized: missing user context.",
//       });
//     }

//     const workbook = await Workbook.findById(workbookId)
//       .populate("sheets")
//       .session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const cleanData = sheetData.slice(1).map((row) => row.slice(1));
//     let sheet = await Sheet.findOne({ workbookId, name: sheetName }).session(
//       session
//     );
//     let currentSheetIds = workbook.sheets.map((s) => s._id);
//     let sheetChangeOccurred = false;
//     let versionSubdocumentId = null;

//     if (sheet) {
//       // Sheet exists, check if data has actually changed
//       // This is a simplistic check; a deep comparison of array contents would be more accurate
//       if (JSON.stringify(sheet.data) !== JSON.stringify(cleanData)) {
//         sheetChangeOccurred = true;
//       }
//     } else {
//       // Sheet does not exist, it's a new sheet
//       sheetChangeOccurred = true;
//     }

//     if (sheetChangeOccurred) {
//       // Only create a new workbook version if sheet data is truly changing
//       versionSubdocumentId = await createNewWorkbookVersion(
//         session,
//         workbook,
//         workbook.sheets, // Capture existing sheets for history
//         userId
//       );

//       // Now update or create the current sheet
//       if (sheet) {
//         // Update existing sheet
//         sheet.data = cleanData;
//         sheet.lastModifiedDate = new Date();
//         sheet.lastModifiedBy = userId;
//         await sheet.save({ session });
//       } else {
//         // Create new sheet
//         const newSheet = new Sheet({
//           workbookId,
//           name: sheetName,
//           data: cleanData,
//           lastModifiedDate: new Date(),
//           lastModifiedBy: userId,
//         });
//         await newSheet.save({ session });
//         currentSheetIds.push(newSheet._id); // Add new sheet ID to current sheets
//         workbook.sheets = currentSheetIds; // Update workbook's current sheets array
//       }
//     }

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;
//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: sheetChangeOccurred
//         ? `Sheet "${sheetName}" saved successfully, new workbook version created.`
//         : `Sheet "${sheetName}" data unchanged, no new version created.`,
//       version: workbook.version,
//       versionId: versionSubdocumentId,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error saving sheet:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const listSheets = async (req, res) => {
//   try {
//     const { workbookId } = req.params;
//     const sheets = await Sheet.find({ workbookId }).select("name");

//     if (!sheets) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Sheets not found for this workbook" });
//     }

//     res.status(200).json({ success: true, data: sheets });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // --- Mappings Operations ---

// const createMapping = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId } = req.params;
//     const { sheet, start, end, destinationField, transform, color } = req.body;
//     const userId = req.user?.id;

//     if (
//       !workbookId ||
//       !sheet ||
//       !start ||
//       !end ||
//       !destinationField ||
//       !transform ||
//       !color
//     ) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(400)
//         .json({ success: false, error: "All mapping fields are required" });
//     }
//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session); // No populate needed for just mappings
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const newMapping = {
//       _id: new mongoose.Types.ObjectId(),
//       destinationField,
//       transform,
//       color,
//       details: { sheet, start, end },
//     };

//     workbook.mappings.push(newMapping);
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: newMapping,
//       message: "Mapping created successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error creating mapping:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const updateMapping = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId, mappingId } = req.params;
//     const { sheet, start, end, destinationField, transform, color } = req.body;
//     const userId = req.user?.id;

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session); // No populate needed
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const mapping = workbook.mappings.id(mappingId);
//     if (!mapping) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Mapping not found" });
//     }

//     if (destinationField) mapping.destinationField = destinationField;
//     if (transform) mapping.transform = transform;
//     if (color) mapping.color = color;
//     if (sheet) mapping.details.sheet = sheet;
//     if (start) mapping.details.start = start;
//     if (end) mapping.details.end = end;

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       data: mapping,
//       message: "Mapping updated successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error updating mapping:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const deleteMapping = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId, mappingId } = req.params;
//     const userId = req.user?.id;

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const mappingExists = workbook.mappings.some(
//       (m) => m._id.toString() === mappingId
//     );
//     if (!mappingExists) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Mapping not found" });
//     }

//     workbook.mappings.pull(mappingId);

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "Mapping deleted successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error deleting mapping:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // --- Named Ranges Operations ---

// const createNamedRange = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId } = req.params;
//     const { name, range } = req.body;
//     const userId = req.user?.id;

//     if (!workbookId || !name || !range) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         error: "Name and range are required for named range",
//       });
//     }
//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const newNamedRange = {
//       _id: new mongoose.Types.ObjectId(),
//       name,
//       range,
//     };

//     workbook.namedRanges.push(newNamedRange);
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: newNamedRange,
//       message:
//         "Named range created successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error creating named range:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const updateNamedRange = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId, namedRangeId } = req.params;
//     const { name, range } = req.body;
//     const userId = req.user?.id;

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const namedRange = workbook.namedRanges.id(namedRangeId);
//     if (!namedRange) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Named range not found" });
//     }

//     if (name) namedRange.name = name;
//     if (range) namedRange.range = range;

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       data: namedRange,
//       message:
//         "Named range updated successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error updating named range:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const deleteNamedRange = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { workbookId, namedRangeId } = req.params;
//     const userId = req.user?.id;

//     if (!userId) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: missing user context." });
//     }

//     const workbook = await Workbook.findById(workbookId).session(session);
//     if (!workbook) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found" });
//     }

//     const namedRangeExists = workbook.namedRanges.id(namedRangeId);
//     if (!namedRangeExists) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Named range not found" });
//     }

//     workbook.namedRanges.pull(namedRangeId);
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message:
//         "Named range deleted successfully. No new workbook version created.",
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error deleting named range:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const addOrUpdateCustomField = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { fieldKey, fieldValue } = req.body;

//     if (!fieldKey) {
//       return res.status(400).json({ message: "Custom field key is required." });
//     }

//     const update = {};
//     update[`customFields.${fieldKey}`] = fieldValue;

//     const workbook = await Workbook.findByIdAndUpdate(
//       id,
//       {
//         $set: update,
//         lastModifiedDate: new Date(), // Update last modified date for any change
//         lastModifiedBy: req.user?.id || "System", // Assuming user context
//       },
//       {
//         new: true,
//         runValidators: true,
//       }
//     );

//     if (!workbook) {
//       return res.status(404).json({ message: "Workbook not found." });
//     }

//     res.status(200).json({
//       message: `Custom field '${fieldKey}' updated successfully.`,
//       workbook: workbook,
//     });
//   } catch (error) {
//     console.error("Error adding/updating custom field:", error);
//     res.status(500).json({
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

// const getWorkbookLogs = async (req, res) => {
//   try {
//     const { workbookId } = req.params;

//     if (!workbookId) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Workbook ID is required." });
//     }

//     const workbook = await Workbook.findById(workbookId);

//     if (!workbook) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found." });
//     }

//     const logs = [];

//     // 1. Log for initial workbook upload (using the Workbook's own creation details)
//     logs.push({
//       type: "Workbook Uploaded",
//       timestamp: workbook.uploadedDate,
//       actor: workbook.uploadedBy,
//       details: {
//         cloudFileId: workbook.cloudFileId,
//         name: workbook.name,
//         engagementId: workbook.engagementId,
//         classification: workbook.classification,
//         webUrl: workbook.webUrl,
//         category: workbook.category,
//         initialVersion: workbook.versions[0]
//           ? workbook.versions[0].version
//           : "N/A", // Use the first version's tag
//       },
//       // Note: At upload, mappings/named ranges might not be present or are initial.
//       // We take the state from the first version entry if available.
//       mappingsCount: workbook.versions[0]
//         ? workbook.versions[0].mappings.length
//         : 0,
//       namedRangesCount: workbook.versions[0]
//         ? workbook.versions[0].namedRanges.length
//         : 0,
//     });

//     // 2. Iterate through all historical versions (these now only represent sheet/workbook metadata changes)
//     for (let i = 0; i < workbook.versions.length; i++) {
//       const versionEntry = workbook.versions[i];
//       const previousVersionEntry = i > 0 ? workbook.versions[i - 1] : null;

//       const historicalSheets = await HistoricalSheet.find({
//         _id: { $in: versionEntry.sheets },
//         workbookVersionId: versionEntry._id,
//       }).select("name savedAt");

//       logs.push({
//         type: "Workbook Version Saved (Sheet/Metadata Change)",
//         version: versionEntry.version,
//         timestamp: versionEntry.savedAt,
//         actor: versionEntry.savedBy,
//         details: {
//           cloudFileId: versionEntry.cloudFileId,
//           name: versionEntry.name,
//           classification: versionEntry.classification,
//           webUrl: versionEntry.webUrl,
//           category: versionEntry.category,
//         },
//         sheets: historicalSheets.map((hs) => ({
//           _id: hs._id,
//           name: hs.name,
//           savedAt: hs.savedAt,
//         })),
//         mappingsCountAtThisVersion: versionEntry.mappings
//           ? versionEntry.mappings.length
//           : 0,
//         namedRangesCountAtThisVersion: versionEntry.namedRanges
//           ? versionEntry.namedRanges.length
//           : 0,
//       });

//       // --- Diffing Mappings and Named Ranges between versions for more granular logs ---
//       // This is an approximation since mappings/named ranges don't trigger new Workbook.versions anymore.
//       // We will compare the 'mappings' and 'namedRanges' arrays from consecutive *version entries*.
//       // This will only log changes if they happened *before* a sheet-related version save.
//       if (previousVersionEntry) {
//         // Mappings Diff
//         const prevMappings = previousVersionEntry.mappings || [];
//         const currentMappings = versionEntry.mappings || [];
//         const mappingChanges = [];

//         // Added Mappings
//         currentMappings.forEach((currentMap) => {
//           if (
//             !prevMappings.some(
//               (prevMap) => prevMap._id.toString() === currentMap._id.toString()
//             )
//           ) {
//             mappingChanges.push({ type: "Mapping Added", mapping: currentMap });
//           }
//         });
//         // Deleted Mappings
//         prevMappings.forEach((prevMap) => {
//           if (
//             !currentMappings.some(
//               (currentMap) =>
//                 currentMap._id.toString() === prevMap._id.toString()
//             )
//           ) {
//             mappingChanges.push({ type: "Mapping Deleted", mapping: prevMap });
//           }
//         });
//         // Updated Mappings
//         currentMappings.forEach((currentMap) => {
//           const prevMap = prevMappings.find(
//             (prev) => prev._id.toString() === currentMap._id.toString()
//           );
//           if (
//             prevMap &&
//             JSON.stringify(prevMap) !== JSON.stringify(currentMap)
//           ) {
//             mappingChanges.push({
//               type: "Mapping Updated",
//               old: prevMap,
//               new: currentMap,
//             });
//           }
//         });

//         if (mappingChanges.length > 0) {
//           logs.push({
//             type: `Mapping Changes (captured before v${i + 1})`,
//             timestamp: versionEntry.savedAt,
//             actor: versionEntry.savedBy,
//             changes: mappingChanges,
//           });
//         }

//         // Named Ranges Diff
//         const prevNamedRanges = previousVersionEntry.namedRanges || [];
//         const currentNamedRanges = versionEntry.namedRanges || [];
//         const namedRangeChanges = [];

//         // Added Named Ranges
//         currentNamedRanges.forEach((currentNr) => {
//           if (
//             !prevNamedRanges.some(
//               (prevNr) => prevNr._id.toString() === currentNr._id.toString()
//             )
//           ) {
//             namedRangeChanges.push({
//               type: "Named Range Added",
//               namedRange: currentNr,
//             });
//           }
//         });
//         // Deleted Named Ranges
//         prevNamedRanges.forEach((prevNr) => {
//           if (
//             !currentNamedRanges.some(
//               (currentNr) => currentNr._id.toString() === prevNr._id.toString()
//             )
//           ) {
//             namedRangeChanges.push({
//               type: "Named Range Deleted",
//               namedRange: prevNr,
//             });
//           }
//         });
//         // Updated Named Ranges
//         currentNamedRanges.forEach((currentNr) => {
//           const prevNr = prevNamedRanges.find(
//             (prev) => prev._id.toString() === currentNr._id.toString()
//           );
//           if (prevNr && JSON.stringify(prevNr) !== JSON.stringify(currentNr)) {
//             namedRangeChanges.push({
//               type: "Named Range Updated",
//               old: prevNr,
//               new: currentNr,
//             });
//           }
//         });

//         if (namedRangeChanges.length > 0) {
//           logs.push({
//             type: `Named Range Changes (captured before v${i + 1})`,
//             timestamp: versionEntry.savedAt,
//             actor: versionEntry.savedBy,
//             changes: namedRangeChanges,
//           });
//         }
//       }
//     }

//     // 3. Log for the *current* workbook state
//     const currentSheets = await Sheet.find({ workbookId: workbook._id }).select(
//       "name lastModifiedDate"
//     );
//     logs.push({
//       type: "Current Workbook State",
//       timestamp: workbook.lastModifiedDate,
//       actor: workbook.lastModifiedBy,
//       details: {
//         cloudFileId: workbook.cloudFileId,
//         name: workbook.name,
//         classification: workbook.classification,
//         webUrl: workbook.webUrl,
//         category: workbook.category,
//         version: workbook.version,
//       },
//       sheets: currentSheets.map((s) => ({
//         _id: s._id,
//         name: s.name,
//         lastModifiedDate: s.lastModifiedDate,
//       })),
//       mappings: workbook.mappings, // Include full current mappings
//       namedRanges: workbook.namedRanges, // Include full current named ranges
//       message:
//         "This represents the currently active state of the workbook (live data).",
//     });

//     // Sort logs by timestamp for a chronological view
//     logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

//     res.status(200).json({ success: true, data: logs });
//   } catch (error) {
//     console.error("Error fetching workbook logs:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// const listTrialBalanceWorkbooks = async (req, res) => {
//   try {
//     const { engagementId } = req.params;
//     const category = "Trial Balance";

//     if (!engagementId) {
//       return res
//         .status(400)
//         .json({ success: false, error: "engagementId is required" });
//     }

//     const query = { engagementId, category };

//     const workbooks = await Workbook.find(query).select(
//       "-mappings -namedRanges -versions"
//     );

//     res.status(200).json({ success: true, data: workbooks });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// module.exports = {
//   saveWorkbookAndSheets,
//   getWorkbookWithSheets,
//   getHistoricalWorkbookVersion,
//   getSpecificSheetData,
//   listWorkbooks,
//   getWorkbookById,
//   uploadWorkbookDataAndSheetData,
//   saveWorkbook,
//   deleteWorkbook,
//   saveSheet,
//   listSheets,
//   createMapping,
//   updateMapping,
//   deleteMapping,
//   createNamedRange,
//   updateNamedRange,
//   deleteNamedRange,
//   addOrUpdateCustomField,
//   getWorkbookLogs,
//   listTrialBalanceWorkbooks,
// };
