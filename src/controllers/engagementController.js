// controllers/engagementController.js
const Engagement        = require('../models/Engagement');
const EngagementLibrary = require('../models/EngagementLibrary');
const { supabase }      = require('../config/supabase');
const TrialBalance = require("../models/TrialBalance");

// list of folder names
const ENGAGEMENT_FOLDERS = [
  'Planning',
  'Capital & Reserves',
  'Property, plant and equipment',
  'Intangible Assets',
  'Investment Property',
  'Investment in Subsidiaries & Associates investments',
  'Receivables',
  'Payables Inventory',
  'Bank & Cash',
  'Borrowings & loans',
  'Taxation',
  'Going Concern',
  'Others'
];
// In controllers/engagementController.js
exports.getLibraryFiles = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    
    const files = await EngagementLibrary.find({ 
      engagement: engagementId,
      url: { $ne: '' }
    }).sort({ createdAt: -1 });
    
    const filesWithNames = files.map(file => ({
      ...file.toObject(),
      fileName: file.url.split('/').pop()?.split('?')[0] || 'Unknown'
    }));
    
    res.json(filesWithNames);
  } catch (err) {
    next(err);
  }
};

exports.createEngagement = async (req, res, next) => {
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl, createdBy } = req.body;
    // 1) Create the engagement
    const engagement = await Engagement.create({
    
    createdBy,  clientId, title, yearEndDate, trialBalanceUrl, status: trialBalanceUrl?"active":"draft"
    });

    // 2) Seed an “empty folder” entry for each category
    const placeholders = ENGAGEMENT_FOLDERS.map(category => ({
      engagement: engagement._id,
      category,
      url: ''            // empty placeholder
    }));
    await EngagementLibrary.insertMany(placeholders);

    // 3) Return the new engagement (folders can be fetched via a populate or separate query)
    return res.status(201).json(engagement);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/engagements/:id/library
 * multipart/form-data:
 *   - file: the uploaded file
 *   - category: one of ENGAGEMENT_FOLDERS
 */
exports.uploadToLibrary = async (req, res, next) => {
  try {
    const { id: engagementId } = req.params;
    const { category }          = req.body;
    const file                   = req.file;           // from multer

    if (!ENGAGEMENT_FOLDERS.includes(category)) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    // 1) Upload to Supabase storage
    const filePath = `${engagementId}/${category}/${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('engagement-documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
    if (uploadError) throw uploadError;

    // 2) Build public URL
    const { publicUrl } = supabase
      .storage
      .from('engagement-documents')
      .getPublicUrl(uploadData.path).data;

    // 3) Save library record
    const entry = await EngagementLibrary.create({
      engagement: engagementId,
      category,
      url: publicUrl
    });

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};


exports.getAllEngagements = async (req, res, next) => {
  try {
    // const clientId = req.user.role === 'client'
    //   ? req.user.id
    //   : req.query.clientId || req.user.id;
    const engagements = await Engagement.find();
    res.json(engagements);
  } catch (err) { next(err); }
};

exports.getClientEngagements = async (req, res, next) => {
  try {
    const clientId = req.user.role === 'client'
      ? req.user.id
      : req.query.clientId || req.user.id;
    const engagements = await Engagement.find();
    res.json(engagements);
  } catch (err) { next(err); }
};

exports.getEngagementById = async (req, res, next) => {
  try {
    const engagement = await Engagement
      .findById(req.params.id)
      .populate('documentRequests')
      .populate('procedures')
      .populate('trialBalanceDoc');
    if (!engagement) return res.status(404).json({ message: 'Not found' });
    res.json(engagement);
  } catch (err) { next(err); }
};

exports.updateEngagement = async (req, res, next) => {
  try {
    const engagement = await Engagement.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );
    if (!engagement) return res.status(404).json({ message: 'Not found' });
    res.json(engagement);
  } catch (err) { next(err); }
};

/**
 * Fetch all rows, store or update a TrialBalance doc,
 * link it on Engagement.trialBalance, and return it.
 */
exports.fetchTrialBalance = async (req, res, next) => {
  try {
    const engagement = await Engagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: 'Engagement not found' });

    // 1) pull raw 2D array from Sheets
    const allRows = await sheetService.fetch(req.body.sheetUrl || engagement.trialBalanceUrl);
    if (!allRows.length) return res.status(204).json({ message: 'No data returned' });

    // 2) split header + data
    const [headers, ...rows] = allRows;

    // 3) upsert TrialBalance
    let tb = await TrialBalance.findOne({ engagement: engagement._id });
    if (tb) {
      tb.headers   = headers;
      tb.rows      = rows;
      tb.fetchedAt = new Date();
      await tb.save();
    } else {
      tb = await TrialBalance.create({
        engagement: engagement._id,
        headers,
        rows
      });
    }

    // 4) link & respond
    engagement.trialBalance = tb._id;
    await engagement.save();
    res.json(tb);
  } catch (err) { next(err); }
};

/** Return the stored TrialBalance for this engagement */
exports.getTrialBalance = async (req, res, next) => {
  try {
    const tb = await TrialBalance.findOne({ engagement: req.params.id });
    if (!tb) return res.status(404).json({ message: 'No trial balance stored' });
    res.json(tb);
  } catch (err) { next(err); }
};
