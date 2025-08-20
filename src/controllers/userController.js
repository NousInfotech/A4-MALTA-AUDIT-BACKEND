const { supabase } = require("../config/supabase")
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