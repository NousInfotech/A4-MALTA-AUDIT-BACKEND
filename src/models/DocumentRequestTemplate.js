const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const templateItemSchema = new Schema({
  label: { type: String, required: true },

  instruction: { type: String },

  // For TEMPLATE items
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
      enum: ["direct", "template"],
      default: "direct",
      required: true
    },

    // Updated: multiple supports direct + template
    multiple: [templateItemSchema],

    // Still allow simple single-template
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

