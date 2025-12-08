const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const UserSettings = require("../models/UserSettings");

// Generate 2FA Secret
exports.setup2FA = async (req, res) => {
    try {
        const userId = req.user.id;

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `AuditPortal (${req.user.email})`
        });

        // Generate QR Code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // Temporarily store secret in DB (we won't enable it yet)
        // We update the record but keep twoFactorEnabled = false until verified
        let settings = await UserSettings.findOne({ userId });
        if (!settings) {
            settings = new UserSettings({ userId });
        }

        settings.security.twoFactorSecret = secret;
        await settings.save();

        res.json({
            message: "2FA Setup initiated",
            qrCode: qrCodeUrl,
            secret: secret.base32 // Manual entry key
        });

    } catch (error) {
        console.error("Error setting up 2FA:", error);
        res.status(500).json({ error: "Failed to setup 2FA" });
    }
};

// Verify Token and Enable 2FA
exports.verify2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        // Fetch user settings with secret
        const settings = await UserSettings.findOne({ userId }).select('+security.twoFactorSecret');

        if (!settings || !settings.security || !settings.security.twoFactorSecret) {
            return res.status(400).json({ error: "2FA setup not initiated" });
        }

        const verified = speakeasy.totp.verify({
            secret: settings.security.twoFactorSecret.base32,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            // Enable 2FA
            settings.security.twoFactorEnabled = true;
            await settings.save();
            res.json({ message: "2FA Enabled successfully", verified: true });
        } else {
            res.status(400).json({ error: "Invalid token", verified: false });
        }

    } catch (error) {
        console.error("Error verifying 2FA:", error);
        res.status(500).json({ error: "Failed to verify 2FA" });
    }
};

// Validate Token (Login flow)
exports.validate2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        const settings = await UserSettings.findOne({ userId }).select('+security.twoFactorSecret');

        if (!settings || !settings.security.twoFactorEnabled) {
            // If 2FA is not enabled, validation is implicitly "true" or unnecessary, 
            // but if we are here, the frontend thinks it IS enabled.
            // Or maybe the user disabled it on another device.
            return res.json({ valid: true, message: "2FA not enabled" });
        }

        const verified = speakeasy.totp.verify({
            secret: settings.security.twoFactorSecret.base32,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            res.json({ valid: true });
        } else {
            res.status(401).json({ valid: false, error: "Invalid code" });
        }

    } catch (error) {
        console.error("Error validating 2FA:", error);
        res.status(500).json({ error: "Validation failed" });
    }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;
        // Ideally we re-verify password here, but Supabase handles auth. 
        // We'll trust the session for now (or require a fresh 2FA token to disable it!).

        await UserSettings.findOneAndUpdate(
            { userId },
            { $set: { 'security.twoFactorEnabled': false, 'security.twoFactorSecret': null } }
        );

        res.json({ message: "2FA Disabled" });
    } catch (error) {
        console.error("Error disabling 2FA:", error);
        res.status(500).json({ error: "Failed to disable 2FA" });
    }
};
