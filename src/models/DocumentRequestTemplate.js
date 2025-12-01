const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const templateItemSchema = new Schema({
  label: { type: String, required: true }, // e.g. "Front Page", "Page 1"

  // optional template file
  template: {
    url: { type: String },
    instructions: { type: String }
  }
});

const documentRequestTemplateSchema = new Schema(
  {
    name: { type: String, required: true },

    description: { type: String, required: true },

    organizationId: {
      type: Types.ObjectId,
      ref: "OrganizationId",
      required: true
    },

    type: {
      type: String,
      enum: ["direct", "template", "multiple"],
      default: "direct",
      required: true
    },

    // ✔️ NEW: multiple template items for multi-page requirements
    multiple: [templateItemSchema],

    // still allow a simple single template for simple cases
    template: {
      url: { type: String },
      instructions: { type: String }
    },

    uploadedBy: { type: String, required: true },

    isActive: { type: Boolean, default: true },

    category: {
      type: String,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "DocumentRequestTemplate",
  documentRequestTemplateSchema
);


module.exports = mongoose.model(
  "DocumentRequestTemplate",
  documentRequestTemplateSchema
);
