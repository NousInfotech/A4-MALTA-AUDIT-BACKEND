// controllers/documentRequestController.js
const DocumentRequest = require('../models/DocumentRequest');

exports.createRequest = async (req, res, next) => {
  try {
    const { engagementId, category, description } = req.body;
    const dr = await DocumentRequest.create({
      engagement: engagementId,
      clientId: req.body.clientId || req.user.id,
      category,
      description
    });
    return res.status(201).json(dr);
  } catch (err) {
    next(err);
  }
};

exports.getRequestsByEngagement = async (req, res, next) => {
  try {
    const reqs = await DocumentRequest.find({
      engagement: req.params.engagementId
    });
    return res.json(reqs);
  } catch (err) {
    next(err);
  }
};

exports.updateRequest = async (req, res, next) => {
  try {
    const updates = req.body;
    const dr = await DocumentRequest.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    if (!dr) return res.status(404).json({ message: 'Not found' });

    if (updates.status === 'completed') {
      dr.completedAt = new Date();
      await dr.save();
    }

    return res.json(dr);
  } catch (err) {
    next(err);
  }
};
