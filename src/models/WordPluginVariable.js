const mongoose = require("mongoose");
const { Schema } = mongoose;

const wordPluginVariableSchema = new Schema(
  {
    variableName: {
      type: String,
      required: true,
      trim: true,
    },
    variableValue: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "WordPluginVariable",
  wordPluginVariableSchema
);

