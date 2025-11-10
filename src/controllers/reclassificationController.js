const mongoose = require("mongoose");
const Reclassification = require("../models/Reclassification");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

/**
 * Create a new reclassification (draft status)
 * POST /api/reclassifications
 */
exports.createReclassification = async (req, res) => {
  try {
    const { engagementId, etbId, reclassificationNo, description, entries } = req.body;

    console.log("Creating reclassification with entries:", entries?.map((e) => ({
      etbRowId: e.etbRowId,
      code: e.code,
      dr: e.dr,
      cr: e.cr,
    })));

    if (!engagementId || !etbId || !reclassificationNo) {
      return res.status(400).json({
        success: false,
        message: "engagementId, etbId, and reclassificationNo are required",
      });
    }

    const etb = await ExtendedTrialBalance.findById(etbId);
    if (!etb) {
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

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

    const reclassification = new Reclassification({
      engagementId,
      etbId,
      reclassificationNo,
      description: description || "",
      status: "draft",
      entries: entries || [],
    });

    await reclassification.save();

    return res.status(201).json({
      success: true,
      data: reclassification,
      message: "Reclassification created successfully",
    });
  } catch (error) {
    console.error("Error creating reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create reclassification",
    });
  }
};

/**
 * Get all reclassifications for an engagement
 * GET /api/reclassifications/engagement/:engagementId
 */
exports.getReclassificationsByEngagement = async (req, res) => {
  try {
    const { engagementId } = req.params;

    const reclassifications = await Reclassification.find({ engagementId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: reclassifications,
      message: "Reclassifications retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching reclassifications:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reclassifications",
    });
  }
};

/**
 * Get a single reclassification by ID
 * GET /api/reclassifications/:id
 */
exports.getReclassificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const reclassification = await Reclassification.findById(id);

    if (!reclassification) {
      return res.status(404).json({
        success: false,
        message: "Reclassification not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: reclassification,
      message: "Reclassification retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reclassification",
    });
  }
};

/**
 * Update an existing reclassification
 * If posted, reverses old ETB impact and applies new impact
 * PUT /api/reclassifications/:id
 */
exports.updateReclassification = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { description, entries } = req.body;

    const reclassification = await Reclassification.findById(id).session(session);

    if (!reclassification) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Reclassification not found",
      });
    }

    console.log(`Updating reclassification ${id} with status: ${reclassification.status}`);

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
    if (reclassification.status === "posted" && entries !== undefined) {
      const etb = await ExtendedTrialBalance.findById(reclassification.etbId).session(session);

      if (!etb) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Extended Trial Balance not found",
        });
      }

      // 1. Reverse OLD entries from ETB
      for (const oldEntry of reclassification.entries) {
        const rowIndex = etb.rows.findIndex(
          (row) =>
            row._id === oldEntry.etbRowId ||
            row.id === oldEntry.etbRowId ||
            row.code === oldEntry.etbRowId
        );

        if (rowIndex !== -1) {
          const row = etb.rows[rowIndex];
          const oldNetReclassification = (oldEntry.dr || 0) - (oldEntry.cr || 0);

          // Reverse old impact
          row.reclassification = (row.reclassification || 0) - oldNetReclassification;
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
        const newNetReclassification = (newEntry.dr || 0) - (newEntry.cr || 0);

        // Apply new impact
        row.reclassification = (row.reclassification || 0) + newNetReclassification;
        row.finalBalance =
          (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

        // Update refs (ensure this reclassification is tracked)
        if (!row.reclassificationRefs) {
          row.reclassificationRefs = [];
        }
        if (!row.reclassificationRefs.includes(reclassification._id.toString())) {
          row.reclassificationRefs.push(reclassification._id.toString());
        }

        etb.rows[rowIndex] = row;
      }

      etb.markModified("rows");
      await etb.save({ session });

      console.log("ETB updated after editing posted reclassification");
    }

    if (description !== undefined) reclassification.description = description;
    if (entries !== undefined) reclassification.entries = entries;

    await reclassification.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: reclassification,
      message: reclassification.status === "posted"
        ? "Reclassification updated and ETB recalculated"
        : "Reclassification updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update reclassification",
    });
  }
};

/**
 * Post a draft reclassification (apply to ETB)
 * POST /api/reclassifications/:id/post
 */
exports.postReclassification = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const reclassification = await Reclassification.findById(id).session(session);

    if (!reclassification) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Reclassification not found",
      });
    }

    if (reclassification.status !== "draft") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only draft reclassifications can be posted",
      });
    }

    const totalDr = reclassification.entries.reduce((sum, e) => sum + (e.dr || 0), 0);
    const totalCr = reclassification.entries.reduce((sum, e) => sum + (e.cr || 0), 0);

    if (totalDr !== totalCr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Unbalanced reclassification: Dr ${totalDr} ≠ Cr ${totalCr}`,
      });
    }

    const etb = await ExtendedTrialBalance.findById(reclassification.etbId).session(session);

    if (!etb) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

    for (const entry of reclassification.entries) {
      const rowIndex = etb.rows.findIndex(
        (row) =>
          row._id === entry.etbRowId ||
          row.id === entry.etbRowId ||
          row.code === entry.etbRowId
      );

      if (rowIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        console.error(
          `ETB row not found for reclassification. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`
        );
        console.error(
          `Available row IDs:`,
          etb.rows.map((r) => ({ _id: r._id, id: r.id, code: r.code })).slice(0, 5)
        );
        return res.status(404).json({
          success: false,
          message: `ETB row ${entry.code} (ID: ${entry.etbRowId}) not found`,
        });
      }

      const row = etb.rows[rowIndex];
      const netReclassification = (entry.dr || 0) - (entry.cr || 0);

      row.reclassification = (row.reclassification || 0) + netReclassification;
      row.finalBalance =
        (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

      if (!row.reclassificationRefs) {
        row.reclassificationRefs = [];
      }
      if (!row.reclassificationRefs.includes(reclassification._id.toString())) {
        row.reclassificationRefs.push(reclassification._id.toString());
      }

      etb.rows[rowIndex] = row;
    }

    etb.markModified("rows");
    await etb.save({ session });

    reclassification.status = "posted";
    await reclassification.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        reclassification,
        etbSummary: {
          totalRows: etb.rows.length,
          updatedRows: reclassification.entries.length,
        },
      },
      message: "Reclassification posted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error posting reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to post reclassification",
    });
  }
};

/**
 * Unpost a posted reclassification (reverse its ETB impact)
 * POST /api/reclassifications/:id/unpost
 */
exports.unpostReclassification = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const reclassification = await Reclassification.findById(id).session(session);

    if (!reclassification) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Reclassification not found",
      });
    }

    if (reclassification.status !== "posted") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only posted reclassifications can be unposted",
      });
    }

    const etb = await ExtendedTrialBalance.findById(reclassification.etbId).session(session);

    if (!etb) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found",
      });
    }

    for (const entry of reclassification.entries) {
      const rowIndex = etb.rows.findIndex(
        (row) =>
          row._id === entry.etbRowId ||
          row.id === entry.etbRowId ||
          row.code === entry.etbRowId
      );

      if (rowIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        console.error(
          `ETB row not found during reclassification unpost. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`
        );
        console.error(
          `Available row IDs:`,
          etb.rows.map((r) => ({ _id: r._id, id: r.id, code: r.code })).slice(0, 5)
        );
        return res.status(404).json({
          success: false,
          message: `ETB row ${entry.code} (ID: ${entry.etbRowId}) not found`,
        });
      }

      const row = etb.rows[rowIndex];
      const netReclassification = (entry.dr || 0) - (entry.cr || 0);

      row.reclassification = (row.reclassification || 0) - netReclassification;
      row.finalBalance =
        (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

      if (row.reclassificationRefs) {
        row.reclassificationRefs = row.reclassificationRefs.filter(
          (ref) => ref !== reclassification._id.toString()
        );
      }

      etb.rows[rowIndex] = row;
    }

    etb.markModified("rows");
    await etb.save({ session });

    reclassification.status = "draft";
    await reclassification.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        reclassification,
        etbSummary: {
          totalRows: etb.rows.length,
          updatedRows: reclassification.entries.length,
        },
      },
      message: "Reclassification unposted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error unposting reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to unpost reclassification",
    });
  }
};

/**
 * Delete a reclassification
 * If posted, reverses its ETB impact before deleting
 * DELETE /api/reclassifications/:id
 */
exports.deleteReclassification = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const reclassification = await Reclassification.findById(id).session(session);

    if (!reclassification) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Reclassification not found",
      });
    }

    console.log(`Deleting reclassification ${id} with status: ${reclassification.status}`);

    if (reclassification.status === "posted") {
      console.log("Reversing ETB impact before deleting posted reclassification");

      const etb = await ExtendedTrialBalance.findById(reclassification.etbId).session(session);

      if (!etb) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Extended Trial Balance not found",
        });
      }

      for (const entry of reclassification.entries) {
        const rowIndex = etb.rows.findIndex(
          (row) =>
            row._id === entry.etbRowId ||
            row.id === entry.etbRowId ||
            row.code === entry.etbRowId
        );

        if (rowIndex === -1) {
          console.warn(
            `ETB row not found during reclassification delete. Looking for: ${entry.etbRowId}, Entry code: ${entry.code}`
          );
          continue;
        }

        const row = etb.rows[rowIndex];
        const netReclassification = (entry.dr || 0) - (entry.cr || 0);

        row.reclassification = (row.reclassification || 0) - netReclassification;
        row.finalBalance =
          (row.currentYear || 0) + (row.adjustments || 0) + (row.reclassification || 0);

        if (row.reclassificationRefs) {
          row.reclassificationRefs = row.reclassificationRefs.filter(
            (ref) => ref !== reclassification._id.toString()
          );
        }

        etb.rows[rowIndex] = row;
      }

      etb.markModified("rows");
      await etb.save({ session });

      console.log("ETB impact reversed successfully for reclassification");
    }

    await Reclassification.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: { id, wasPosted: reclassification.status === "posted" },
      message:
        reclassification.status === "posted"
          ? "Reclassification deleted and ETB impact reversed"
          : "Reclassification deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting reclassification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete reclassification",
    });
  }
};

/**
 * Get reclassifications by ETB ID
 * GET /api/reclassifications/etb/:etbId
 */
exports.getReclassificationsByETB = async (req, res) => {
  try {
    const { etbId } = req.params;

    const reclassifications = await Reclassification.find({ etbId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: reclassifications,
      message: "Reclassifications retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching reclassifications:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reclassifications",
    });
  }
};

