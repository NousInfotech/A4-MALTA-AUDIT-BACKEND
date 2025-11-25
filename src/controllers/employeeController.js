const { supabase } = require("../config/supabase");

exports.createEmployee = async (req, res) => {
  try {
    const { role } = req.params;
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const validRoles = ['employee', 'admin', 'partner', 'senior-employee'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    let userId = null;

    //  1. Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);

    if (existingUser) {
    //    Email exists — reuse existing userId
      userId = existingUser.id;
      console.log("Email already exists → Reusing user ID:", userId);
    } else {
    //    Email does NOT exist — create new auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, name },
      });

      if (authError) throw authError;

      userId = authUser.user.id;
    }

    // Create new profile entry (always)
    const { data: userRecord, error: dbError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        name,
        role,
        status: "approved",
        organization_id: req.user.organizationId,
        company_name: null,
        company_number: null,
        industry: null,
        company_summary: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return res.status(201).json({
      message: `${role} profile created successfully`,
      user: userRecord,
      note: existingUser ? "Used existing auth user (email already registered)" : "New auth user created"
    });

  } catch (error) {
    console.error("Error creating employee:", error);
    return res.status(500).json({ error: error.message });
  }
};

