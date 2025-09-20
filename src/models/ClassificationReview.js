const mongoose = require("mongoose");

const classificationReviewSchema = new mongoose.Schema(
  {
    engagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Engagement",
      required: true,
    },
    classificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassificationSection",
      required: true,
    },
    reviewedBy: {
      userId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        required: true,
      },
    },
    comment: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-review", "signed-off"],
      default: "pending",
    },
    reviewedOn: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    sessionId: {
      type: String,
    },
    systemVersion: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClassificationReview", classificationReviewSchema);
