const KYC = require('../../../models/KnowYourClient');

/**
 * Get KYC by company ID
 * @param {String} companyId - Company ID
 * @returns {Promise<Array>} Array of KYC documents with populated fields
 */
async function getKycByCompanyId(companyId) {
  try {
    const kyc = await KYC.find({ company: companyId })
      .populate('company', 'name registrationNumber clientId')
      .populate({
        path: 'documentRequests.documentRequest',
        model: 'DocumentRequest',
        select: 'name category description status documents multipleDocuments',
      })
      .populate({
        path: 'documentRequests.person',
        model: 'Person',
        select: 'name email phoneNumber nationality address',
      });

    return kyc;
  } catch (error) {
    throw new Error(`Failed to fetch KYC: ${error.message}`);
  }
}

module.exports = {
  getKycByCompanyId,
};

