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
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better query performance
OrganizationSchema.index({ adminId: 1 });
OrganizationSchema.index({ title: 1 });
OrganizationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Organization", OrganizationSchema);
