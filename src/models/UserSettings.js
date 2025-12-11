const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSettingsSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Security Settings
    security: {
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: Object, select: false } // Stores encrypted secret
    },

    // Reminder Settings
    reminders: {
        documentRemindersEnabled: { type: Boolean, default: true },
        reminderDaysBeforeDue: { type: Number, default: 3 }
    },

    // Extended Profile
    profile: {
        phone: { type: String, default: "" }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("UserSettings", UserSettingsSchema);
