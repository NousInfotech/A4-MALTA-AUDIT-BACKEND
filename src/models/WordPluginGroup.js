const mongoose = require("mongoose");
const { Schema } = mongoose;

const wordPluginGroupSchema = new Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WordPluginGroup", wordPluginGroupSchema);

