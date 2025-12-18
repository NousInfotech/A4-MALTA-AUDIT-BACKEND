const mongoose = require("mongoose");

// Schema for storing mappings from ExcelWorkbook to ClassificationEvidence (same as ETB)
const EvidenceMappingSchema = new mongoose.Schema({
  workbookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workbook",
    required: true
  },
  color: {
    type: String,
    required: true
  },
  details: {
    sheet: { type: String, required: true },
    start: {
      row: { type: Number, required: true },
      col: { type: Number, required: true },
    },
    end: {
      row: { type: Number, required: true },
      col: { type: Number, required: true },
    },
  },
  isActive: {
    type: Boolean,
    default: true
  },
  referenceFiles: [{
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String }
  }],
  notes: { type: String } // ✅ NEW: Notes field for mapping
}, { _id: true });

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
    linkedWorkbooks: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workbook" }],
      default: []
    }, // NEW: Add linked workbooks like ETB
    mappings: {
      type: [EvidenceMappingSchema],
      default: []
    }, // NEW: Add mappings like ETB
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ClassificationEvidence", classificationEvidenceSchema);
