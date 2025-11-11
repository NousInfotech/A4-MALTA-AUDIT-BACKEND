const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

/**
 * Discussion Schema for KYC
 * Allows client & auditor to raise doubts / replies on specific requested files
 */
const KYCDiscussionSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["client", "auditor"],
      required: true,
    },
    message: { type: String, required: true },
    replyTo: { type: Types.ObjectId }, // reply to another discussion
    // metadata to link back to the exact document inside DocumentRequest
    documentRef: {
      documentRequestId: {
        type: Types.ObjectId,
        ref: "DocumentRequest",
        required: true,
      },
      documentIndex: { type: Number, required: true }, // points to documents[documentIndex]
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * KYC Schema
 */
const KYCSchema = new Schema(
  {
    engagement: { type: Types.ObjectId, ref: "Engagement", required: true },
    clientId: { type: String, required: true },
    auditorId: { type: String, required: true },
    documentRequests: [{ type: Types.ObjectId, ref: "DocumentRequest",personId: { type: Types.ObjectId, ref: "Person"} }],
    discussions: [KYCDiscussionSchema],
    status: {
      type: String,
      enum: [
        "active",
        "pending",
        "submitted",
        "in-review",
        "completed",
        "reopened",
      ],
      default: "pending",
    },
  },
  { timestamps: true }
);

const KYC = mongoose.model("KYC", KYCSchema);
module.exports = KYC;
