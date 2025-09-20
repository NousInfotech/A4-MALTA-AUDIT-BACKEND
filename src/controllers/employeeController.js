const { supabase } = require("../config/supabase");

exports.createEmployee = async (req, res) => {
    try {
        const { role } = req.params;
        const { name, email, password } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, password, and name are required" });
        }

        // Validate role
        const validRoles = ['employee', 'admin', 'partner', 'senior-employee'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role. Must be employee, admin, or partner" });
        }

        // Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                role: role,
                name: name,
            },
        });

        if (authError) {
            throw authError;
        }

        // Create user record in profiles table
        const { data: userRecord, error: dbError } = await supabase
            .from("profiles")
            .insert({
                user_id: authUser.user.id,
                name: name,
                role: role,
                status: "pending", // Keep status as pending
                company_name: null, // Leave empty as requested
                company_number: null, // Leave empty as requested
                industry: null, // Leave empty as requested
                company_summary: null, // Leave empty as requested
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (dbError) {
            // Clean up auth user if database insert fails
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw dbError;
        }

        res.status(201).json({
            message: `${role} created successfully (pending approval)`,
            user: userRecord,
        });
    } catch (error) {
        console.error(`Error creating ${req.params.role}:`, error);
        res.status(500).json({
            error: error.message || `Failed to create ${req.params.role}`,
        });
    }
};
