const ISQMParent = require('../models/ISQMParent');
const ISQMQuestionnaire = require('../models/ISQMQuestionnaire');
const ISQMSupportingDocument = require('../models/ISQMSupportingDocument');
const { formatISQMPrompt, validateISQMData, getAvailablePrompts } = require('../prompts/isqmPrompts');
const { openai_pbc } = require('../config/openai');
const { supabase } = require('../config/supabase');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

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

// Update question text
exports.updateQuestionText = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex, questionIndex } = req.params;
    const { text } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const question = section.qna[questionIndex];
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Update question text
    question.question = text;
    question.updatedAt = new Date();
    question.updatedBy = req.user.id;

    await questionnaire.save();

    res.json({
      message: 'Question text updated successfully',
      question: question
    });
  } catch (err) {
    next(err);
  }
};

// Delete question
exports.deleteQuestion = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex, questionIndex } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (questionIndex >= section.qna.length) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Remove question from section
    section.qna.splice(questionIndex, 1);

    await questionnaire.save();

    res.json({
      message: 'Question deleted successfully',
      questionnaire: questionnaire
    });
  } catch (err) {
    next(err);
  }
};

// Add question note
exports.addQuestionNote = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex, questionIndex } = req.params;
    const { note } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const question = section.qna[questionIndex];
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Add note to question
    if (!question.notes) {
      question.notes = [];
    }
    
    question.notes.push({
      note: note,
      addedBy: req.user.id,
      addedAt: new Date()
    });

    await questionnaire.save();

    res.json({
      message: 'Question note added successfully',
      question: question
    });
  } catch (err) {
    next(err);
  }
};

// Update section heading
exports.updateSectionHeading = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex } = req.params;
    const { heading } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const section = questionnaire.sections[sectionIndex];
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Update section heading
    section.heading = heading;
    section.updatedAt = new Date();
    section.updatedBy = req.user.id;

    await questionnaire.save();

    res.json({
      message: 'Section heading updated successfully',
      section: section
    });
  } catch (err) {
    next(err);
  }
};

// Delete section
exports.deleteSection = async (req, res, next) => {
  try {
    const { questionnaireId, sectionIndex } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    if (sectionIndex >= questionnaire.sections.length) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Remove section from questionnaire
    questionnaire.sections.splice(sectionIndex, 1);

    await questionnaire.save();

    res.json({
      message: 'Section deleted successfully',
      questionnaire: questionnaire
    });
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

/**
 * ISQM Document Generation Controllers
 */

// Helper function to generate PDF from text content
async function generatePDF(content, filename, title) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const outputPath = path.join(__dirname, '../temp', `${filename}.pdf`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(outputPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Add title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown(2);
      
      // Add content
      doc.fontSize(12);
      
      // Split content into paragraphs and add to PDF
      const paragraphs = content.split('\n\n');
      paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
          // Handle headers (lines starting with #)
          if (paragraph.startsWith('#')) {
            const headerText = paragraph.replace(/^#+\s*/, '');
            doc.fontSize(16).text(headerText, { align: 'left' });
            doc.moveDown(0.5);
          } else {
            doc.fontSize(12).text(paragraph, { align: 'left' });
            doc.moveDown(1);
          }
        }
      });
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(outputPath);
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to upload PDF to Supabase
async function uploadPDFToSupabase(filePath, fileName, bucketName = 'global-documents') {
  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Create folder structure: isqm-documents/policies/ or isqm-documents/procedures/
    const fullPath = `isqm-documents/${fileName}`;
    
    // Upload to global-documents bucket with isqm-documents folder structure
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fullPath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '0'
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Get the public URL with versioning (same pattern as other controllers)
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    const versionedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    return {
      success: true,
      fileName: data.path,
      publicUrl: versionedUrl,
      bucketName,
      folderPath: 'isqm-documents'
    };
  } catch (error) {
    console.error('Error uploading PDF to Supabase:', error);
    throw error;
  }
}

// Generate policy document from ISQM questionnaire
exports.generatePolicyDocument = async (req, res, next) => {
  try {
    const { questionnaireId } = req.params;
    const { firmDetails = {} } = req.body;

    // Get the questionnaire with parent information
    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId)
      .populate('parent', 'metadata.title metadata.version metadata.jurisdiction_note');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Format ISQM data for prompt
    const isqmData = {
      componentName: questionnaire.heading,
      questionnaire: {
        key: questionnaire.key,
        heading: questionnaire.heading,
        sections: questionnaire.sections.map(section => ({
          heading: section.heading,
          qna: section.qna.map(qna => ({
            question: qna.question,
            answer: qna.answer,
            state: qna.state
          }))
        }))
      },
      firmDetails: {
        size: firmDetails.size || 'mid-sized',
        jurisdiction: questionnaire.parent?.metadata?.jurisdiction_note || 'UK',
        specializations: firmDetails.specializations || ['audit', 'tax', 'advisory'],
        ...firmDetails
      }
    };

    // Validate data structure
    if (!validateISQMData(isqmData)) {
      return res.status(400).json({ message: 'Invalid ISQM data structure' });
    }

    // Format prompt with data
    const prompt = formatISQMPrompt(isqmData, 'POLICY_GENERATOR');

    // Generate policy using openai_pbc
    const completion = await openai_pbc.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in ISQM 1 and audit firm quality management systems. Generate professional, comprehensive policy documents in PDF-ready format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });

    const generatedPolicy = completion.choices[0].message.content;

    // Generate PDF from the content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const policyFilename = `${questionnaire.key}_policy_${timestamp}`;
    
    const policyPDFPath = await generatePDF(
      generatedPolicy,
      policyFilename,
      `${questionnaire.heading} - Policy Document`
    );

    // Upload PDF to Supabase
    const supabaseFileName = `policies/${policyFilename}.pdf`;
    const uploadResult = await uploadPDFToSupabase(policyPDFPath, supabaseFileName);

    // Add policy URL to questionnaire
    await questionnaire.addPolicyUrl({
      name: `${questionnaire.heading} Policy`,
      url: uploadResult.publicUrl, // Using Supabase public URL
      version: "1.0",
      uploadedBy: req.user.id,
      description: `AI-generated policy document for ${questionnaire.heading}`
    });

    // Log the generation activity
    console.log(`Policy generated and URL added for questionnaire ${questionnaireId} by user ${req.user.id}`);

    res.json({
      success: true,
      questionnaireId,
      componentName: questionnaire.heading,
      generatedDocument: generatedPolicy,
      pdfPath: policyPDFPath,
      pdfFilename: `${policyFilename}.pdf`,
      supabaseUrl: uploadResult.publicUrl,
      supabaseFileName: uploadResult.fileName,
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        promptType: 'POLICY_GENERATOR'
      }
    });

  } catch (err) {
    console.error('Policy generation error:', err);
    next(err);
  }
};

// Generate procedure document from ISQM questionnaire
exports.generateProcedureDocument = async (req, res, next) => {
  try {
    const { questionnaireId } = req.params;
    const { firmDetails = {}, policyDetails = {} } = req.body;

    // Get the questionnaire with parent information
    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId)
      .populate('parent', 'metadata.title metadata.version metadata.jurisdiction_note');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Format ISQM data for prompt
    const isqmData = {
      componentName: questionnaire.heading,
      policy: {
        title: policyDetails.title || `${questionnaire.heading} Policy`,
        requirements: policyDetails.requirements || [],
        responsibilities: policyDetails.responsibilities || {}
      },
      questionnaire: {
        key: questionnaire.key,
        heading: questionnaire.heading,
        sections: questionnaire.sections.map(section => ({
          heading: section.heading,
          qna: section.qna.map(qna => ({
            question: qna.question,
            answer: qna.answer,
            state: qna.state
          }))
        }))
      },
      firmDetails: {
        size: firmDetails.size || 'mid-sized',
        jurisdiction: questionnaire.parent?.metadata?.jurisdiction_note || 'UK',
        specializations: firmDetails.specializations || ['audit', 'tax', 'advisory'],
        processes: firmDetails.processes || [],
        ...firmDetails
      }
    };

    // Validate data structure
    if (!validateISQMData(isqmData)) {
      return res.status(400).json({ message: 'Invalid ISQM data structure' });
    }

    // Format prompt with data
    const prompt = formatISQMPrompt(isqmData, 'PROCEDURE_GENERATOR');

    // Generate procedure using openai_pbc
    const completion = await openai_pbc.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in ISQM 1 and audit firm operational procedures. Generate detailed, actionable procedure documents in PDF-ready format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });

    const generatedProcedure = completion.choices[0].message.content;

    // Generate PDF from the content
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const procedureFilename = `${questionnaire.key}_procedure_${timestamp}`;
    
    const procedurePDFPath = await generatePDF(
      generatedProcedure,
      procedureFilename,
      `${questionnaire.heading} - Procedure Document`
    );

    // Upload PDF to Supabase
    const supabaseFileName = `procedures/${procedureFilename}.pdf`;
    const uploadResult = await uploadPDFToSupabase(procedurePDFPath, supabaseFileName);

    // Add procedure URL to questionnaire
    await questionnaire.addProcedureUrl({
      name: `${questionnaire.heading} Procedure`,
      url: uploadResult.publicUrl, // Using Supabase public URL
      version: "1.0",
      uploadedBy: req.user.id,
      description: `AI-generated procedure document for ${questionnaire.heading}`
    });

    // Log the generation activity
    console.log(`Procedure generated and URL added for questionnaire ${questionnaireId} by user ${req.user.id}`);

    res.json({
      success: true,
      questionnaireId,
      componentName: questionnaire.heading,
      generatedDocument: generatedProcedure,
      pdfPath: procedurePDFPath,
      pdfFilename: `${procedureFilename}.pdf`,
      supabaseUrl: uploadResult.publicUrl,
      supabaseFileName: uploadResult.fileName,
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        promptType: 'PROCEDURE_GENERATOR'
      }
    });

  } catch (err) {
    console.error('Procedure generation error:', err);
    next(err);
  }
};

// Generate risk assessment from ISQM questionnaire
exports.generateRiskAssessment = async (req, res, next) => {
  try {
    const { questionnaireId } = req.params;
    const { firmDetails = {} } = req.body;

    // Get the questionnaire with parent information
    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId)
      .populate('parent', 'metadata.title metadata.version metadata.jurisdiction_note');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Format ISQM data for prompt
    const isqmData = {
      componentName: questionnaire.heading,
      questionnaire: {
        key: questionnaire.key,
        heading: questionnaire.heading,
        sections: questionnaire.sections.map(section => ({
          heading: section.heading,
          qna: section.qna.map(qna => ({
            question: qna.question,
            answer: qna.answer,
            state: qna.state
          }))
        }))
      },
      firmDetails: {
        size: firmDetails.size || 'mid-sized',
        jurisdiction: questionnaire.parent?.metadata?.jurisdiction_note || 'UK',
        specializations: firmDetails.specializations || ['audit', 'tax', 'advisory'],
        ...firmDetails
      }
    };

    // Validate data structure
    if (!validateISQMData(isqmData)) {
      return res.status(400).json({ message: 'Invalid ISQM data structure' });
    }

    // Format prompt with data
    const prompt = formatISQMPrompt(isqmData, 'RISK_ASSESSMENT_GENERATOR');

    // Generate risk assessment using OpenAI
    const completion = await openai_pbc.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in audit risk management and ISQM 1 quality management systems. Generate comprehensive risk assessments in PDF-ready format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3
    });

    const generatedRiskAssessment = completion.choices[0].message.content;

    // Log the generation activity
    console.log(`Risk assessment generated for questionnaire ${questionnaireId} by user ${req.user.id}`);

    res.json({
      success: true,
      questionnaireId,
      componentName: questionnaire.heading,
      generatedDocument: generatedRiskAssessment,
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        promptType: 'RISK_ASSESSMENT_GENERATOR'
      }
    });

  } catch (err) {
    console.error('Risk assessment generation error:', err);
    next(err);
  }
};

// Generate compliance checklist from ISQM questionnaire
exports.generateComplianceChecklist = async (req, res, next) => {
  try {
    const { questionnaireId } = req.params;
    const { firmDetails = {} } = req.body;

    // Get the questionnaire with parent information
    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId)
      .populate('parent', 'metadata.title metadata.version metadata.jurisdiction_note');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Format ISQM data for prompt
    const isqmData = {
      componentName: questionnaire.heading,
      questionnaire: {
        key: questionnaire.key,
        heading: questionnaire.heading,
        sections: questionnaire.sections.map(section => ({
          heading: section.heading,
          qna: section.qna.map(qna => ({
            question: qna.question,
            answer: qna.answer,
            state: qna.state
          }))
        }))
      },
      firmDetails: {
        size: firmDetails.size || 'mid-sized',
        jurisdiction: questionnaire.parent?.metadata?.jurisdiction_note || 'UK',
        specializations: firmDetails.specializations || ['audit', 'tax', 'advisory'],
        ...firmDetails
      }
    };

    // Validate data structure
    if (!validateISQMData(isqmData)) {
      return res.status(400).json({ message: 'Invalid ISQM data structure' });
    }

    // Format prompt with data
    const prompt = formatISQMPrompt(isqmData, 'COMPLIANCE_CHECKLIST_GENERATOR');

    // Generate compliance checklist using OpenAI
    const completion = await openai_pbc.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in ISQM 1 compliance and audit firm quality management. Generate practical, actionable compliance checklists in PDF-ready format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3
    });

    const generatedChecklist = completion.choices[0].message.content;

    // Log the generation activity
    console.log(`Compliance checklist generated for questionnaire ${questionnaireId} by user ${req.user.id}`);

    res.json({
      success: true,
      questionnaireId,
      componentName: questionnaire.heading,
      generatedDocument: generatedChecklist,
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        promptType: 'COMPLIANCE_CHECKLIST_GENERATOR'
      }
    });

  } catch (err) {
    console.error('Compliance checklist generation error:', err);
    next(err);
  }
};

// Get available generation types
exports.getGenerationTypes = async (req, res, next) => {
  try {
    const availableTypes = getAvailablePrompts();
    
    res.json({
      success: true,
      availableTypes: availableTypes.map(type => ({
        type,
        description: getTypeDescription(type)
      }))
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to get type descriptions
function getTypeDescription(type) {
  const descriptions = {
    'POLICY_GENERATOR': 'Generate formal quality management policies',
    'PROCEDURE_GENERATOR': 'Generate detailed implementation procedures',
    'RISK_ASSESSMENT_GENERATOR': 'Generate comprehensive risk assessments',
    'COMPLIANCE_CHECKLIST_GENERATOR': 'Generate compliance checklists'
  };
  
  return descriptions[type] || 'Unknown generation type';
}

/**
 * Automatic ISQM Document Generation
 */

// Generate both policy and procedure documents automatically from completed ISQM
exports.generateISQMDocuments = async (req, res, next) => {
  try {
    const { parentId } = req.params;
    const { firmDetails = {} } = req.body;

    // Get the ISQM parent with all completed questionnaires
    const parent = await ISQMParent.findById(parentId)
      .populate({
        path: 'children',
        match: { status: 'completed' }, // Only get completed questionnaires
        populate: {
          path: 'parent',
          select: 'metadata.title metadata.version metadata.jurisdiction_note'
        }
      });

    if (!parent) {
      return res.status(404).json({ message: 'ISQM Parent not found' });
    }

    // Check if there are any completed questionnaires
    const completedQuestionnaires = parent.children.filter(child => child.status === 'completed');
    if (completedQuestionnaires.length === 0) {
      return res.status(400).json({ 
        message: 'No completed questionnaires found. Please complete at least one questionnaire before generating documents.' 
      });
    }

    const generatedDocuments = {
      parent: {
        id: parent._id,
        title: parent.metadata.title,
        version: parent.metadata.version,
        jurisdiction: parent.metadata.jurisdiction_note
      },
      questionnaires: [],
      policies: [],
      procedures: [],
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        totalQuestionnaires: completedQuestionnaires.length
      }
    };

    // Process each completed questionnaire
    for (const questionnaire of completedQuestionnaires) {
      try {
        // Format ISQM data for prompt
        const isqmData = {
          componentName: questionnaire.heading,
          questionnaire: {
            key: questionnaire.key,
            heading: questionnaire.heading,
            sections: questionnaire.sections.map(section => ({
              heading: section.heading,
              qna: section.qna.map(qna => ({
                question: qna.question,
                answer: qna.answer,
                state: qna.state
              }))
            }))
          },
          firmDetails: {
            size: firmDetails.size || 'mid-sized',
            jurisdiction: parent.metadata.jurisdiction_note || 'UK',
            specializations: firmDetails.specializations || ['audit', 'tax', 'advisory'],
            ...firmDetails
          }
        };

        // Validate data structure
        if (!validateISQMData(isqmData)) {
          console.warn(`Invalid data structure for questionnaire ${questionnaire._id}`);
          continue;
        }

        // Generate Policy Document using openai_pbc
        const policyPrompt = formatISQMPrompt(isqmData, 'POLICY_GENERATOR');
        const policyCompletion = await openai_pbc.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in ISQM 1 and audit firm quality management systems. Generate professional, comprehensive policy documents in PDF-ready format.'
            },
            {
              role: 'user',
              content: policyPrompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.3
        });

        // Generate Procedure Document using openai_pbc
        const procedurePrompt = formatISQMPrompt({
          ...isqmData,
          policy: {
            title: `${questionnaire.heading} Policy`,
            requirements: [],
            responsibilities: {}
          }
        }, 'PROCEDURE_GENERATOR');
        
        const procedureCompletion = await openai_pbc.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in ISQM 1 and audit firm operational procedures. Generate detailed, actionable procedure documents in PDF-ready format.'
            },
            {
              role: 'user',
              content: procedurePrompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.3
        });

        // Generate PDFs from the content
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const policyFilename = `${questionnaire.key}_policy_${timestamp}`;
        const procedureFilename = `${questionnaire.key}_procedure_${timestamp}`;
        
        const policyPDFPath = await generatePDF(
          policyCompletion.choices[0].message.content,
          policyFilename,
          `${questionnaire.heading} - Policy Document`
        );
        
        const procedurePDFPath = await generatePDF(
          procedureCompletion.choices[0].message.content,
          procedureFilename,
          `${questionnaire.heading} - Procedure Document`
        );

        // Upload PDFs to Supabase
        const policySupabaseFileName = `policies/${policyFilename}.pdf`;
        const procedureSupabaseFileName = `procedures/${procedureFilename}.pdf`;
        
        const policyUploadResult = await uploadPDFToSupabase(policyPDFPath, policySupabaseFileName);
        const procedureUploadResult = await uploadPDFToSupabase(procedurePDFPath, procedureSupabaseFileName);

        // Add URLs to questionnaire
        await questionnaire.addPolicyUrl({
          name: `${questionnaire.heading} Policy`,
          url: policyUploadResult.publicUrl,
          version: "1.0",
          uploadedBy: req.user.id,
          description: `AI-generated policy document for ${questionnaire.heading}`
        });

        await questionnaire.addProcedureUrl({
          name: `${questionnaire.heading} Procedure`,
          url: procedureUploadResult.publicUrl,
          version: "1.0",
          uploadedBy: req.user.id,
          description: `AI-generated procedure document for ${questionnaire.heading}`
        });

        // Store generated documents
        const questionnaireData = {
          id: questionnaire._id,
          key: questionnaire.key,
          heading: questionnaire.heading,
          completionPercentage: questionnaire.stats.completionPercentage,
          totalQuestions: questionnaire.stats.totalQuestions,
          answeredQuestions: questionnaire.stats.answeredQuestions
        };

        const policyDocument = {
          questionnaireId: questionnaire._id,
          componentName: questionnaire.heading,
          componentKey: questionnaire.key,
          document: policyCompletion.choices[0].message.content,
          pdfPath: policyPDFPath,
          pdfFilename: `${policyFilename}.pdf`,
          supabaseUrl: policyUploadResult.publicUrl,
          supabaseFileName: policyUploadResult.fileName,
          generatedAt: new Date(),
          generatedBy: req.user.id,
          model: 'gpt-4o-mini',
          promptType: 'POLICY_GENERATOR'
        };

        const procedureDocument = {
          questionnaireId: questionnaire._id,
          componentName: questionnaire.heading,
          componentKey: questionnaire.key,
          document: procedureCompletion.choices[0].message.content,
          pdfPath: procedurePDFPath,
          pdfFilename: `${procedureFilename}.pdf`,
          supabaseUrl: procedureUploadResult.publicUrl,
          supabaseFileName: procedureUploadResult.fileName,
          generatedAt: new Date(),
          generatedBy: req.user.id,
          model: 'gpt-4o-mini',
          promptType: 'PROCEDURE_GENERATOR'
        };

        generatedDocuments.questionnaires.push(questionnaireData);
        generatedDocuments.policies.push(policyDocument);
        generatedDocuments.procedures.push(procedureDocument);

        // Log successful generation
        console.log(`Generated documents for questionnaire ${questionnaire._id} (${questionnaire.key})`);

      } catch (err) {
        console.error(`Error generating documents for questionnaire ${questionnaire._id}:`, err);
        // Continue with other questionnaires even if one fails
      }
    }

    // Check if any documents were generated
    if (generatedDocuments.policies.length === 0) {
      return res.status(500).json({ 
        message: 'Failed to generate any documents. Please check questionnaire completion status and try again.' 
      });
    }

    // Log the overall generation activity
    console.log(`Generated ${generatedDocuments.policies.length} policies and ${generatedDocuments.procedures.length} procedures for ISQM parent ${parentId} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Successfully generated ${generatedDocuments.policies.length} policy documents and ${generatedDocuments.procedures.length} procedure documents`,
      ...generatedDocuments
    });

  } catch (err) {
    console.error('Automatic ISQM document generation error:', err);
    next(err);
  }
};

/**
 * ISQM URL Management Controllers
 */

// Add procedure URL to questionnaire
exports.addProcedureUrl = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, url, version = "1.0", description } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    await questionnaire.addProcedureUrl({
      name,
      url,
      version,
      uploadedBy: req.user.id,
      description
    });

    res.json({
      success: true,
      questionnaire: questionnaire,
      message: 'Procedure URL added successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Add policy URL to questionnaire
exports.addPolicyUrl = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, url, version = "1.0", description } = req.body;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    await questionnaire.addPolicyUrl({
      name,
      url,
      version,
      uploadedBy: req.user.id,
      description
    });

    res.json({
      success: true,
      questionnaire: questionnaire,
      message: 'Policy URL added successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get questionnaire URLs
exports.getQuestionnaireUrls = async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id)
      .select('key heading procedureUrls policyUrls')
      .populate('parent', 'metadata.title');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    res.json({
      success: true,
      questionnaireId: id,
      componentName: questionnaire.heading,
      componentKey: questionnaire.key,
      procedureUrls: questionnaire.procedureUrls,
      policyUrls: questionnaire.policyUrls,
      latestProcedure: questionnaire.getLatestProcedureUrl(),
      latestPolicy: questionnaire.getLatestPolicyUrl()
    });
  } catch (err) {
    next(err);
  }
};

// Remove procedure URL
exports.removeProcedureUrl = async (req, res, next) => {
  try {
    const { id, urlId } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    await questionnaire.removeProcedureUrl(urlId);

    res.json({
      success: true,
      message: 'Procedure URL removed successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Remove policy URL
exports.removePolicyUrl = async (req, res, next) => {
  try {
    const { id, urlId } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    await questionnaire.removePolicyUrl(urlId);

    res.json({
      success: true,
      message: 'Policy URL removed successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Get questionnaires by component type
exports.getQuestionnairesByComponentType = async (req, res, next) => {
  try {
    const { componentType } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questionnaires = await ISQMQuestionnaire.getByComponentType(componentType)
      .populate('parent', 'metadata.title')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalCount = await ISQMQuestionnaire.countDocuments({ 
      key: new RegExp(`^${componentType}_`, 'i') 
    });

    res.json({
      success: true,
      componentType,
      questionnaires,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + questionnaires.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get questionnaires by tags
exports.getQuestionnairesByTags = async (req, res, next) => {
  try {
    const { tags } = req.query;
    const { page = 1, limit = 20 } = req.query;

    if (!tags) {
      return res.status(400).json({ message: 'Tags parameter is required' });
    }

    const tagArray = Array.isArray(tags) ? tags : tags.split(',');
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questionnaires = await ISQMQuestionnaire.getByTags(tagArray)
      .populate('parent', 'metadata.title')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Count total matching questionnaires
    const query = {
      $or: [
        { key: { $in: tagArray } },
        { heading: { $regex: tagArray.join('|'), $options: 'i' } },
        { framework: { $in: tagArray } }
      ]
    };
    const totalCount = await ISQMQuestionnaire.countDocuments(query);

    res.json({
      success: true,
      tags: tagArray,
      questionnaires,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + questionnaires.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get questionnaire tags
exports.getQuestionnaireTags = async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaire = await ISQMQuestionnaire.findById(id)
      .select('key heading framework status');

    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    const tags = questionnaire.generateTags();

    res.json({
      success: true,
      questionnaireId: id,
      componentName: questionnaire.heading,
      componentKey: questionnaire.key,
      generatedTags: tags,
      tagCount: tags.length
    });
  } catch (err) {
    next(err);
  }
};

// Generate category answers from policy document
exports.generateCategoryAnswers = async (req, res, next) => {
  try {
    const { questionnaireId, sectionId } = req.params;
    const { policyText, policyFile } = req.body;

    // Get the questionnaire
    const questionnaire = await ISQMQuestionnaire.findById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ message: 'Questionnaire not found' });
    }

    // Find the specific section
    const section = questionnaire.sections.find(s => s._id.toString() === sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    let extractedPolicyText = '';

    // Handle PDF file upload
    if (policyFile) {
      try {
        // If policyFile is a base64 string, decode it
        if (typeof policyFile === 'string' && policyFile.startsWith('data:')) {
          const base64Data = policyFile.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const pdfData = await pdfParse(buffer);
          extractedPolicyText = pdfData.text;
        } else if (Buffer.isBuffer(policyFile)) {
          const pdfData = await pdfParse(policyFile);
          extractedPolicyText = pdfData.text;
        } else {
          return res.status(400).json({ message: 'Invalid policy file format' });
        }
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return res.status(400).json({ message: 'Failed to parse PDF file' });
      }
    } else if (policyText) {
      extractedPolicyText = policyText;
    } else {
      return res.status(400).json({ message: 'Either policyText or policyFile is required' });
    }

    // Generate answers for each question in the section
    const generatedAnswers = [];
    
    for (let i = 0; i < section.qna.length; i++) {
      const question = section.qna[i];
      
      try {
        // Create AI prompt for policy analysis
        const analysisPrompt = `
You are an expert in ISQM 1 quality management systems and audit firm policies. 

Analyze the following policy document and answer the specific ISQM question.

POLICY DOCUMENT:
${extractedPolicyText}

ISQM QUESTION:
${question.question}

INSTRUCTIONS:
1. Carefully analyze the policy document to find information relevant to this specific question.
2. If the policy contains clear information that answers the question, provide a detailed answer based on the policy text.
3. If the policy mentions relevant information but it's incomplete, provide a partial answer and note what's missing.
4. If the policy doesn't contain any relevant information, respond with "No reference found in firm policies regarding this requirement. Policy update required."
5. Always base your answer on the actual policy text - quote specific sections when possible.
6. Mark the implementation status as "Implemented" if the policy fully addresses the requirement, "Partially Implemented" if it partially addresses it, or "Not Implemented" if it doesn't address it.

Please provide your response in the following JSON format:
{
  "answer": "Your detailed answer based on the policy analysis",
  "status": "Implemented|Partially Implemented|Not Implemented",
  "policyReferences": ["Specific quotes or references from the policy"],
  "gaps": ["Any gaps or missing elements identified"],
  "confidence": "High|Medium|Low"
}
`;

        // Call OpenAI to analyze the policy
        const completion = await openai_pbc.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in ISQM 1 quality management systems. Analyze policy documents and provide accurate, evidence-based answers to ISQM questions. Always respond with valid JSON format.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        const analysisResult = JSON.parse(completion.choices[0].message.content);
        
        // Update the question with the generated answer
        question.answer = analysisResult.answer;
        question.answeredAt = new Date();
        question.answeredBy = 'AI generated via policy';
        question.state = analysisResult.status === 'Implemented' || analysisResult.status === 'Partially Implemented';
        question.status = analysisResult.status;
        
        // Add AI analysis as a comment
        question.comments.push({
          text: `AI Analysis - Status: ${analysisResult.status}, Confidence: ${analysisResult.confidence}. Policy References: ${analysisResult.policyReferences?.join('; ') || 'None'}. Gaps: ${analysisResult.gaps?.join('; ') || 'None'}`,
          addedBy: 'AI generated via policy',
          addedAt: new Date()
        });

        generatedAnswers.push({
          questionIndex: i,
          question: question.question,
          answer: analysisResult.answer,
          status: analysisResult.status,
          confidence: analysisResult.confidence,
          policyReferences: analysisResult.policyReferences,
          gaps: analysisResult.gaps
        });

      } catch (questionError) {
        console.error(`Error processing question ${i}:`, questionError);
        
        // Set a default answer for failed questions
        question.answer = 'Error occurred during AI analysis. Manual review required.';
        question.answeredAt = new Date();
        question.answeredBy = 'AI generated via policy';
        question.state = false;
        question.status = 'Error';
        
        question.comments.push({
          text: 'AI analysis failed - manual review required',
          addedBy: 'AI generated via policy',
          addedAt: new Date()
        });

        generatedAnswers.push({
          questionIndex: i,
          question: question.question,
          answer: 'Error occurred during AI analysis. Manual review required.',
          status: 'Error',
          confidence: 'Low',
          policyReferences: [],
          gaps: ['AI analysis failed']
        });
      }
    }

    // Save the updated questionnaire
    await questionnaire.save();

    // Log the generation activity
    console.log(`Generated answers for section ${sectionId} in questionnaire ${questionnaireId} by user ${req.user.id}`);

    res.json({
      success: true,
      questionnaireId,
      sectionId,
      sectionHeading: section.heading,
      totalQuestions: section.qna.length,
      generatedAnswers,
      summary: {
        implemented: generatedAnswers.filter(a => a.status === 'Implemented').length,
        partiallyImplemented: generatedAnswers.filter(a => a.status === 'Partially Implemented').length,
        notImplemented: generatedAnswers.filter(a => a.status === 'Not Implemented').length,
        errors: generatedAnswers.filter(a => a.status === 'Error').length
      },
      metadata: {
        generatedAt: new Date(),
        generatedBy: req.user.id,
        model: 'gpt-4o-mini',
        policyTextLength: extractedPolicyText.length
      }
    });

  } catch (err) {
    console.error('Generate category answers error:', err);
    next(err);
  }
};
