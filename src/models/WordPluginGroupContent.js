const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const wordPluginGroupContentSchema = new Schema(
  {
    groupId: {
      type: Types.ObjectId,
      ref: "WordPluginGroup",
      required: true,
      index: true,
    },
    contentText: {
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
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WordPluginGroupContent",
  wordPluginGroupContentSchema
);

