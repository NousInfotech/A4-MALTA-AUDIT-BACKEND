const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const { Workbook } = require("../models/ExcelWorkbook");
const Adjustment = require("../models/Adjustment");
const Reclassification = require("../models/Reclassification");

// Get Extended Trial Balance with mappings for a specific engagement and classification
const getExtendedTrialBalanceWithMappings = async (req, res) => {
  try {
    const { id: engagementId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'
    const { classification } = req.query;

    console.log('Backend: getExtendedTrialBalanceWithMappings called with:', { engagementId, classification });

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required"
      });
    }

    // Build filter object
    const filter = { engagement: engagementId };
    
    // Add classification filter if provided
    if (classification) {
      filter["rows.classification"] = classification;
    }

    console.log('Backend: MongoDB filter:', filter);

    const etb = await ExtendedTrialBalance.findOne(filter)
      .populate({
        path: "rows.mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .lean();

    console.log('Backend: MongoDB query result:', etb ? 'Found ETB' : 'No ETB found');

    if (!etb) {
      // If no ETB found with classification filter, try without classification
      if (classification) {
        console.log('Backend: No ETB found with classification, trying without classification filter');
        const etbWithoutClassification = await ExtendedTrialBalance.findOne({ engagement: engagementId })
          .populate({
            path: "rows.mappings.workbookId",
            model: "Workbook",
            select: "name cloudFileId webUrl classification category"
          })
          .lean();
        
        if (etbWithoutClassification) {
          console.log('Backend: Found ETB without classification filter');
          return res.status(200).json({
            success: true,
            data: {
              ...etbWithoutClassification,
              rows: etbWithoutClassification.rows.filter(row => row.classification === classification)
            }
          });
        }
      }
      
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found for this engagement" + (classification ? ` and classification: ${classification}` : "")
      });
    }

    // If classification filter is applied, filter the rows in the response
    let filteredData = etb;
    if (classification) {
      filteredData = {
        ...etb,
        rows: etb.rows.filter(row => row.classification === classification)
      };
    }

    res.status(200).json({
      success: true,
      data: filteredData
    });
  } catch (error) {
    console.error("Backend: Error fetching Extended Trial Balance:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create or update Extended Trial Balance
const createOrUpdateExtendedTrialBalance = async (req, res) => {
  try {
    const { id: engagementId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'
    const { rows } = req.body;

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required"
      });
    }

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        message: "Rows array is required"
      });
    }

    // Check if ETB already exists (to determine if it's new or update)
    const existingEtb = await ExtendedTrialBalance.findOne({ engagement: engagementId });

    // Case 1: New trial balance - delete all existing adjustments and reclassifications
    if (!existingEtb) {
      console.log('Case 1: New trial balance detected, deleting all adjustments and reclassifications');
      
      // Delete all adjustments for this engagement
      const deletedAdjustments = await Adjustment.deleteMany({ engagementId: engagementId });
      console.log(`Deleted ${deletedAdjustments.deletedCount} adjustments`);

      // Delete all reclassifications for this engagement
      const deletedReclassifications = await Reclassification.deleteMany({ engagementId: engagementId });
      console.log(`Deleted ${deletedReclassifications.deletedCount} reclassifications`);
    }

    // Validate and clean each row
    const cleanedRows = rows.map((row) => {
      if (!row.code || !row.accountName) {
        throw new Error("Each row must have code and accountName");
      }

      // Parse and round all numeric values
      const currentYear = Math.round(Number(row.currentYear) || 0);
      const adjustments = Math.round(Number(row.adjustments) || 0);
      const reclassification = typeof row.reclassification === "string"
        ? Math.round(parseFloat(row.reclassification) || 0)
        : Math.round(Number(row.reclassification) || 0);
      
      // Compute finalBalance from formula: currentYear + adjustments + reclassification
      const computedFinal = currentYear + adjustments + reclassification; // All values already rounded
      const finalBalance = row.finalBalance !== undefined && row.finalBalance !== null
        ? Math.round(Number(row.finalBalance))
        : computedFinal; // Already rounded

      // Preserve adjustmentRefs and reclassificationRefs from existing row if updating
      let adjustmentRefs = row.adjustmentRefs || [];
      let reclassificationRefs = row.reclassificationRefs || [];
      
      if (existingEtb) {
        const rowId = (row._id || row.rowId)?.toString();
        if (rowId) {
          const existingRow = existingEtb.rows.find(r => r._id?.toString() === rowId);
          if (existingRow) {
            // Preserve references if not provided in new row
            if (!row.adjustmentRefs && existingRow.adjustmentRefs) {
              adjustmentRefs = existingRow.adjustmentRefs;
            }
            if (!row.reclassificationRefs && existingRow.reclassificationRefs) {
              reclassificationRefs = existingRow.reclassificationRefs;
            }
          }
        }
      }

      return {
        ...row,
        currentYear, // Rounded
        adjustments, // Rounded
        reclassification, // Rounded
        finalBalance, // Rounded
        priorYear: Math.round(Number(row.priorYear) || 0), // Rounded
        adjustmentRefs,
        reclassificationRefs,
      };
    });

    // Case 2: Check for code/accountName changes and update adjustments/reclassifications
    if (existingEtb) {
      console.log('Case 2: Checking for code/accountName changes');
      
      // Create a map of existing rows by rowId (_id) for quick lookup
      const existingRowsMap = new Map();
      existingEtb.rows.forEach(row => {
        if (row._id) {
          existingRowsMap.set(row._id.toString(), row);
        }
      });

      // Find rows with changed code or accountName
      const rowsWithChanges = [];
      cleanedRows.forEach(newRow => {
        // Try to find existing row by _id (rowId) if provided
        if (newRow._id || newRow.rowId) {
          const rowId = (newRow._id || newRow.rowId).toString();
          const existingRow = existingRowsMap.get(rowId);
          
          if (existingRow) {
            // Check if code or accountName changed
            if (existingRow.code !== newRow.code || existingRow.accountName !== newRow.accountName) {
              rowsWithChanges.push({
                rowId: rowId,
                oldCode: existingRow.code,
                oldAccountName: existingRow.accountName,
                newCode: newRow.code,
                newAccountName: newRow.accountName,
                adjustmentRefs: existingRow.adjustmentRefs || [],
                reclassificationRefs: existingRow.reclassificationRefs || []
              });
            }
          }
        } else {
          // If no rowId, try to match by code
          const existingRow = existingEtb.rows.find(r => r.code === newRow.code);
          if (existingRow && existingRow.accountName !== newRow.accountName) {
            const rowId = existingRow._id?.toString();
            if (rowId) {
              rowsWithChanges.push({
                rowId: rowId,
                oldCode: existingRow.code,
                oldAccountName: existingRow.accountName,
                newCode: newRow.code,
                newAccountName: newRow.accountName,
                adjustmentRefs: existingRow.adjustmentRefs || [],
                reclassificationRefs: existingRow.reclassificationRefs || []
              });
            }
          }
        }
      });

      // Update adjustments and reclassifications for changed rows
      for (const changedRow of rowsWithChanges) {
        console.log(`Updating references for row ${changedRow.rowId}: ${changedRow.oldCode} -> ${changedRow.newCode}`);

        // Update adjustments
        if (changedRow.adjustmentRefs && changedRow.adjustmentRefs.length > 0) {
          for (const adjustmentId of changedRow.adjustmentRefs) {
            const adjustment = await Adjustment.findById(adjustmentId);
            if (adjustment) {
              // Update entries that match this rowId
              let hasChanges = false;
              adjustment.entries.forEach(entry => {
                if (entry.etbRowId === changedRow.rowId) {
                  entry.code = changedRow.newCode;
                  entry.accountName = changedRow.newAccountName;
                  hasChanges = true;
                }
              });
              
              if (hasChanges) {
                await adjustment.save();
                console.log(`Updated adjustment ${adjustmentId}`);
              }
            }
          }
        }

        // Update reclassifications
        if (changedRow.reclassificationRefs && changedRow.reclassificationRefs.length > 0) {
          for (const reclassificationId of changedRow.reclassificationRefs) {
            const reclassification = await Reclassification.findById(reclassificationId);
            if (reclassification) {
              // Update entries that match this rowId
              let hasChanges = false;
              reclassification.entries.forEach(entry => {
                if (entry.etbRowId === changedRow.rowId) {
                  entry.code = changedRow.newCode;
                  entry.accountName = changedRow.newAccountName;
                  hasChanges = true;
                }
              });
              
              if (hasChanges) {
                await reclassification.save();
                console.log(`Updated reclassification ${reclassificationId}`);
              }
            }
          }
        }
      }
    }

    const etb = await ExtendedTrialBalance.findOneAndUpdate(
      { engagement: engagementId },
      { 
        engagement: engagementId,
        rows: cleanedRows,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    ).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    res.status(200).json({
      success: true,
      message: "Extended Trial Balance created/updated successfully",
      data: etb
    });
  } catch (error) {
    console.error("Error creating/updating Extended Trial Balance:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Add mapping to a specific ETB row
const addMappingToRow = async (req, res) => {
  try {
    const { id: engagementId, rowId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'
    const { workbookId, color, details } = req.body;

    // Debug: Log the received data
    console.log('Backend: Received request body:', req.body);
    console.log('Backend: Destructured fields:', { workbookId, color, details });

    if (!workbookId || !color || !details) {
      console.log('Backend: Missing required fields:', {
        workbookId: !!workbookId,
        color: !!color,
        details: !!details
      });
      return res.status(400).json({
        success: false,
        message: "workbookId, color, and details are required"
      });
    }

    // Verify workbook exists
    const workbook = await Workbook.findById(workbookId);
    if (!workbook) {
      return res.status(404).json({
        success: false,
        message: "Workbook not found"
      });
    }

    const newMapping = {
      workbookId,
      color,
      details,
      isActive: true
    };

    console.log('Backend: Looking for ETB with engagement:', engagementId, 'and rowId:', rowId);
    
    // First, let's check if the ETB exists
    const etbExists = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    console.log('Backend: ETB exists:', !!etbExists);
    if (etbExists) {
      console.log('Backend: ETB rows:', etbExists.rows.map(r => ({ _id: r._id, code: r.code, accountName: r.accountName })));
      
      // Check if the specific row exists
      const targetRow = etbExists.rows.find(r => r.code === rowId);
      console.log('Backend: Target row found:', !!targetRow);
      if (targetRow) {
        console.log('Backend: Target row details:', { code: targetRow.code, accountName: targetRow.accountName, mappings: targetRow.mappings?.length || 0 });
      }
    }

    const etb = await ExtendedTrialBalance.findOneAndUpdate(
      { 
        engagement: engagementId,
        "rows.code": rowId 
      },
      { 
        $push: { "rows.$.mappings": newMapping },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    console.log('Backend: Update result:', !!etb);
    if (etb) {
      console.log('Backend: Updated ETB rows count:', etb.rows.length);
      const updatedRow = etb.rows.find(r => r.code === rowId);
      if (updatedRow) {
        console.log('Backend: Updated row mappings count:', updatedRow.mappings?.length || 0);
      }
    }

    if (!etb) {
      console.log('Backend: ETB or row not found after update attempt');
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance or row not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping added successfully",
      data: etb
    });
  } catch (error) {
    console.error("Error adding mapping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Update a specific mapping
const updateMapping = async (req, res) => {
  try {
    const { id: engagementId, rowId, mappingId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.workbookId;

    // Find the ETB and update the specific mapping
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId });
    
    if (!etb) {
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance not found"
      });
    }

    // Find the specific row
    const row = etb.rows.find(r => r.code === rowId || r.code === rowId.toString());
    
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Row not found"
      });
    }

    // Find and update the mapping
    const mappingIndex = row.mappings.findIndex(m => m._id.toString() === mappingId);
    
    if (mappingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Mapping not found"
      });
    }

    // Update the mapping
    row.mappings[mappingIndex] = {
      ...row.mappings[mappingIndex].toObject(),
      ...updateData,
      _id: mappingId
    };
    
    etb.updatedAt = new Date();
    await etb.save();

    // Populate the workbook reference
    const populatedEtb = await ExtendedTrialBalance.findById(etb._id).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    res.status(200).json({
      success: true,
      message: "Mapping updated successfully",
      data: populatedEtb
    });
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Remove a mapping from a specific ETB row
const removeMappingFromRow = async (req, res) => {
  try {
    const { id: engagementId, rowId, mappingId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'

    const etb = await ExtendedTrialBalance.findOneAndUpdate(
      { 
        engagement: engagementId,
        "rows.code": rowId
      },
      { 
        $pull: { "rows.$.mappings": { _id: mappingId } },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    if (!etb) {
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance or row not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping removed successfully",
      data: etb
    });
  } catch (error) {
    console.error("Error removing mapping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get mappings for a specific workbook
const getMappingsByWorkbook = async (req, res) => {
  try {
    const { workbookId } = req.params;

    // ✅ CRITICAL: Validate workbookId before using it
    if (!workbookId || workbookId === 'undefined' || workbookId === 'null') {
      console.error('❌ Invalid workbookId in getMappingsByWorkbook:', workbookId);
      return res.status(400).json({
        success: false,
        error: 'Invalid workbookId provided'
      });
    }

    const etb = await ExtendedTrialBalance.find({
      "rows.mappings.workbookId": workbookId
    })
    .populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    })
    .lean();

    // Filter and format mappings for the specific workbook
    const workbookMappings = [];
    etb.forEach(etbDoc => {
      etbDoc.rows.forEach(row => {
        const relevantMappings = row.mappings.filter(mapping => 
          mapping.workbookId.toString() === workbookId
        );
        relevantMappings.forEach(mapping => {
          workbookMappings.push({
            etbId: etbDoc._id,
            engagementId: etbDoc.engagement,
            rowId: row._id,
            rowCode: row.code,
            rowAccountName: row.accountName,
            mapping: mapping
          });
        });
      });
    });

    res.status(200).json({
      success: true,
      data: workbookMappings
    });
  } catch (error) {
    console.error("Error fetching mappings by workbook:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Toggle mapping active status
const toggleMappingStatus = async (req, res) => {
  try {
    const { id: engagementId, rowId, mappingId } = req.params; // Fix: get 'id' parameter and rename to 'engagementId'
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value"
      });
    }

    const etb = await ExtendedTrialBalance.findOneAndUpdate(
      { 
        engagement: engagementId,
        "rows._id": rowId,
        "rows.mappings._id": mappingId
      },
      { 
        $set: { 
          "rows.$.mappings.$.isActive": isActive,
          updatedAt: new Date()
        }
      },
      { new: true }
    ).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    if (!etb) {
      return res.status(404).json({
        success: false,
        message: "Extended Trial Balance, row, or mapping not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Mapping ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: etb
    });
  } catch (error) {
    console.error("Error toggling mapping status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  getExtendedTrialBalanceWithMappings,
  createOrUpdateExtendedTrialBalance,
  addMappingToRow,
  updateMapping,
  removeMappingFromRow,
  getMappingsByWorkbook,
  toggleMappingStatus
};
