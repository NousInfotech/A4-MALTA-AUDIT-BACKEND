const Organization = require("../models/Organization");
const Prompt = require("../models/Prompt");
const { supabase } = require("../config/supabase");
const { promptData } = require("../data/classifications/prompts");

// Default prompts configuration for new organizations
const defaultPromptsConfig = [
  {
    name: "planningAiSectionAnswersPrompt",
    description: "Generate answers for AI planning sections",
    category: "planning",
    content: `You are an expert audit planner with deep knowledge of ISA, IFRS, and industry-specific auditing standards.

RETURN FORMAT:
Return ONLY valid JSON. No prose, no code fences.

INPUT CONTEXT:
- Client Profile JSON: {clientProfile}
- Materiality (numeric): {materiality}
- Extended Trial Balance rows (array): {etbRows}
- Section with fields (object with sectionId and fields array): {section}

TASK:
For the provided section, produce EXTREMELY DETAILED answers for ALL fields AND generate comprehensive section-specific recommendations.
- Perform DEEP ANALYSIS of client profile, materiality, and ETB data to provide context-specific responses
- Calculate precise values using ETB data when numeric fields are requested
- Identify risk patterns, control weaknesses, and compliance gaps from the context
- Do NOT restate labels/help/options/content/etc.
- Do NOT add or remove fields.
- Preserve original field "key" identity; provide only "answer" for each.
- If information is insufficient, use conservative, professional defaults based on audit best practices and industry standards
- NEVER leave any answer empty or unanswered - provide detailed, context-appropriate responses with specific calculations and references
- Respect types:
  - text/textarea: string (provide detailed explanations with specific examples and references to ETB accounts)
  - checkbox: boolean (with justification in adjacent text fields if needed)
  - multiselect: string[] (select ALL applicable options with rationale)
  - number/currency: number (provide precise calculations showing methodology: base amount * percentage * adjustment factors)
  - table: array of row objects with keys exactly matching the provided "columns" (include ALL relevant data points from ETB)
  - group: object of { childKey: boolean|string|number } for the defined child fields
- Answers must be self-consistent with materiality and ETB data, showing clear relationships between amounts
- Additionally, provide EXTENSIVE section-specific recommendations based on the answers with specific audit procedures, testing approaches, and risk mitigation strategies
- MUST ENSURE that All AI-generated procedures are fully aligned with the International Standards on Auditing (ISAs). For every answer and recommendation generated, the corresponding ISA reference will be explicitly cited, along with the applicable financial reporting framework —(e.g., ISA 315 – Identifying and Assessing Risks of Material Misstatement ). This guarantees that all outputs remain compliant with professional auditing standards and tailored to the framework under which the audit is being performed.
- DO NOT use the pilcrow (¶) symbol
- ONLY ANSWER ACCORDING TO THE INPUT AND CONTEXT THAT YOU HAVE DO NOT ADD ANYTHING ELSE FROM YOUR OWN OR ASSUME ANYTHING

OUTPUT JSON SCHEMA:
{
  "sectionId": "same-section-id",
  "fields": [
    { "key": "field_key_1", "answer": <typed_value> },
    { "key": "field_key_2", "answer": <typed_value> }
  ],
  "sectionRecommendations": [
    {"id": "1", "text": "Specific actionable recommendation with ISA references", "checked": false},
    {"id": "2", "text": "Another specific recommendation", "checked": false}
  ]
}`,
    lastModifiedBy: "System"
  },
  // Additional default prompts can be added here
  // For now, we'll just have one example. In production, copy all from the initialize endpoint
];

/**
 * Create a new organization with admin user and default prompts
 */
exports.createOrganization = async (req, res) => {
  try {
    const { title, adminName, adminEmail, adminPassword } = req.body;

    // Validate input
    if (!title || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        error: "Missing required fields: title, adminName, adminEmail, adminPassword"
      });
    }

    // 1. Create admin user in Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        role: 'admin'
      }
    });

    if (authError) {
      console.error("Error creating admin user:", authError);
      return res.status(500).json({ error: `Failed to create admin user: ${authError.message}` });
    }

    const adminUserId = authData.user.id;

    // 2. Create organization in MongoDB
    const organization = new Organization({
      title,
      adminId: adminUserId,
      brandingSettings: []
    });

    await organization.save();
    const organizationId = organization._id.toString();

    // 3. Create admin profile in Supabase (manually, as trigger might not fire with admin.createUser)
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        user_id: adminUserId,
        name: adminName,
        role: 'admin',
        status: 'approved',
        organization_id: organizationId
      });

    if (profileInsertError) {
      console.error("Error creating admin profile:", profileInsertError);

      // If profile already exists (trigger DID fire), update it instead
      if (profileInsertError.code === '23505') { // Duplicate key error
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({ organization_id: organizationId })
          .eq('user_id', adminUserId);

        if (profileUpdateError) {
          console.error("Error updating existing admin profile:", profileUpdateError);
          await Organization.findByIdAndDelete(organizationId);
          return res.status(500).json({
            error: `Failed to link admin to organization: ${profileUpdateError.message}`
          });
        }
      } else {
        // Other error, cleanup and fail
        await Organization.findByIdAndDelete(organizationId);
        await supabase.auth.admin.deleteUser(adminUserId);
        return res.status(500).json({
          error: `Failed to create admin profile: ${profileInsertError.message}`
        });
      }
    }

    // 4. Seed default prompts for the organization
    await seedDefaultPrompts(organizationId);

    res.status(201).json({
      message: "Organization created successfully",
      organization: {
        _id: organization._id,
        title: organization.title,
        adminId: organization.adminId,
        adminEmail,
        adminName
      }
    });

  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Failed to create organization" });
  }
};

/**
 * Get all organizations (super-admin only)
 */
exports.getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find().sort({ createdAt: -1 });

    // Enrich with admin details from Supabase
    const enrichedOrgs = await Promise.all(
      organizations.map(async (org) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('user_id', org.adminId)
          .single();

        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, role')
          .eq('organization_id', org._id.toString());

        return {
          _id: org._id,
          title: org.title,
          adminId: org.adminId,
          adminName: profile?.name || 'Unknown',
          adminEmail: org.adminId, // This could be enhanced
          employeeCount: users?.filter(u => u.role === 'employee').length || 0,
          clientCount: users?.filter(u => u.role === 'client').length || 0,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt
        };
      })
    );

    res.json({ organizations: enrichedOrgs });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
};

/**
 * Get organization by ID
 */
exports.getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check access: super-admin or org admin
    if (req.user.role !== 'super-admin' && req.user.id !== organization.adminId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get admin details
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, role')
      .eq('user_id', organization.adminId)
      .single();

    res.json({
      organization: {
        _id: organization._id,
        title: organization.title,
        adminId: organization.adminId,
        adminName: profile?.name,
        adminEmail: profile?.email,
        brandingSettings: organization.brandingSettings,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      }
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
};

/**
 * Update organization
 */
exports.updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, brandingSettings } = req.body;

    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check access: super-admin or org admin
    if (req.user.role !== 'super-admin' && req.user.id !== organization.adminId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (title) organization.title = title;
    if (brandingSettings) organization.brandingSettings = brandingSettings;

    await organization.save();

    res.json({
      message: "Organization updated successfully",
      organization
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ error: "Failed to update organization" });
  }
};

/**
 * Get organization analytics (super-admin only)
 */
exports.getOrganizationAnalytics = async (req, res) => {
  try {
    const organizations = await Organization.find();
    const totalOrganizations = organizations.length;

    // Get user counts per organization
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('organization_id, role, user_id');

    const analyticsData = await Promise.all(
      organizations.map(async (org) => {
        const orgId = org._id.toString();
        const orgUsers = allProfiles?.filter(p => p.organization_id === orgId) || [];

        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('user_id', org.adminId)
          .single();

        return {
          id: org._id,
          name: org.title,
          adminName: adminProfile?.name || 'Unknown',
          adminEmail: adminProfile?.email || 'Unknown',
          employeeCount: orgUsers.filter(u => u.role === 'employee').length,
          clientCount: orgUsers.filter(u => u.role === 'client').length,
          adminCount: orgUsers.filter(u => u.role === 'admin').length,
          totalUsers: orgUsers.length,
          createdAt: org.createdAt
        };
      })
    );

    res.json({
      totalOrganizations,
      organizations: analyticsData
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

/**
 * Helper function to seed default prompts for a new organization
 */
async function seedDefaultPrompts(organizationId) {
  try {
    // Get all existing prompts to use as templates
    const existingPrompts = promptData;

    if (existingPrompts.length > 0) {
      // Clone existing prompts for new organization
      const newPrompts = existingPrompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        content: prompt.content,
        version: 1,
        isActive: true,
        lastModifiedBy: "System",
        organizationId
      }));

      await Prompt.insertMany(newPrompts);
      console.log(`Seeded ${newPrompts.length} prompts for organization ${organizationId}`);
    } else {
      // Fallback: use default config
      const prompts = defaultPromptsConfig.map(p => ({ ...p, organizationId }));
      await Prompt.insertMany(prompts);
      console.log(`Seeded ${prompts.length} default prompts for organization ${organizationId}`);
    }
  } catch (error) {
    console.error("Error seeding prompts:", error);
    throw error;
  }
}

module.exports = exports;

