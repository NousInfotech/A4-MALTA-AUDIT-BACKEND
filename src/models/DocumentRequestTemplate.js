const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const documentRequestTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
     },

    description: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["template", "direct"],
      default: "direct",
      required: true
    },

    template: {
      url: {
        type: String,
        required: true
      },
      instructions: {
        type: String,
        required: true
      }
    },

    uploadedBy: {
      type: String,
      required: true
     },

    isActive: {
      type: Boolean,
      default: true
    },

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
