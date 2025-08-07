// controllers/checklistController.js
const ChecklistItem = require('../models/ChecklistItem');

exports.getChecklistByEngagement = async (req, res, next) => {
  try {
    const items = await ChecklistItem.find({
      engagement: req.params.engagementId
    }).sort({ category: 1, key: 1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

exports.updateChecklistItem = async (req, res, next) => {
  try {
    const { completed } = req.body;
    const item = await ChecklistItem.findByIdAndUpdate(
      req.params.id,
      { completed },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Checklist item not found' });

    // Emit real‐time update to all clients in this engagement room
    const io = req.app.get('io');
    io.to(`engagement_${item.engagement}`).emit('checklist:update', item);

    res.json(item);
  } catch (err) {   
    next(err);
  }
};
