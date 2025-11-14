const mongoose = require("mongoose");
const { Schema } = mongoose;

const wordPluginDraftTemplateSchema = new Schema(
  {
    templateId: {
      type: Number,
      required: true,
      unique: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    file: {
      originalName: {
        type: String,
        required: true,
      },
      mimeType: {
        type: String,
        required: true,
      },
      size: {
        type: Number,
        required: true,
      },
      url: {
        type: String,
      },
    },
    fileUrl: {
      type: String,
    },
    userId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WordPluginDraftTemplate",
  wordPluginDraftTemplateSchema
);

