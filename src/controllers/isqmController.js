const ISQMParent = require('../models/ISQMParent');
const ISQMQuestionnaire = require('../models/ISQMQuestionnaire');
const ISQMSupportingDocument = require('../models/ISQMSupportingDocument');

/**
 * ISQM Parent Controllers
 */

// Create a new ISQM Parent (from JSON upload)
exports.createISQMParent = async (req, res, next) => {
  try {
    const { 
      metadata, 
      questionnaires, 
      status = 'draft'
    } = req.body;

    // Create the parent document
    const parent = await ISQMParent.create({
      metadata: {
        title: metadata.title,
        version: metadata.version,
        jurisdiction_note: metadata.jurisdiction_note,
        sources: metadata.sources || [],
        generated: metadata.generated ? new Date(metadata.generated) : new Date()
      },
      children: [],
      createdBy: req.user.id,
      status
    });

    // Create child questionnaires if provided
    if (questionnaires && Array.isArray(questionnaires)) {
      const createdQuestionnaires = [];
      
      for (const questionnaireData of questionnaires) {
        const questionnaire = await ISQMQuestionnaire.create({
          parentId: parent._id,
          key: questionnaireData.key,
          heading: questionnaireData.heading,
          description: questionnaireData.description,
          version: questionnaireData.version,
          framework: questionnaireData.framework,
          sections: questionnaireData.sections || []
        });
        
        createdQuestionnaires.push(questionnaire._id);
      }
      
      // Update parent with children references
      parent.children = createdQuestionnaires;
      await parent.save();
    }

    // Populate and return the complete parent
    const populatedParent = await ISQMParent.findById(parent._id)
      .populate('questionnaires');

    res.status(201).json(populatedParent);
  } catch (err) {
    next(err);
  }
};

// Get all ISQM Parents
exports.getAllISQMParents = async (req, res, next) => {
  try {
    const { 
      status, 
      createdBy, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    let filter = {};
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const parents = await ISQMParent.find(filter)
      .populate('questionnaires', 'key heading status stats')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await ISQMParent.countDocuments(filter);

    res.json({
      parents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + parents.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get ISQM Parent by ID
exports.getISQMParentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parent = await ISQMParent.findById(id)
      .populate('questionnaires');

    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    res.json(parent);
  } catch (err) {
    next(err);
  }
};

// Update ISQM Parent
exports.updateISQMParent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.children;
    delete updates.createdBy;
    delete updates.createdAt;

    const parent = await ISQMParent.findByIdAndUpdate(id, updates, { new: true })
      .populate('questionnaires');

    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    res.json(parent);
  } catch (err) {
    next(err);
  }
};

// Delete ISQM Parent (cascade delete questionnaires)
exports.deleteISQMParent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parent = await ISQMParent.findById(id);
    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    // Cascade delete all questionnaires
    await ISQMQuestionnaire.deleteMany({ parentId: id });

    // Delete the parent
    await ISQMParent.findByIdAndDelete(id);

    res.json({ message: 'ISQM Parent and all questionnaires deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * ISQM Questionnaire Controllers
 */

// Create a new questionnaire
exports.createQuestionnaire = async (req, res, next) => {
  try {
    const { parentId, key, heading, description, version, framework, sections } = req.body;

    // Verify parent exists
    const parent = await ISQMParent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    // Check if questionnaire with same key already exists for this parent
    const existingQuestionnaire = await ISQMQuestionnaire.findOne({ parentId, key });
    if (existingQuestionnaire) {
      return res.status(400).json({ message: 'Questionnaire with this key already exists for this parent' });
    }

    const questionnaire = await ISQMQuestionnaire.create({
      parentId,
      key,
      heading,
      description,
      version,
      framework,
      sections: sections || []
    });

    // Add to parent's children array
    parent.children.push(questionnaire._id);
    await parent.save();

    res.status(201).json(questionnaire);
  } catch (err) {
    next(err);
  }
};

// Get all questionnaires for a parent
exports.getQuestionnairesByParent = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    const questionnaires = await ISQMQuestionnaire.find({ parentId })
      .populate('parent', 'metadata.title')
      .sort({ createdAt: 1 });

    res.json(questionnaires);
  } catch (err) {
    next(err);
  }
};

// Get questionnaire by ID
exports.getQuestionnaireById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id)
      .populate('parent', 'metadata.title');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    res.json(questionnaire);
  } catch (err) {
    next(err);
  }
};

// Update questionnaire
exports.updateQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.parentId;
    delete updates.createdAt;

    const questionnaire = await ISQMQuestionnaire.findByIdAndUpdate(id, updates, { new: true })
      .populate('parent', 'metadata.title');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    res.json(questionnaire);
  } catch (err) {
    next(err);
  }
};

// Delete questionnaire
exports.deleteQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Remove from parent's children array
    await ISQMParent.findByIdAndUpdate(questionnaire.parentId, {
      $pull: { children: questionnaire._id }
    });

    // Delete the questionnaire
    await ISQMQuestionnaire.findByIdAndDelete(id);

    res.json({ message: 'Questionnaire deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Update question answer
exports.updateQuestionAnswer = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex, questionIndex } = req.params;
    const { answer, comments } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(400).json({ message: 'Invalid section index' });
    }

    const question = section.qna[questionIndex];
    if (!question) {
      return res.status(400).json({ message: 'Invalid question index' });
    }

    // Update the answer
    question.answer = answer;
    question.answeredAt = new Date();
    question.answeredBy = req.user.id;

    // Add comment if provided
    if (comments) {
      question.comments.push({
        text: comments,
        addedBy: req.user.id,
        addedAt: new Date()
      });
    }

    // Save the questionnaire (pre-save middleware will update stats)
    await questionnaire.save();

    res.json(questionnaire);
  } catch (err) {
    next(err);
  }
};

// Add section note
exports.addSectionNote = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex } = req.params;
    const { text } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(400).json({ message: 'Invalid section index' });
    }

    section.notes.push({
      text,
      addedBy: req.user.id,
      addedAt: new Date()
    });

    await questionnaire.save();

    res.json(questionnaire);
  } catch (err) {
    next(err);
  }
};

// Get questionnaire statistics
exports.getQuestionnaireStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const stats = {
      questionnaire: {
        id: questionnaire._id,
        key: questionnaire.key,
        heading: questionnaire.heading,
        status: questionnaire.status
      },
      overall: questionnaire.stats,
      sections: questionnaire.sections.map(section => ({
        heading: section.heading,
        totalQuestions: section.qna.length,
        answeredQuestions: section.qna.filter(q => q.answer && q.answer.trim() !== '').length,
        completionPercentage: section.completionPercentage,
        isCompleted: section.isCompleted
      }))
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// Bulk update questionnaire answers
exports.bulkUpdateAnswers = async (req, res, next) => {
  try {
    const { questionnaireId } = req.params;
    const { answers } = req.body; // Array of { sectionIndex, questionIndex, answer }

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    let updatedCount = 0;

    for (const answerUpdate of answers) {
      const { sectionIndex, questionIndex, answer } = answerUpdate;
      
      const section = questionnaire.sections[sectionIndex];
      if (section && section.qna[questionIndex]) {
        const question = section.qna[questionIndex];
        question.answer = answer;
        question.answeredAt = new Date();
        question.answeredBy = req.user.id;
        updatedCount++;
      }
    }

    await questionnaire.save();

    res.json({
      message: `${updatedCount} answers updated successfully`,
      updatedCount,
      questionnaire
    });
  } catch (err) {
    next(err);
  }
};

// Export questionnaire data
exports.exportQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const questionnaire = await ISQMQuestionnaire.findById(id)
      .populate('parent', 'metadata.title');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    if (format === 'csv') {
      // Generate CSV format
      let csvContent = 'Section,Question,Answer,Answered By,Answered At\n';
      
      questionnaire.sections.forEach(section => {
        section.qna.forEach(qna => {
          csvContent += `"${section.heading}","${qna.question}","${qna.answer || ''}","${qna.answeredBy || ''}","${qna.answeredAt || ''}"\n`;
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${questionnaire.key}_export.csv`);
      res.send(csvContent);
    } else {
      // Return JSON format
      res.json(questionnaire);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * ISQM Supporting Document Controllers
 */

// Create supporting document request
exports.createSupportingDocument = async (req, res, next) => {
  try {
    const { 
      parentId, 
      category, 
      title, 
      description, 
      priority = 'medium',
      isMandatory = false,
      dueDate,
      tags = [],
      framework,
      jurisdiction
    } = req.body;

    // Verify parent exists
    const parent = await ISQMParent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    const supportingDoc = await ISQMSupportingDocument.create({
      parentId,
      category,
      title,
      description,
      priority,
      isMandatory,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags,
      framework,
      jurisdiction,
      requestedBy: req.user.id,
      status: 'pending'
    });

    // Add to parent's supporting documents array
    parent.supportingDocuments.push(supportingDoc._id);
    await parent.save();

    res.status(201).json(supportingDoc);
  } catch (err) {
    next(err);
  }
};

// Get supporting documents by parent
exports.getSupportingDocumentsByParent = async (req, res, next) => {
  try {
    const { parentId } = req.params;
    const { category, status, priority } = req.query;

    // Build filter
    let filter = { parentId };
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const documents = await ISQMSupportingDocument.find(filter)
      .populate('parent', 'metadata.title')
      .sort({ priority: -1, createdAt: -1 });

    res.json(documents);
  } catch (err) {
    next(err);
  }
};

// Get supporting document by ID
exports.getSupportingDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await ISQMSupportingDocument.findById(id)
      .populate('parent', 'metadata.title');

    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    res.json(document);
  } catch (err) {
    next(err);
  }
};

// Update supporting document
exports.updateSupportingDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.parentId;
    delete updates.createdAt;
    delete updates.requestedBy;

    const document = await ISQMSupportingDocument.findByIdAndUpdate(id, updates, { new: true })
      .populate('parent', 'metadata.title');

    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    res.json(document);
  } catch (err) {
    next(err);
  }
};

// Delete supporting document
exports.deleteSupportingDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await ISQMSupportingDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    // Remove from parent's supporting documents array
    await ISQMParent.findByIdAndUpdate(document.parentId, {
      $pull: { supportingDocuments: document._id }
    });

    // Delete the supporting document
    await ISQMSupportingDocument.findByIdAndDelete(id);

    res.json({ message: 'Supporting document deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Upload document file
exports.uploadDocumentFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { version = '1.0' } = req.body;

    const document = await ISQMSupportingDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Add uploaded files to the document
    for (const file of req.files) {
      await document.addDocument({
        name: file.originalname,
        url: file.url || file.path, // Assuming file upload middleware sets this
        uploadedBy: req.user.id,
        fileSize: file.size,
        mimeType: file.mimetype,
        version
      });
    }

    res.json(document);
  } catch (err) {
    next(err);
  }
};

// Review supporting document
exports.reviewSupportingDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reviewComments } = req.body;

    const validStatuses = ['reviewed', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: reviewed, approved, rejected' 
      });
    }

    const document = await ISQMSupportingDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    // Update review information
    document.status = status;
    document.reviewedBy = req.user.id;
    document.reviewedAt = new Date();
    document.reviewComments = reviewComments;

    if (status === 'approved') {
      document.approvedBy = req.user.id;
      document.approvedAt = new Date();
    }

    await document.save();

    res.json(document);
  } catch (err) {
    next(err);
  }
};

// Add note to supporting document
exports.addDocumentNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const document = await ISQMSupportingDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: 'Supporting document not found' });
    }

    document.notes.push({
      text,
      addedBy: req.user.id,
      addedAt: new Date()
    });

    await document.save();

    res.json(document);
  } catch (err) {
    next(err);
  }
};

// Get supporting document statistics
exports.getSupportingDocumentStats = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    const stats = await ISQMSupportingDocument.aggregate([
      { $match: { parentId: require('mongoose').Types.ObjectId(parentId) } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          pendingDocuments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          uploadedDocuments: {
            $sum: { $cond: [{ $eq: ['$status', 'uploaded'] }, 1, 0] }
          },
          reviewedDocuments: {
            $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] }
          },
          approvedDocuments: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedDocuments: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          averageCompletion: { $avg: '$completionPercentage' }
        }
      }
    ]);

    const categoryStats = await ISQMSupportingDocument.aggregate([
      { $match: { parentId: require('mongoose').Types.ObjectId(parentId) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overall: stats[0] || {
        totalDocuments: 0,
        pendingDocuments: 0,
        uploadedDocuments: 0,
        reviewedDocuments: 0,
        approvedDocuments: 0,
        rejectedDocuments: 0,
        averageCompletion: 0
      },
      byCategory: categoryStats
    });
  } catch (err) {
    next(err);
  }
};
