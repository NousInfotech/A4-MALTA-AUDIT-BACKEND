const MBR = require("../models/MBR");
const { MBRStatusEnum } = require("../models/MBR");
const EngagementLibrary = require("../models/EngagementLibrary");
const { supabase } = require("../config/supabase");
const mongoose = require("mongoose");

// Get MBR by engagement ID (auto-create if doesn't exist)
exports.getMBRByEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;

    // Validate engagementId
    if (!mongoose.Types.ObjectId.isValid(engagementId)) {
      return res.status(400).json({ message: "Invalid engagement ID" });
    }

    let mbr = await MBR.findOne({ engagementId })
      .populate("engagementId", "title clientId")
      .populate("document.fileId");

    // Auto-create MBR record if it doesn't exist (for existing engagements)
    if (!mbr) {
      const Engagement = require("../models/Engagement");
      const engagement = await Engagement.findById(engagementId);
      
      if (!engagement) {
        return res.status(404).json({ message: "Engagement not found" });
      }

      // Create MBR record with initial PENDING status
      mbr = await MBR.create({
        engagementId: engagement._id,
        document: {
          fileId: null,
          url: null,
          employeeId: null
        },
        currentStatus: MBRStatusEnum.PENDING,
        statusHistory: [{
          status: MBRStatusEnum.PENDING,
          createdAt: new Date(),
          employeeId: engagement.createdBy || "system"
        }]
      });

      // Populate after creation
      mbr = await MBR.findById(mbr._id)
        .populate("engagementId", "title clientId")
        .populate("document.fileId");
    }

    return res.json(mbr);
  } catch (err) {
    next(err);
  }
};

// Get MBR by ID
exports.getMBRById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const mbr = await MBR.findById(id)
      .populate("engagementId", "title clientId")
      .populate("document.fileId");

    if (!mbr) {
      return res.status(404).json({ message: "MBR not found" });
    }

    return res.json(mbr);
  } catch (err) {
    next(err);
  }
};

// Upload MBR document
exports.uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Find MBR record
    const mbr = await MBR.findById(id);
    if (!mbr) {
      return res.status(404).json({ message: "MBR not found" });
    }

    // Check if document upload is allowed (only at SUBMITTED or later)
    if (mbr.currentStatus === MBRStatusEnum.PENDING) {
      return res.status(400).json({
        message: "Document upload is only allowed at SUBMITTED status or later"
      });
    }

    const engagementId = mbr.engagementId;
    const category = "MBR Documents";
    const filePath = `${engagementId}/${category}/${file.originalname}`;

    // Upload to Supabase storage
    let { data: uploadData, error: uploadError } = await supabase.storage
      .from("engagement-documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
        cacheControl: "0",
      });

    if (uploadError) {
      // If file exists, remove and retry
      if (String(uploadError.message).toLowerCase().includes("exists")) {
        try {
          await supabase.storage.from("engagement-documents").remove([filePath]);
        } catch {}
        const retry = await supabase.storage
          .from("engagement-documents")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
            cacheControl: "0",
          });
        if (retry.error) throw retry.error;
        uploadData = retry.data;
      } else {
        throw uploadError;
      }
    }

    // Get public URL
    const { data: pub } = supabase.storage
      .from("engagement-documents")
      .getPublicUrl(uploadData.path);

    const versionedUrl = `${pub.publicUrl}?v=${Date.now()}`;

    // Create EngagementLibrary entry
    const libraryEntry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: versionedUrl,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileId: id, // Link to MBR record
    });

    // Update MBR document
    mbr.document.fileId = libraryEntry._id;
    mbr.document.url = versionedUrl;
    mbr.document.employeeId = employeeId;
    await mbr.save();

    return res.json({
      message: "MBR document uploaded successfully",
      mbr,
      libraryEntry
    });
  } catch (err) {
    next(err);
  }
};

// Update MBR status
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, employeeId, documentUrl, fileId } = req.body;

    // Validate required fields
    if (!status || !employeeId) {
      return res.status(400).json({
        message: "status and employeeId are required"
      });
    }

    // Validate status value
    if (!Object.values(MBRStatusEnum).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(MBRStatusEnum).join(", ")}`
      });
    }

    // Find MBR record
    const mbr = await MBR.findById(id);
    if (!mbr) {
      return res.status(404).json({ message: "MBR not found" });
    }

    // Validate status transition
    if (!MBR.isValidStatusTransition(mbr.currentStatus, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${mbr.currentStatus} to ${status}. Valid transitions: ${getValidTransitions(mbr.currentStatus).join(", ")}`
      });
    }

    // Update document if provided (only allowed at SUBMITTED or later)
    if (documentUrl || fileId) {
      if (mbr.currentStatus === MBRStatusEnum.PENDING) {
        return res.status(400).json({
          message: "Document upload is only allowed at SUBMITTED status or later"
        });
      }

      if (documentUrl) {
        mbr.document.url = documentUrl;
        mbr.document.employeeId = employeeId;
      }
      if (fileId) {
        mbr.document.fileId = fileId;
        mbr.document.employeeId = employeeId;
      }
    }

    // Add status to history
    mbr.addStatusHistory(status, employeeId);
    await mbr.save();

    return res.json({
      message: "MBR status updated successfully",
      mbr
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to get valid transitions for error messages
function getValidTransitions(currentStatus) {
  const validTransitions = {
    [MBRStatusEnum.PENDING]: [MBRStatusEnum.SUBMITTED],
    [MBRStatusEnum.SUBMITTED]: [MBRStatusEnum.APPROVED, MBRStatusEnum.REJECTED],
    [MBRStatusEnum.APPROVED]: [],
    [MBRStatusEnum.REJECTED]: []
  };
  return validTransitions[currentStatus] || [];
}

