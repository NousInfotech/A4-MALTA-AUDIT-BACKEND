const mongoose = require('mongoose');

const brandingSettingsSchema = new mongoose.Schema({
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  organization_name: {
    type: String,
    required: true,
    default: 'Audit Portal'
  },
  organization_subname: {
    type: String,
    default: 'AUDIT & COMPLIANCE'
  },
  logo_url: {
    type: String,
    default: null
  },
  // Sidebar colors
  sidebar_background_color: {
    type: String,
    required: true,
    default: '222 47% 11%'
  },
  sidebar_text_color: {
    type: String,
    required: true,
    default: '220 14% 96%'
  },
  // Body colors
  body_background_color: {
    type: String,
    required: true,
    default: '48 100% 96%'
  },
  body_text_color: {
    type: String,
    required: true,
    default: '222 47% 11%'
  },
  // Primary brand colors
  primary_color: {
    type: String,
    required: true,
    default: '222 47% 11%'
  },
  primary_foreground_color: {
    type: String,
    required: true,
    default: '0 0% 100%'
  },
  // Accent colors
  accent_color: {
    type: String,
    required: true,
    default: '0 0% 45%'
  },
  accent_foreground_color: {
    type: String,
    required: true,
    default: '0 0% 100%'
  }
}, {
  timestamps: true
});

// Create unique index on organizationId to ensure one branding per organization
brandingSettingsSchema.index({ organizationId: 1 }, { unique: true });

module.exports = mongoose.model('BrandingSettings', brandingSettingsSchema);

