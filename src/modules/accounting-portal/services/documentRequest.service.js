const DocumentRequest = require("../../../models/DocumentRequest");
const EngagementLibrary = require("../../../models/EngagementLibrary");
const ClassificationEvidence = require("../../../models/ClassificationEvidence");
const ClassificationSection = require("../../../models/ClassificationSection");
const ChecklistItem = require("../../../models/ChecklistItem");
const KYC = require("../../../models/KnowYourClient");
const { supabase } = require("../../../config/supabase");

/**
 * Get user profile from Supabase
 * @param {String} userId - User ID
 * @returns {Promise<Object>} User profile with name and role
 */
async function getUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("user_id", userId)
      .single();

    if (error || !profile) {
      throw new Error("Profile not found");
    }

    return profile;
  } catch (error) {
    throw new Error("Failed to fetch user profile");
  }
}

/**
 * Map document categories to classification names
 * @param {String} category - Document category
 * @returns {String|null} Classification name or null
 */
function mapCategoryToClassification(category) {
  const categoryMapping = {
    cash: "Cash & Cash Equivalents",
    receivables: "Trade Receivables",
    inventory: "Inventory",
    prepayments: "Prepayments",
    ppe: "Property, Plant & Equipment",
    payables: "Trade Payables",
    accruals: "Accruals",
    equity: "Equity",
    revenue: "Revenue",
    expenses: "Expenses",
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

/**
 * Get document requests by engagement ID
 * @param {String} engagementId - Engagement ID
 * @returns {Promise<Array>} Array of document request documents
 */
async function getDocumentRequestsByEngagementId(engagementId) {
  try {
    const documentRequests = await DocumentRequest.find({
      engagement: engagementId,
    }).sort({ requestedAt: -1 });
    return documentRequests;
  } catch (error) {
    throw new Error(`Failed to fetch document requests: ${error.message}`);
  }
}

/**
 * Upload document request document
 * @param {String} documentRequestId - Document Request ID
 * @param {Array} files - Array of uploaded files
 * @param {Object} body - Request body with additional data
 * @param {Object} user - User object from request
 * @returns {Promise<Object>} Updated document request
 */
async function uploadDocumentRequestDocument(
  documentRequestId,
  files,
  body,
  user
) {
  try {
    const dr = await DocumentRequest.findById(documentRequestId);
    if (!dr) {
      throw new Error("Request not found");
    }

    const bucket = "engagement-documents";
    const categoryFolder = `${dr.category}/`;

    for (const file of files) {
      const originalFilename = file.originalname;
      const ext = originalFilename.split(".").pop();
      const uniqueFilename = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 5)}.${ext}`;

      // Determine the root folder (Engagement ID or Company ID)
      const contextId = dr.engagement
        ? dr.engagement.toString()
        : dr.company
        ? dr.company.toString()
        : "unknown";
      const path = `${contextId}/${categoryFolder}${uniqueFilename}`;

      const { data: up, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(up.path);

      // Check if we have a specific document index from the frontend
      const documentIndex = body.documentIndex
        ? parseInt(body.documentIndex)
        : null;
      const documentName = body.documentName || originalFilename;

      if (
        documentIndex !== null &&
        documentIndex >= 0 &&
        documentIndex < dr.documents.length
      ) {
        // Update specific document by index
        const existingDoc = dr.documents[documentIndex];
        dr.documents[documentIndex] = {
          ...existingDoc,
          name: documentName, // Ensure name is always set
          uploadedFileName: originalFilename,
          url: urlData.publicUrl,
          uploadedAt: new Date(),
          status: "uploaded",
          comment: body.comment || "",
        };
      } else {
        // Find the first pending document to update
        const pendingDocIndex = dr.documents.findIndex(
          (doc) => doc.status === "pending" && !doc.url
        );

        if (pendingDocIndex !== -1) {
          // Update existing pending document
          const existingDoc = dr.documents[pendingDocIndex];
          dr.documents[pendingDocIndex] = {
            ...existingDoc,
            name: existingDoc.name || documentName, // Ensure name is always set
            uploadedFileName: originalFilename,
            url: urlData.publicUrl,
            uploadedAt: new Date(),
            status: "uploaded",
            comment: body.comment || "",
          };
        } else {
          // If no pending document found, add new one
          dr.documents.push({
            name: documentName,
            uploadedFileName: originalFilename,
            url: urlData.publicUrl,
            uploadedAt: new Date(),
            status: "uploaded",
            comment: body.comment || "",
          });
        }
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
        const userProfile = await getUserProfile(user.id || user.userId);

        // Map document category to classification name
        const classificationName = mapCategoryToClassification(dr.category);

        if (classificationName) {
          // Try to find the classification
          const classification = await ClassificationSection.findOne({
            engagement: dr.engagement,
            classification: classificationName,
          });

          if (classification) {
            // Create evidence entry
            const evidence = new ClassificationEvidence({
              engagementId: dr.engagement,
              classificationId: classification._id,
              uploadedBy: {
                userId: user.id || user.userId,
                name: userProfile.name,
                email: user.email || "",
                role: userProfile.role,
              },
              evidenceUrl: urlData.publicUrl,
              evidenceComments: [],
            });

            await evidence.save();
            console.log(
              `Document uploaded to both library and evidence for classification: ${classification.classification}`
            );
          } else {
            console.log(
              `Classification '${classificationName}' not found for engagement: ${dr.engagement}`
            );
          }
        } else {
          console.log(`No mapping found for document category: ${dr.category}`);
        }
      } catch (evidenceError) {
        console.error("Error creating evidence entry:", evidenceError);
        // Don't fail the upload if evidence creation fails
      }
    }

    if (body.markCompleted === "true") {
      dr.status = "completed";
      dr.completedAt = new Date();
    }

    await dr.save();

    // Update checklist items linked to this document request
    try {
      // Find checklist items linked to this document request
      const checklistItems = await ChecklistItem.find({
        engagement: dr.engagement,
        documentRequestId: dr._id,
      });

      // Update checklist items: mark as requested and uploaded
      for (const item of checklistItems) {
        item.isRequested = true;
        item.isUploaded = true;
        // If all documents are uploaded, mark checklist item as completed
        const allDocsUploaded = dr.documents.every(
          (doc) => doc.status === "uploaded" || doc.status === "approved"
        );
        if (allDocsUploaded && dr.documents.length > 0) {
          item.completed = true;
        }
        await item.save();
      }

      // Also try to find checklist items by document name/category mapping
      if (checklistItems.length === 0 && dr.engagement) {
        // Map document names to checklist keys
        const documentToChecklistMap = {
          "Professional Clearance Letter": "prof-clearance-letter",
          "Removal of Auditor": "removal-auditor",
          "professional clearance": "prof-clearance-letter",
          "removal of auditor": "removal-auditor",
        };

        // Check if any document name matches a checklist item
        for (const doc of dr.documents) {
          const docName = doc.name?.toLowerCase() || "";
          for (const [key, checklistKey] of Object.entries(
            documentToChecklistMap
          )) {
            if (
              docName.includes(key.toLowerCase()) ||
              dr.category.toLowerCase().includes("kyc")
            ) {
              const checklistItem = await ChecklistItem.findOne({
                engagement: dr.engagement,
                key: checklistKey,
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
      console.error("Error updating checklist items:", checklistError);
      // Don't fail the upload if checklist update fails
    }

    // Update KYC status if this is a KYC document request
    if (dr.category === "kyc") {
      try {
        const kyc = await KYC.findOne({
          "documentRequests.documentRequest": dr._id,
        });
        if (kyc) {
          // Update KYC status to 'submitted' when documents are uploaded
          kyc.status = "submitted";
          await kyc.save();
        }
      } catch (kycError) {
        console.error("Error updating KYC status:", kycError);
        // Don't fail the upload if KYC update fails
      }
    }

    return dr;
  } catch (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

/**
 * Clear single document from document request
 * @param {String} requestId - Document Request ID
 * @param {Number} docIndex - Document index
 * @returns {Promise<Object>} Updated document
 */
async function clearSingleDocument(requestId, docIndex) {
  try {
    const dr = await DocumentRequest.findById(requestId);
    if (!dr) {
      throw new Error("Document request not found");
    }

    const doc = dr.documents[docIndex];
    if (!doc) {
      throw new Error("Document not found");
    }

    // Clear only the upload fields — DO NOT touch doc.template
    doc.url = "";
    doc.uploadedFileName = "";
    doc.uploadedAt = null;
    doc.status = "pending"; // reset status

    await dr.save();

    return doc;
  } catch (error) {
    throw new Error(`Failed to clear document: ${error.message}`);
  }
}

module.exports = {
  getDocumentRequestsByEngagementId,
  uploadDocumentRequestDocument,
  clearSingleDocument,
};
