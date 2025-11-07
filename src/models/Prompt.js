const mongoose = require("mongoose");
const { Schema } = mongoose;

const PromptSchema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastModifiedBy: {
      type: String,
      required: true
    },
    organizationId: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

// Index for faster queries with organization scoping
PromptSchema.index({ name: 1, organizationId: 1, category: 1 });
PromptSchema.index({ organizationId: 1, isActive: 1 });

module.exports = mongoose.model("Prompt", PromptSchema);