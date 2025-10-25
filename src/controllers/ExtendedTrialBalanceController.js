const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
const { Workbook } = require("../models/ExcelWorkbook");

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

    // Validate each row has required fields
    for (const row of rows) {
      if (!row.code || !row.accountName || row.finalBalance === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each row must have code, accountName, and finalBalance"
        });
      }
    }

    const etb = await ExtendedTrialBalance.findOneAndUpdate(
      { engagement: engagementId },
      { 
        engagement: engagementId,
        rows: rows,
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
