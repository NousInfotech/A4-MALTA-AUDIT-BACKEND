const KYC = require("../models/KnowYourClient");
const DocumentRequest = require("../models/DocumentRequest");
const Engagement = require("../models/Engagement");
const Person = require("../models/Person");
const Company = require("../models/Company");

/**
 * KYC Controllers
 */

// Create a new KYC workflow
exports.createKYC = async (req, res, next) => {
  try {
    const { engagementId, companyId, clientId, auditorId, documentRequests } = req.body;

    let targetContext = {};
    let contextName = "";

    // Verify engagement exists if provided
    if (engagementId) {
      const engagement = await Engagement.findById(engagementId);
      if (!engagement) {
        return res.status(404).json({ message: "Engagement not found" });
      }
      targetContext = { engagement: engagementId };
      contextName = engagement.title;
      
      // Check if KYC already exists for this engagement
      const existingKYC = await KYC.findOne({ engagement: engagementId });
      if (existingKYC) {
        return res
          .status(400)
          .json({ message: "KYC workflow already exists for this engagement" });
      }
    } else if (companyId) {
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      targetContext = { company: companyId };
      contextName = company.name;

      // Check if KYC already exists for this company
      const existingKYC = await KYC.findOne({ company: companyId });
      if (existingKYC) {
        return res
          .status(400)
          .json({ message: "KYC workflow already exists for this company" });
      }
    } else {
      return res.status(400).json({ message: "Either engagementId or companyId is required" });
    }

    // Process document requests array
    // documentRequests: [{ documentRequest: {...data}, person: personId }]
    const processedDocRequests = [];

    if (documentRequests && Array.isArray(documentRequests)) {
      for (let i = 0; i < documentRequests.length; i++) {
        const { documentRequest, multipleDocuments, person } = documentRequests[i];
      
        
        // Validate person exists
        if (!person) {
          return res.status(400).json({
            message: `Document request at index ${i} is missing person ID`,
          });
        }

        const personExists = await Person.findById(person);
        if (!personExists) {
          return res.status(404).json({
            message: `Person with ID ${person} not found for document request ${i}`,
          });
        }

        // documentRequest is an ARRAY of documents (single documents)
        // Validate documents array if provided
        let documentsWithStatus = [];
        if (documentRequest) {
          if (!Array.isArray(documentRequest)) {
            return res.status(400).json({
              message: `Document request at index ${i} must be an array of documents`,
            });
          }

          // Validate each document in the array
          for (let j = 0; j < documentRequest.length; j++) {
            const doc = documentRequest[j];
            if (!doc.name) {
              return res.status(400).json({
                message: `Document at index ${j} in request ${i} is missing required 'name' field`,
              });
            }
          }

          // Convert the documents array to the format expected by DocumentRequest model
          documentsWithStatus = documentRequest.map(doc => ({
            name: doc.name,
            type: doc.templateUrl ? 'template' : 'direct',
            description: doc.description || '',
            template: doc.templateUrl ? {
              url: doc.templateUrl,
              instruction: doc.description || ''
            } : undefined,
            status: 'pending'
          }));
        }

        // Validate and convert multipleDocuments if provided
        let multipleDocumentsWithStatus = [];
        if (multipleDocuments) {
          if (!Array.isArray(multipleDocuments)) {
            return res.status(400).json({
              message: `Multiple documents at index ${i} must be an array`,
            });
          }

          // Validate each multiple document
          for (let j = 0; j < multipleDocuments.length; j++) {
            const multiDoc = multipleDocuments[j];
            if (!multiDoc.name) {
              return res.status(400).json({
                message: `Multiple document at index ${j} in request ${i} is missing required 'name' field`,
              });
            }
            if (!multiDoc.multiple || !Array.isArray(multiDoc.multiple) || multiDoc.multiple.length === 0) {
              return res.status(400).json({
                message: `Multiple document at index ${j} in request ${i} must have at least one item in 'multiple' array`,
              });
            }
            
            // Validate each item in the multiple array
            for (let k = 0; k < multiDoc.multiple.length; k++) {
              const item = multiDoc.multiple[k];
              if (!item.label) {
                return res.status(400).json({
                  message: `Multiple document at index ${j} in request ${i}, item at index ${k} is missing required 'label' field`,
                });
              }
            }
          }

          // Convert multiple documents to the format expected by DocumentRequest model
          multipleDocumentsWithStatus = multipleDocuments.map(multiDoc => ({
            name: multiDoc.name,
            type: multiDoc.type === 'template' ? 'template' : 'direct',
            instruction: multiDoc.instruction || '',
            multiple: multiDoc.multiple.map(item => ({
              label: item.label,
              template: item.template?.url ? {
                url: item.template.url,
                instruction: item.template.instruction || ''
              } : undefined,
              status: 'pending'
            }))
          }));
        }

        // Validate that at least one type of document is provided
        if (documentsWithStatus.length === 0 && multipleDocumentsWithStatus.length === 0) {
          return res.status(400).json({
            message: `Document request at index ${i} must have at least one document or multiple document`,
          });
        }

        // Set category to 'kyc' and add engagement info
        const documentRequestData = {
          name: `KYC-${personExists.name.toUpperCase()}-V1`,
          description: `The following files to be submitted by the ${personExists.name} for ${contextName}`,
          ...targetContext,
          clientId: clientId || req.user.id,
          category: "kyc",
          documents: documentsWithStatus, // Single documents
          multipleDocuments: multipleDocumentsWithStatus, // Multiple documents
          status: 'pending'
        };

        console.log('💾 Creating DocumentRequest with data:', JSON.stringify(documentRequestData, null, 2));

        // Create document request
        const createdDocRequest = await DocumentRequest.create(
          documentRequestData
        );

        console.log('✅ Created DocumentRequest:', createdDocRequest._id, 'with', createdDocRequest.documents?.length || 0, 'documents and', createdDocRequest.multipleDocuments?.length || 0, 'multiple documents');

        // Add to processed array
        processedDocRequests.push({
          documentRequest: createdDocRequest._id,
          person: person,
        });
      }
    }

    // Create KYC with all document requests
    const kyc = await KYC.create({
      ...targetContext,
      clientId: clientId || req.user.id,
      auditorId: auditorId || req.user.id,
      documentRequests: processedDocRequests,
      status: "active", // Start with active state when KYC is created
    });

    // Populate the document requests and persons to return
    const populatedKYC = await KYC.findById(kyc._id)
      .populate("engagement", "title status yearEndDate")
      .populate("company", "name registrationNumber")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    res.status(201).json({
      success: true,
      message: "KYC workflow created successfully",
      kyc: populatedKYC,
    });
  } catch (err) {
    next(err);
  }
};

// Get KYC by engagement ID
exports.getKYCByEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;

    const kyc = await KYC.findOne({ engagement: engagementId })
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    // if (!kyc) {
    //   return res.status(404).json({ message: 'KYC workflow not found for this engagement' });
    // }

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Get KYC by company ID
exports.getKYCByCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const kyc = await KYC.findOne({ company: companyId })
      .populate("company", "name registrationNumber clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Get KYC by ID
exports.getKYCById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const kyc = await KYC.findById(id)
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Update KYC workflow
exports.updateKYC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.engagement;
    delete updates.clientId;
    delete updates.auditorId;
    delete updates.createdAt;

    const kyc = await KYC.findByIdAndUpdate(id, updates, { new: true })
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Delete KYC workflow
exports.deleteKYC = async (req, res, next) => {
  try {
    const { id } = req.params;

    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    await KYC.findByIdAndDelete(id);

    res.json({ message: "KYC workflow deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Get all KYC workflows (for dashboard)
exports.getAllKYCs = async (req, res, next) => {
  try {
    const { status, clientId, auditorId } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (auditorId) filter.auditorId = auditorId;

    const kycs = await KYC.find(filter)
      .populate("engagement", "title yearEndDate clientId")
      .populate("company", "name registrationNumber clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      })
      .sort({ createdAt: -1 });

    res.json(kycs);
  } catch (err) {
    next(err);
  }
};

// Add DocumentRequest to KYC (supports multiple document requests with persons)
exports.addDocumentRequestToKYC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documentRequests } = req.body;

    // Verify KYC exists
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Validate documentRequests array
    if (!documentRequests || !Array.isArray(documentRequests)) {
      return res
        .status(400)
        .json({ message: "documentRequests must be an array" });
    }

    // Process each document request
    const newDocRequests = [];
    // Track version numbers per person for this batch
    const personVersionCounts = {};

    for (let i = 0; i < documentRequests.length; i++) {
      const { documentRequest, multipleDocuments, person } = documentRequests[i];

      console.log(`\n📋 Adding Document Request ${i + 1}:`);
      console.log('Document Request: ', documentRequest);
      console.log('Multiple Documents: ', multipleDocuments);
      console.log('Person: ', person);

      // Validate person exists or check if it's a company/engagement level request
      let personExists = null;
      let personIdStr = 'global';
      let documentRequestName = '';

      if (person) {
        personExists = await Person.findById(person);
        if (!personExists) {
          return res.status(404).json({
            message: `Person with ID ${person} not found for document request ${i}`,
          });
        }
        personIdStr = person.toString();
      }

      // Count existing document requests for this person/context in the KYC
      const existingDocRequestCount = kyc.documentRequests.filter(
        (dr) => {
          if (person) {
            return dr.person && dr.person.toString() === personIdStr;
          }
          return !dr.person; // Count global requests
        }
      ).length;
      
      // Initialize or increment version count for this person in current batch
      if (!personVersionCounts[personIdStr]) {
        personVersionCounts[personIdStr] = 0;
      }
      personVersionCounts[personIdStr]++;
      
      // Generate name
      const versionNumber = existingDocRequestCount + personVersionCounts[personIdStr];
      
      if (personExists) {
        documentRequestName = `KYC-${personExists.name}-V${versionNumber}`;
      } else {
         // Fallback naming for company/engagement level requests
         let contextName = 'General';
         if (kyc.company) {
            const company = await Company.findById(kyc.company);
            if (company) contextName = company.name;
         } else if (kyc.engagement) {
             const engagement = await Engagement.findById(kyc.engagement);
             if (engagement) contextName = engagement.title;
         }
         documentRequestName = `KYC-${contextName}-V${versionNumber}`;
      }

      // documentRequest is an ARRAY of documents (single documents)
      // Validate documents array if provided
      let documentsWithStatus = [];
      if (documentRequest) {
        if (!Array.isArray(documentRequest)) {
          return res.status(400).json({
            message: `Document request at index ${i} must be an array of documents`,
          });
        }

        // Validate each document in the array
        for (let j = 0; j < documentRequest.length; j++) {
          const doc = documentRequest[j];
          if (!doc.name) {
            return res.status(400).json({
              message: `Document at index ${j} in request ${i} is missing required 'name' field`,
            });
          }
        }

        // Convert the documents array to the format expected by DocumentRequest model
        documentsWithStatus = documentRequest.map(doc => ({
          name: doc.name,
          type: doc.templateUrl ? 'template' : 'direct',
          description: doc.description || '',
          template: doc.templateUrl ? {
            url: doc.templateUrl,
            instruction: doc.description || ''
          } : undefined,
          status: 'pending'
        }));
      }

      console.log('📝 Documents with status:', documentsWithStatus);

      // Validate and convert multipleDocuments if provided
      let multipleDocumentsWithStatus = [];
      if (multipleDocuments) {
        if (!Array.isArray(multipleDocuments)) {
          return res.status(400).json({
            message: `Multiple documents at index ${i} must be an array`,
          });
        }

        // Validate each multiple document
        for (let j = 0; j < multipleDocuments.length; j++) {
          const multiDoc = multipleDocuments[j];
          if (!multiDoc.name) {
            return res.status(400).json({
              message: `Multiple document at index ${j} in request ${i} is missing required 'name' field`,
            });
          }
          if (!multiDoc.multiple || !Array.isArray(multiDoc.multiple) || multiDoc.multiple.length === 0) {
            return res.status(400).json({
              message: `Multiple document at index ${j} in request ${i} must have at least one item in 'multiple' array`,
            });
          }
          
          // Validate each item in the multiple array
          for (let k = 0; k < multiDoc.multiple.length; k++) {
            const item = multiDoc.multiple[k];
            if (!item.label) {
              return res.status(400).json({
                message: `Multiple document at index ${j} in request ${i}, item at index ${k} is missing required 'label' field`,
              });
            }
          }
        }

        // Convert multiple documents to the format expected by DocumentRequest model
        multipleDocumentsWithStatus = multipleDocuments.map(multiDoc => ({
          name: multiDoc.name,
          type: multiDoc.type === 'template' ? 'template' : 'direct',
          instruction: multiDoc.instruction || '',
          multiple: multiDoc.multiple.map(item => ({
            label: item.label,
            template: item.template?.url ? {
              url: item.template.url,
              instruction: item.template.instruction || ''
            } : undefined,
            status: 'pending'
          }))
        }));
      }

      console.log('📝 Multiple Documents with status:', multipleDocumentsWithStatus);

      // Validate that at least one type of document is provided
      if (documentsWithStatus.length === 0 && multipleDocumentsWithStatus.length === 0) {
        return res.status(400).json({
          message: `Document request at index ${i} must have at least one document or multiple document`,
        });
      }

      // Get context details for description
      let description = '';
      const entityName = personExists ? personExists.name : 'Client';
      
      if (kyc.engagement) {
        const engagement = await Engagement.findById(kyc.engagement);
        const engagementTitle = engagement ? engagement.title : 'this engagement';
        description = `The following files to be submitted by the ${entityName} for the engagement ${engagementTitle}`;
      } else if (kyc.company) {
        const company = await Company.findById(kyc.company);
        const companyName = company ? company.name : 'this company';
        description = `The following files to be submitted by the ${entityName} for the company ${companyName}`;
      }

      // Set category to 'kyc' and add engagement info
      const documentRequestData = {
        name: documentRequestName,
        description: description,
        engagement: kyc.engagement,
        company: kyc.company,
        clientId: kyc.clientId,
        category: "kyc",
        documents: documentsWithStatus, // Single documents
        multipleDocuments: multipleDocumentsWithStatus, // Multiple documents
        status: 'pending'
      };

      console.log('💾 Creating DocumentRequest with data:', JSON.stringify(documentRequestData, null, 2));

      // Create document request
      const createdDocRequest = await DocumentRequest.create(
        documentRequestData
      );

      console.log('✅ Created DocumentRequest:', createdDocRequest._id, 'with', createdDocRequest.documents?.length || 0, 'documents and', createdDocRequest.multipleDocuments?.length || 0, 'multiple documents');

      // Add to array
      newDocRequests.push({
        documentRequest: createdDocRequest._id,
        person: person,
      });
    }

    // Add new document requests to existing KYC
    kyc.documentRequests.push(...newDocRequests);
    await kyc.save();

    // Populate and return
    const updatedKYC = await KYC.findById(id)
      .populate("engagement", "title yearEndDate clientId")
      .populate("company", "name registrationNumber clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    res.status(200).json({
      success: true,
      message: `${newDocRequests.length} document request(s) added successfully`,
      kyc: updatedKYC,
    });
  } catch (err) {
    next(err);
  }
};





/**
 * KYC Discussion Controllers
 */

// Add discussion to KYC
exports.addDiscussion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, replyTo, documentRef } = req.body;

    // Verify KYC exists
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Verify document reference if provided
    if (documentRef) {
      const { documentRequestId, documentIndex } = documentRef;

      const documentRequest = await DocumentRequest.findById(documentRequestId);
      if (!documentRequest) {
        return res.status(400).json({ message: "Document request not found" });
      }

      if (
        documentIndex < 0 ||
        documentIndex >= documentRequest.documents.length
      ) {
        return res.status(400).json({ message: "Invalid document index" });
      }
    }

    // Add discussion
    const discussion = {
      role: req.user.role === "employee" ? "auditor" : "client",
      message,
      replyTo: replyTo || null,
      documentRef: documentRef || null,
    };

    kyc.discussions.push(discussion)
    await kyc.save();

    res.status(201).json(kyc);
  } catch (err) {
    next(err);
  }
};

// Update discussion
exports.updateDiscussion = async (req, res, next) => {
  try {
    const { id, discussionId } = req.params;
    const { message } = req.body;

    // Verify KYC exists
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Find the discussion
    const discussion = kyc.discussions.id(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: "Discussion not found" });
    }

    // Check if user can edit this discussion
    const userRole = req.user.role === "employee" ? "auditor" : "client";
    if (discussion.role !== userRole) {
      return res
        .status(403)
        .json({ message: "You can only edit your own discussions" });
    }

    // Update discussion
    discussion.message = message;
    await kyc.save();

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Delete discussion
exports.deleteDiscussion = async (req, res, next) => {
  try {
    const { id, discussionId } = req.params;

    // Verify KYC exists
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Find the discussion
    const discussion = kyc.discussions.id(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: "Discussion not found" });
    }

    // Check if user can delete this discussion
    const userRole = req.user.role === "employee" ? "auditor" : "client";
    if (discussion.role !== userRole) {
      return res
        .status(403)
        .json({ message: "You can only delete your own discussions" });
    }

    // Delete discussion
    discussion.remove();
    await kyc.save();

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};

// Get discussions for a specific document
exports.getDiscussionsByDocument = async (req, res, next) => {
  try {
    const { documentRequestId, documentIndex } = req.params;

    const kycs = await KYC.find({
      "discussions.documentRef.documentRequestId": documentRequestId,
      "discussions.documentRef.documentIndex": parseInt(documentIndex),
    })
      .populate("engagement", "title yearEndDate")
      .select("discussions engagement");

    // Filter discussions for the specific document
    const relevantDiscussions = [];
    kycs.forEach((kyc) => {
      kyc.discussions.forEach((discussion) => {
        if (
          discussion.documentRef &&
          discussion.documentRef.documentRequestId.toString() ===
            documentRequestId &&
          discussion.documentRef.documentIndex === parseInt(documentIndex)
        ) {
          relevantDiscussions.push({
            ...discussion.toObject(),
            kycId: kyc._id,
            engagement: kyc.engagement,
          });
        }
      });
    });

    res.json(relevantDiscussions);
  } catch (err) {
    next(err);
  }
};

// Update KYC status
exports.updateKYCStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Verify KYC exists
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Validate status
    const validStatuses = [
      "active",
      "pending",
      "submitted",
      "in-review",
      "completed",
      "reopened",
    ];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({
          message:
            "Invalid status. Must be one of: active, pending, submitted, in-review, completed, reopened",
        });
    }

    // Update status
    kyc.status = status;
    await kyc.save();

    res.json(kyc);
  } catch (err) {
    next(err);
  }
};


// Get all discussions for a KYC
exports.getAllDiscussions = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify KYC exists
    const kyc = await KYC.findById(id)
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      });

    if (!kyc) {
      return res.status(404).json({ message: "KYC workflow not found" });
    }

    // Return discussions with engagement and document request info
    const discussions = kyc.discussions.map((discussion) => ({
      ...discussion.toObject(),
      engagement: kyc.engagement,
      documentRequests: kyc.documentRequests,
    }));

    res.json({
      kycId: kyc._id,
      engagement: kyc.engagement,
      documentRequests: kyc.documentRequests,
      discussions: discussions.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ),
    });
  } catch (err) {
    next(err);
  }
};

// Get client's own KYCs
exports.getMyKYCs = async (req, res, next) => {
  try {
    const clientId = req.user.id;

    const kycs = await KYC.find({ clientId })
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "name category description status documents multipleDocuments",
      })
      .populate({
        path: "documentRequests.person",
        model: "Person",
        select: "name email phoneNumber nationality address",
      })
      .sort({ createdAt: -1 });

    res.json(kycs);
  } catch (err) {
    next(err);
  }
};
