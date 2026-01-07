const Company = require('../../../models/Company');

/**
 * Get companies by client ID
 * @param {String} clientId - Client ID
 * @returns {Promise<Array>} Array of companies with _id, name, registrationNumber
 */
async function getCompaniesClientId(clientId) {
  try {
    const companies = await Company.find({ clientId })
      .select('_id name registrationNumber')
      .sort({ name: 1 });
    return companies;
  } catch (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }
}

/**
 * Get company by ID
 * @param {String} id - Company ID
 * @returns {Promise<Object>} Full company document with populated virtuals
 */
async function getCompanyById(id) {
  try {
    const company = await Company.findById(id)
      .populate('shareHolderDetails')
      .populate('shareHoldingCompanyDetails');
    
    if (!company) {
      throw new Error('Company not found');
    }
    return company;
  } catch (error) {
    throw new Error(`Failed to fetch company: ${error.message}`);
  }
}

module.exports = {
  getCompaniesClientId,
  getCompanyById,
};

