const Tax = require("../models/Tax");
const { TaxStatusEnum } = require("../models/Tax");
const EngagementLibrary = require("../models/EngagementLibrary");
const { supabase } = require("../config/supabase");
const mongoose = require("mongoose");

// Get Tax by engagement ID (auto-create if doesn't exist)
exports.getTaxByEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;

    // Validate engagementId
    if (!mongoose.Types.ObjectId.isValid(engagementId)) {
      return res.status(400).json({ message: "Invalid engagement ID" });
    }

    let tax = await Tax.findOne({ engagementId })
      .populate("engagementId", "title clientId")
      .populate("document.fileId")
      .populate("draftDocument.fileId");

    // Auto-create Tax record if it doesn't exist (for existing engagements)
    if (!tax) {
      const Engagement = require("../models/Engagement");
      const engagement = await Engagement.findById(engagementId);
      
      if (!engagement) {
        return res.status(404).json({ message: "Engagement not found" });
      }

      // Create Tax record with initial PENDING status
      tax = await Tax.create({
        engagementId: engagement._id,
        document: {
          fileId: null,
          url: null,
          employeeId: null
        },
        draftDocument: {
          fileId: null,
          url: null,
          employeeId: null
        },
        currentStatus: TaxStatusEnum.PENDING,
        statusHistory: [{
          status: TaxStatusEnum.PENDING,
          createdAt: new Date(),
          employeeId: engagement.createdBy || "system"
        }]
      });

      // Populate after creation
      tax = await Tax.findById(tax._id)
        .populate("engagementId", "title clientId")
        .populate("document.fileId")
        .populate("draftDocument.fileId");
    }

    return res.json(tax);
  } catch (err) {
    next(err);
  }
};

// Get Tax by ID
exports.getTaxById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findById(id)
      .populate("engagementId", "title clientId")
      .populate("document.fileId")
      .populate("draftDocument.fileId");

    if (!tax) {
      return res.status(404).json({ message: "Tax not found" });
    }

    return res.json(tax);
  } catch (err) {
    next(err);
  }
};

// Upload Tax document (final document)
exports.uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Find Tax record
    const tax = await Tax.findById(id);
    if (!tax) {
      return res.status(404).json({ message: "Tax not found" });
    }

    // Check if document upload is allowed (only at SUBMITTED or later)
    if (tax.currentStatus === TaxStatusEnum.PENDING || tax.currentStatus === TaxStatusEnum.DRAFT) {
      return res.status(400).json({
        message: "Final document upload is only allowed at SUBMITTED status or later"
      });
    }

    const engagementId = tax.engagementId;
    const category = "Tax Documents";
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
      fileId: id, // Link to Tax record
    });

    // Update Tax document
    tax.document.fileId = libraryEntry._id;
    tax.document.url = versionedUrl;
    tax.document.employeeId = employeeId;
    await tax.save();

    return res.json({
      message: "Tax document uploaded successfully",
      tax,
      libraryEntry
    });
  } catch (err) {
    next(err);
  }
};

// Upload Tax draft document
exports.uploadDraftDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Find Tax record
    const tax = await Tax.findById(id);
    if (!tax) {
      return res.status(404).json({ message: "Tax not found" });
    }

    // Check if draft document upload is allowed (only at DRAFT status)
    if (tax.currentStatus !== TaxStatusEnum.DRAFT) {
      return res.status(400).json({
        message: "Draft document upload is only allowed at DRAFT status"
      });
    }

    const engagementId = tax.engagementId;
    const category = "Tax Documents";
    const filePath = `${engagementId}/${category}/draft_${file.originalname}`;

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
      fileName: `draft_${file.originalname}`,
      fileType: file.mimetype,
      fileId: id, // Link to Tax record
    });

    // Update Tax draftDocument
    tax.draftDocument.fileId = libraryEntry._id;
    tax.draftDocument.url = versionedUrl;
    tax.draftDocument.employeeId = employeeId;
    await tax.save();

    return res.json({
      message: "Tax draft document uploaded successfully",
      tax,
      libraryEntry
    });
  } catch (err) {
    next(err);
  }
};

// Update Tax status
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
    if (!Object.values(TaxStatusEnum).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(TaxStatusEnum).join(", ")}`
      });
    }

    // Find Tax record
    const tax = await Tax.findById(id);
    if (!tax) {
      return res.status(404).json({ message: "Tax not found" });
    }

    // Validate status transition
    if (!Tax.isValidStatusTransition(tax.currentStatus, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${tax.currentStatus} to ${status}. Valid transitions: ${getValidTransitions(tax.currentStatus).join(", ")}`
      });
    }

    // Handle document uploads based on status
    if (status === TaxStatusEnum.DRAFT) {
      // Only draftDocument can be uploaded in DRAFT status
      if (documentUrl || fileId) {
        if (documentUrl) {
          tax.draftDocument.url = documentUrl;
          tax.draftDocument.employeeId = employeeId;
        }
        if (fileId) {
          tax.draftDocument.fileId = fileId;
          tax.draftDocument.employeeId = employeeId;
        }
      }
    } else if (status === TaxStatusEnum.SUBMITTED || 
               status === TaxStatusEnum.APPROVED || 
               status === TaxStatusEnum.REJECTED) {
      // Final document upload is allowed only at SUBMITTED or later
      if (documentUrl || fileId) {
        if (documentUrl) {
          tax.document.url = documentUrl;
          tax.document.employeeId = employeeId;
        }
        if (fileId) {
          tax.document.fileId = fileId;
          tax.document.employeeId = employeeId;
        }
      }
    }

    // Add status to history
    tax.addStatusHistory(status, employeeId);
    await tax.save();

    return res.json({
      message: "Tax status updated successfully",
      tax
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to get valid transitions for error messages
function getValidTransitions(currentStatus) {
  const validTransitions = {
    [TaxStatusEnum.PENDING]: [TaxStatusEnum.DRAFT],
    [TaxStatusEnum.DRAFT]: [TaxStatusEnum.SUBMITTED],
    [TaxStatusEnum.SUBMITTED]: [TaxStatusEnum.APPROVED, TaxStatusEnum.REJECTED],
    [TaxStatusEnum.APPROVED]: [],
    [TaxStatusEnum.REJECTED]: []
  };
  return validTransitions[currentStatus] || [];
}

