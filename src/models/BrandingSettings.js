const mongoose = require('mongoose');

const brandingSettingsSchema = new mongoose.Schema({
  organization_name: {
    type: String,
    required: true,
    default: 'Audit Portal'
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
    default: '210 40% 98%'
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
    default: '43 96% 56%'
  },
  accent_foreground_color: {
    type: String,
    required: true,
    default: '222 47% 11%'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BrandingSettings', brandingSettingsSchema);

