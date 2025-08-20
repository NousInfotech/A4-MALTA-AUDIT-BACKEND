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
        status: "pending", 
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