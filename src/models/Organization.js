const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const OrganizationSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  adminId: {
    type: String,
    required: true,
  },

  brandingSettings: [{
    type: Types.ObjectId,
    ref: "BrandingSettings"
  }],

  // Firm Defaults
  firmDefaults: {
    timeZone: { type: String, default: "Europe/Malta" },
    currency: { type: String, default: "EUR" }
  },

  // Role & Controls
  roleControls: {
    enableCustomRoles: { type: Boolean, default: false },
    restrictDeleteToAdmins: { type: Boolean, default: true },
    allowESignature: { type: Boolean, default: false },
    showActivityLogToManagers: { type: Boolean, default: false }
  },

  // Compliance & Legal
  complianceSettings: {
    faqsMarkdown: { type: String, default: "" },
    termsUrl: { type: String, default: "" },
    privacyUrl: { type: String, default: "" },
    dataRetentionPolicy: { type: String, default: "" }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
OrganizationSchema.index({ adminId: 1 });
OrganizationSchema.index({ title: 1 });
OrganizationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Organization", OrganizationSchema);
