const { PBC, QnACategory } = require('../models/ProvidedByClient');
const DocumentRequest = require('../models/DocumentRequest');
const Engagement = require('../models/Engagement');
const { pbcPromptGenerator } = require("../services/pbcPromptGenerator")
const { openai_pbc } = require("../config/openai");
// controllers/pbcAIController.js
const fetch = require('node-fetch'); // npm i node-fetch
const { Types } = require('mongoose');

/**
 * PBC Controllers
 */

// Create a new PBC workflow
// Create a new PBC workflow
exports.createPBC = async (req, res, next) => {
  try {
    const {
      engagementId,
      clientId,
      auditorId,
      documentRequests,
      entityName,
      notes,
      customFields
    } = req.body;

    // 1️⃣ Verify engagement exists
    const engagement = await Engagement.findById(engagementId);
    if (!engagement) {
      return res.status(404).json({ message: 'Engagement not found' });
    }

    // 2️⃣ Check if PBC already exists for this engagement
    const existingPBC = await PBC.findOne({ engagement: engagementId });
    if (existingPBC) {
      return res.status(400).json({ message: 'PBC workflow already exists for this engagement' });
    }

    // 3️⃣ Verify provided document requests are valid for this engagement
    let validRequests = [];
    if (documentRequests && documentRequests.length > 0) {
      validRequests = await DocumentRequest.find({
        _id: { $in: documentRequests },
        engagement: engagementId
      });

      if (validRequests.length !== documentRequests.length) {
        return res.status(400).json({ message: 'Some document requests are invalid or not associated with this engagement' });
      }
    }

    // 4️⃣ Create the PBC workflow
    const pbc = await PBC.create({
      engagement: engagementId,
      clientId: clientId || engagement.clientId,
      auditorId: auditorId || req.user.id,
      documentRequests: validRequests.map(dr => dr._id),

      // ✅ pull directly from Engagement
      engagementTitle: engagement.title,
      yearEndDate: engagement.yearEndDate,
      trialBalanceUrl: engagement.trialBalanceUrl,
      trialBalance: engagement.trialBalance,
      excelURL: engagement.excelURL,

      // ✅ extra fields from req.body
      entityName,
      notes,
      customFields,

      status: 'document-collection',
      createdAt: new Date(),
      createdBy: req.user.id
    });

    // 5️⃣ Update engagement status
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

/**
   * Helper: get a small textual snippet if file seems textual (csv/txt/json)
   * Returns { snippet, isText }
   */
async function fetchFileAndSnippet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file ${url}: ${res.statusText}`);

  const contentType = res.headers.get('content-type') || '';
  const buffer = await res.buffer();

  // Simple heuristics: treat common text-like types as text
  const filenameGuess = (url.split('/').pop() || '').toLowerCase();
  const isTextType =
    contentType.includes('text') ||
    filenameGuess.endsWith('.csv') ||
    filenameGuess.endsWith('.txt') ||
    filenameGuess.endsWith('.json') ||
    filenameGuess.endsWith('.xml');

  if (isTextType) {
    // get safe substring, avoid enormous strings
    const text = buffer.toString('utf8');
    const snippet = text.length > 64 * 1024 ? text.slice(0, 64 * 1024) : text;
    return { buffer, contentType, isText: true, snippet };
  }

  // binary or unknown
  return { buffer, contentType, isText: false, snippet: null };
}

/**
 * Upload a buffer to OpenAI files endpoint for "assistants" purpose
 * Returns openaiFileId string
 */
async function uploadBufferToOpenAI(buffer, filename) {
  // Many OpenAI Node SDKs allow passing a Buffer or a Readable stream.
  // If your SDK requires a different shape, adapt this call.
  const upload = await openai_pbc.files.create({
    file: buffer, // Buffer
    filename: filename,
    purpose: 'assistants'
  });

  // upload.id or upload.data?.id depending on SDK version; check and adapt
  // We'll try a couple of common shapes:
  const fileId = upload?.id || (upload?.data && upload.data.id) || upload?.data?.[0]?.id;
  if (!fileId) {
    throw new Error('OpenAI file upload returned unexpected response: ' + JSON.stringify(upload));
  }
  return fileId;
}

/**
 * POST /pbc/:pbcId/generate-qna-ai
 * - Only runs when pbc.status === 'qna-preparation'
 * - Downloads completed document requests' files
 * - Uploads binary docs to OpenAI Files for assistant usage
 * - Calls OpenAI with generated prompt
 * - Persists categories/questions into QnACategory
 */
exports.generateQnAUsingAI = async (req, res, next) => {
  try {
    const { pbcId } = req.params;
    if (!Types.ObjectId.isValid(pbcId)) {
      return res.status(400).json({ success: false, message: 'Invalid pbcId' });
    }

    const pbc = await PBC.findById(pbcId).lean();
    if (!pbc) return res.status(404).json({ success: false, message: 'PBC not found' });

    if (pbc.status !== 'qna-preparation') {
      return res.status(400).json({ success: false, message: 'PBC not in qna-preparation stage' });
    }

    // Fetch DocumentRequests referenced in PBC, but only those marked completed
    const docRequests = await DocumentRequest.find({
      _id: { $in: pbc.documentRequests || [] },
      status: 'completed'
    }).lean();

    // For each document in each request: download & either extract snippet or upload to OpenAI
    // We'll build a structure to pass into the prompt generator.
    const docFilesInfo = []; // { requestId, docIndex, name, url, openaiFileId?, snippet? }

    for (const dr of docRequests) {
      if (!Array.isArray(dr.documents)) continue;

      for (let i = 0; i < dr.documents.length; i++) {
        const doc = dr.documents[i];
        if (!doc || !doc.url) continue;

        try {
          const { buffer, contentType, isText, snippet } = await fetchFileAndSnippet(doc.url);

          if (isText) {
            // For text-like files, we can include snippet directly
            docFilesInfo.push({
              requestId: dr._id.toString(),
              docIndex: i,
              name: doc.name,
              url: doc.url,
              snippet,
              openaiFileId: null
            });
          } else {
            // For binary files, upload to OpenAI and persist file id back to DocumentRequest
            const filename = doc.name || `file_${Date.now()}`;
            let openaiFileId;
            try {
              openaiFileId = await uploadBufferToOpenAI(buffer, filename);
            } catch (uploadErr) {
              console.warn('OpenAI upload failed for', doc.url, uploadErr);
              // still push as info without openaiFileId and without snippet
              docFilesInfo.push({
                requestId: dr._id.toString(),
                docIndex: i,
                name: doc.name,
                url: doc.url,
                snippet: null,
                openaiFileId: null,
                uploadError: uploadErr.message
              });
              continue;
            }

            // persist openaiFileId into DocumentRequest.documents[i].openaiFileId (add field)
            const updateQuery = {};
            updateQuery[`documents.${i}.openaiFileId`] = openaiFileId;
            await DocumentRequest.updateOne({ _id: dr._id }, { $set: updateQuery });

            docFilesInfo.push({
              requestId: dr._id.toString(),
              docIndex: i,
              name: doc.name,
              url: doc.url,
              snippet: null,
              openaiFileId
            });
          }
        } catch (err) {
          console.warn('Skipping file due to fetch error', doc.url, err.message);
          docFilesInfo.push({
            requestId: dr._id.toString(),
            docIndex: i,
            name: doc.name,
            url: doc.url,
            snippet: null,
            openaiFileId: null,
            fetchError: err.message
          });
        }
      }
    }

    // Build prompt (pbcPromptGenerator should accept pbc and docFilesInfo)
    // Ensure you exported that util to accept docFilesInfo and produce JSON request
    const prompt = pbcPromptGenerator(pbc, docFilesInfo);

    // Call OpenAI (chat completion)
    // You expect JSON back; enforce low temperature for consistency
    const completion = await openai_pbc.chat.completions.create({
      model: 'gpt-4o-mini', // adapt model if required by your account
      messages: [
        { role: 'system', content: 'You are an audit assistant embedded in an audit portal.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    const rawOutput = completion?.choices?.[0]?.message?.content;
    if (!rawOutput) {
      return res.status(500).json({ success: false, message: 'OpenAI returned empty response' });
    }

    // Attempt to parse JSON (AI should return JSON array of categories)
    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch (err) {
      // If parse fails, return raw output for debug
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI response as JSON. Raw output included.',
        raw: rawOutput
      });
    }

    // Validate parsed shape (basic)
    if (!Array.isArray(parsed)) {
      return res.status(500).json({ success: false, message: 'AI response JSON was expected to be an array of categories', parsed });
    }

    // Persist categories -> QnACategory documents
    const categoriesToInsert = parsed.map(cat => {
      // expected cat = { category or title, questions or qnaQuestions }
      const title = cat.category || cat.title || 'Uncategorized';
      const qnaQuestions = (cat.questions || cat.qnaQuestions || []).map(q => ({
        question: q.question || q.text || q.prompt || '',
        isMandatory: !!q.isMandatory,
        // other fields (answer/status/discussions) will be default values
      }));
      return {
        pbcId,
        title,
        qnaQuestions
      };
    });

    let insertedCats = [];
    if (categoriesToInsert.length > 0) {
      insertedCats = await QnACategory.insertMany(categoriesToInsert);
    }

    // Optionally: keep PBC status the same (qna-preparation) or set a different one
    // We'll keep it at qna-preparation and return newly created categories
    const result = {
      success: true,
      createdCount: insertedCats.length,
      categories: insertedCats
    };
    return res.json(result);
  } catch (err) {
    console.error('generateQnAUsingAI error:', err);
    next(err);
  }
};

