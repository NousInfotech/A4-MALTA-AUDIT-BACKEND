const { supabase } = require("../../../config/supabase");
const { createCompany, assignCompanyToClient } = require("./company.service");

/**
 * Register a new client user
 * @param {Object} payload - Registration payload
 * @param {string} payload.email - User email (required)
 * @param {string} payload.password - User password (required)
 * @param {string} payload.name - User name (required)
 * @param {string} [payload.companyName] - Company name
 * @param {string} [payload.companyNumber] - Company registration number
 * @param {string} [payload.industry] - Industry
 * @param {string} [payload.summary] - Company summary
 * @param {boolean} [payload.isCreateCompany=false] - Whether to create/assign company
 * @param {boolean} [payload.isNewCompany=true] - Whether to create new company or assign existing
 * @param {string} [payload.companyId] - Company ID (if assigning existing)
 * @param {string} [payload.nationality] - Owner nationality
 * @param {string} [payload.address] - Company address
 * @param {Object} [payload.shareHolderData] - Shareholder data
 * @param {Array} [payload.representationalSchema] - Representational schema
 * @param {number} [payload.authorizedShares] - Authorized shares
 * @param {number} [payload.issuedShares] - Issued shares
 * @param {number} [payload.perShareValue] - Per share value
 * @param {string} [payload.accountingPortalId] - Accounting portal ID
 * @param {string} [payload.organizationId] - Organization ID
 * @returns {Promise<Object>} Created user record
 * @throws {Error} If validation fails or creation fails
 */
const registerClient = async (payload) => {
  const {
    email,
    password,
    name,
    companyName,
    companyNumber,
    industry,
    summary,
    isCreateCompany = false,
    isNewCompany = true,
    companyId,
    nationality,
    address,
    shareHolderData,
    representationalSchema,
    authorizedShares,
    issuedShares,
    perShareValue,
    accountingPortalId,
    organizationId,
  } = payload;

  // Validate required fields
  if (!email || !password || !name) {
    throw new Error("Email, password, and name are required");
  }

  // Create auth user
  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: "client",
        name: name,
      },
    });

  if (authError) {
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }

  try {
    // Build insert payload safely
    const profilePayload = {
      user_id: authUser.user.id,
      name,
      role: "client",
      status: "approved",
      company_name: companyName,
      company_number: companyNumber,
      organization_id: organizationId,
      industry,
      company_summary: summary,
      updated_at: new Date().toISOString(),
    };

    // Optional field – only add if present
    if (accountingPortalId) {
      profilePayload.accounting_portal_id = accountingPortalId;
    }

    const { data: userRecord, error: dbError } = await supabase
      .from("profiles")
      .insert(profilePayload)
      .select()
      .single();

    if (dbError) {
      // Rollback auth user if DB insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create profile: ${dbError.message}`);
    }

    // Create company and related data if isCreateCompany is true
    if (isCreateCompany) {
      if (isNewCompany) {
        // Create new company
        await createCompany({
          clientId: authUser.user.id,
          organizationId: organizationId,
          companyName,
          companyNumber,
          address,
          industry,
          summary,
          name,
          email,
          nationality,
          shareHolderData,
          representationalSchema,
          authorizedShares,
          issuedShares,
          perShareValue,
        });
      } else {
        // Assign existing company to client
        if (companyId) {
          await assignCompanyToClient(companyId, authUser.user.id);
        }
      }
    }

    return userRecord;
  } catch (error) {
    // Rollback: delete user and profile if any operation fails
    try {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase
        .from("profiles")
        .delete()
        .eq("user_id", authUser.user.id);
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    throw error;
  }
};

module.exports = {
  registerClient,
};
