const KYC = require("../models/KnowYourClient");
const DocumentRequest = require("../models/DocumentRequest");
const Engagement = require("../models/Engagement");
const Person = require("../models/Person");

/**
 * KYC Controllers
 */

// Create a new KYC workflow
exports.createKYC = async (req, res, next) => {
  try {
    const { engagementId, clientId, auditorId, documentRequests } = req.body;


    // Verify engagement exists
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" });
    }

    // Check if KYC already exists for this engagement
    const existingKYC = await KYC.findOne({ engagement: engagementId });
    if (existingKYC) {
      return res
        .status(400)
        .json({ message: "KYC workflow already exists for this engagement" });
    }

    // Process document requests array
    // documentRequests: [{ documentRequest: {...data}, person: personId }]
    const processedDocRequests = [];

    if (documentRequests && Array.isArray(documentRequests)) {
      for (let i = 0; i < documentRequests.length; i++) {
        const { documentRequest, person } = documentRequests[i];
      
        
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

        // documentRequest is an ARRAY of documents, not an object with documents property
        // Validate documents array
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
        const documentsWithStatus = documentRequest.map(doc => ({
          name: doc.name,
          type: doc.templateUrl ? 'template' : 'direct',
          description: doc.description || '',
          template: doc.templateUrl ? {
            url: doc.templateUrl,
            instruction: doc.description || ''
          } : undefined,
          status: 'pending'
        }));


        // Set category to 'kyc' and add engagement info
        const documentRequestData = {
          description: `The following files to be submitted by the ${personExists.name} for the engagement ${engagement.title}`,
          engagement: engagementId,
          clientId: clientId || req.user.id,
          category: "kyc",
          documents: documentsWithStatus, // Add the documents array here!
          status: 'pending'
        };

        console.log('💾 Creating DocumentRequest with data:', JSON.stringify(documentRequestData, null, 2));

        // Create document request
        const createdDocRequest = await DocumentRequest.create(
          documentRequestData
        );

        console.log('✅ Created DocumentRequest:', createdDocRequest._id, 'with', createdDocRequest.documents?.length || 0, 'documents');

        // Add to processed array
        processedDocRequests.push({
          documentRequest: createdDocRequest._id,
          person: person,
        });
      }
    }

    // Create KYC with all document requests
    const kyc = await KYC.create({
      engagement: engagementId,
      clientId: clientId || req.user.id,
      auditorId: auditorId || req.user.id,
      documentRequests: processedDocRequests,
      status: "active", // Start with active state when KYC is created
    });

    // Populate the document requests and persons to return
    const populatedKYC = await KYC.findById(kyc._id)
      .populate("engagement", "title status yearEndDate")
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
        select: "category description status documents",
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

// Get KYC by ID
exports.getKYCById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const kyc = await KYC.findById(id)
      .populate("engagement", "title yearEndDate clientId")
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "category description status documents",
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
        select: "category description status documents",
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
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "category description status documents",
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

    kyc.discussions.push(discussion);
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

    for (let i = 0; i < documentRequests.length; i++) {
      const { documentRequest, person } = documentRequests[i];

      console.log(`\n📋 Adding Document Request ${i + 1}:`);
      console.log('Document Request: ', documentRequest);
      console.log('Person: ', person);

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

      // documentRequest is an ARRAY of documents, not an object with documents property
      // Validate documents array
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
      const documentsWithStatus = documentRequest.map(doc => ({
        name: doc.name,
        type: doc.templateUrl ? 'template' : 'direct',
        description: doc.description || '',
        template: doc.templateUrl ? {
          url: doc.templateUrl,
          instruction: doc.description || ''
        } : undefined,
        status: 'pending'
      }));

      console.log('📝 Documents with status:', documentsWithStatus);

      // Get engagement details for description
      const engagement = await Engagement.findById(kyc.engagement);
      const engagementTitle = engagement ? engagement.title : 'this engagement';

      // Set category to 'kyc' and add engagement info
      const documentRequestData = {
        description: `The following files to be submitted by the ${personExists.name} for the engagement ${engagementTitle}`,
        engagement: kyc.engagement,
        clientId: kyc.clientId,
        category: "kyc",
        documents: documentsWithStatus, // Add the documents array here!
        status: 'pending'
      };

      console.log('💾 Creating DocumentRequest with data:', JSON.stringify(documentRequestData, null, 2));

      // Create document request
      const createdDocRequest = await DocumentRequest.create(
        documentRequestData
      );

      console.log('✅ Created DocumentRequest:', createdDocRequest._id, 'with', createdDocRequest.documents?.length || 0, 'documents');

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
      .populate({
        path: "documentRequests.documentRequest",
        model: "DocumentRequest",
        select: "category description status documents",
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
        select: "category description status documents",
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
        select: "category description status documents",
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
