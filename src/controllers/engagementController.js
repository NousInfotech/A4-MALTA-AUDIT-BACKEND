const Engagement   = require('../models/Engagement');
const TrialBalance = require('../models/TrialBalance');
const ChecklistItem = require('../models/ChecklistItem');
const defaultChecklist = require('../config/checklist');
const sheetService = require('../services/googleSheetsService');

exports.createEngagement = async (req, res, next) => {
  try {
    const { clientId, title, yearEndDate, trialBalanceUrl } = req.body;
    const engagement = await Engagement.create({
      clientId, title, yearEndDate, trialBalanceUrl,
      createdBy: req.user.id
    });
    await Promise.all(
      defaultChecklist.map(item =>
        ChecklistItem.create({
          engagement: engagement._id,
          key:         item.key,
          description: item.description,
          category:    item.category,
          completed:   false
        })
      )
    );
    res.status(201).json(engagement);
  } catch (err) { next(err); }
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
