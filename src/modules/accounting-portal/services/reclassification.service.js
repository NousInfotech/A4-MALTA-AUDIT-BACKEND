const Reclassification = require('../../../models/Reclassification');

/**
 * Get all reclassifications by ETB ID
 * @param {String} etbId - Extended Trial Balance ID
 * @returns {Promise<Array>} Array of reclassification documents
 */
async function getReclassifications(etbId) {
  try {
    const reclassifications = await Reclassification.find({ etbId }).sort({ createdAt: -1 });
    return reclassifications;
  } catch (error) {
    throw new Error(`Failed to fetch reclassifications: ${error.message}`);
  }
}

/**
 * Get reclassification by ID
 * @param {String} id - Reclassification ID
 * @returns {Promise<Object>} Reclassification document
 */
async function getReclassificationById(id) {
  try {
    const reclassification = await Reclassification.findById(id);
    if (!reclassification) {
      throw new Error('Reclassification not found');
    }
    return reclassification;
  } catch (error) {
    throw new Error(`Failed to fetch reclassification: ${error.message}`);
  }
}

module.exports = {
  getReclassifications,
  getReclassificationById,
};

