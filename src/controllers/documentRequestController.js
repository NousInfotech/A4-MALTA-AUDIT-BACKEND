const DocumentRequest = require("../models/DocumentRequest");
const EngagementLibrary = require("../models/EngagementLibrary");
const ClassificationEvidence = require("../models/ClassificationEvidence");
const ClassificationSection = require("../models/ClassificationSection");
const { supabase } = require("../config/supabase");

// Get user profile from Supabase
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('user_id', userId)
      .single();
    
    if (error || !profile) {
      throw new Error('Profile not found');
    }
    
    return profile;
  } catch (error) {
    throw new Error('Failed to fetch user profile');
  }
}

// Map document categories to classification names
function mapCategoryToClassification(category) {
  const categoryMapping = {
    'cash': 'Cash & Cash Equivalents',
    'receivables': 'Trade Receivables',
    'inventory': 'Inventory',
    'prepayments': 'Prepayments',
    'ppe': 'Property, Plant & Equipment',
    'payables': 'Trade Payables',
    'accruals': 'Accruals',
    'equity': 'Equity',
    'revenue': 'Revenue',
    'expenses': 'Expenses'
  };
  
  // Try exact match first
  if (categoryMapping[category.toLowerCase()]) {
    return categoryMapping[category.toLowerCase()];
  }
  
  // Try partial match
  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(categoryMapping)) {
    if (lowerCategory.includes(key) || key.includes(lowerCategory)) {
      return value;
    }
  }
  
  return null;
}

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
      const originalFilename = file.originalname;
      const ext = originalFilename.split(".").pop();
      const uniqueFilename = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 5)}.${ext}`;
      const path = `${dr.engagement.toString()}/${categoryFolder}${uniqueFilename}`;

      const { data: up, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(up.path);

      // For KYC documents, try to update existing pending document instead of adding new one
      if (dr.category === 'kyc') {
        // Find the first pending document to update
        const pendingDocIndex = dr.documents.findIndex(doc => doc.status === 'pending' && !doc.url);
        
        if (pendingDocIndex !== -1) {
          // Update existing pending document
          dr.documents[pendingDocIndex] = {
            ...dr.documents[pendingDocIndex],
            // Keep the original document name (like "Source of Wealth")
            // Store uploaded filename separately
            uploadedFileName: originalFilename,
            url: urlData.publicUrl,
            uploadedAt: new Date(),
            status: 'uploaded',
            comment: req.body.comment || ""
          };
        } else {
          // If no pending document found, add new one
          dr.documents.push({
            name: originalFilename,
            url: urlData.publicUrl,
            uploadedAt: new Date(),
            status: 'uploaded',
            comment: req.body.comment || ""
          });
        }
      } else {
        // For non-KYC documents, add new document (existing behavior)
        dr.documents.push({
          name: originalFilename,
          url: urlData.publicUrl,
          uploadedAt: new Date(),
          status: 'uploaded',
          comment: req.body.comment || ""
        });
      }

      // Add to library
      await EngagementLibrary.create({
        engagement: dr.engagement,
        category: dr.category,
        url: urlData.publicUrl,
      });

      // Also add to evidence if we can find a matching classification
      try {
        // Get user profile for evidence creation
        const userProfile = await getUserProfile(req.user.id);
        
        // Map document category to classification name
        const classificationName = mapCategoryToClassification(dr.category);
        
        if (classificationName) {
          // Try to find the classification
          const classification = await ClassificationSection.findOne({
            engagementId: dr.engagement,
            classification: classificationName
          });

          if (classification) {
            // Create evidence entry
            const evidence = new ClassificationEvidence({
              engagementId: dr.engagement,
              classificationId: classification._id,
              uploadedBy: {
                userId: req.user.id,
                name: userProfile.name,
                email: req.user.email || '',
                role: userProfile.role,
              },
              evidenceUrl: urlData.publicUrl,
              evidenceComments: [],
            });

            await evidence.save();
            console.log(`Document uploaded to both library and evidence for classification: ${classification.classification}`);
          } else {
            console.log(`Classification '${classificationName}' not found for engagement: ${dr.engagement}`);
          }
        } else {
          console.log(`No mapping found for document category: ${dr.category}`);
        }
      } catch (evidenceError) {
        console.error('Error creating evidence entry:', evidenceError);
        // Don't fail the upload if evidence creation fails
      }
    }

    if (req.body.markCompleted === "true") {
      dr.status = "completed";
      dr.completedAt = new Date();
    }

    await dr.save();

    // Update KYC status if this is a KYC document request
    if (dr.category === 'kyc') {
      try {
        const KYC = require('../models/KnowYourClient');
        const kyc = await KYC.findOne({ documentRequests: dr._id });
        if (kyc) {
          // Update KYC status to 'submitted' when documents are uploaded
          kyc.status = 'submitted';
          await kyc.save();
        }
      } catch (kycError) {
        console.error('Error updating KYC status:', kycError);
        // Don't fail the upload if KYC update fails
      }
    }

    return res.json({
      success: true,
      message: `${req.files.length} document(s) uploaded successfully and added to both library and evidence`,
      documentRequest: dr
    });
  } catch (err) {
    next(err);
  }
};

exports.createRequest = async (req, res, next) => {
  try {
    const { engagementId, category, name, description, comment, documents, attachment } = req.body;
    
    // Validate that all documents have required fields
    if (documents && Array.isArray(documents)) {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (!doc.name) {
          return res.status(400).json({ 
            message: `Document at index ${i} is missing required 'name' field` 
          });
        }
      }
    }
    
    // Handle file upload if attachment is provided
    let attachmentData = null;
    if (attachment && attachment.file) {
      try {
        // Upload file to Supabase
        const fileBuffer = Buffer.from(attachment.file, 'base64');
        const fileName = `${Date.now()}-${attachment.name}`;
        const filePath = `document-requests/attachments/${fileName}`;
        
        const { data, error } = await supabase.storage
          .from('audit-documents')
          .upload(filePath, fileBuffer, {
            contentType: attachment.type,
            upsert: false
          });
        
        if (error) {
          throw new Error(`File upload failed: ${error.message}`);
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('audit-documents')
          .getPublicUrl(filePath);
        
        attachmentData = {
          name: attachment.name,
          url: urlData.publicUrl,
          size: attachment.size,
          type: attachment.type,
          uploadedAt: new Date()
        };
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload attachment',
          error: uploadError.message
        });
      }
    }
    
    const dr = await DocumentRequest.create({
      engagement: engagementId,
      clientId: req.body.clientId || req.user.id,
      name: name || `${category} Request - ${new Date().toLocaleDateString()}`,
      category,
      description,
      comment: comment || "",
      documents,
      attachment: attachmentData
    });
    
    return res.status(201).json({
      success: true,
      message: 'Document request created successfully',
      documentRequest: dr
    });
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

    // Use the original filename for display, but generate a unique filename for storage
    const originalFilename = file.originalname;
    const ext = originalFilename.split(".").pop();
    const uniqueFilename = `${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}.${ext}`;
    const path = `${dr.engagement.toString()}/${categoryFolder}${uniqueFilename}`;

    const { data: up, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(up.path);

    // For KYC documents, try to update existing pending document instead of adding new one
    if (dr.category === 'kyc') {
      // Find the first pending document to update
      const pendingDocIndex = dr.documents.findIndex(doc => doc.status === 'pending' && !doc.url);
      
      if (pendingDocIndex !== -1) {
        // Update existing pending document
        dr.documents[pendingDocIndex] = {
          ...dr.documents[pendingDocIndex],
          // Keep the original document name (like "Source of Wealth")
          // Store uploaded filename separately
          uploadedFileName: originalFilename,
          url: urlData.publicUrl,
          uploadedAt: new Date(),
          status: 'uploaded'
        };
      } else {
        // If no pending document found, add new one
        const newDocument = {
          name: originalFilename,
          url: urlData.publicUrl,
          uploadedAt: new Date(),
          status: 'uploaded'
        };
        dr.documents.push(newDocument);
      }
    } else {
      // For non-KYC documents, add new document (existing behavior)
      const newDocument = {
        name: originalFilename,
        url: urlData.publicUrl,
        uploadedAt: new Date(),
        status: 'uploaded'
      };
      dr.documents.push(newDocument);
    }

    await EngagementLibrary.create({
      engagement: dr.engagement,
      category: dr.category,
      url: urlData.publicUrl,
    });

    await dr.save();

    // Update KYC status if this is a KYC document request
    if (dr.category === 'kyc') {
      try {
        const KYC = require('../models/KnowYourClient');
        const kyc = await KYC.findOne({ documentRequests: dr._id });
        if (kyc) {
          // Update KYC status to 'submitted' when documents are uploaded
          kyc.status = 'submitted';
          await kyc.save();
        }
      } catch (kycError) {
        console.error('Error updating KYC status:', kycError);
        // Don't fail the upload if KYC update fails
      }
    }

    // Find the uploaded document to return
    const uploadedDoc = dr.documents.find(doc => doc.url === urlData.publicUrl);
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: uploadedDoc,
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
