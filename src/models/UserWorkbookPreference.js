const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * UserWorkbookPreference Model
 * Stores user-specific preferences for workbooks (e.g., last selected sheet)
 */
const UserWorkbookPreferenceSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true, // Index for faster queries
    },
    workbookId: {
      type: Schema.Types.ObjectId,
      ref: "Workbook",
      required: true,
      index: true, // Index for faster queries
    },
    lastSelectedSheet: {
      type: String,
      required: true,
    },
    // Additional preferences can be added here in the future
    // e.g., zoomLevel, viewMode, etc.
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Create compound unique index for efficient queries (userId + workbookId)
// This ensures one preference per user per workbook
UserWorkbookPreferenceSchema.index({ userId: 1, workbookId: 1 }, { unique: true });

const UserWorkbookPreference = mongoose.model(
  "UserWorkbookPreference",
  UserWorkbookPreferenceSchema
);

module.exports = { UserWorkbookPreference };

