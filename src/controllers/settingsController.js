const Organization = require("../models/Organization");
const UserSettings = require("../models/UserSettings");
const { supabase } = require("../config/supabase");

// Helper to get Org ID from request (populated by middleware)
const getOrgId = (req) => {
    return req.user.organizationId || null;
};

// ==========================================
// Organization Settings (Admin Only)
// ==========================================

exports.getOrgSettings = async (req, res) => {
    try {
        const orgId = getOrgId(req);
        // Fallback: finding by adminId if organizationId is missing on user (e.g. super-admin context or newly created)
        const query = orgId ? { _id: orgId } : { adminId: req.user.id };

        const org = await Organization.findOne(query);
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        res.json({
            firmDefaults: org.firmDefaults,
            roleControls: org.roleControls,
            complianceSettings: org.complianceSettings
        });
    } catch (error) {
        console.error("Error fetching org settings:", error);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
};

exports.updateOrgSettings = async (req, res) => {
    try {
        const orgId = getOrgId(req);
        const query = orgId ? { _id: orgId } : { adminId: req.user.id };

        const org = await Organization.findOne(query);
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        // Verify admin ownership
        if (org.adminId !== req.user.id && req.user.role !== 'super-admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Access denied" });
        }

        const { firmDefaults, roleControls, complianceSettings } = req.body;

        if (firmDefaults) org.firmDefaults = { ...org.firmDefaults, ...firmDefaults };
        if (roleControls) org.roleControls = { ...org.roleControls, ...roleControls };
        if (complianceSettings) org.complianceSettings = { ...org.complianceSettings, ...complianceSettings };

        await org.save();

        res.json({
            message: "Settings updated",
            firmDefaults: org.firmDefaults,
            roleControls: org.roleControls,
            complianceSettings: org.complianceSettings
        });
    } catch (error) {
        console.error("Error updating org settings:", error);
        res.status(500).json({ error: "Failed to update settings" });
    }
};

// ==========================================
// User Settings (Profile, Security, Reminders)
// ==========================================

exports.getUserSettings = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get or Create UserSettings
        let settings = await UserSettings.findOne({ userId });
        if (!settings) {
            settings = await UserSettings.create({ userId });
        }

        // 2. Fetch latest Name/Email from Supabase Profiles
        const { data: profileData } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('user_id', userId)
            .single();

        res.json({
            profile: {
                displayName: profileData?.name || req.user.name,
                email: profileData?.email || req.user.email,
                phone: settings.profile?.phone || ""
            },
            security: settings.security,
            reminders: settings.reminders
        });
    } catch (error) {
        console.error("Error fetching user settings:", error);
        res.status(500).json({ error: "Failed to fetch user settings" });
    }
};

exports.updateUserSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { security, reminders, profile } = req.body;

        let settings = await UserSettings.findOne({ userId });
        if (!settings) {
            settings = new UserSettings({ userId });
        }

        // Update local settings
        if (security) settings.security = { ...settings.security, ...security };
        if (reminders) settings.reminders = { ...settings.reminders, ...reminders };
        if (profile && profile.phone !== undefined) {
            if (!settings.profile) settings.profile = {};
            settings.profile.phone = profile.phone;
        }

        await settings.save();

        // Update Supabase Name if changed
        if (profile && profile.displayName) {
            const { error } = await supabase
                .from('profiles')
                .update({ name: profile.displayName })
                .eq('user_id', userId);

            if (error) {
                console.error("Error updating supabase profile name:", error);
                // Don't fail the whole request, just log
            }
        }

        res.json({ message: "User settings updated" });
    } catch (error) {
        console.error("Error updating user settings:", error);
        res.status(500).json({ error: "Failed to update user settings" });
    }
};
