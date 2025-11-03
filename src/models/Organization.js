const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const ThemeSchema = new Schema({});

const OrganizationSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  adminId: {
    type: String,
    required: true,
  },

  theme: ThemeSchema,

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Organization", OrganizationSchema);

// create reference

// create a superAdmin role in supabase
// create only page to him to manage and create Organizaton

// order of roles

// 1. super Admin creates Organization and Admin Account for that organization
// 2. admin can create Employee and approve client ( now on auto approove )
// 3. employee can create clients and engagement and it's sub things

// 1. employee ( supabase )
// 2. client ( supabase )
// 3. engagements
// 4. ISQM
// 5. prompt
