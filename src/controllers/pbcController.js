const { PBC, QnACategory } = require('../models/ProvidedByClient');
const DocumentRequest = require('../models/DocumentRequest');
const Engagement = require('../models/Engagement');

/**
 * PBC Controllers
 */

// Create a new PBC workflow
exports.createPBC = async (req, res, next) => {
  try {
    const { engagementId, clientId, auditorId, documentRequests } = req.body;
    
    // Verify engagement exists
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: 'Engagement not found' });
    }

    // Check if PBC already exists for this engagement
    const existingPBC = await PBC.findOne({ engagement: engagementId });
    if (existingPBC) {
      return res.status(400).json({ message: 'PBC workflow already exists for this engagement' });
    }

    // Verify document requests exist if provided
    if (documentRequests && documentRequests.length > 0) {
      const validRequests = await DocumentRequest.find({ 
        _id: { $in: documentRequests },
        engagement: engagementId 
      });
      
      if (validRequests.length !== documentRequests.length) {
        return res.status(400).json({ message: 'Some document requests are invalid or not associated with this engagement' });
      }
    }

    const pbc = await PBC.create({
      engagement: engagementId,
      clientId: clientId || req.user.id,
      auditorId: auditorId || req.user.id,
      documentRequests: documentRequests || [],
      status: 'document-collection'
    });

    // Update engagement status to include PBC workflow
    await Engagement.findByIdAndUpdate(engagementId, { 
      status: 'pbc-data-collection' 
    });

    res.status(201).json(pbc);
  } catch (err) {
    next(err);
  }
};

// Get PBC by engagement ID
exports.getPBCByEngagement = async (req, res, next) => {
  try {
    const { engagementId } = req.params;
    
    const pbc = await PBC.findOne({ engagement: engagementId })
      .populate('engagement')
      .populate('documentRequests');
    
    if (!pbc) {
      return res.status(404).json({ message: 'PBC workflow not found for this engagement' });
    }

    // Get all categories for this PBC
    const categories = await QnACategory.find({ pbcId: pbc._id })
      .sort({ createdAt: 1 });

    res.json({
      ...pbc.toObject(),
      categories
    });
  } catch (err) {
    next(err);
  }
};

// Update PBC workflow
exports.updatePBC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates.engagement;
    delete updates.clientId;
    delete updates.auditorId;
    delete updates.createdAt;

    const pbc = await PBC.findByIdAndUpdate(id, updates, { new: true })
      .populate('engagement')
      .populate('documentRequests');
    
    if (!pbc) {
      return res.status(404).json({ message: 'PBC workflow not found' });
    }

    // Update engagement status based on PBC status
    const statusMapping = {
      'document-collection': 'pbc-data-collection',
      'qna-preparation': 'pbc-qna-preparation', 
      'client-responses': 'pbc-client-responses',
      'doubt-resolution': 'pbc-doubt-resolution',
      'submitted': 'active'
    };

    if (updates.status && statusMapping[updates.status]) {
      await Engagement.findByIdAndUpdate(pbc.engagement, {
        status: statusMapping[updates.status]
      });
    }

    res.json(pbc);
  } catch (err) {
    next(err);
  }
};

// Delete PBC workflow
exports.deletePBC = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const pbc = await PBC.findById(id);
    if (!pbc) {
      return res.status(404).json({ message: 'PBC workflow not found' });
    }

    // Cascade delete all categories and questions
    await QnACategory.deleteMany({ pbcId: id });
    
    // Delete the PBC
    await PBC.findByIdAndDelete(id);

    // Reset engagement status
    await Engagement.findByIdAndUpdate(pbc.engagement, {
      status: 'draft'
    });

    res.json({ message: 'PBC workflow deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * QnA Category Controllers
 */

// Create a new QnA category
exports.createCategory = async (req, res, next) => {
  try {
    const { pbcId, title } = req.body;
    
    // Verify PBC exists
    const pbc = await PBC.findById(pbcId);
    if (!pbc) {
      return res.status(404).json({ message: 'PBC workflow not found' });
    }

    const category = await QnACategory.create({
      pbcId,
      title
    });

    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

// Get all categories for a PBC
exports.getCategoriesByPBC = async (req, res, next) => {
  try {
    const { pbcId } = req.params;
    
    // Verify PBC exists
    const pbc = await PBC.findById(pbcId);
    if (!pbc) {
      return res.status(404).json({ message: 'PBC workflow not found' });
    }

    const categories = await QnACategory.find({ pbcId })
      .sort({ createdAt: 1 });

    res.json(categories);
  } catch (err) {
    next(err);
  }
};

// Add question to a category
exports.addQuestionToCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { question, isMandatory = false } = req.body;
    
    // Verify category exists
    const category = await QnACategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const newQuestion = {
      question,
      isMandatory,
      status: 'unanswered'
    };

    category.qnaQuestions.push(newQuestion);
    await category.save();

    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

// Update question status (answered/unanswered/doubt)
exports.updateQuestionStatus = async (req, res, next) => {
  try {
    const { categoryId, questionIndex } = req.params;
    const { status, answer, doubtReason } = req.body;
    
    // Verify category exists
    const category = await QnACategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Verify question index is valid
    if (questionIndex < 0 || questionIndex >= category.qnaQuestions.length) {
      return res.status(400).json({ message: 'Invalid question index' });
    }

    const question = category.qnaQuestions[questionIndex];
    
    // Update question status and answer
    question.status = status;
    if (answer !== undefined) {
      question.answer = answer;
    }
    
    if (status === 'answered') {
      question.answeredAt = new Date();
    } else if (status === 'doubt' && doubtReason) {
      // Add doubt discussion
      question.discussions.push({
        role: 'client',
        message: doubtReason
      });
    }

    await category.save();

    res.json(category);
  } catch (err) {
    next(err);
  }
};

// Delete category (cascade delete QnA)
exports.deleteCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    const category = await QnACategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await QnACategory.findByIdAndDelete(categoryId);

    res.json({ message: 'Category and all questions deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Add discussion to a question (for doubt resolution)
exports.addDiscussion = async (req, res, next) => {
  try {
    const { categoryId, questionIndex } = req.params;
    const { message, replyTo } = req.body;
    
    // Verify category exists
    const category = await QnACategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Verify question index is valid
    if (questionIndex < 0 || questionIndex >= category.qnaQuestions.length) {
      return res.status(400).json({ message: 'Invalid question index' });
    }

    const question = category.qnaQuestions[questionIndex];
    
    // Add discussion
    question.discussions.push({
      role: req.user.role === 'employee' ? 'auditor' : 'client',
      message,
      replyTo: replyTo || null
    });

    await category.save();

    res.json(category);
  } catch (err) {
    next(err);
  }
};

// Get all PBC workflows (for admin/auditor dashboard)
exports.getAllPBCs = async (req, res, next) => {
  try {
    const { status, clientId } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    
    const pbcs = await PBC.find(filter)
      .populate('engagement', 'title yearEndDate')
      .populate('documentRequests', 'category description status')
      .sort({ createdAt: -1 });

    res.json(pbcs);
  } catch (err) {
    next(err);
  }
};
