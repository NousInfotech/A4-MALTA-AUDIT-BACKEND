const DocumentRequest = require("../models/DocumentRequest");
const Engagement = require("../models/Engagement");
const Company = require("../models/Company");
const EngagementLibrary = require("../models/EngagementLibrary");
const ClassificationEvidence = require("../models/ClassificationEvidence");
const ClassificationSection = require("../models/ClassificationSection");
const ChecklistItem = require("../models/ChecklistItem");
const { supabase } = require("../config/supabase");
const { notifyDocumentRequested } = require("../utils/notificationTriggers");
const EmailService = require("../services/email.service");
const archiver = require('archiver');
const axios = require('axios');

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
    const isClient = req.user?.role === 'client';
    if (isClient && dr.clientId !== req.user.id) {
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
      
      // Determine the root folder (Engagement ID or Company ID)
      const contextId = dr.engagement ? dr.engagement.toString() : (dr.company ? dr.company.toString() : 'unknown');
      const path = `${contextId}/${categoryFolder}${uniqueFilename}`;

      const { data: up, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, { 
          cacheControl: "3600", 
          upsert: false,
          contentType: file.mimetype 
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(up.path);

      // For KYC documents, try to update existing pending document instead of adding new one
      if (dr.category === 'kyc') {
        // Check if we have a specific document index from the frontend
        const documentIndex = req.body.documentIndex ? parseInt(req.body.documentIndex) : null;
        const documentName = req.body.documentName || originalFilename;
        
        if (documentIndex !== null && documentIndex >= 0 && documentIndex < dr.documents.length) {
          // Update specific document by index
          const existingDoc = dr.documents[documentIndex];
          dr.documents[documentIndex] = {
            ...existingDoc,
            name: documentName, // Ensure name is always set
            uploadedFileName: originalFilename,
            url: urlData.publicUrl,
            uploadedAt: new Date(),
            status: 'uploaded',
            comment: req.body.comment || ""
          };
        } else {
          // Find the first pending document to update
          const pendingDocIndex = dr.documents.findIndex(doc => doc.status === 'pending' && !doc.url);
          
          if (pendingDocIndex !== -1) {
            // Update existing pending document
            const existingDoc = dr.documents[pendingDocIndex];
            dr.documents[pendingDocIndex] = {
              ...existingDoc,
              name: existingDoc.name || documentName, // Ensure name is always set
              uploadedFileName: originalFilename,
              url: urlData.publicUrl,
              uploadedAt: new Date(),
              status: 'uploaded',
              comment: req.body.comment || ""
            };
          } else {
            // If no pending document found, add new one
            dr.documents.push({
              name: documentName,
              uploadedFileName: originalFilename,
              url: urlData.publicUrl,
              uploadedAt: new Date(),
              status: 'uploaded',
              comment: req.body.comment || ""
            });
          }
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

      // Add to library (only if associated with an engagement)
      if (dr.engagement) {
        await EngagementLibrary.create({
          engagement: dr.engagement,
          category: dr.category,
          url: urlData.publicUrl,
        });
      }

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

    // Update checklist items linked to this document request
    try {
      // Find checklist items linked to this document request
      const checklistItems = await ChecklistItem.find({
        engagement: dr.engagement,
        documentRequestId: dr._id
      });
      
      // Update checklist items: mark as requested and uploaded
      for (const item of checklistItems) {
        item.isRequested = true;
        item.isUploaded = true;
        // If all documents are uploaded, mark checklist item as completed
        const allDocsUploaded = dr.documents.every(doc => doc.status === 'uploaded' || doc.status === 'approved');
        if (allDocsUploaded && dr.documents.length > 0) {
          item.completed = true;
        }
        await item.save();
      }
      
      // Also try to find checklist items by document name/category mapping
      if (checklistItems.length === 0 && dr.engagement) {
        // Map document names to checklist keys
        const documentToChecklistMap = {
          'Professional Clearance Letter': 'prof-clearance-letter',
          'Removal of Auditor': 'removal-auditor',
          'professional clearance': 'prof-clearance-letter',
          'removal of auditor': 'removal-auditor'
        };
        
        // Check if any document name matches a checklist item
        for (const doc of dr.documents) {
          const docName = doc.name?.toLowerCase() || '';
          for (const [key, checklistKey] of Object.entries(documentToChecklistMap)) {
            if (docName.includes(key.toLowerCase()) || dr.category.toLowerCase().includes('kyc')) {
              const checklistItem = await ChecklistItem.findOne({
                engagement: dr.engagement,
                key: checklistKey
              });
              
              if (checklistItem) {
                checklistItem.documentRequestId = dr._id;
                checklistItem.isRequested = true;
                checklistItem.isUploaded = true;
                checklistItem.completed = true;
                await checklistItem.save();
                break;
              }
            }
          }
        }
      }
    } catch (checklistError) {
      console.error('Error updating checklist items:', checklistError);
      // Don't fail the upload if checklist update fails
    }

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
    const { engagementId, category, name, description, comment, documents, multipleDocuments, attachment, notificationEmails } = req.body;
    
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
    
    // Validate that all multiple documents have required fields
    if (multipleDocuments && Array.isArray(multipleDocuments)) {
      for (let i = 0; i < multipleDocuments.length; i++) {
        const multiDoc = multipleDocuments[i];
        if (!multiDoc.name) {
          return res.status(400).json({ 
            message: `Multiple document at index ${i} is missing required 'name' field` 
          });
        }
        if (!multiDoc.multiple || !Array.isArray(multiDoc.multiple) || multiDoc.multiple.length === 0) {
          return res.status(400).json({ 
            message: `Multiple document at index ${i} is missing required 'multiple' array with at least one item` 
          });
        }
        // Validate each item in the multiple array
        for (let j = 0; j < multiDoc.multiple.length; j++) {
          const item = multiDoc.multiple[j];
          if (!item.label) {
            return res.status(400).json({ 
              message: `Multiple document at index ${i}, item at index ${j} is missing required 'label' field` 
            });
          }
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
    
    const clientId = req.body.clientId || req.user.id;
    
    const dr = await DocumentRequest.create({
      engagement: engagementId,
      clientId: clientId,
      name: name || `${category} Request - ${new Date().toLocaleDateString()}`,
      category,
      description,
      comment: comment || "",
      documents: documents || [],
      multipleDocuments: multipleDocuments || [],
      attachment: attachmentData,
      notificationEmails: notificationEmails || []
    });

    // Link checklist items with document request for KYC documents
    try {
      if (category === 'kyc' && engagementId) {
        const documentToChecklistMap = {
          'Professional Clearance Letter': 'prof-clearance-letter',
          'Removal of Auditor': 'removal-auditor',
          'professional clearance': 'prof-clearance-letter',
          'removal of auditor': 'removal-auditor'
        };
        
        // Check if any document name matches a checklist item
        const allDocNames = [
          ...(documents || []).map(d => d.name?.toLowerCase() || ''),
          ...(multipleDocuments || []).map(d => d.name?.toLowerCase() || ''),
          name?.toLowerCase() || '',
          description?.toLowerCase() || ''
        ];
        
        for (const [key, checklistKey] of Object.entries(documentToChecklistMap)) {
          if (allDocNames.some(docName => docName.includes(key.toLowerCase()))) {
            const checklistItem = await ChecklistItem.findOne({
              engagement: engagementId,
              key: checklistKey
            });
            
            if (checklistItem) {
              checklistItem.documentRequestId = dr._id;
              checklistItem.isRequested = true;
              await checklistItem.save();
            }
          }
        }
      }
    } catch (checklistError) {
      console.error('Error linking checklist items:', checklistError);
      // Don't fail the request creation if checklist linking fails
    }
    
    // Send notification to client when auditor/admin creates document request
    try {
      // Only notify if:
      // 1. The requester is an auditor (employee) or admin
      // 2. The clientId is different from the requester (to avoid self-notification)
      const isAuditorOrAdmin = req.user.role === 'employee' || req.user.role === 'admin';
      const isDifferentUser = clientId !== req.user.id;
      
      if (isAuditorOrAdmin && isDifferentUser) {
        // Get engagement details
        const engagement = await Engagement.findById(engagementId);
        const engagementTitle = engagement?.entityName || engagement?.title || 'Your engagement';
        
        // Get auditor/admin name
        const requesterProfile = await getUserProfile(req.user.id);
        const requesterName = requesterProfile?.name || (req.user.role === 'admin' ? 'Admin' : 'Auditor');
        
        // Get document names for notification message
        const documentNames = [];
        if (documents && documents.length > 0) {
          documentNames.push(...documents.map(doc => doc.name));
        }
        if (multipleDocuments && multipleDocuments.length > 0) {
          documentNames.push(...multipleDocuments.map(doc => doc.name));
        }
        const documentNamesStr = documentNames.length > 0 
          ? documentNames.join(', ')
          : name || `${category} documents`;
        
        // Send notification to client
        await notifyDocumentRequested(
          dr._id,
          clientId,  // Notify the client
          documentNamesStr,
          requesterName,
          category
        );
        
        console.log(`✅ Notification sent to client ${clientId} for document request ${dr._id}`);
        
        // Send email notifications to specified email addresses
        if (notificationEmails && Array.isArray(notificationEmails) && notificationEmails.length > 0) {
          try {
            const portalBaseUrl = process.env.PORTAL_URL || 'http://localhost:8080';
            const portalUrl = `${portalBaseUrl}/client/document-requests?id=${dr._id}`;
            
            // Get client email from Supabase
            let clientEmail = null;
            try {
              const { data: clientProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('user_id', clientId)
                .single();
              
              if (clientProfile && clientProfile.email) {
                clientEmail = clientProfile.email;
              }
            } catch (emailError) {
              console.log('Could not fetch client email:', emailError.message);
            }
            
            // Combine client email with notification emails (remove duplicates)
            const allEmails = [...new Set([...notificationEmails, clientEmail].filter(Boolean))];
            
            await EmailService.sendDocumentRequestEmail({
              to: allEmails,
              documentRequestName: dr.name,
              category: category,
              description: description,
              requesterName: requesterName,
              engagementTitle: engagementTitle,
              portalUrl: portalUrl
            });
            
            // Mark email as sent
            dr.emailNotificationSent = true;
            await dr.save();
            
            console.log(`📧 Email notifications sent to ${allEmails.length} recipient(s) for document request ${dr._id}`);
          } catch (emailError) {
            console.error('Failed to send email notifications:', emailError);
            // Don't fail the request if email fails
          }
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the request
      console.error('Failed to send document request notification:', notificationError);
    }
    
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

// Get requests by company
exports.getRequestsByCompany = async (req, res, next) => {
  try {
    const reqs = await DocumentRequest.find({
      company: req.params.companyId,
    });
    return res.json(reqs);
  } catch (err) {
    next(err);
  }
};

// Delete entire document request
exports.deleteRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Also remove reference from KYC workflow if it exists
    try {
      const KYC = require('../models/KnowYourClient');
      const kyc = await KYC.findOne({ "documentRequests.documentRequest": id });
      
      if (kyc) {
        // Remove the specific document request entry from the array
        await KYC.updateOne(
          { _id: kyc._id },
          { $pull: { documentRequests: { documentRequest: id } } }
        );
        console.log(`Removed document request ${id} from KYC ${kyc._id}`);
      }
    } catch (kycError) {
      console.error('Error cleaning up KYC reference:', kycError);
      // Continue with deletion even if cleanup fails to avoid blocking
    }

    await dr.deleteOne();

    return res.json({
      success: true,
      message: "Document request deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Add documents to an existing document request
exports.addDocumentsToRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documents, multipleDocuments } = req.body;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Check permissions - only employees/admins can add documents
    const isClient = req.user?.role === 'client';
    if (isClient && dr.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Add single documents
    if (documents && Array.isArray(documents) && documents.length > 0) {
      // Validate documents
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (!doc.name) {
          return res.status(400).json({ 
            message: `Document at index ${i} is missing required 'name' field` 
          });
        }
      }

      // Add documents to the request
      if (!dr.documents) {
        dr.documents = [];
      }
      dr.documents.push(...documents);
    }

    // Add multiple documents
    if (multipleDocuments && Array.isArray(multipleDocuments) && multipleDocuments.length > 0) {
      // Validate multiple documents
      for (let i = 0; i < multipleDocuments.length; i++) {
        const multiDoc = multipleDocuments[i];
        if (!multiDoc.name) {
          return res.status(400).json({ 
            message: `Multiple document at index ${i} is missing required 'name' field` 
          });
        }
        if (!multiDoc.multiple || !Array.isArray(multiDoc.multiple) || multiDoc.multiple.length === 0) {
          return res.status(400).json({ 
            message: `Multiple document at index ${i} must have at least one item in 'multiple' array` 
          });
        }
      }

      // Add multiple documents to the request
      if (!dr.multipleDocuments) {
        dr.multipleDocuments = [];
      }
      dr.multipleDocuments.push(...multipleDocuments);
    }

    // Save the updated document request
    await dr.save();

    // Send notification if documents were added by auditor/admin
    try {
      const isAuditorOrAdmin = req.user.role === 'employee' || req.user.role === 'admin';
      const isDifferentUser = dr.clientId !== req.user.id;
      
      if (isAuditorOrAdmin && isDifferentUser) {
        const documentNames = [];
        if (documents && documents.length > 0) {
          documentNames.push(...documents.map(doc => doc.name));
        }
        if (multipleDocuments && multipleDocuments.length > 0) {
          documentNames.push(...multipleDocuments.map(doc => doc.name));
        }
        
        if (documentNames.length > 0) {
          const engagement = await Engagement.findById(dr.engagement);
          const requesterProfile = await getUserProfile(req.user.id);
          const requesterName = requesterProfile?.name || (req.user.role === 'admin' ? 'Admin' : 'Auditor');
          
          await notifyDocumentRequested(
            dr._id,
            dr.clientId,
            documentNames.join(', '),
            requesterName,
            dr.category
          );
        }
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }

    return res.json({
      success: true,
      message: 'Documents added to request successfully',
      documentRequest: dr
    });
  } catch (err) {
    console.error('Error adding documents to request:', err);
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

    const isClient = req.user?.role === 'client';
    if (isClient && dr.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const bucket = "engagement-documents";
    const categoryFolder = `${dr.category}/`;
    const file = req.file;

    const originalFilename = file.originalname;
    const ext = originalFilename.split(".").pop();
    const uniqueFilename = `${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}.${ext}`;

    // Determine the root folder (Engagement ID or Company ID)
    const contextId = dr.engagement ? dr.engagement.toString() : (dr.company ? dr.company.toString() : 'unknown');
    const path = `${contextId}/${categoryFolder}${uniqueFilename}`;

    const { data: up, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.mimetype
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(up.path);

    const documentIndex = req.body.documentIndex
      ? parseInt(req.body.documentIndex)
      : null;

    const documentName = req.body.documentName || originalFilename;

    // Helper function that preserves template data
    const buildUpdatedDocument = (existingDoc) => ({
      ...existingDoc,
      name: existingDoc?.name || documentName,
      uploadedFileName: originalFilename,
      url: urlData.publicUrl,
      uploadedAt: new Date(),
      status: "uploaded",
      // Preserve template metadata
      type: existingDoc?.type || "direct",
      template: existingDoc?.template || (existingDoc?.type === "template" ? existingDoc.template : {})
    });

    // 1️⃣ If documentIndex provided → update that specific document
    if (
      documentIndex !== null &&
      !Number.isNaN(documentIndex) &&
      documentIndex >= 0 &&
      documentIndex < dr.documents.length
    ) {
      const existingDoc = dr.documents[documentIndex];
      dr.documents[documentIndex] = buildUpdatedDocument(existingDoc);
    } else {
      // 2️⃣ Find first pending document slot
      const pendingDocIndex = dr.documents.findIndex(
        (doc) => doc.status === "pending" && !doc.url
      );

      if (pendingDocIndex !== -1) {
        const existingDoc = dr.documents[pendingDocIndex];
        dr.documents[pendingDocIndex] = buildUpdatedDocument(existingDoc);
      } else {
        // 3️⃣ Try to find a template document with the same name
        const templateDocIndex = dr.documents.findIndex(
          (doc) => doc.name === documentName && doc.template && doc.template.url
        );

        if (templateDocIndex !== -1) {
          const existingDoc = dr.documents[templateDocIndex];
          dr.documents[templateDocIndex] = buildUpdatedDocument(existingDoc);
        } else {
          // 4️⃣ Final fallback → append new document
          // If a template exists with this name, reuse its metadata
          const templateLike = dr.documents.find(
            (doc) => doc.name === documentName && doc.template && doc.template.url
          );

          const newDocument = templateLike
            ? {
                ...templateLike,
                uploadedFileName: originalFilename,
                url: urlData.publicUrl,
                uploadedAt: new Date(),
                status: "uploaded",
              }
            : {
                name: documentName,
                type: "direct",
                template: {},
                uploadedFileName: originalFilename,
                url: urlData.publicUrl,
                uploadedAt: new Date(),
                status: "uploaded",
                comment: "",
              };

          dr.documents.push(newDocument);
        }
      }
    }

    if (dr.engagement) {
      await EngagementLibrary.create({
        engagement: dr.engagement,
        category: dr.category,
        url: urlData.publicUrl,
      });
    }

    await dr.save();

    // KYC status update if needed
    if (dr.category === 'kyc') {
      try {
        const KYC = require('../models/KnowYourClient');
        const kyc = await KYC.findOne({ documentRequests: dr._id });
        if (kyc) {
          kyc.status = 'submitted';
          await kyc.save();
        }
      } catch (kycError) {
        console.error('Error updating KYC status:', kycError);
      }
    }

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

exports.downloadAllDocuments = async (req, res, next) => {
  try {
    const { engagementId, companyId, documentRequestId, groupId } = req.query;

    let query = {};
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (documentRequestId) {
        query._id = documentRequestId;
    } else if (engagementId) {
      query.engagement = engagementId;
    } else if (companyId) {
      query.company = companyId;
    } else {
       return res.status(400).json({ message: "Engagement ID, Company ID, or Document Request ID required" });
    }

    const docRequests = await DocumentRequest.find(query);

    if (!docRequests || docRequests.length === 0) {
      return res.status(404).json({ message: "No documents found" });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    let zipName = 'documents.zip';

    
    if (groupId) {
       // If downloading a specific group, we'll try to find its name from the first docRequest that has it
       const requestWithGroup = docRequests.find(dr => dr.multipleDocuments.some(g => g._id.toString() === groupId));
       if (requestWithGroup) {
         const group = requestWithGroup.multipleDocuments.find(g => g._id.toString() === groupId);
         if (group) zipName = `${group.name || 'group'}_documents.zip`;
       }
    } else if (documentRequestId) {
        const dr = await DocumentRequest.findById(documentRequestId);
        if (dr) zipName = `${dr.name || 'request'}_documents.zip`;
    } else if (engagementId) {
      const engagement = await Engagement.findById(engagementId);
      if (engagement) zipName = `${engagement.title || 'engagement'}_documents.zip`;
    } else if (companyId) {
       const company = await Company.findById(companyId);
       if (company) zipName = `${company.name || 'company'}_documents.zip`;
    }

    // Sanitize filename
    zipName = zipName.replace(/[^a-zA-Z0-9-_. ]/g, '');

    res.attachment(zipName);
    archive.pipe(res);

    for (const dr of docRequests) {
      const safeDrName = (dr.name || 'Untitled Request').replace(/[^a-zA-Z0-9-_ ]/g, '');

      // Single Documents (Skip if downloading specific group)
      if (!groupId && dr.documents && Array.isArray(dr.documents)) {
        for (const doc of dr.documents) {
          if (doc.url) {
            try {
              const response = await axios.get(doc.url, { responseType: 'stream' });
              const ext = doc.uploadedFileName ? doc.uploadedFileName.split('.').pop() : 'pdf';
              const safeDocName = (doc.name || 'document').replace(/[^a-zA-Z0-9-_ ]/g, '');
              const filename = `${safeDrName}/${safeDocName}.${ext}`;
              archive.append(response.data, { name: filename });
            } catch (e) {
              console.error(`Failed to download ${doc.url}`, e);
            }
          }
        }
      }
      
      // Multiple Documents
      if (dr.multipleDocuments && Array.isArray(dr.multipleDocuments)) {
          for (const mDoc of dr.multipleDocuments) {
              // specific group check
              if (groupId && mDoc._id.toString() !== groupId) continue;

              if (mDoc.multiple && Array.isArray(mDoc.multiple)) {
                  for (const item of mDoc.multiple) {
                      if (item.url) {
                          try {
                              const response = await axios.get(item.url, { responseType: 'stream' });
                              const ext = item.uploadedFileName ? item.uploadedFileName.split('.').pop() : 'pdf';
                              const safeMDocName = (mDoc.name || 'group').replace(/[^a-zA-Z0-9-_ ]/g, '');
                              const safeItemLabel = (item.label || 'item').replace(/[^a-zA-Z0-9-_ ]/g, '');
                              const filename = groupId ? `${safeItemLabel}.${ext}` : `${safeDrName}/${safeMDocName}/${safeItemLabel}.${ext}`;
                              archive.append(response.data, { name: filename });
                          } catch (e) {
                               console.error(`Failed to download ${item.url}`, e);
                          }
                      }
                  }
              }
          }
      }
    }

    await archive.finalize();

  } catch (err) {
    next(err);
  }
};


 
// CLEAR ONLY UPLOADED DOCUMENT
 
exports.clearSingleDocument = async (req, res) => {
  try {
    const { requestId, docIndex } = req.params;

    const dr = await DocumentRequest.findById(requestId);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    const doc = dr.documents[docIndex];
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // ⭐ IMPORTANT:
    // Clear only the upload fields — DO NOT touch doc.template
    doc.url = "";
    doc.uploadedFileName = "";
    doc.uploadedAt = null;
    doc.status = "pending"; // reset status

    await dr.save();

    return res.json({
      success: true,
      message: "Uploaded file cleared successfully",
      document: doc,
    });
  } catch (err) {
    console.error("Clear document error:", err);
    return res
      .status(500)
      .json({ message: "Failed to clear uploaded document" });
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

// Upload template file for document requests
exports.uploadTemplate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const bucket = "engagement-documents";
    const originalFilename = req.file.originalname;
    const ext = originalFilename.split(".").pop();
    const uniqueFilename = `template_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}.${ext}`;
    
    // Store templates in a templates folder
    const path = `templates/${uniqueFilename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, req.file.buffer, { 
        cacheControl: "3600", 
        upsert: false,
        contentType: req.file.mimetype 
      });
    
    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ message: "Failed to upload template file" });
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    res.json({
      success: true,
      url: urlData.publicUrl,
      filename: uniqueFilename,
      originalName: originalFilename
    });
  } catch (error) {
    console.error('Template upload error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Download template file for clients
exports.downloadTemplate = async (req, res, next) => {
  try {
    const { templateUrl } = req.query;
    
    if (!templateUrl) {
      return res.status(400).json({ message: "Template URL is required" });
    }

    let bucket, filePath;

    // Check if it's a relative path (starts with /) - for default templates
    if (templateUrl.startsWith('/')) {
      // For default templates in public folder, serve them directly
      const fs = require('fs');
      const path = require('path');
      
      // Remove leading slash and construct file path
      const fileName = templateUrl.substring(1);
      const filePath_local = path.join(__dirname, '../../public', fileName);
      
      // Check if file exists
      if (!fs.existsSync(filePath_local)) {
        return res.status(404).json({ message: "Template file not found" });
      }
      
      // Set appropriate content type
      const ext = path.extname(fileName).toLowerCase();
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.txt': 'text/plain'
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      
      // Set headers and send file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      return res.sendFile(filePath_local);
    }

    // Handle Supabase URLs (existing logic)
    try {
      const url = new URL(templateUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
      
      if (!pathMatch) {
        return res.status(400).json({ message: "Invalid template URL" });
      }

      [, bucket, filePath] = pathMatch;
    } catch (urlError) {
      return res.status(400).json({ message: "Invalid template URL format" });
    }

    // Get the file from Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      console.error('Supabase download error:', error);
      return res.status(404).json({ message: "Template file not found" });
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="template_${Date.now()}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a document from document request
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id, documentIndex } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    const parsedIndex = parseInt(documentIndex);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= dr.documents.length) {
      return res.status(404).json({ message: "Document not found" });
    }

    const documentToDelete = dr.documents[parsedIndex];
    
    // Delete file from Supabase storage if URL exists
    if (documentToDelete && documentToDelete.url) {
      try {
        const url = new URL(documentToDelete.url);
        // Match Supabase storage URL pattern
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
        
        if (pathMatch) {
          const [, bucket, filePath] = pathMatch;
          console.log(`Attempting to delete file from bucket: ${bucket}, path: ${filePath}`);
          
          const { data, error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([filePath]);
          
          if (deleteError) {
            console.error('Error deleting file from storage:', deleteError);
            // Continue with document removal even if storage delete fails
          } else {
            console.log('File successfully deleted from storage');
          }
        } else {
          console.log('Could not parse Supabase URL:', documentToDelete.url);
        }
      } catch (storageError) {
        console.error('Error handling storage deletion:', storageError);
        // Continue with document removal
      }
    }
    
    // Also remove from EngagementLibrary if URL exists
    if (documentToDelete && documentToDelete.url) {
      try {
        await EngagementLibrary.findOneAndDelete({ url: documentToDelete.url });
      } catch (libError) {
        console.error('Error removing from library:', libError);
        // Continue anyway
      }
    }

    // Always remove the document from the array (actual deletion)
    dr.documents.splice(parsedIndex, 1);
    await dr.save();

    // Fetch the updated document to return
    const updatedDr = await DocumentRequest.findById(id);

    return res.json({
      success: true,
      message: 'Document deleted successfully',
      documentRequest: updatedDr
    });
  } catch (err) {
    console.error('Error in deleteDocument:', err);
    next(err);
  }
};

// Clear only the uploaded file for a multiple document item
exports.clearMultipleDocumentItem = async (req, res, next) => {
  try {
    const { id, multipleDocumentId, itemIndex } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Find the multiple document by _id (convert to string for comparison)
    const multipleDoc = dr.multipleDocuments.find(
      (doc) => String(doc._id) === String(multipleDocumentId)
    );
    if (!multipleDoc) {
      return res.status(404).json({ message: "Multiple document group not found" });
    }

    const parsedIndex = parseInt(itemIndex);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= multipleDoc.multiple.length) {
      return res.status(404).json({ message: "Document item not found" });
    }

    const item = multipleDoc.multiple[parsedIndex];
    if (!item) {
      return res.status(404).json({ message: "Document item not found" });
    }

    // Clear only the upload fields — preserve template and label
    item.url = "";
    item.uploadedFileName = "";
    item.uploadedAt = null;
    item.status = "pending"; // reset status

    await dr.save();

    return res.json({
      success: true,
      message: "Uploaded file cleared successfully",
      item: item,
      documentRequest: dr
    });
  } catch (err) {
    console.error("Clear multiple document item error:", err);
    return res
      .status(500)
      .json({ message: "Failed to clear uploaded document item" });
  }
};

// Delete entire multiple document group
exports.deleteMultipleDocumentGroup = async (req, res, next) => {
  try {
    const { id, multipleDocumentId } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Find the multiple document group
    const multipleDocIndex = dr.multipleDocuments.findIndex(
      (doc) => String(doc._id) === String(multipleDocumentId)
    );
    if (multipleDocIndex === -1) {
      return res.status(404).json({ message: "Multiple document group not found" });
    }

    const multipleDoc = dr.multipleDocuments[multipleDocIndex];
    
    // Delete all files from Supabase storage
    if (multipleDoc.multiple && multipleDoc.multiple.length > 0) {
      for (const item of multipleDoc.multiple) {
        if (item.url) {
          try {
            const url = new URL(item.url);
            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
            
            if (pathMatch) {
              const [, bucket, filePath] = pathMatch;
              const { error: deleteError } = await supabase.storage
                .from(bucket)
                .remove([filePath]);
              
              if (deleteError) {
                console.error('Error deleting file from storage:', deleteError);
              }

              // Also remove from EngagementLibrary
              try {
                await EngagementLibrary.findOneAndDelete({ url: item.url });
              } catch (libError) {
                console.error('Error removing from library:', libError);
              }
            }
          } catch (storageError) {
            console.error('Error handling storage deletion:', storageError);
          }
        }
      }
    }

    // Remove the entire group from the multipleDocuments array
    dr.multipleDocuments.splice(multipleDocIndex, 1);
    await dr.save();

    const updatedDr = await DocumentRequest.findById(id);

    return res.json({
      success: true,
      message: 'Multiple document group deleted successfully',
      documentRequest: updatedDr
    });
  } catch (err) {
    console.error('Error in deleteMultipleDocumentGroup:', err);
    next(err);
  }
};

// Clear all files in a multiple document group (keeps items, removes files)
exports.clearMultipleDocumentGroup = async (req, res, next) => {
  try {
    const { id, multipleDocumentId } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Find the multiple document group
    const multipleDoc = dr.multipleDocuments.find(
      (doc) => String(doc._id) === String(multipleDocumentId)
    );
    if (!multipleDoc) {
      return res.status(404).json({ message: "Multiple document group not found" });
    }

    // Clear all files in all items
    if (multipleDoc.multiple && multipleDoc.multiple.length > 0) {
      for (const item of multipleDoc.multiple) {
        if (item.url) {
          try {
            const url = new URL(item.url);
            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
            
            if (pathMatch) {
              const [, bucket, filePath] = pathMatch;
              const { error: deleteError } = await supabase.storage
                .from(bucket)
                .remove([filePath]);
              
              if (deleteError) {
                console.error('Error deleting file from storage:', deleteError);
              }

              // Also remove from EngagementLibrary
              try {
                await EngagementLibrary.findOneAndDelete({ url: item.url });
              } catch (libError) {
                console.error('Error removing from library:', libError);
              }
            }
          } catch (storageError) {
            console.error('Error handling storage deletion:', storageError);
          }
        }

        // Clear file-related fields but keep the item
        item.url = undefined;
        item.uploadedFileName = undefined;
        item.uploadedAt = undefined;
        item.status = 'pending';
      }
    }

    await dr.save();

    const updatedDr = await DocumentRequest.findById(id);

    return res.json({
      success: true,
      message: 'All files in multiple document group cleared successfully',
      documentRequest: updatedDr
    });
  } catch (err) {
    console.error('Error in clearMultipleDocumentGroup:', err);
    next(err);
  }
};

// Delete a specific item from a multiple document group
exports.deleteMultipleDocumentItem = async (req, res, next) => {
  try {
    const { id, multipleDocumentId, itemIndex } = req.params;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    // Find the multiple document by _id (convert to string for comparison)
    const multipleDoc = dr.multipleDocuments.find(
      (doc) => String(doc._id) === String(multipleDocumentId)
    );
    if (!multipleDoc) {
      return res.status(404).json({ message: "Multiple document group not found" });
    }

    const parsedIndex = parseInt(itemIndex);
    if (isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= multipleDoc.multiple.length) {
      return res.status(404).json({ message: "Document item not found" });
    }

    const itemToDelete = multipleDoc.multiple[parsedIndex];
    
    // Delete file from Supabase storage if URL exists
    if (itemToDelete && itemToDelete.url) {
      try {
        const url = new URL(itemToDelete.url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
        
        if (pathMatch) {
          const [, bucket, filePath] = pathMatch;
          console.log(`Attempting to delete file from bucket: ${bucket}, path: ${filePath}`);
          
          const { data, error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([filePath]);
          
          if (deleteError) {
            console.error('Error deleting file from storage:', deleteError);
          } else {
            console.log('File successfully deleted from storage');
          }
        }
      } catch (storageError) {
        console.error('Error handling storage deletion:', storageError);
      }
    }

    // Remove the item from the multiple array
    multipleDoc.multiple.splice(parsedIndex, 1);
    await dr.save();

    // Also remove from EngagementLibrary if URL exists
    if (itemToDelete && itemToDelete.url) {
      try {
        await EngagementLibrary.findOneAndDelete({ url: itemToDelete.url });
      } catch (libError) {
        console.error('Error removing from library:', libError);
      }
    }

    // Fetch the updated document to return
    const updatedDr = await DocumentRequest.findById(id);

    return res.json({
      success: true,
      message: 'Document item deleted successfully',
      documentRequest: updatedDr
    });
  } catch (err) {
    console.error('Error in deleteMultipleDocumentItem:', err);
    next(err);
  }
};

// Upload files to multiple document items
exports.uploadMultipleDocuments = async (req, res, next) => {
  try {
    const { id, multipleDocumentId } = req.params;
    const itemIndex = req.body.itemIndex ? parseInt(req.body.itemIndex) : null;

    const dr = await DocumentRequest.findById(id);
    if (!dr) {
      return res.status(404).json({ message: "Document request not found" });
    }

    const isClient = req.user?.role === 'client';
    if (isClient && dr.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Find the multiple document group
    const multipleDoc = dr.multipleDocuments.find(
      (doc) => String(doc._id) === String(multipleDocumentId)
    );
    if (!multipleDoc) {
      return res.status(404).json({ message: "Multiple document group not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const bucket = "engagement-documents";
    const categoryFolder = `${dr.category}/`;
    const EngagementLibrary = require("../models/EngagementLibrary");

    // Process each uploaded file
    for (let fileIndex = 0; fileIndex < req.files.length; fileIndex++) {
      const file = req.files[fileIndex];
      const originalFilename = file.originalname;
      const ext = originalFilename.split(".").pop();
      const uniqueFilename = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 5)}_${fileIndex}.${ext}`;
      // Determine the root folder (Engagement ID or Company ID)
    const contextId = dr.engagement ? dr.engagement.toString() : (dr.company ? dr.company.toString() : 'unknown');
    
    const path = `${contextId}/${categoryFolder}${uniqueFilename}`;

      const { data: up, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(up.path);

      // Determine which item to update
      let targetItemIndex = null;

      if (itemIndex !== null && !isNaN(itemIndex) && itemIndex >= 0 && itemIndex < multipleDoc.multiple.length) {
        // Use provided item index
        targetItemIndex = itemIndex;
      } else {
        // Find first pending item without a file
        targetItemIndex = multipleDoc.multiple.findIndex(
          (item) => item.status === "pending" && !item.url
        );
      }

      if (targetItemIndex !== -1 && targetItemIndex !== null) {
        // Update existing item
        const existingItem = multipleDoc.multiple[targetItemIndex];
        multipleDoc.multiple[targetItemIndex] = {
          ...existingItem,
          label: existingItem.label, // Preserve label
          url: urlData.publicUrl,
          uploadedFileName: originalFilename,
          uploadedAt: new Date(),
          status: "uploaded",
          // Preserve template if it exists
          template: existingItem.template || undefined,
        };
      } else {
        // If no pending item found, create a new one
        multipleDoc.multiple.push({
          label: originalFilename.replace(/\.[^/.]+$/, ""), // Use filename without extension as label
          url: urlData.publicUrl,
          uploadedFileName: originalFilename,
          uploadedAt: new Date(),
          status: "uploaded",
        });
      }

      // Add to library (only if associated with an engagement)
      if (dr.engagement) {
        await EngagementLibrary.create({
          engagement: dr.engagement,
          category: dr.category,
          url: urlData.publicUrl,
        });
      }
    }

    await dr.save();

    // Update KYC status if this is a KYC document request
    if (dr.category === 'kyc') {
      try {
        const KYC = require('../models/KnowYourClient');
        const kyc = await KYC.findOne({ documentRequests: dr._id });
        if (kyc) {
          kyc.status = 'submitted';
          await kyc.save();
        }
      } catch (kycError) {
        console.error('Error updating KYC status:', kycError);
      }
    }

    return res.json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully to multiple document group`,
      documentRequest: dr
    });
  } catch (err) {
    console.error('Error in uploadMultipleDocuments:', err);
    next(err);
  }
};