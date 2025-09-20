const mongoose = require("mongoose");

const classificationEvidenceSchema = new mongoose.Schema(
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
    uploadedBy: {
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
    evidenceUrl: {
      type: String,
      required: true,
    },
    evidenceComments: [
      {
        commentor: {
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
        },
        comment: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClassificationEvidence", classificationEvidenceSchema);
