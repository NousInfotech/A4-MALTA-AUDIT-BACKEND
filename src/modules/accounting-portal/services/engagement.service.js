const Engagement = require('../../../models/Engagement');

/**
 * Get engagements by client ID
 * @param {String} clientId - Client ID
 * @returns {Promise<Array>} Array of engagements with _id, title (name), yearEndDate (year), status
 */
async function getEngagementsByClientId(clientId) {
  try {
    const engagements = await Engagement.find({ clientId })
      .select('_id title yearEndDate status')
      .sort({ yearEndDate: -1 });

    return engagements;
  } catch (error) {
    throw new Error(`Failed to fetch engagements: ${error.message}`);
  }
}

/**
 * Get engagement by ID
 * @param {String} id - Engagement ID
 * @returns {Promise<Object>} Engagement with populated company
 */
async function getEngagementsById(id) {
  try {
    const engagement = await Engagement.findById(id)
      .populate('companyId', 'name _id registrationNumber');

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    return {
      _id: engagement._id,
      name: engagement.title,
      year: new Date(engagement.yearEndDate).getFullYear(),
      deadline: engagement.deadline,
      status: engagement.status,
      companyId: engagement.companyId,
    };
  } catch (error) {
    throw new Error(`Failed to fetch engagement: ${error.message}`);
  }
}

module.exports = {
  getEngagementsByClientId,
  getEngagementsById,
};

