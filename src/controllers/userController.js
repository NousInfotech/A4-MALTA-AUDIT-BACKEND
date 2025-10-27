// controllers/userController.js
const { supabase } = require("../config/supabase")
const mongoose = require("mongoose")

// Mongoose models
const Engagement = require("../models/Engagement")
const DocumentRequest = require("../models/DocumentRequest")
const Procedure = require("../models/Procedure")
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")
const WorkingPaper = require("../models/WorkingPaper")
const TrialBalance = require("../models/TrialBalance")
const EngagementLibrary = require("../models/EngagementLibrary")
const ChecklistItem = require("../models/ChecklistItem")
const ClassificationSection = require("../models/ClassificationSection")

exports.deleteUser = async (req, res) => {
  const session = await mongoose.startSession()
  try {
    const userId = req.params.id
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" })
    }

    // 1) MONGO TRANSACTION: delete all engagement-related data for this client
    let engagementIds = []
    let mongoStats = {}

    await session.withTransaction(async () => {
      // Find all engagements for this client
      const engagements = await Engagement.find({ clientId: userId }).session(session)
      engagementIds = engagements.map((e) => e._id)

      if (engagementIds.length === 0) {
        // No engagements—nothing to cascade
        mongoStats = {
          engagements: 0,
          documentRequests: 0,
          procedures: 0,
          extendedTrialBalances: 0,
          workingPapers: 0,
          trialBalances: 0,
          libraries: 0,
          checklistItems: 0,
          classificationSections: 0,
        }
      } else {
        // Delete all dependent docs by engagement
        const [
          drRes,
          procRes,
          etbRes,
          wpRes,
          tbRes,
          libRes,
          chkRes,
          clsRes,
        ] = await Promise.all([
          DocumentRequest.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          Procedure.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          ExtendedTrialBalance.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          WorkingPaper.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          TrialBalance.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          EngagementLibrary.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          ChecklistItem.deleteMany({ engagement: { $in: engagementIds } }).session(session),
          ClassificationSection.deleteMany({ engagement: { $in: engagementIds } }).session(session),
        ])

        // Finally, delete the engagements themselves
        const engRes = await Engagement.deleteMany({ _id: { $in: engagementIds } }).session(session)

        mongoStats = {
          engagements: engRes.deletedCount || 0,
          documentRequests: drRes.deletedCount || 0,
          procedures: procRes.deletedCount || 0,
          extendedTrialBalances: etbRes.deletedCount || 0,
          workingPapers: wpRes.deletedCount || 0,
          trialBalances: tbRes.deletedCount || 0,
          libraries: libRes.deletedCount || 0,
          checklistItems: chkRes.deletedCount || 0,
          classificationSections: clsRes.deletedCount || 0,
        }
      }
    })

    // 2) SUPABASE: delete profile row then auth user (not part of Mongo transaction)
    // Remove from profiles table
    const { error: dbError } = await supabase.from("profiles").delete().eq("user_id", userId)
    if (dbError) {
      // At this point, Mongo deletions are committed. We surface the error.
      throw dbError
    }

    // Remove from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
      throw authError
    }

    res.status(200).json({
      message: "User and all related data deleted successfully",
      userId,
      mongoStats,
    })
  } catch (error) {
    console.error("Error deleting user (deep):", error)
    // If we are still inside a transaction block, abort; outside of it, this is a no-op.
    try { await session.abortTransaction() } catch (_) {}
    res.status(500).json({
      error: error.message || "Failed to delete user",
      note:
        "Mongo deletions are transactional. Supabase operations are best-effort and happen after Mongo commit.",
    })
  } finally {
    session.endSession()
  }
}


exports.createUser = async (req, res) => {
  try {
    const { email, password, name, companyName, companyNumber, industry, summary } = req.body
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" })
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, 
      user_metadata: {
        role: "client",
        name: name,
      },
    })

    if (authError) {
      throw authError
    }

    const { data: userRecord, error: dbError } = await supabase
      .from("profiles")
      .insert({
        user_id: authUser.user.id,
        name: name,
        role: "client",
        status: "approved", 
        company_name: companyName,
        company_number: companyNumber,
        industry: industry,
        company_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      await supabase.auth.admin.deleteUser(authUser.user.id)
      throw dbError
    }

    res.status(201).json({
      message: "Client created successfully (pending approval)",
      client: userRecord,
    })
  } catch (error) {
    console.error("Error creating client:", error)
    res.status(500).json({
      error: error.message || "Failed to create client",
    })
  }
}

exports.getEmail = async (req, res) => {
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(req.params.id)

    if (authError) {
      throw authError
    }

    if (!authUser.user.email) {
      throw new Error("Email not found for this user")
    }

    res.status(200).json({
      message: "Client email retrieved successfully",
      clientData: {
        email: authUser.user.email,
      },
    })
  } catch (error) {
    console.error("Error getting client email:", error)
    res.status(500).json({
      error: error.message || "Failed to get client email",
    })
  }
}

exports.getAllUsers = async (req, res) => {
  try {
    const { 
      role, 
      status, 
      companyName, 
      industry, 
      search, 
      limit = 100, 
      page = 1,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    console.log('getAllUsers called with params:', req.query);

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build the base query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }
    
    if (industry) {
      query = query.ilike('industry', `%${industry}%`);
    }
    
    if (search) {
      // For search, we'll use textSearch or multiple ilike conditions
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,industry.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute the query
    const { data: users, error: usersError, count } = await query;

    if (usersError) {
      console.error('Supabase query error:', usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users`);

    // Get additional user data from auth for each user
    const enrichedUsers = await Promise.all(
      (users || []).map(async (user) => {
        try {
          const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
          
          if (authError) {
            console.warn(`Could not fetch auth data for user ${user.user_id}:`, authError);
            return {
              ...user,
              email: 'Email not available',
              last_sign_in_at: null,
              email_confirmed_at: null
            };
          }

          return {
            ...user,
            email: authUser.user.email,
            last_sign_in_at: authUser.user.last_sign_in_at,
            email_confirmed_at: authUser.user.email_confirmed_at,
            created_at: authUser.user.created_at
          };
        } catch (error) {
          console.warn(`Error enriching user ${user.user_id}:`, error);
          return {
            ...user,
            email: 'Email not available',
            last_sign_in_at: null,
            email_confirmed_at: null
          };
        }
      })
    );

    // Calculate pagination metadata
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = offset + enrichedUsers.length < totalCount;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      users: enrichedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      filters: {
        role,
        status,
        companyName,
        industry,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get users",
    });
  }
}

exports.updateClassificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ["in-progress", "ready-for-review", "reviewed-approved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be one of: in-progress, ready-for-review, reviewed-approved"
      });
    }

    // Update the classification section
    const updatedClassification = await ClassificationSection.findByIdAndUpdate(
      id,
      { 
        status: status,
        lastSyncAt: new Date()
      },
      { new: true }
    ).populate('engagement', 'clientId name');

    if (!updatedClassification) {
      return res.status(404).json({
        error: "Classification section not found"
      });
    }

    res.status(200).json({
      message: "Classification status updated successfully",
      classification: updatedClassification
    });

  } catch (error) {
    console.error("Error updating classification status:", error);
    res.status(500).json({
      error: error.message || "Failed to update classification status"
    });
  }
};

exports.updateClientProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, companyName, companyNumber, industry, summary, email } = req.body;

    console.log("Updating client profile:", id, req.body);

    // Update email in Supabase Auth if provided
    if (email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: email,
      });

      if (authError) {
        console.error("Supabase auth update error:", authError);
        return res.status(400).json({ error: "Failed to update email: " + authError.message });
      }
      console.log("Email updated in auth:", email);
    }

    // Update profile data
    const { data, error } = await supabase
      .from("profiles")
      .update({
        name,
        company_name: companyName,
        company_number: companyNumber,
        industry,
        company_summary: summary,
      })
      .eq("user_id", id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ success: true, client: data[0] });
  } catch (err) {
    console.error("Error updating client:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}