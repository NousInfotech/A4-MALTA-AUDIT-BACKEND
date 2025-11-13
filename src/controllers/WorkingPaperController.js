const WorkingPaper = require("../models/WorkingPaper");
const { Workbook } = require("../models/ExcelWorkbook");

// Get Working Paper with mappings for a specific engagement and classification
const getWorkingPaperWithMappings = async (req, res) => {
  try {
    const { engagementId, classification } = req.params;

    console.log('Backend: getWorkingPaperWithMappings called with:', { engagementId, classification });

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required"
      });
    }

    if (!classification) {
      return res.status(400).json({
        success: false,
        message: "Classification is required"
      });
    }

    // Build filter object
    const filter = { 
      engagement: engagementId,
      classification: classification
    };

    console.log('Backend: MongoDB filter:', filter);

    const workingPaper = await WorkingPaper.findOne(filter)
      .populate({
        path: "rows.mappings.workbookId",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category"
      })
      .populate({
        path: "rows.linkedExcelFiles",
        model: "Workbook",
        select: "name cloudFileId webUrl classification category uploadedDate lastModifiedDate"
      })
      .lean();

    console.log('Backend: MongoDB query result:', workingPaper ? 'Found WorkingPaper' : 'No WorkingPaper found');
    
    if (workingPaper) {
      console.log('Backend: WorkingPaper linkedExcelFiles:', {
        totalRows: workingPaper.rows?.length || 0,
        rowsWithLinkedFiles: workingPaper.rows?.filter(r => r.linkedExcelFiles?.length > 0).length || 0,
        detailedRows: workingPaper.rows?.map(r => ({
          code: r.code,
          linkedCount: r.linkedExcelFiles?.length || 0,
          linkedFiles: r.linkedExcelFiles?.map(f => f.name || f._id)
        }))
      });
    }

    if (!workingPaper) {
      // Auto-create Working Paper from ETB data if it doesn't exist
      console.log('Backend: No Working Paper found, attempting to create from ETB data');
      
      const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");
      
      // Fetch ETB data for this engagement and classification
      const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
        .lean();
      
      if (!etb) {
        return res.status(404).json({
          success: false,
          message: `No ETB data found for engagement: ${engagementId}`
        });
      }
      
      // Filter rows by classification
      const filteredRows = etb.rows.filter(row => 
        row.classification === classification || 
        row.classification?.startsWith(classification + ' >')
      );
      
      if (filteredRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No rows found for classification: ${classification}`
        });
      }
      
      // Create new Working Paper with ETB rows
      const newWorkingPaper = new WorkingPaper({
        engagement: engagementId,
        classification: classification,
        rows: filteredRows.map(row => ({
          code: row.code,
          accountName: row.accountName,
          currentYear: row.currentYear,
          priorYear: row.priorYear,
          adjustments: row.adjustments,
          finalBalance: row.finalBalance,
          classification: row.classification,
          reference: row.reference,
          referenceData: row.referenceData,
          linkedExcelFiles: [], // Start with empty linked files
          mappings: [] // Start with empty mappings
        }))
      });
      
      await newWorkingPaper.save();
      console.log('Backend: Created new Working Paper from ETB data');
      
      return res.status(201).json({
        success: true,
        data: newWorkingPaper
      });
    }

    res.status(200).json({
      success: true,
      data: workingPaper
    });
  } catch (error) {
    console.error("Backend: Error fetching Working Paper:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create or update Working Paper
const createOrUpdateWorkingPaper = async (req, res) => {
  try {
    const { id: engagementId } = req.params;
    const { classification, rows } = req.body;

    if (!engagementId) {
      return res.status(400).json({
        success: false,
        message: "Engagement ID is required"
      });
    }

    if (!classification) {
      return res.status(400).json({
        success: false,
        message: "Classification is required"
      });
    }

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        message: "Rows array is required"
      });
    }

    // Validate and clean each row
    const cleanedRows = rows.map((row) => {
      if (!row.code && !row.accountName) {
        throw new Error("Each row must have code or accountName");
      }

      const currentYear = Number(row.currentYear) || 0;
      const adjustments = Number(row.adjustments) || 0;
      
      // Compute finalBalance from formula: currentYear + adjustments
      const computedFinal = currentYear + adjustments;
      const finalBalance = row.finalBalance !== undefined && row.finalBalance !== null
        ? Number(row.finalBalance)
        : computedFinal;

      return {
        ...row,
        currentYear,
        adjustments,
        finalBalance,
        priorYear: Number(row.priorYear) || 0,
      };
    });

    const workingPaper = await WorkingPaper.findOneAndUpdate(
      { 
        engagement: engagementId,
        classification: classification
      },
      { 
        engagement: engagementId,
        classification: classification,
        rows: cleanedRows
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
      message: "Working Paper created/updated successfully",
      data: workingPaper
    });
  } catch (error) {
    console.error("Error creating/updating Working Paper:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Add mapping to a specific Working Paper row
const addMappingToRow = async (req, res) => {
  try {
    const { id: engagementId, classification, rowId } = req.params;
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

    console.log('Backend: Looking for WorkingPaper with engagement:', engagementId, 'classification:', classification, 'and rowId:', rowId);
    
    // First, let's check if the Working Paper exists
    const wpExists = await WorkingPaper.findOne({ 
      engagement: engagementId,
      classification: classification
    });
    console.log('Backend: WorkingPaper exists:', !!wpExists);
    if (wpExists) {
      console.log('Backend: WorkingPaper rows:', wpExists.rows.map(r => ({ id: r.id, code: r.code, accountName: r.accountName })));
      
      // Check if the specific row exists
      const targetRow = wpExists.rows.find(r => r.id === rowId || r.code === rowId);
      console.log('Backend: Target row found:', !!targetRow);
      if (targetRow) {
        console.log('Backend: Target row details:', { id: targetRow.id, code: targetRow.code, accountName: targetRow.accountName, mappings: targetRow.mappings?.length || 0 });
      }
    }

    const workingPaper = await WorkingPaper.findOneAndUpdate(
      { 
        engagement: engagementId,
        classification: classification,
        $or: [
          { "rows.id": rowId },
          { "rows.code": rowId }
        ]
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

    console.log('Backend: Update result:', !!workingPaper);
    if (workingPaper) {
      console.log('Backend: Updated WorkingPaper rows count:', workingPaper.rows.length);
      const updatedRow = workingPaper.rows.find(r => r.id === rowId || r.code === rowId);
      if (updatedRow) {
        console.log('Backend: Updated row mappings count:', updatedRow.mappings?.length || 0);
      }
    }

    if (!workingPaper) {
      console.log('Backend: WorkingPaper or row not found after update attempt');
      return res.status(404).json({
        success: false,
        message: "Working Paper or row not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping added successfully",
      data: workingPaper
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
    const { id: engagementId, classification, rowId, mappingId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.workbookId;

    // Find the Working Paper and update the specific mapping
    const workingPaper = await WorkingPaper.findOne({ 
      engagement: engagementId,
      classification: classification
    });
    
    if (!workingPaper) {
      return res.status(404).json({
        success: false,
        message: "Working Paper not found"
      });
    }

    // Find the specific row
    const row = workingPaper.rows.find(r => r.id === rowId || r.code === rowId || r.code === rowId.toString());
    
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
    
    workingPaper.updatedAt = new Date();
    await workingPaper.save();

    // Populate the workbook reference
    const populatedWP = await WorkingPaper.findById(workingPaper._id).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    res.status(200).json({
      success: true,
      message: "Mapping updated successfully",
      data: populatedWP
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

// Remove a mapping from a specific Working Paper row
const removeMappingFromRow = async (req, res) => {
  try {
    const { id: engagementId, classification, rowId, mappingId } = req.params;

    const workingPaper = await WorkingPaper.findOneAndUpdate(
      { 
        engagement: engagementId,
        classification: classification,
        $or: [
          { "rows.id": rowId },
          { "rows.code": rowId }
        ]
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

    if (!workingPaper) {
      return res.status(404).json({
        success: false,
        message: "Working Paper or row not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mapping removed successfully",
      data: workingPaper
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

// Get mappings for a specific workbook from all Working Papers
const getMappingsByWorkbook = async (req, res) => {
  try {
    const { workbookId } = req.params;

    const workingPapers = await WorkingPaper.find({
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
    workingPapers.forEach(wpDoc => {
      wpDoc.rows.forEach(row => {
        const relevantMappings = row.mappings.filter(mapping => 
          mapping.workbookId.toString() === workbookId
        );
        relevantMappings.forEach(mapping => {
          workbookMappings.push({
            workingPaperId: wpDoc._id,
            engagementId: wpDoc.engagement,
            classification: wpDoc.classification,
            rowId: row.id || row.code,
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
    const { id: engagementId, classification, rowId, mappingId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value"
      });
    }

    // Find the Working Paper
    const workingPaper = await WorkingPaper.findOne({ 
      engagement: engagementId,
      classification: classification
    });

    if (!workingPaper) {
      return res.status(404).json({
        success: false,
        message: "Working Paper not found"
      });
    }

    // Find the row
    const row = workingPaper.rows.find(r => r.id === rowId || r.code === rowId);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Row not found"
      });
    }

    // Find and update the mapping
    const mapping = row.mappings.find(m => m._id.toString() === mappingId);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: "Mapping not found"
      });
    }

    mapping.isActive = isActive;
    workingPaper.updatedAt = new Date();
    await workingPaper.save();

    // Populate the workbook reference
    const populatedWP = await WorkingPaper.findById(workingPaper._id).populate({
      path: "rows.mappings.workbookId",
      model: "Workbook",
      select: "name cloudFileId webUrl classification category"
    });

    res.status(200).json({
      success: true,
      message: `Mapping ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: populatedWP
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

// Update linkedExcelFiles array for a specific row
const updateLinkedExcelFiles = async (req, res) => {
  try {
    const { engagementId, classification, rowCode } = req.params;
    const { linkedExcelFiles } = req.body;

    console.log('Backend: 🔄 updateLinkedExcelFiles called with:', { 
      engagementId, 
      classification, 
      rowCode, 
      linkedExcelFiles,
      linkedExcelFilesType: typeof linkedExcelFiles,
      linkedExcelFilesIsArray: Array.isArray(linkedExcelFiles),
      linkedExcelFilesLength: linkedExcelFiles?.length
    });

    const workingPaper = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: classification
    });

    if (!workingPaper) {
      return res.status(404).json({
        success: false,
        message: "Working Paper not found"
      });
    }

    const row = workingPaper.rows.find(r => r.code === rowCode);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: `Row ${rowCode} not found`
      });
    }

    console.log('Backend: Before save - row linkedExcelFiles:', row.linkedExcelFiles);
    row.linkedExcelFiles = linkedExcelFiles;
    console.log('Backend: After assignment - row linkedExcelFiles:', row.linkedExcelFiles);
    
    await workingPaper.save();
    console.log('Backend: ✅ Working Paper saved to database');

    const populatedWP = await WorkingPaper.findById(workingPaper._id)
      .populate({
        path: "rows.linkedExcelFiles",
        model: "Workbook",
        select: "name cloudFileId webUrl uploadedDate classification category"
      })
      .lean();

    console.log('Backend: After populate - linkedExcelFiles:', {
      rowCode,
      linkedCount: populatedWP.rows.find(r => r.code === rowCode)?.linkedExcelFiles?.length || 0
    });

    res.status(200).json({
      success: true,
      message: "Linked files updated successfully",
      data: populatedWP
    });
  } catch (error) {
    console.error("Error updating linked files:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Remove a workbook from linkedExcelFiles array
const deleteWorkbookFromLinkedFiles = async (req, res) => {
  try {
    const { engagementId, classification, rowCode, workbookId } = req.params;

    console.log('Backend: deleteWorkbookFromLinkedFiles called with:', { 
      engagementId, 
      classification, 
      rowCode, 
      workbookId 
    });

    const workingPaper = await WorkingPaper.findOne({
      engagement: engagementId,
      classification: classification
    });

    if (!workingPaper) {
      return res.status(404).json({
        success: false,
        message: "Working Paper not found"
      });
    }

    const row = workingPaper.rows.find(r => r.code === rowCode);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: `Row ${rowCode} not found`
      });
    }

    row.linkedExcelFiles = row.linkedExcelFiles.filter(
      id => id.toString() !== workbookId
    );
    await workingPaper.save();

    const populatedWP = await WorkingPaper.findById(workingPaper._id)
      .populate({
        path: "rows.linkedExcelFiles",
        model: "Workbook",
        select: "name cloudFileId webUrl uploadedDate classification category"
      })
      .lean();

    res.status(200).json({
      success: true,
      message: "Workbook removed from linked files successfully",
      data: populatedWP
    });
  } catch (error) {
    console.error("Error removing workbook from linked files:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  getOrCreateWorkingPaper: getWorkingPaperWithMappings, // Alias for routes compatibility
  getWorkingPaperWithMappings,
  createOrUpdateWorkingPaper,
  addMappingToRow,
  updateMapping,
  removeMapping: removeMappingFromRow, // Alias for routes compatibility
  removeMappingFromRow,
  getMappingsByWorkbook,
  toggleMappingStatus,
  updateLinkedExcelFiles,
  deleteWorkbookFromLinkedFiles
};

