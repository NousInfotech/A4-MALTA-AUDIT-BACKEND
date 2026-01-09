const ExtendedTrialBalance = require('../../../models/ExtendedTrialBalance');

/**
 * Get Extended Trial Balance by engagement ID
 * @param {String} engagementId - Engagement ID
 * @returns {Promise<Object>} Extended Trial Balance document
 */
async function getEtb(engagementId) {
  try {
    const etb = await ExtendedTrialBalance.findOne({ engagement: engagementId })
      .populate('engagement', 'title yearEndDate status');
    
    if (!etb) {
      throw new Error('Extended Trial Balance not found');
    }
    return etb;
  } catch (error) {
    throw new Error(`Failed to fetch Extended Trial Balance: ${error.message}`);
  }
}

module.exports = {
  getEtb,
};

