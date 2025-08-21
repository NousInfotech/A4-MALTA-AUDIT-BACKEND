const Procedure = require("../models/Procedure")
const Engagement = require("../models/Engagement")
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance")
const WorkingPaper = require("../models/WorkingPaper")
const staticProcedures = require("../static/procedures")
const proceduresPrompt = require("../static/proceduresPrompt")
const proceduresPromptHybrid = require("../static/proceduresPromptHybrid")
const recommendationsPrompt = require("../static/recommendationsPrompt")
const { supabase } = require("../config/supabase")

// Get procedure for engagement
exports.getProcedure = async (req, res) => {
  try {
    const { engagementId } = req.params

    const procedure = await Procedure.findOne({ engagement: engagementId })

    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" })
    }

    res.json(procedure)
  } catch (error) {
    console.error("Error fetching procedure:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Create or update procedure
exports.saveProcedure = async (req, res) => {
  try {
    const { engagementId } = req.params
    const procedureData = req.body

    const procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      { ...procedureData, engagement: engagementId },
      { upsert: true, new: true },
    )

    res.json(procedure)
  } catch (error) {
    console.error("Error saving procedure:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Generate procedures using AI
exports.generateProcedures = async (req, res) => {
  try {
    const { engagementId } = req.params
    const { mode, materiality, selectedClassifications, validitySelections } = req.body

    // Get engagement and client profile
    const engagement = await Engagement.findById(engagementId)
    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" })
    }

    // Get client profile from Supabase
    const { data: clientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", engagement.clientId)
      .single()

    if (profileError) {
      console.error("Error fetching client profile:", profileError)
    }

    // Create or update procedure record
    const procedure = await Procedure.findOneAndUpdate(
      { engagement: engagementId },
      {
        engagement: engagementId,
        mode,
        materiality,
        selectedClassifications,
        validitySelections,
        status: mode === "manual" ? "completed" : "in-progress",
        aiProcessingStatus:
          mode !== "manual"
            ? selectedClassifications.map((c) => ({
                classification: c,
                status: "queued",
              }))
            : [],
      },
      { upsert: true, new: true },
    )

    if (mode === "manual") {
      // For manual mode, just return static procedures
      const questions = []
      for (const classification of selectedClassifications) {
        const classificationProcedures = staticProcedures[classification] || staticProcedures.default
        classificationProcedures.forEach((proc) => {
          questions.push({
            ...proc,
            classification,
            answer: "",
          })
        })
      }

      procedure.questions = questions
      await procedure.save()

      return res.json(procedure)
    }

    // For AI and Hybrid modes, process each classification
    const allQuestions = []
    const processingResults = []

    for (const classification of selectedClassifications) {
      try {
        // Update status to loading
        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          { $set: { "aiProcessingStatus.$.status": "loading" } },
        )

        // Get working papers for this classification
        const workingPaper = await WorkingPaper.findOne({
          engagement: engagementId,
          classification,
        })

        // Prepare prompt based on mode
        let prompt
        let proceduresToProcess = []

        if (mode === "ai") {
          prompt = proceduresPrompt[classification] || proceduresPrompt.default
        } else {
          // hybrid
          prompt = proceduresPromptHybrid[classification] || proceduresPromptHybrid.default
          proceduresToProcess = staticProcedures[classification] || staticProcedures.default
        }

        // Replace placeholders in prompt
        prompt = prompt
          .replace("{clientProfile}", JSON.stringify(clientProfile || {}))
          .replace("{workingPapers}", JSON.stringify(workingPaper?.rows || []))
          .replace("{classification}", classification)
          .replace("{predefinedProcedures}", JSON.stringify(proceduresToProcess))

        // Here you would call your AI service (OpenAI, etc.)
        // For now, we'll simulate with static procedures + some AI-like enhancements
        const classificationProcedures = staticProcedures[classification] || staticProcedures.default
        const enhancedQuestions = classificationProcedures.map((proc) => ({
          ...proc,
          classification,
          answer: `Based on review of working papers and client profile, this procedure has been completed. [AI-generated response would go here based on actual working paper data]`,
        }))

        allQuestions.push(...enhancedQuestions)

        // Update status to completed
        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          { $set: { "aiProcessingStatus.$.status": "completed" } },
        )

        processingResults.push({ classification, status: "completed" })
      } catch (error) {
        console.error(`Error processing classification ${classification}:`, error)

        // Update status to error
        await Procedure.findOneAndUpdate(
          { engagement: engagementId, "aiProcessingStatus.classification": classification },
          {
            $set: {
              "aiProcessingStatus.$.status": "error",
              "aiProcessingStatus.$.error": error.message,
            },
          },
        )

        processingResults.push({ classification, status: "error", error: error.message })
      }
    }

    // Generate AI recommendations
    let recommendations = ""
    if (allQuestions.length > 0) {
      const proceduresAndFindings = allQuestions.map((q) => `${q.question}: ${q.answer}`).join("\n")
      const recPrompt = recommendationsPrompt
        .replace("{proceduresAndFindings}", proceduresAndFindings)
        .replace("{clientProfile}", JSON.stringify(clientProfile || {}))

      // Here you would call AI for recommendations
      recommendations =
        "Based on the audit procedures performed, the following recommendations are provided: [AI-generated recommendations would go here]"
    }

    // Update procedure with results
    procedure.questions = allQuestions
    procedure.recommendations = recommendations
    procedure.status = "completed"
    await procedure.save()

    res.json({
      procedure,
      processingResults,
    })
  } catch (error) {
    console.error("Error generating procedures:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Update procedure status
exports.updateProcedureStatus = async (req, res) => {
  try {
    const { engagementId } = req.params
    const { status } = req.body

    const procedure = await Procedure.findOneAndUpdate({ engagement: engagementId }, { status }, { new: true })

    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" })
    }

    res.json(procedure)
  } catch (error) {
    console.error("Error updating procedure status:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Delete procedure
exports.deleteProcedure = async (req, res) => {
  try {
    const { engagementId } = req.params

    const procedure = await Procedure.findOneAndDelete({ engagement: engagementId })

    if (!procedure) {
      return res.status(404).json({ message: "Procedure not found" })
    }

    res.json({ message: "Procedure deleted successfully" })
  } catch (error) {
    console.error("Error deleting procedure:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}
