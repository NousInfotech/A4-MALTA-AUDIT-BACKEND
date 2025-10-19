// const { Workbook, HistoricalSheet } = require("../models/ExcelWorkbook.js");
// const Sheet = require("../models/Sheet.js");
// const XLSX = require("xlsx");
// const mongoose = require("mongoose");

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

//     let workbook;
//     let currentSheetIds = [];
//     const currentUser = req.user ? req.user.id : null;
//     let newWorkbookCreated = false; // Flag to track if a new workbook was created

//     if (workbookData.id) {
//       workbook = await Workbook.findById(workbookData.id)
//         .populate("sheets")
//         .session(session);

//       if (workbook) {
//         const previousVersion = {
//           version: workbook.version || "v1",
//           savedAt: workbook.lastModifiedDate || workbook.uploadedDate,
//           savedBy: workbook.lastModifiedBy || workbook.uploadedBy,
//           name: workbook.name,
//           classification: workbook.classification,
//           webUrl: workbook.webUrl,
//           mappings: workbook.mappings
//             ? JSON.parse(JSON.stringify(workbook.mappings))
//             : [],
//           namedRanges: workbook.namedRanges
//             ? JSON.parse(JSON.stringify(workbook.namedRanges))
//             : [],
//           sheets: [],
//         };

//         workbook.versions.push(previousVersion);
//         const newVersionSubdocument =
//           workbook.versions[workbook.versions.length - 1];
//         const newVersionId = newVersionSubdocument._id;

//         const previousVersionSheetsRefs = [];
//         for (const currentSheet of workbook.sheets) {
//           const historicalSheet = new HistoricalSheet({
//             workbookVersionId: newVersionId,
//             name: currentSheet.name,
//             data: currentSheet.data,
//             savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//           });
//           await historicalSheet.save({ session });
//           previousVersionSheetsRefs.push(historicalSheet._id);
//         }

//         newVersionSubdocument.sheets = previousVersionSheetsRefs;

//         workbook.name = workbookData.name || workbook.name;
//         workbook.webUrl = workbookData.webUrl || workbook.webUrl;
//         workbook.classification =
//           workbookData.classification || workbook.classification;
//         workbook.lastModifiedBy = currentUser;
//         workbook.lastModifiedDate = new Date();
//         const currentVersionNumber = parseInt(
//           workbook.version.replace("v", "") || "0"
//         );
//         workbook.version = `v${currentVersionNumber + 1}`;

//         workbook.mappings = workbookData.mappings || [];
//         workbook.namedRanges = workbookData.namedRanges || [];

//         await Sheet.deleteMany({ workbookId: workbook._id }, { session });
//       }
//     }

//     if (!workbook) {
//       newWorkbookCreated = true; // Set flag
//       workbook = new Workbook({
//         engagementId: workbookData.engagementId,
//         classification: workbookData.classification,
//         name: workbookData.name,
//         webUrl: workbookData.webUrl,
//         uploadedBy: currentUser,
//         lastModifiedBy: currentUser,
//         version: "v1",
//         mappings: workbookData.mappings || [],
//         namedRanges: workbookData.namedRanges || [],
//       });
//     }

//     await workbook.save({ session });

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
//     await workbook.save({ session });

//     // --- CRITICAL FIX: Refetch and Populate the Workbook before responding ---
//     // This ensures we get a fresh document from the DB with all references properly linked,
//     // and then we populate it.
//     const finalWorkbook = await Workbook.findById(workbook._id)
//                                     .populate({ path: "sheets", session: session })
//                                     .session(session);


//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: {
//         workbook: finalWorkbook.toObject({ getters: true }), // Use the refetched and populated workbook
//         sheetsSaved: currentSheetIds.length,
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

// // You might also want a controller to fetch a workbook with its sheets
// const getWorkbookWithSheets = async (req, res) => {
//   try {
//     const { id } = req.params; // Expect workbook ID as a URL parameter

//     const workbook = await Workbook.findById(id).populate("sheets"); // Populates current sheets

//     if (!workbook) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Workbook not found." });
//     }

//     // This will return the latest workbook data, including its mappings, namedRanges, and current sheets.
//     // It will also include the 'versions' array containing historical metadata.
//     res.status(200).json({ success: true, data: workbook });
//   } catch (error) {
//     console.error("Error fetching workbook with sheets:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // --- NEW FUNCTION: To fetch a specific historical version of a workbook ---
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

//     // Fetch the historical sheets from the HistoricalSheet collection
//     const historicalSheets = await HistoricalSheet.find({
//       _id: { $in: historicalVersion.sheets },
//       workbookVersionId: historicalVersion._id, // Ensure sheets belong to this specific version subdocument
//     });

//     const historicalWorkbookData = {
//       _id: workbook._id,
//       engagementId: workbook.engagementId,
//       name: historicalVersion.name,
//       classification: historicalVersion.classification,
//       webUrl: historicalVersion.webUrl,
//       version: historicalVersion.version,
//       savedAt: historicalVersion.savedAt,
//       savedBy: historicalVersion.savedBy,
//       mappings: historicalVersion.mappings,
//       namedRanges: historicalVersion.namedRanges,
//       sheets: historicalSheets, // Attach the fetched historical sheets (containing data)
//     };

//     res.status(200).json({ success: true, data: historicalWorkbookData });
//   } catch (error) {
//     console.error("Error fetching historical workbook version:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // Controller to get a specific sheet's data
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

//       // Fetch the historical sheet from the HistoricalSheet collection
//       sheet = await HistoricalSheet.findOne({
//         _id: { $in: historicalVersion.sheets },
//         name: sheetName,
//         workbookVersionId: historicalVersion._id, // Ensure it belongs to the correct version
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

// // --- Workbook Operations ---

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
//       "-mappings -namedRanges -versions" // Exclude versions from the list for brevity
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
//       fileName,
//       workbookData, // Parsed workbook data [{ name, data }]
//       webUrl, // Optional: file link from MS Drive
//     } = req.body;

//     const userId = req.user?.id;

//     if (!engagementId || !fileName || !workbookData) {
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

//     // --- Auto versioning: increment version if same workbook name exists for same engagement ---
//     // Find the highest existing version for this engagement and filename
//     const existingWorkbooksCount = await Workbook.countDocuments({
//       engagementId,
//       name: fileName,
//     }).session(session);
//     const newVersionString = `v${existingWorkbooksCount + 1}`;

//     // --- Create new workbook record ---
//     const newWorkbook = new Workbook({
//       engagementId,
//       classification,
//       name: fileName,
//       webUrl: webUrl || null,
//       uploadedBy: userId,
//       lastModifiedBy: userId,
//       uploadedDate: new Date(),
//       lastModifiedDate: new Date(),
//       version: newVersionString, // Set the current version
//       mappings: [],
//       namedRanges: [],
//       sheets: [], // Initialize sheets array
//     });

//     await newWorkbook.save({ session }); // Save to get newWorkbook._id for sheet references

//     // --- Save all sheets belonging to this workbook ---
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

//     // Update the workbook with the references to the newly created sheets
//     newWorkbook.sheets = savedSheetIds;

//     // --- Create initial version entry for the new workbook ---
//     const initialVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: newWorkbook.name,
//       classification: newWorkbook.classification,
//       webUrl: newWorkbook.webUrl,
//       sheets: savedSheetIds, // These are the _id's of the *current* sheets, for the initial version they are the same
//       mappings: [],
//       namedRanges: [],
//     };
//     newWorkbook.versions.push(initialVersionEntry);

//     await newWorkbook.save({ session }); // Save again to update sheets and versions

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       data: {
//         id: newWorkbook._id,
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
//     const { workbookId, workbookName, sheetData, metadata, savedByUserId } =
//       req.body;
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

//     // --- Prepare for new version creation before updates ---
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture the *current* state of the workbook for the version to be saved
//     const currentSheetRefIds = workbook.sheets.map((sheet) => sheet._id); // Get IDs of current sheets
//     const currentMappings = JSON.parse(JSON.stringify(workbook.mappings)); // Deep copy
//     const currentNamedRanges = JSON.parse(JSON.stringify(workbook.namedRanges)); // Deep copy

//     // Create HistoricalSheet documents for the *current* sheets being superseded
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder, will be updated with actual version subdocument _id
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     // Create the new version entry
//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name, // Capture current workbook name
//       classification: workbook.classification, // Capture current classification
//       webUrl: workbook.webUrl, // Capture current webUrl
//       sheets: historicalSheetIds, // Link to the newly created historical sheets
//       mappings: currentMappings,
//       namedRanges: currentNamedRanges,
//     };

//     // Add the new version entry to the workbook's versions array
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString; // Update the main version field

//     // Update the workbook's last modified fields
//     workbook.lastModifiedBy = userId;
//     workbook.lastModifiedDate = new Date();

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     // --- Apply updates to the workbook and its sheets ---
//     if (workbookName) workbook.name = workbookName;
//     if (metadata) {
//       if (metadata.lastModifiedBy)
//         workbook.lastModifiedBy = metadata.lastModifiedBy;
//       workbook.lastModifiedDate = new Date();
//     }

//     const updatedSheetIds = []; // This will hold the _ids of the *new* current sheets

//     // Delete existing current sheets as their historical version is saved
//     await Sheet.deleteMany({ workbookId: workbook._id }, { session });

//     for (const sheetName in sheetData) {
//       const data = sheetData[sheetName];
//       // Assuming sheetData includes the header and index column and needs cleaning
//       const cleanData = data.slice(1).map((row) => row.slice(1));

//       const newSheet = new Sheet({
//         workbookId: workbook._id,
//         name: sheetName,
//         data: cleanData,
//         lastModifiedDate: new Date(),
//         lastModifiedBy: userId,
//       });
//       await newSheet.save({ session });
//       updatedSheetIds.push(newSheet._id);
//     }
//     workbook.sheets = updatedSheetIds; // Update workbook's sheets array with new current sheets

//     await workbook.save({ session }); // Save the updated workbook with the new version and sheet references

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message:
//         "Workbook and its sheets saved successfully, new version created.",
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
//     const userId = req.user?.id; // Assuming user ID is available from auth middleware

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

//     // 1. Delete all current sheets associated with this workbook
//     await Sheet.deleteMany({ workbookId: workbook._id }, { session });

//     // 2. Extract _id's of all Version subdocuments
//     // Note: VersionSchema is a subdocument array within Workbook.
//     // We need to get the HistoricalSheet._id's that reference these Version subdocuments.
//     const versionSubdocumentIds = workbook.versions.map((v) => v._id);

//     // 3. Delete all HistoricalSheets associated with these versions
//     // We query HistoricalSheet by `workbookVersionId` field which stores the _id of the Version subdocument
//     await HistoricalSheet.deleteMany(
//       { workbookVersionId: { $in: versionSubdocumentIds } },
//       { session }
//     );

//     // 4. Delete the workbook itself (which implicitly removes its subdocuments like versions, mappings, namedRanges)
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

//     // If a sheet is being updated or created, this operation should also create a new workbook version.
//     // 1. Create a new version entry for the workbook
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)),
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)),
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     // Now, handle the update/creation of the *current* sheet
//     if (sheet) {
//       sheet.data = cleanData;
//       sheet.lastModifiedDate = new Date();
//       sheet.lastModifiedBy = userId;
//       await sheet.save({ session });
//     } else {
//       const newSheet = new Sheet({
//         workbookId,
//         name: sheetName,
//         data: cleanData,
//         lastModifiedDate: new Date(),
//         lastModifiedBy: userId,
//       });
//       await newSheet.save({ session });
//       currentSheetIds.push(newSheet._id); // Add new sheet ID to current sheets
//     }

//     workbook.sheets = currentSheetIds; // Update the workbook's current sheets array
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     await workbook.save({ session }); // Save the updated workbook with new version and current sheets

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: `Sheet "${sheetName}" saved successfully, new workbook version created.`,
//       version: newVersionString,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error saving sheet:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// // --- Sheet Operations ---

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

//     // Also create a new version when mappings are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)), // Deep copy of updated mappings
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)),
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: newMapping,
//       message: "Mapping created successfully, new version created.",
//       version: newVersionString,
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

//     // Also create a new version when mappings are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)), // Deep copy of updated mappings
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)),
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       data: mapping,
//       message: "Mapping updated successfully, new version created.",
//       version: newVersionString,
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

//     // Check if the mapping exists before attempting to remove
//     const mappingExists = workbook.mappings.some(m => m._id.toString() === mappingId);
//     if (!mappingExists) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Mapping not found" });
//     }

//     // Use workbook.mappings.pull() to remove the subdocument
//     workbook.mappings.pull(mappingId);

//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     // Also create a new version when mappings are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       // Mappings array has already been updated by the pull operation
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)), // Deep copy of updated mappings
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)),
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "Mapping deleted successfully, new version created.",
//       version: newVersionString,
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

//     console.log("Received workbookId:", workbookId); 

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

//     const newNamedRange = {
//       _id: new mongoose.Types.ObjectId(),
//       name,
//       range,
//     };

//     workbook.namedRanges.push(newNamedRange);
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     // Also create a new version when named ranges are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)),
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)), // Deep copy of updated named ranges
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       data: newNamedRange,
//       message: "Named range created successfully, new version created.",
//       version: newVersionString,
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

//     // Also create a new version when named ranges are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)),
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)), // Deep copy of updated named ranges
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       data: namedRange,
//       message: "Named range updated successfully, new version created.",
//       version: newVersionString,
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

//     // Check if the named range exists before attempting to pull
//     const namedRangeExists = workbook.namedRanges.id(namedRangeId);
//     if (!namedRangeExists) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ success: false, error: "Named range not found" });
//     }

//     // Correct way to remove a subdocument from a Mongoose array
//     workbook.namedRanges.pull(namedRangeId); // Use pull to remove the subdocument by its _id
//     workbook.lastModifiedDate = new Date();
//     workbook.lastModifiedBy = userId;

//     // Also create a new version when named ranges are changed
//     const newVersionNumber = workbook.versions.length + 1;
//     const newVersionString = `v${newVersionNumber}`;

//     // Capture current state of sheets for historical version
//     const historicalSheetIds = [];
//     for (const currentSheet of workbook.sheets) {
//       const historicalSheet = new HistoricalSheet({
//         workbookVersionId: new mongoose.Types.ObjectId(), // Placeholder
//         name: currentSheet.name,
//         data: currentSheet.data,
//         savedAt: currentSheet.lastModifiedDate || currentSheet.createdAt,
//       });
//       await historicalSheet.save({ session });
//       historicalSheetIds.push(historicalSheet._id);
//     }

//     const newVersionEntry = {
//       version: newVersionString,
//       savedAt: new Date(),
//       savedBy: userId,
//       name: workbook.name,
//       classification: workbook.classification,
//       webUrl: workbook.webUrl,
//       sheets: historicalSheetIds, // References to historical sheets
//       mappings: JSON.parse(JSON.stringify(workbook.mappings)),
//       namedRanges: JSON.parse(JSON.stringify(workbook.namedRanges)), // Deep copy of updated named ranges (after deletion)
//     };
//     workbook.versions.push(newVersionEntry);
//     workbook.version = newVersionString;

//     // Assign the actual _id of the new version subdocument to the historical sheets
//     const versionSubdocumentId =
//       workbook.versions[workbook.versions.length - 1]._id;
//     for (const hsId of historicalSheetIds) {
//       await HistoricalSheet.findByIdAndUpdate(
//         hsId,
//         { workbookVersionId: versionSubdocumentId },
//         { session }
//       );
//     }

//     await workbook.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: "Named range deleted successfully, new version created.",
//       version: newVersionString,
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

//     // Basic validation
//     if (!fieldKey) {
//       return res.status(400).json({ message: "Custom field key is required." });
//     }

//     // Construct the update object dynamically for the customFields.fieldKey
//     const update = {};
//     update[`customFields.${fieldKey}`] = fieldValue;

//     const workbook = await Workbook.findByIdAndUpdate(
//       id,
//       { $set: update },
//       {
//         new: true, // Return the updated document
//         runValidators: true, // Run schema validators on update (though Mixed type won't validate sub-fields)
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

//     // Log for initial workbook upload
//     logs.push({
//       type: "Workbook Uploaded",
//       timestamp: workbook.uploadedDate,
//       actor: workbook.uploadedBy,
//       details: {
//         name: workbook.name,
//         engagementId: workbook.engagementId,
//         classification: workbook.classification,
//         webUrl: workbook.webUrl,
//         initialVersion: workbook.version,
//       },
//       currentStatus: { // Current status at the time of this log entry
//         mappingsCount: 0, // No mappings or named ranges on initial upload if they're not part of initial data
//         namedRangesCount: 0,
//         sheetsCount: workbook.sheets.length, // Number of initial sheets
//       }
//     });

//     // Iterate through all historical versions
//     for (const versionEntry of workbook.versions) {
//       const historicalVersionLogs = {
//         type: "Workbook Version Saved",
//         version: versionEntry.version,
//         timestamp: versionEntry.savedAt,
//         actor: versionEntry.savedBy,
//         details: {
//           name: versionEntry.name,
//           classification: versionEntry.classification,
//           webUrl: versionEntry.webUrl,
//           mappingsCount: versionEntry.mappings ? versionEntry.mappings.length : 0,
//           namedRangesCount: versionEntry.namedRanges ? versionEntry.namedRanges.length : 0,
//         },
//         // To get sheet names and data for this specific version, we need to populate HistoricalSheet
//         sheets: [],
//       };

//       // Fetch historical sheets for this version
//       if (versionEntry.sheets && versionEntry.sheets.length > 0) {
//         const historicalSheets = await HistoricalSheet.find({
//           _id: { $in: versionEntry.sheets },
//           workbookVersionId: versionEntry._id,
//         }).select('name savedAt'); // Only select name and savedAt for the log summary

//         historicalVersionLogs.details.sheetsCount = historicalSheets.length;
//         historicalVersionLogs.sheets = historicalSheets.map(hs => ({
//             _id: hs._id,
//             name: hs.name,
//             savedAt: hs.savedAt,
//             // You can add more historical sheet data here if needed,
//             // but for a log summary, name and ID are usually sufficient.
//             // Full sheet data might be too verbose for a general "log" endpoint.
//         }));
//       }

//       // Add detailed diffs for mappings and named ranges between versions
//       // This part requires comparing `versionEntry.mappings` and `versionEntry.namedRanges`
//       // with the *previous* version's mappings/named ranges. This can get complex
//       // quickly if you want a granular diff. For a general log, just listing the
//       // state *at* that version might be sufficient.
//       // For this example, we'll just include the counts and a summary.
//       historicalVersionLogs.currentStatus = { // Status *after* this version was saved
//         mappingsCount: versionEntry.mappings.length,
//         namedRangesCount: versionEntry.namedRanges.length,
//         sheetsCount: historicalVersionLogs.details.sheetsCount,
//       };

//       logs.push(historicalVersionLogs);
//     }

//     // You could also add a log for the *current* state of the workbook (not yet versioned)
//     const currentSheets = await Sheet.find({ workbookId: workbook._id }).select('name');
//     logs.push({
//       type: "Current Workbook State",
//       timestamp: workbook.lastModifiedDate,
//       actor: workbook.lastModifiedBy,
//       details: {
//         name: workbook.name,
//         classification: workbook.classification,
//         webUrl: workbook.webUrl,
//         version: workbook.version,
//         mappingsCount: workbook.mappings.length,
//         namedRangesCount: workbook.namedRanges.length,
//         sheetsCount: currentSheets.length,
//       },
//       sheets: currentSheets.map(s => ({ _id: s._id, name: s.name })),
//       message: "This represents the current, unversioned state of the workbook.",
//     });

//     // Sort logs by timestamp for a chronological view
//     logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

//     res.status(200).json({ success: true, data: logs });
//   } catch (error) {
//     console.error("Error fetching workbook logs:", error);
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
// };
