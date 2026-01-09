const Adjustment = require('../../../models/Adjustment');

/**
 * Get all adjustments by ETB ID
 * @param {String} etbId - Extended Trial Balance ID
 * @returns {Promise<Array>} Array of adjustment documents
 */
async function getAdjustments(etbId) {
  try {
    const adjustments = await Adjustment.find({ etbId }).sort({ createdAt: -1 });
    return adjustments;
  } catch (error) {
    throw new Error(`Failed to fetch adjustments: ${error.message}`);
  }
}

/**
 * Get adjustment by ID
 * @param {String} id - Adjustment ID
 * @returns {Promise<Object>} Adjustment document
 */
async function getAdjustmentById(id) {
  try {
    const adjustment = await Adjustment.findById(id);
    if (!adjustment) {
      throw new Error('Adjustment not found');
    }
    return adjustment;
  } catch (error) {
    throw new Error(`Failed to fetch adjustment: ${error.message}`);
  }
}

module.exports = {
  getAdjustments,
  getAdjustmentById,
};

