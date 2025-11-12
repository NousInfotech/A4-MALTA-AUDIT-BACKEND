// models/Engagement.js

const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const EngagementSchema = new Schema(
  {
    excelURL: { type: String },
    clientId: { type: String, required: true },
    organizationId: { type: String, required: true },
    companyId:{type:Types.ObjectId, ref:"Company", required:true},
    title: { type: String, required: true },
    yearEndDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "completed"],
      default: "draft",
    },

    trialBalanceUrl: { type: String, default: "" },

    trialBalance: {
      type: Types.ObjectId,
      ref: "TrialBalance",
    },

    assignedAuditors: [
      {
        auditorId: {
          type: String,
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: String,
          required: true,
        },
      },
    ],

    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

EngagementSchema.virtual("trialBalanceDoc", {
  ref: "TrialBalance",
  localField: "trialBalance",
  foreignField: "_id",
  justOne: true,
});

EngagementSchema.virtual("documentRequests", {
  ref: "DocumentRequest",
  localField: "_id",
  foreignField: "engagement",
});

EngagementSchema.virtual("procedures", {
  ref: "Procedure",
  localField: "_id",
  foreignField: "engagement",
});

EngagementSchema.virtual("pbc", {
  ref: "PBC",
  localField: "_id",
  foreignField: "engagement",
});

EngagementSchema.virtual("kyc",{
  ref: "KYC",
  localField: "_id",
  foreignField: "engagement",
})


// Index for better query performance with organization scoping
EngagementSchema.index({ organizationId: 1, status: 1 });
EngagementSchema.index({ organizationId: 1, createdBy: 1 });
EngagementSchema.index({ clientId: 1, organizationId: 1 });

module.exports = mongoose.model("Engagement", EngagementSchema);
