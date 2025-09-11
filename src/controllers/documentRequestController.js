const DocumentRequest = require("../models/DocumentRequest");
const EngagementLibrary = require("../models/EngagementLibrary");
const { supabase } = require("../config/supabase");

exports.uploadDocuments = async (req, res, next) => {
  try {
    const dr = await DocumentRequest.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: "Request not found" });
    if (dr.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bucket = "engagement-documents";
    const categoryFolder = `${dr.category}/`;

    for (const file of req.files) {
      const ext = file.originalname.split(".").pop();
      const filename = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 5)}.${ext}`;
      const path = `${dr.engagement.toString()}/${categoryFolder}${filename}`;

      const { data: up, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(up.path);

      dr.documents.push({
        name: file.originalname,
        url: urlData.publicUrl,
        uploadedAt: new Date(),
        status: 'uploaded' // Set initial status to uploaded
      });

      await EngagementLibrary.create({
        engagement: dr.engagement,
        category: dr.category,
        url: urlData.publicUrl,
      });
    }

    if (req.body.markCompleted === "true") {
      dr.status = "completed";
      dr.completedAt = new Date();
    }

    await dr.save();
    return res.json({
      success: true,
      message: `${req.files.length} document(s) uploaded successfully`,
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

exports.createRequest = async (req, res, next) => {
  try {
    const { engagementId, category, description,documents } = req.body;
    const dr = await DocumentRequest.create({
      engagement: engagementId,
      clientId: req.body.clientId || req.user.id,
      category,
      description,
      documents,
    });
    return res.status(201).json(dr);
  } catch (err) {
    next(err);
  }
};

exports.getRequestsByEngagement = async (req, res, next) => {
  try {
    const reqs = await DocumentRequest.find({
      engagement: req.params.engagementId,
    });
    return res.json(reqs);
  } catch (err) {
    next(err);
  }
};

exports.updateRequest = async (req, res, next) => {
  try {
    const updates = req.body;
    const dr = await DocumentRequest.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!dr) return res.status(404).json({ message: "Not found" });

    if (updates.status === "completed") {
      dr.completedAt = new Date();
      await dr.save();
    }

    return res.json({
      success: true,
      message: 'Document request updated successfully',
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

// Update individual document status
exports.updateDocumentStatus = async (req, res, next) => {
  try {
    const { id, documentIndex } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'uploaded', 'in-review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: pending, uploaded, in-review, approved, rejected' 
      });
    }

    const dr = await DocumentRequest.findById(id);
    if (!dr) return res.status(404).json({ message: "Document request not found" });

    if (documentIndex >= dr.documents.length) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update document status
    dr.documents[documentIndex].status = status;
    await dr.save();

    res.json({
      success: true,
      message: 'Document status updated successfully',
      document: dr.documents[documentIndex],
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update document statuses
exports.bulkUpdateDocumentStatuses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { updates } = req.body; // Array of { documentIndex, status }

    const validStatuses = ['pending', 'uploaded', 'in-review', 'approved', 'rejected'];
    
    // Validate all statuses first
    for (const update of updates) {
      if (!validStatuses.includes(update.status)) {
        return res.status(400).json({ 
          message: `Invalid status '${update.status}'. Must be one of: pending, uploaded, in-review, approved, rejected` 
        });
      }
    }

    const dr = await DocumentRequest.findById(id);
    if (!dr) return res.status(404).json({ message: "Document request not found" });

    let updatedCount = 0;
    for (const update of updates) {
      if (update.documentIndex < dr.documents.length) {
        dr.documents[update.documentIndex].status = update.status;
        updatedCount++;
      }
    }

    await dr.save();

    res.json({
      success: true,
      message: `${updatedCount} document status(es) updated successfully`,
      updatedCount,
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

// Upload single document
exports.uploadSingleDocument = async (req, res, next) => {
  try {
    const dr = await DocumentRequest.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: "Request not found" });
    if (dr.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const bucket = "engagement-documents";
    const categoryFolder = `${dr.category}/`;
    const file = req.file;

    const ext = file.originalname.split(".").pop();
    const filename = `${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}.${ext}`;
    const path = `${dr.engagement.toString()}/${categoryFolder}${filename}`;

    const { data: up, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(up.path);

    const newDocument = {
      name: file.originalname,
      url: urlData.publicUrl,
      uploadedAt: new Date(),
      status: 'uploaded'
    };

    dr.documents.push(newDocument);

    await EngagementLibrary.create({
      engagement: dr.engagement,
      category: dr.category,
      url: urlData.publicUrl,
    });

    await dr.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: newDocument,
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

// Get document request statistics
exports.getDocumentRequestStats = async (req, res, next) => {
  try {
    const { engagementId } = req.params;
    const { category } = req.query;

    let filter = { engagement: engagementId };
    if (category) filter.category = category;

    const stats = await DocumentRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          pendingRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalDocuments: {
            $sum: { $size: '$documents' }
          },
          uploadedDocuments: {
            $sum: {
              $size: {
                $filter: {
                  input: '$documents',
                  cond: { $eq: ['$$this.status', 'uploaded'] }
                }
              }
            }
          },
          inReviewDocuments: {
            $sum: {
              $size: {
                $filter: {
                  input: '$documents',
                  cond: { $eq: ['$$this.status', 'in-review'] }
                }
              }
            }
          },
          approvedDocuments: {
            $sum: {
              $size: {
                $filter: {
                  input: '$documents',
                  cond: { $eq: ['$$this.status', 'approved'] }
                }
              }
            }
          },
          rejectedDocuments: {
            $sum: {
              $size: {
                $filter: {
                  input: '$documents',
                  cond: { $eq: ['$$this.status', 'rejected'] }
                }
              }
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalRequests: 0,
        pendingRequests: 0,
        completedRequests: 0,
        totalDocuments: 0,
        uploadedDocuments: 0,
        inReviewDocuments: 0,
        approvedDocuments: 0,
        rejectedDocuments: 0
      }
    });
  } catch (err) {
    next(err);
  }
};
