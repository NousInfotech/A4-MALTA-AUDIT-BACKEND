const mongoose = require("mongoose");
const { Schema } = mongoose;

const FolderPermissionSchema = new Schema(
  {
    folderName: { type: String, required: true, index: true }, // Removed unique - folders can have same name in different parents
    folderId: { type: Schema.Types.ObjectId, ref: "GlobalFolder", unique: true, required: true }, // Use folderId as unique identifier
    
    // Role-based permissions
    permissions: {
      // Roles that can view
      view: [{ type: String }], // e.g., ["partner", "manager", "junior-auditor", "client"]
      
      // Roles that can upload
      upload: [{ type: String }],
      
      // Roles that can delete
      delete: [{ type: String }],
      
      // Roles that can approve
      approve: [{ type: String }],
      
      // Roles that can create/delete folders
      manage: [{ type: String }],
    },
    
    // User-specific permissions (overrides role permissions)
    userPermissions: [
      {
        userId: { type: String, required: true },
        permissions: {
          view: { type: Boolean, default: true },
          upload: { type: Boolean, default: false },
          delete: { type: Boolean, default: false },
          approve: { type: Boolean, default: false },
        },
      },
    ],
    
    // Folder type
    folderType: {
      type: String,
      enum: ["predefined", "custom"],
      default: "custom",
    },
    
    // Predefined folder category (if applicable)
    category: {
      type: String,
      enum: [
        "Engagement Letters",
        "Client Documents",
        "Audit Working Papers",
        "Final Deliverables",
        "Prior Year Files",
      ],
    },
    
    // 2FA Settings
    require2FA: { type: Boolean, default: false },
    twoFactorMethod: {
      type: String,
      enum: ["email", "totp"],
      default: "email",
    },
    twoFactorSecret: { type: String }, // For TOTP (stored encrypted)
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FolderPermission", FolderPermissionSchema);

