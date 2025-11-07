const mongoose = require("mongoose");
const Adjustment = require("../models/Adjustment");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

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
 * Update an existing draft adjustment
 * PUT /api/adjustments/:id
 */
exports.updateAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, entries } = req.body;

    const adjustment = await Adjustment.findById(id);

    if (!adjustment) {
      return res.status(404).json({
        success: false,
        message: "Adjustment not found",
      });
    }

    // TEMPORARY: Allow updating posted adjustments (will be removed later)
    // if (adjustment.status !== "draft") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Only draft adjustments can be edited",
    //   });
    // }
    
    console.log(`Updating adjustment ${id} with status: ${adjustment.status}`);

    // Validate entries if provided
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

    // Update fields
    if (description !== undefined) adjustment.description = description;
    if (entries !== undefined) adjustment.entries = entries;

    await adjustment.save();

    return res.status(200).json({
      success: true,
      data: adjustment,
      message: "Adjustment updated successfully",
    });
  } catch (error) {
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

