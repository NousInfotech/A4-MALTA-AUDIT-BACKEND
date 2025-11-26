const mongoose = require("mongoose");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const Adjustment = require("../models/Adjustment");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

/**
 * Helper function to add history entry to adjustment
 * @param {Object} adjustment - The adjustment document
 * @param {String} action - Action type (created, updated, posted, unposted, deleted, reversed)
 * @param {Object} req - Express request object (optional, for user info)
 * @param {Object} previousValues - Previous state before change (optional)
 * @param {Object} newValues - New state after change (optional)
 * @param {Object} metadata - Additional metadata (optional)
 * @param {String} description - Human-readable description (optional)
 */
const addHistoryEntry = (adjustment, action, req = null, previousValues = null, newValues = null, metadata = {}, description = "") => {
  // Extract user info from req.user (populated by requireAuth middleware)
  let userId = "system";
  let userName = "System";
  
  if (req && req.user) {
    userId = req.user.id || req.user._id || "system";
    // Prefer name, fallback to email, then "Unknown User"
    userName = req.user.name || req.user.email || "Unknown User";
  }

  const historyEntry = {
    action,
    timestamp: new Date(),
    userId,
    userName,
    previousValues,
    newValues,
    metadata: {
      ...metadata,
      totalDr: adjustment.totalDr,
      totalCr: adjustment.totalCr,
      entriesCount: adjustment.entries.length,
    },
    description: description || getDefaultDescription(action, adjustment),
  };

  if (!adjustment.history) {
    adjustment.history = [];
  }
  
  adjustment.history.push(historyEntry);
  
  // Log for debugging
  console.log(`History entry added: ${action} by ${userName} (${userId})`);
};

/**
 * Generate default description based on action
 */
const getDefaultDescription = (action, adjustment) => {
  const actionDescriptions = {
    created: `Adjustment ${adjustment.adjustmentNo} created with ${adjustment.entries.length} entries`,
    updated: `Adjustment ${adjustment.adjustmentNo} updated`,
    posted: `Adjustment ${adjustment.adjustmentNo} posted to ETB (Dr: ${adjustment.totalDr}, Cr: ${adjustment.totalCr})`,
    unposted: `Adjustment ${adjustment.adjustmentNo} unposted from ETB`,
    deleted: `Adjustment ${adjustment.adjustmentNo} deleted`,
    reversed: `Adjustment ${adjustment.adjustmentNo} reversed`,
  };
  return actionDescriptions[action] || `Adjustment ${action}`;
};

/**
 * Create a new adjustment (draft status)
 * POST /api/adjustments
 */
exports.createAdjustment = async (req, res) => {
  try {
    const { engagementId, etbId, adjustmentNo, description, entries } = req.body;

    console.log("Creating adjustment with entries:", entries?.map(e => ({ 
      etbRowId: e.etbRowId, 
      code: e.code, 
      dr: e.dr, 
      cr: e.cr 
    })));

    // Validate required fields
    if (!engagementId || !etbId || !adjustmentNo) {
      return res.status(400).json({
        success: false,
        message: "engagementId, etbId, and adjustmentNo are required",
      });
    }

    // Verify ETB exists
    const etb = await ExtendedTrialBalance.findById(etbId);
    if (!etb) {
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

    console.log(`ETB has ${etb.rows.length} rows. First 3 row IDs:`, etb.rows.slice(0, 3).map(r => ({ 
      _id: r._id, 
      id: r.id, 
      code: r.code 
    })));

    // Validate entries
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        if (entry.dr > 0 && entry.cr > 0) {
          return res.status(400).json({
            success: false,
            message: `Entry for ${entry.code} cannot have both Dr and Cr values`,
          });
        }
      }
    }

    // Create adjustment
    const adjustment = new Adjustment({
      engagementId,
      etbId,
      adjustmentNo,
      description: description || "",
      status: "draft",
      entries: entries || [],
    });

    // Add history entry for creation
    addHistoryEntry(
      adjustment,
      "created",
      req,
      null,
      {
        adjustmentNo,
        description,
        entriesCount: (entries || []).length,
        status: "draft",
      },
      {
        createdBy: req?.user?.email || "system",
      }
    );

    await adjustment.save();

    return res.status(201).json({
      success: true,
      data: adjustment,
      message: "Adjustment created successfully",
    });
  } catch (error) {
    console.error("Error creating adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create adjustment",
    });
  }
};

/**
 * Get all adjustments for an engagement
 * GET /api/adjustments/engagement/:engagementId
 */
exports.getAdjustmentsByEngagement = async (req, res) => {
  try {
    const { engagementId } = req.params;

    const adjustments = await Adjustment.find({ engagementId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: adjustments,
      message: "Adjustments retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching adjustments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch adjustments",
    });
  }
};

/**
 * Get a single adjustment by ID
 * GET /api/adjustments/:id
 */
exports.getAdjustmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const adjustment = await Adjustment.findById(id);

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: adjustment,
      message: "Adjustment retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch adjustment",
    });
  }
};

/**
 * Update an existing adjustment
 * If posted, reverses old ETB impact and applies new impact
 * PUT /api/adjustments/:id
 */
exports.updateAdjustment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { description, entries } = req.body;

    const adjustment = await Adjustment.findById(id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    console.log(`Updating adjustment ${id} with status: ${adjustment.status}`);

    // Capture previous state for history
    const previousState = {
      description: adjustment.description,
      entriesCount: adjustment.entries.length,
      totalDr: adjustment.totalDr,
      totalCr: adjustment.totalCr,
      status: adjustment.status,
    };

    // Validate entries if provided
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        if (entry.dr > 0 && entry.cr > 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Entry for ${entry.code} cannot have both Dr and Cr values`,
          });
        }
      }
    }

    // If posted, need to update ETB
    if (adjustment.status === "posted" && entries !== undefined) {
      const etb = await ExtendedTrialBalance.findById(adjustment.etbId).session(session);

      if (!etb) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Extended Trial Balance not found",
        });
      }

      // 1. Reverse OLD entries from ETB
      for (const oldEntry of adjustment.entries) {
        const rowIndex = etb.rows.findIndex(
          (row) =>
            row._id === oldEntry.etbRowId ||
            row.id === oldEntry.etbRowId ||
            row.code === oldEntry.etbRowId
        );

        if (rowIndex !== -1) {
          const row = etb.rows[rowIndex];
          const oldNetAdjustment = (oldEntry.dr || 0) - (oldEntry.cr || 0);

          // Reverse old impact
          row.adjustments = (row.adjustments || 0) - oldNetAdjustment;
          etb.rows[rowIndex] = row;
        }
      }

      // 2. Apply NEW entries to ETB
      for (const newEntry of entries) {
        const rowIndex = etb.rows.findIndex(
          (row) =>
            row._id === newEntry.etbRowId ||
            row.id === newEntry.etbRowId ||
            row.code === newEntry.etbRowId
        );

        if (rowIndex === -1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({
            success: false,
            message: `ETB row ${newEntry.code} (ID: ${newEntry.etbRowId}) not found`,
          });
        }

        const row = etb.rows[rowIndex];
        const newNetAdjustment = (newEntry.dr || 0) - (newEntry.cr || 0);

        // Apply new impact
        row.adjustments = (row.adjustments || 0) + newNetAdjustment;
        row.finalBalance =
          (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

        // Update refs (ensure this adjustment is tracked)
        if (!row.adjustmentRefs) {
          row.adjustmentRefs = [];
        }
        if (!row.adjustmentRefs.includes(adjustment._id.toString())) {
          row.adjustmentRefs.push(adjustment._id.toString());
        }

        etb.rows[rowIndex] = row;
      }

      etb.markModified("rows");
      await etb.save({ session });

      console.log("ETB updated after editing posted adjustment");
    }

    // Update adjustment fields
    if (description !== undefined) adjustment.description = description;
    if (entries !== undefined) adjustment.entries = entries;

    // Add history entry for update
    const newState = {
      description: adjustment.description,
      entriesCount: adjustment.entries.length,
      totalDr: adjustment.entries.reduce((sum, e) => sum + (e.dr || 0), 0),
      totalCr: adjustment.entries.reduce((sum, e) => sum + (e.cr || 0), 0),
      status: adjustment.status,
    };

    addHistoryEntry(
      adjustment,
      "updated",
      req,
      previousState,
      newState,
      {
        etbUpdated: adjustment.status === "posted",
        updatedBy: req?.user?.email || "system",
      }
    );

    await adjustment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: adjustment,
      message: adjustment.status === "posted" 
        ? "Adjustment updated and ETB recalculated"
        : "Adjustment updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update adjustment",
    });
  }
};

/**
 * Post a draft adjustment (apply to ETB)
 * POST /api/adjustments/:id/post
 */
exports.postAdjustment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const adjustment = await Adjustment.findById(id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    // Only draft adjustments can be posted
    if (adjustment.status !== "draft") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only draft adjustments can be posted",
      });
    }

    // Validate Dr = Cr
    const totalDr = adjustment.entries.reduce((sum, e) => sum + (e.dr || 0), 0);
    const totalCr = adjustment.entries.reduce((sum, e) => sum + (e.cr || 0), 0);

    if (totalDr !== totalCr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Unbalanced adjustment: Dr ${totalDr} ≠ Cr ${totalCr}`,
      });
    }

    // Fetch ETB
    const etb = await ExtendedTrialBalance.findById(adjustment.etbId).session(
      session
    );

    if (!etb) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

    // Apply each entry to ETB rows
    for (const entry of adjustment.entries) {
      // Search by _id, id, or code for maximum compatibility
      const rowIndex = etb.rows.findIndex(
        (row) => row._id === entry.etbRowId || 
                 row.id === entry.etbRowId || 
                 row.code === entry.etbRowId
      );

      if (rowIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        console.error(`ETB row not found. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`);
        console.error(`Available row IDs:`, etb.rows.map(r => ({ _id: r._id, id: r.id, code: r.code })).slice(0, 5));
        return res.status(404).json({
          success: false,
          message: `ETB row ${entry.code} (ID: ${entry.etbRowId}) not found`,
        });
      }

      const row = etb.rows[rowIndex];
      const netAdjustment = (entry.dr || 0) - (entry.cr || 0);

      // Update adjustments and finalBalance
      row.adjustments = (row.adjustments || 0) + netAdjustment;
      row.finalBalance =
        (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

      // Add adjustment reference (if not already tracked)
      if (!row.adjustmentRefs) {
        row.adjustmentRefs = [];
      }
      if (!row.adjustmentRefs.includes(adjustment._id.toString())) {
        row.adjustmentRefs.push(adjustment._id.toString());
      }

      etb.rows[rowIndex] = row;
    }

    // Mark ETB as modified
    etb.markModified("rows");
    await etb.save({ session });

    // Update adjustment status
    adjustment.status = "posted";

    // Add history entry for posting
    addHistoryEntry(
      adjustment,
      "posted",
      req,
      { status: "draft" },
      { status: "posted" },
      {
        etbRowsUpdated: adjustment.entries.length,
        totalRows: etb.rows.length,
        postedBy: req?.user?.email || "system",
      }
    );

    await adjustment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        adjustment,
        etbSummary: {
          totalRows: etb.rows.length,
          updatedRows: adjustment.entries.length,
        },
      },
      message: "Adjustment posted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error posting adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to post adjustment",
    });
  }
};

/**
 * Unpost a posted adjustment (reverse its ETB impact)
 * POST /api/adjustments/:id/unpost
 */
exports.unpostAdjustment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const adjustment = await Adjustment.findById(id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    // Only posted adjustments can be unposted
    if (adjustment.status !== "posted") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only posted adjustments can be unposted",
      });
    }

    // Fetch ETB
    const etb = await ExtendedTrialBalance.findById(adjustment.etbId).session(
      session
    );

    if (!etb) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

    // Reverse each entry from ETB rows
    for (const entry of adjustment.entries) {
      // Search by _id, id, or code for maximum compatibility
      const rowIndex = etb.rows.findIndex(
        (row) => row._id === entry.etbRowId || 
                 row.id === entry.etbRowId || 
                 row.code === entry.etbRowId
      );

      if (rowIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        console.error(`ETB row not found during unpost. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`);
        console.error(`Available row IDs:`, etb.rows.map(r => ({ _id: r._id, id: r.id, code: r.code })).slice(0, 5));
        return res.status(404).json({
          success: false,
          message: `ETB row ${entry.code} (ID: ${entry.etbRowId}) not found`,
        });
      }

      const row = etb.rows[rowIndex];
      const netAdjustment = (entry.dr || 0) - (entry.cr || 0);

      // Reverse adjustments and finalBalance
      row.adjustments = (row.adjustments || 0) - netAdjustment;
      row.finalBalance =
        (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

      // Remove adjustment reference
      if (row.adjustmentRefs) {
        row.adjustmentRefs = row.adjustmentRefs.filter(
          (ref) => ref !== adjustment._id.toString()
        );
      }

      etb.rows[rowIndex] = row;
    }

    // Mark ETB as modified
    etb.markModified("rows");
    await etb.save({ session });

    // Update adjustment status back to draft
    adjustment.status = "draft";

    // Add history entry for unposting
    addHistoryEntry(
      adjustment,
      "unposted",
      req,
      { status: "posted" },
      { status: "draft" },
      {
        etbRowsReverted: adjustment.entries.length,
        totalRows: etb.rows.length,
        unpostedBy: req?.user?.email || "system",
      }
    );

    await adjustment.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        adjustment,
        etbSummary: {
          totalRows: etb.rows.length,
          updatedRows: adjustment.entries.length,
        },
      },
      message: "Adjustment unposted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error unposting adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to unpost adjustment",
    });
  }
};

/**
 * Delete an adjustment
 * If posted, reverses its ETB impact before deleting
 * DELETE /api/adjustments/:id
 */
exports.deleteAdjustment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const adjustment = await Adjustment.findById(id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    console.log(`Deleting adjustment ${id} with status: ${adjustment.status}`);

    // If the adjustment is posted, reverse its ETB impact first
    if (adjustment.status === "posted") {
      console.log("Reversing ETB impact before deleting posted adjustment");

      // Fetch ETB
      const etb = await ExtendedTrialBalance.findById(adjustment.etbId).session(session);

      if (!etb) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Extended Trial Balance not found",
        });
      }

      // Reverse each entry from ETB rows
      for (const entry of adjustment.entries) {
        // Search by _id, id, or code for maximum compatibility
        const rowIndex = etb.rows.findIndex(
          (row) => row._id === entry.etbRowId || 
                   row.id === entry.etbRowId || 
                   row.code === entry.etbRowId
        );

        if (rowIndex === -1) {
          console.warn(`ETB row not found during delete. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`);
          // Continue with other entries instead of aborting
          continue;
        }

        const row = etb.rows[rowIndex];
        const netAdjustment = (entry.dr || 0) - (entry.cr || 0);

        // Reverse adjustments and finalBalance
        row.adjustments = (row.adjustments || 0) - netAdjustment;
        row.finalBalance =
          (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

        // Remove adjustment reference
        if (row.adjustmentRefs) {
          row.adjustmentRefs = row.adjustmentRefs.filter(
            (ref) => ref !== adjustment._id.toString()
          );
        }

        etb.rows[rowIndex] = row;
      }

      // Mark ETB as modified and save
      etb.markModified("rows");
      await etb.save({ session });

      console.log("ETB impact reversed successfully");
    }

    // Add history entry for deletion (before deleting)
    addHistoryEntry(
      adjustment,
      "deleted",
      req,
      {
        adjustmentNo: adjustment.adjustmentNo,
        description: adjustment.description,
        status: adjustment.status,
        entriesCount: adjustment.entries.length,
        totalDr: adjustment.totalDr,
        totalCr: adjustment.totalCr,
      },
      null,
      {
        wasPosted: adjustment.status === "posted",
        etbImpactReversed: adjustment.status === "posted",
        deletedBy: req?.user?.email || "system",
      }
    );

    // Save the history before deletion
    await adjustment.save({ session });

    // Delete the adjustment
    await Adjustment.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: { id, wasPosted: adjustment.status === "posted" },
      message: adjustment.status === "posted" 
        ? "Adjustment deleted and ETB impact reversed"
        : "Adjustment deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting adjustment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete adjustment",
    });
  }
};

/**
 * Get adjustments by ETB ID
 * GET /api/adjustments/etb/:etbId
 */
exports.getAdjustmentsByETB = async (req, res) => {
  try {
    const { etbId } = req.params;

    const adjustments = await Adjustment.find({ etbId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: adjustments,
      message: "Adjustments retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching adjustments:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch adjustments",
    });
  }
};

/**
 * Get history for a specific adjustment
 * GET /api/adjustments/:id/history
 */
exports.getAdjustmentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const adjustment = await Adjustment.findById(id).select('history adjustmentNo');

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    // Sort history by timestamp descending (newest first)
    const sortedHistory = (adjustment.history || []).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.status(200).json({
      success: true,
      data: {
        adjustmentNo: adjustment.adjustmentNo,
        history: sortedHistory,
      },
      message: "Adjustment history retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching adjustment history:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch adjustment history",
    });
  }
};

/**
 * Export adjustments to Excel
 * GET /api/adjustments/engagement/:engagementId/export
 */
exports.exportAdjustments = async (req, res) => {
  try {
    const { engagementId } = req.params;

    const adjustments = await Adjustment.find({ engagementId }).sort({
      createdAt: -1,
    });

    if (adjustments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No adjustments found for this engagement",
      });
    }

    // Prepare Excel data
    const headers = [
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

    const rows = [];

    for (const adj of adjustments) {
      // Get posted user and date from history
      const postedHistory = adj.history?.find((h) => h.action === "posted");
      const postedBy = postedHistory?.userName || "N/A";
      const postedDate = postedHistory?.timestamp
        ? new Date(postedHistory.timestamp).toLocaleDateString()
        : "N/A";
      const createdDate = adj.createdAt
        ? new Date(adj.createdAt).toLocaleDateString()
        : "N/A";

      // Get evidence filenames
      const evidenceFilenames = adj.evidenceFiles
        ?.map((f) => f.fileName)
        .join("; ") || "None";

      // Create a row for each entry
      if (adj.entries && adj.entries.length > 0) {
        for (const entry of adj.entries) {
          const type = entry.dr > 0 ? "Debit" : "Credit";
          const amount = entry.dr > 0 ? entry.dr : entry.cr;

          rows.push([
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
        // If no entries, still create a row with adjustment info
        rows.push([
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
    const headerRow = worksheet.addRow(headers);
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
      to: { row: 1, column: headers.length },
    };

    // Add data rows with styling and alternating row colors
    rows.forEach((row, rowIndex) => {
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

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="adjustments_${engagementId}_${new Date().toISOString().split("T")[0]}.xlsx"`
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
 * Add evidence file to an adjustment
 * POST /api/adjustments/:id/evidence
 */
exports.addEvidenceFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileUrl } = req.body;

    if (!fileName || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "fileName and fileUrl are required",
      });
    }

    const adjustment = await Adjustment.findById(id);

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    // Extract user info
    let userId = "system";
    let userName = "System";
    if (req && req.user) {
      userId = req.user.id || req.user._id || "system";
      userName = req.user.name || req.user.email || "Unknown User";
    }

    // Add evidence file
    if (!adjustment.evidenceFiles) {
      adjustment.evidenceFiles = [];
    }

    adjustment.evidenceFiles.push({
      fileName,
      fileUrl,
      uploadedAt: new Date(),
      uploadedBy: {
        userId,
        userName,
      },
    });

    await adjustment.save();

    return res.status(200).json({
      success: true,
      data: adjustment,
      message: "Evidence file added successfully",
    });
  } catch (error) {
    console.error("Error adding evidence file:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add evidence file",
    });
  }
};

/**
 * Remove evidence file from an adjustment
 * DELETE /api/adjustments/:id/evidence/:evidenceId
 */
exports.removeEvidenceFile = async (req, res) => {
  try {
    const { id, evidenceId } = req.params;

    const adjustment = await Adjustment.findById(id);

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    if (!adjustment.evidenceFiles || adjustment.evidenceFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No evidence files found",
      });
    }

    // Remove evidence file
    adjustment.evidenceFiles = adjustment.evidenceFiles.filter(
      (file) => file._id.toString() !== evidenceId
    );

    await adjustment.save();

    return res.status(200).json({
      success: true,
      data: adjustment,
      message: "Evidence file removed successfully",
    });
  } catch (error) {
    console.error("Error removing evidence file:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove evidence file",
    });
  }
};

