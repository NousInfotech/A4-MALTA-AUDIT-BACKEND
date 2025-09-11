const { Schema, model } = require("mongoose");

// Expandable enum for actions
const Action = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  UPLOAD_DOCUMENT: "UPLOAD_DOCUMENT",
  VIEW_CLIENT_FILE: "VIEW_CLIENT_FILE",
  UPDATE_PROFILE: "UPDATE_PROFILE",
  DELETE_DOCUMENT: "DELETE_DOCUMENT",
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  CREATE_ENGAGEMENT: "CREATE_ENGAGEMENT",
  UPDATE_ENGAGEMENT: "UPDATE_ENGAGEMENT",
  CREATE_CLIENT: "CREATE_CLIENT",
  UPDATE_CLIENT: "UPDATE_CLIENT",
  VIEW_ENGAGEMENT: "VIEW_ENGAGEMENT",
  START_ENGAGEMENT: "START_ENGAGEMENT",
  KYC_SETUP: "KYC_SETUP",
  KYC_COMPLETE: "KYC_COMPLETE",
  E_SIGNATURE: "E_SIGNATURE",
  // ➕ Add more as needed
};

const EmployeeLogSchema = new Schema(
  {
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, required: true },

    action: {
      type: String,
      enum: Object.values(Action),
      required: true,
    },
    details: { type: String },

    ipAddress: { type: String },
    location: { type: String },
    deviceInfo: { type: String },
    status: { type: String, enum: ["SUCCESS", "FAIL"] },

    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false, // already tracking with `timestamp`
    versionKey: false,
  }
);

const Log = model("Log", EmployeeLogSchema);

module.exports = { Log, Action };
