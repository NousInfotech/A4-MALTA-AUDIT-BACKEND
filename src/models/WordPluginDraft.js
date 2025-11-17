const mongoose = require("mongoose");
const { Schema } = mongoose;

const wordPluginDraftSchema = new Schema(
  {
    draftId: {
      type: Number,
      required: true,
      unique: true,
    },
    engagementId: {
      type: Number,
      required: true,
      index: true,
    },
    draftName: {
      type: String,
      required: true,
      trim: true,
    },
    createdDate: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    templateId: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WordPluginDraft", wordPluginDraftSchema);

