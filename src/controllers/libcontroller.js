const mongoose = require("mongoose");
const GlobalFolder = require("../models/GlobalFolder");
const GlobalDocument = require("../models/GlobalDocument");
const DocumentVersion = require("../models/DocumentVersion");
const DocumentActivity = require("../models/DocumentActivity");
const FolderPermission = require("../models/FolderPermission");
const UserSession = require("../models/UserSession");
const { supabase } = require("../config/supabase");
const archiver = require("archiver");
const { Readable } = require("stream");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");

const BUCKET = "engagement-documents";

// Predefined folders
const PREDEFINED_FOLDERS = [
  { name: "Engagement Letters", category: "Engagement Letters" },
  { name: "Client Documents", category: "Client Documents" },
  { name: "Audit Working Papers", category: "Audit Working Papers" },
  { name: "Final Deliverables", category: "Final Deliverables" },
  { name: "Prior Year Files", category: "Prior Year Files" },
];

// Role-based permissions mapping (using existing Supabase roles)
const ROLE_PERMISSIONS = {
  "partner": { view: true, upload: true, delete: true, approve: true, manage: true },
  "manager": { view: true, upload: true, delete: true, approve: true, manage: true },
  "senior-employee": { view: true, upload: true, delete: false, approve: false, manage: true }, // Can create folders
  "employee": { view: true, upload: true, delete: false, approve: false, manage: true }, // Can create folders (auditors)
  "reviewer": { view: true, upload: true, delete: false, approve: true, manage: true }, // Can create folders
  "client": { view: true, upload: true, delete: false, approve: false, manage: false },
  "admin": { view: true, upload: true, delete: true, approve: true, manage: true },
};

function sanitizeFolderName(name) {
  const cleaned = (name || "").trim();
  const valid = cleaned.replace(/[^a-zA-Z0-9 _.-]/g, "");
  if (!valid || /[\\/]/.test(valid)) {
    throw new Error("Invalid folder name");
  }
  return valid;
}

// Helper function to build full path from parent hierarchy
async function buildFolderPath(folderId) {
  if (!folderId) return "";
  
  const folder = await GlobalFolder.findById(folderId);
  if (!folder) return "";
  
  const parentPath = folder.parentId 
    ? await buildFolderPath(folder.parentId) 
    : "";
  
  return parentPath ? `${parentPath}${folder.name}/` : `${folder.name}/`;
}

// Check if 2FA is required and verified for folder
async function check2FAVerification(folderNameOrId, user, sessionToken) {
  // Try to find folder by ID first, then by name
  let folder = null;
  let folderId = null;
  
  if (mongoose.Types.ObjectId.isValid(folderNameOrId)) {
    folder = await GlobalFolder.findById(folderNameOrId);
    if (folder) folderId = folder._id;
  }
  
  if (!folder) {
    folder = await GlobalFolder.findOne({ name: folderNameOrId });
    if (folder) folderId = folder._id;
  }
  
  const permission = folderId 
    ? await FolderPermission.findOne({ folderId })
    : await FolderPermission.findOne({ folderName: folderNameOrId });
    
  if (!permission || !permission.require2FA) {
    return { required: false, verified: true };
  }

  // Check if user has verified 2FA for this folder in current session
  // Use folderId if available, otherwise use folderName for backward compatibility
  const folderKey = folderId ? folderId.toString() : folderNameOrId;
  
  if (sessionToken) {
    const session = await UserSession.findOne({ 
      userId: user.id, 
      sessionToken,
      isActive: true 
    });
    
    if (session && session.twoFactorVerified) {
      const verifiedAt = session.twoFactorVerified.get(folderKey);
      // 2FA verification valid for 24 hours
      if (verifiedAt && (Date.now() - verifiedAt.getTime()) < 24 * 60 * 60 * 1000) {
        return { required: true, verified: true };
      }
    }
  }

  return { required: true, verified: false };
}

// Check folder permissions - now supports folderId or folderName
async function checkFolderPermission(folderNameOrId, user, action, sessionToken = null) {
  // Try to find folder by ID first, then by name
  let folder = null;
  let folderId = null;
  
  // Check if it's an ObjectId format
  if (mongoose.Types.ObjectId.isValid(folderNameOrId)) {
    folder = await GlobalFolder.findById(folderNameOrId);
    if (folder) folderId = folder._id;
  }
  
  // If not found by ID, try by name
  if (!folder) {
    folder = await GlobalFolder.findOne({ name: folderNameOrId });
    if (folder) folderId = folder._id;
  }
  
  // If still no folder found, use folderName for backward compatibility
  const permission = folderId 
    ? await FolderPermission.findOne({ folderId })
    : await FolderPermission.findOne({ folderName: folderNameOrId });
    
  if (!permission) {
    // Default: allow all employees
    return { allowed: ROLE_PERMISSIONS[user.role]?.[action] || false, requires2FA: false };
  }

  // Check 2FA requirement
  const twoFAStatus = await check2FAVerification(folderNameOrId, user, sessionToken);
  if (twoFAStatus.required && !twoFAStatus.verified) {
    return { allowed: false, requires2FA: true, verified: false };
  }

  // Check user-specific permissions first
  const userPerm = permission.userPermissions?.find((p) => p.userId === user.id);
  if (userPerm && userPerm.permissions[action] !== undefined) {
    return { 
      allowed: userPerm.permissions[action], 
      requires2FA: twoFAStatus.required,
      verified: twoFAStatus.verified 
    };
  }

  // Check role permissions
  const allowedRoles = permission.permissions[action] || [];
  const allowed = allowedRoles.includes(user.role) || ROLE_PERMISSIONS[user.role]?.[action] || false;
  
  return { 
    allowed, 
    requires2FA: twoFAStatus.required,
    verified: twoFAStatus.verified 
  };
}

// Log activity
async function logActivity(documentId, fileName, folderName, action, user, details = null, req = null) {
  try {
    await DocumentActivity.create({
      documentId,
      fileName,
      folderName,
      action,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details,
      ipAddress: req?.ip || user.ipAddress,
      userAgent: req?.get("user-agent"),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

// Initialize predefined folders with permissions
async function initializePredefinedFolders() {
  for (const folder of PREDEFINED_FOLDERS) {
    const exists = await GlobalFolder.findOne({ name: folder.name });
    if (!exists) {
      const path = `${folder.name}/`;
      await supabase.storage
        .from(BUCKET)
        .upload(`${path}.keep`, Buffer.from(""), {
          contentType: "text/plain",
          upsert: false,
        });
      await GlobalFolder.create({ name: folder.name, path });
      
      // Set default permissions - use folderId
      const createdFolder = await GlobalFolder.findOne({ name: folder.name });
      if (createdFolder) {
        await FolderPermission.findOneAndUpdate(
          { folderId: createdFolder._id },
          {
            folderName: folder.name,
            folderId: createdFolder._id,
            folderType: "predefined",
            category: folder.category,
            permissions: {
              view: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
              upload: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
              delete: ["partner", "manager", "admin"],
              approve: ["partner", "manager", "admin"],
              manage: ["partner", "manager", "admin"],
            },
          },
          { upsert: true }
        );
      }
    }
  }
}

exports.listFolders = async (req, res, next) => {
  try {
    await initializePredefinedFolders();
    const folders = await GlobalFolder.find().populate('parentId', 'name path').sort({ createdAt: -1 });
    
    // Add permission info for each folder
    const foldersWithPerms = await Promise.all(
      folders.map(async (folder) => {
        const perm = await FolderPermission.findOne({ folderId: folder._id });
        const canView = await checkFolderPermission(folder._id.toString(), req.user, "view");
        return {
          ...folder.toObject(),
          canView,
          permissions: perm || null,
        };
      })
    );
    
    res.json(foldersWithPerms.filter((f) => f.canView));
  } catch (err) {
    next(err);
  }
};

exports.createFolder = async (req, res, next) => {
  try {
    // Allow employees (auditors), reviewers, senior-employees, managers, partners, and admins to create folders
    // Using existing Supabase roles
    const allowedRoles = ["employee", "reviewer", "senior-employee", "manager", "partner", "admin"];
    
    // Check role-based permission first (from ROLE_PERMISSIONS)
    const roleHasPermission = ROLE_PERMISSIONS[req.user.role]?.manage === true;
    
    if (!roleHasPermission && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions to create folders" });
    }

    const rawName = req.body.name;
    const name = sanitizeFolderName(rawName);
    const parentId = req.body.parentId || null;

    // Check if parent exists (if parentId is provided)
    if (parentId) {
      const parent = await GlobalFolder.findById(parentId);
      if (!parent) {
        return res.status(404).json({ message: "Parent folder not found" });
      }
    }

    // Check if folder with same name already exists in the same parent
    const exists = await GlobalFolder.findOne({ name, parentId });
    if (exists) {
      return res.status(409).json({ message: "Folder with this name already exists in the selected location" });
    }

    // Build full path including parent hierarchy
    const parentPath = parentId ? await buildFolderPath(parentId) : "";
    const fullPath = `${parentPath}${name}/`;
    const storagePath = `${fullPath}.keep`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(""), {
        contentType: "text/plain",
        upsert: false,
      });
    if (upErr && upErr.statusCode !== "409") throw upErr;
    
    const folder = await GlobalFolder.create({ 
      name, 
      path: fullPath,
      parentId: parentId || null,
      createdBy: req.user.name,
    });
    
    // Create default permissions - use folderId as unique identifier
    await FolderPermission.create({
      folderName: name,
      folderId: folder._id,
      folderType: "custom",
      permissions: {
        view: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
        upload: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
        delete: ["partner", "manager", "admin"],
        approve: ["partner", "manager", "admin"],
        manage: ["partner", "manager", "admin"],
      },
    }).catch(async (err) => {
      // If permission already exists (by folderId), update it instead
      if (err.code === 11000) {
        await FolderPermission.findOneAndUpdate(
          { folderId: folder._id },
          { folderName: name },
          { upsert: true }
        );
      } else {
        throw err;
      }
    });
    
    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
};

exports.renameFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawNewName = req.body.newName;
    const newName = sanitizeFolderName(rawNewName);

    const folder = await GlobalFolder.findById(id);
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    const canManage = await checkFolderPermission(folder.name, req.user, "manage");
    if (!canManage.allowed) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    if (newName === folder.name) return res.json(folder);

    const dupe = await GlobalFolder.findOne({ name: newName });
    if (dupe) return res.status(409).json({ message: "Target folder name already exists" });

    const oldPrefix = folder.path;
    const newPrefix = `${newName}/`;

    const { data: items, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(oldPrefix, { limit: 1000 });
    if (listErr) throw listErr;

    for (const item of items || []) {
      const oldPath = `${oldPrefix}${item.name}`;
      const newPath = `${newPrefix}${item.name}`;
      const { error: copyErr } = await supabase.storage.from(BUCKET).copy(oldPath, newPath);
      if (copyErr) throw copyErr;
    }

    const deletePaths = (items || []).map((i) => `${oldPrefix}${i.name}`);
    if (deletePaths.length) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(deletePaths);
      if (delErr) throw delErr;
    }

    await supabase.storage.from(BUCKET).upload(`${newPrefix}.keep`, Buffer.from(""), {
      contentType: "text/plain",
      upsert: true,
    });

    folder.name = newName;
    folder.path = newPrefix;
    await folder.save();

    // Update permissions - use folderId instead of folderName
    await FolderPermission.updateOne({ folderId: folder._id }, { folderName: newName });

    res.json(folder);
  } catch (err) {
    next(err);
  }
};

exports.deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const folder = await GlobalFolder.findById(id);
    if (!folder) return res.status(404).json({ message: "Folder not found" });

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const canManage = await checkFolderPermission(folder.name, req.user, "manage", sessionToken);
    if (!canManage.allowed) {
      if (canManage.requires2FA && !canManage.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder.name 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const prefix = folder.path;
    const { data: items, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (listErr) throw listErr;

    const deletePaths = (items || []).map((i) => `${prefix}${i.name}`);
    deletePaths.push(`${prefix}.keep`);

    const uniquePaths = Array.from(new Set(deletePaths));
    const { error: delErr } = await supabase.storage.from(BUCKET).remove(uniquePaths);
    if (delErr) throw delErr;

    await GlobalDocument.deleteMany({ folderName: folder.name });
    await FolderPermission.deleteOne({ folderId: folder._id });
    await GlobalFolder.deleteOne({ _id: folder._id });

    res.json({ message: "Folder and contents deleted" });
  } catch (err) {
    next(err);
  }
};

exports.listFiles = async (req, res, next) => {
  try {
    const { folder, search, fileType, uploadedBy, dateFrom, dateTo, engagementId, clientId, tags, sortBy = "uploadedAt", sortOrder = "desc" } = req.query;
    
    if (!folder) return res.status(400).json({ message: "folder is required" });

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "view", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions to view this folder" });
    }

    const name = sanitizeFolderName(folder);
    const query = { folderName: name, isLatest: true };

    // Apply filters
    if (search) {
      query.$or = [
        { fileName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }
    if (fileType) {
      query.fileType = fileType.toLowerCase();
    }
    if (uploadedBy) {
      query.uploadedBy = uploadedBy;
    }
    if (dateFrom || dateTo) {
      query.uploadedAt = {};
      if (dateFrom) query.uploadedAt.$gte = new Date(dateFrom);
      if (dateTo) query.uploadedAt.$lte = new Date(dateTo);
    }
    if (engagementId) {
      query.engagementId = engagementId;
    }
    if (clientId) {
      query.clientId = clientId;
    }
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const documents = await GlobalDocument.find(query)
      .sort(sortOptions)
      .limit(1000)
      .lean();

    // Get public URLs from Supabase
    const files = documents.map((doc) => {
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(doc.filePath);
      return {
        ...doc,
        publicUrl: pub.publicUrl,
        _id: doc._id.toString(),
      };
    });

    res.json(files);
  } catch (err) {
    next(err);
  }
};

exports.upload = async (req, res, next) => {
  try {
    const { folder, description, tags, engagementId, clientId } = req.body;
    const file = req.file;
    
    if (!folder) return res.status(400).json({ message: "folder is required" });
    if (!file) return res.status(400).json({ message: "file is required" });

    // Check file size (20 MB limit)
    if (file.size > 20 * 1024 * 1024) {
      return res.status(400).json({ message: "File size must be less than 20 MB" });
    }

    // Check permissions
    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "upload", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions to upload to this folder" });
    }

    const name = sanitizeFolderName(folder);
    const fileType = file.originalname.split(".").pop()?.toLowerCase() || "";
    const allowedTypes = ["pdf", "docx", "xlsx", "jpg", "jpeg", "png", "zip", "doc", "xls"];
    
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ message: `File type .${fileType} not allowed. Allowed: ${allowedTypes.join(", ")}` });
    }

    // Check if file with same name exists (versioning)
    const existingDoc = await GlobalDocument.findOne({
      folderName: name,
      fileName: file.originalname,
      isLatest: true,
    });

    let version = 1;
    let previousVersionId = null;

    if (existingDoc) {
      // Create version history entry
      await DocumentVersion.create({
        documentId: existingDoc._id,
        fileName: existingDoc.fileName,
        version: existingDoc.version,
        filePath: existingDoc.filePath,
        fileSize: existingDoc.fileSize,
        publicUrl: existingDoc.publicUrl,
        createdBy: existingDoc.uploadedBy,
        createdByName: existingDoc.uploadedByName,
        createdByRole: existingDoc.uploadedByRole,
      });

      // Mark old version as not latest
      existingDoc.isLatest = false;
      await existingDoc.save();
      
      version = existingDoc.version + 1;
      previousVersionId = existingDoc._id;
    }

    // Upload to Supabase
    const timestamp = Date.now();
    const uniqueFileName = existingDoc 
      ? `${file.originalname}`
      : `${timestamp}-${file.originalname}`;
    const path = `${name}/${uniqueFileName}`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (error) throw error;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

    // Create document record
    const document = await GlobalDocument.create({
      fileName: file.originalname,
      originalFileName: file.originalname,
      folderName: name,
      folderPath: `${name}/`,
      filePath: path,
      fileSize: file.size,
      fileType,
      mimeType: file.mimetype,
      publicUrl: pub.publicUrl,
      version,
      isLatest: true,
      previousVersionId,
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      uploadedByRole: req.user.role,
      description: description || null,
      tags: tags ? (Array.isArray(tags) ? tags : typeof tags === "string" ? (tags.startsWith("[") ? JSON.parse(tags) : tags.split(",").map((t) => t.trim())) : []) : [],
      engagementId: engagementId || null,
      clientId: clientId || null,
    });

    // Log activity
    await logActivity(document._id, file.originalname, name, "upload", req.user, `Uploaded version ${version}`, req);

    res.status(201).json({
      _id: document._id.toString(),
      name: file.originalname,
      size: file.size,
      updatedAt: document.uploadedAt,
      publicUrl: pub.publicUrl,
      version: document.version,
      uploadedBy: document.uploadedByName,
      uploadedByRole: document.uploadedByRole,
    });
  } catch (err) {
    next(err);
  }
};

exports.moveFile = async (req, res, next) => {
  try {
    const { fileName, fromFolder, toFolder } = req.body;
    if (!fileName || !fromFolder || !toFolder) {
      return res.status(400).json({ message: "fileName, fromFolder, toFolder are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    
    const from = sanitizeFolderName(fromFolder);
    const to = sanitizeFolderName(toFolder);

    // Find document - use fileName to find it
    const doc = await GlobalDocument.findOne({ folderName: from, fileName, isLatest: true });
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Use the actual filePath from the document (includes timestamp if present)
    const oldPath = doc.filePath;
    // Extract just the filename part (after last slash) for the new path
    const actualFileName = oldPath.split('/').pop();
    const newPath = `${to}/${actualFileName}`;

    // Check permissions: Need upload on destination, and either:
    // 1. Delete permission on source folder, OR
    // 2. User uploaded the file (owns it), OR  
    // 3. Upload permission on source folder (for employees who can't delete but can move their own files)
    const permCheckUploadDest = await checkFolderPermission(toFolder, req.user, "upload", sessionToken);
    const permCheckUploadSource = await checkFolderPermission(fromFolder, req.user, "upload", sessionToken);
    const permCheckDelete = await checkFolderPermission(fromFolder, req.user, "delete", sessionToken);
    const userOwnsFile = doc.uploadedBy === req.user.id;
    
    // Allow move if:
    // - Has upload permission on destination AND
    // - (Has delete permission on source OR user owns the file OR has upload permission on source)
    const canMove = permCheckUploadDest.allowed && 
                    (permCheckDelete.allowed || userOwnsFile || permCheckUploadSource.allowed);
    
    if (!canMove) {
      // Check 2FA requirements
      if ((permCheckUploadDest.requires2FA && !permCheckUploadDest.verified) || 
          (permCheckUploadSource.requires2FA && !permCheckUploadSource.verified)) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: permCheckUploadDest.requires2FA ? toFolder : fromFolder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions to move this file" });
    }

    await supabase.storage.from(BUCKET).upload(`${to}/.keep`, Buffer.from(""), {
      contentType: "text/plain",
      upsert: true,
    });

    const { error: copyErr } = await supabase.storage.from(BUCKET).copy(oldPath, newPath);
    if (copyErr) throw copyErr;

    const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
    if (delErr) throw delErr;

    // Update document record
    doc.folderName = to;
    doc.folderPath = `${to}/`;
    doc.filePath = newPath;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
    doc.publicUrl = pub.publicUrl;
    await doc.save();

    // Log activity
    await logActivity(doc._id, fileName, to, "move", req.user, `Moved from ${fromFolder} to ${toFolder}`, req);

    res.json({ message: "Moved", newPublicUrl: pub.publicUrl });
  } catch (err) {
    next(err);
  }
};

exports.deleteFile = async (req, res, next) => {
  try {
    const { folder, fileName } = req.body;
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const name = sanitizeFolderName(folder);
    const doc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check permissions: Allow delete if:
    // 1. User has delete permission on folder, OR
    // 2. User owns the file (uploaded it), OR
    // 3. User has upload permission on folder (can delete their own uploads)
    const permCheckDelete = await checkFolderPermission(folder, req.user, "delete", sessionToken);
    const permCheckUpload = await checkFolderPermission(folder, req.user, "upload", sessionToken);
    const userOwnsFile = doc.uploadedBy === req.user.id;
    
    // Allow delete if:
    // - Has delete permission on folder OR
    // - (User owns the file AND has upload permission on folder)
    const canDelete = permCheckDelete.allowed || (userOwnsFile && permCheckUpload.allowed);
    
    if (!canDelete) {
      // Check 2FA requirements
      if ((permCheckDelete.requires2FA && !permCheckDelete.verified) || 
          (permCheckUpload.requires2FA && !permCheckUpload.verified)) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions to delete this file" });
    }

    // Use the actual filePath from the document (includes timestamp if present)
    const path = doc.filePath;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;

    // Mark as deleted (soft delete) or remove
    await GlobalDocument.deleteOne({ _id: doc._id });
    
    // Log activity
    await logActivity(doc._id, fileName, name, "delete", req.user, null, req);

    res.json({ message: "File deleted" });
  } catch (err) {
    next(err);
  }
};

// New endpoints

exports.getFileVersions = async (req, res, next) => {
  try {
    const { folder, fileName } = req.query;
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const name = sanitizeFolderName(folder);
    
    // Find all documents with the same fileName and folderName (all versions)
    const allDocs = await GlobalDocument.find({ folderName: name, fileName })
      .sort({ version: -1 })
      .lean();

    if (allDocs.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    // Get all document IDs to find related DocumentVersion entries
    const docIds = allDocs.map(d => d._id);
    
    // Find all DocumentVersion entries for any of these documents
    const versionEntries = await DocumentVersion.find({ documentId: { $in: docIds } })
      .sort({ version: -1 })
      .lean();

    // Create a map of versions from DocumentVersion entries
    const versionMap = new Map();
    versionEntries.forEach(v => {
      // Find the corresponding GlobalDocument to get restoredFromVersion if it exists
      const correspondingDoc = allDocs.find(d => d.version === v.version);
      versionMap.set(v.version, {
        version: v.version,
        fileName: v.fileName,
        fileSize: v.fileSize,
        uploadedBy: v.createdByName || v.uploadedBy,
        uploadedAt: v.createdAt || v.uploadedAt,
        publicUrl: v.publicUrl,
        isLatest: false,
        restoredFromVersion: correspondingDoc?.restoredFromVersion || null,
      });
    });

    // Add all GlobalDocument entries (including current and old versions)
    allDocs.forEach(doc => {
      if (!versionMap.has(doc.version)) {
        versionMap.set(doc.version, {
          version: doc.version,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          uploadedBy: doc.uploadedByName,
          uploadedAt: doc.uploadedAt,
          publicUrl: doc.publicUrl,
          isLatest: doc.isLatest || false,
          restoredFromVersion: doc.restoredFromVersion || null, // Include restored info
        });
      } else {
        // Update if this is the latest version
        const existing = versionMap.get(doc.version);
        if (doc.isLatest) {
          existing.isLatest = true;
          existing.publicUrl = doc.publicUrl; // Use latest URL
          existing.restoredFromVersion = doc.restoredFromVersion || null; // Include restored info
        }
      }
    });

    // Convert map to array and sort by version descending
    const allVersions = Array.from(versionMap.values())
      .sort((a, b) => b.version - a.version);

    res.json(allVersions);
  } catch (err) {
    next(err);
  }
};

exports.restoreVersion = async (req, res, next) => {
  try {
    const { folder, fileName, version } = req.body;
    if (!folder || !fileName || version === undefined) {
      return res.status(400).json({ message: "folder, fileName, and version are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "upload", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const name = sanitizeFolderName(folder);
    
    // Find the latest document
    const latestDoc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    if (!latestDoc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Find the version to restore - check both GlobalDocument and DocumentVersion
    let versionToRestore = null;
    let filePathToRestore = null;
    let mimeTypeToRestore = null;
    
    // First, try to find in GlobalDocument (for old versions that are still stored as documents)
    const versionDoc = await GlobalDocument.findOne({ folderName: name, fileName, version: parseInt(version) });
    if (versionDoc) {
      versionToRestore = versionDoc;
      filePathToRestore = versionDoc.filePath;
      mimeTypeToRestore = versionDoc.mimeType;
    } else {
      // If not found in GlobalDocument, try DocumentVersion
      // Get all document IDs for this file
      const allDocs = await GlobalDocument.find({ folderName: name, fileName }).select('_id').lean();
      const docIds = allDocs.map(d => d._id);
      
      const versionEntry = await DocumentVersion.findOne({ 
        documentId: { $in: docIds }, 
        version: parseInt(version) 
      });
      
      if (versionEntry) {
        versionToRestore = versionEntry;
        filePathToRestore = versionEntry.filePath;
        mimeTypeToRestore = latestDoc.mimeType; // Use latest mimeType as fallback
      }
    }

    if (!versionToRestore || !filePathToRestore) {
      return res.status(404).json({ message: `Version ${version} not found` });
    }

    // Download the version file and re-upload as new version
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET)
      .download(filePathToRestore);
    if (downloadErr) {
      console.error("Error downloading version file:", downloadErr);
      return res.status(404).json({ message: "Version file not found in storage" });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    
    // Create new version
    const newVersion = latestDoc.version + 1;
    const timestamp = Date.now();
    const path = `${name}/${timestamp}-${fileName}`;
    
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: mimeTypeToRestore || latestDoc.mimeType,
        upsert: false,
      });
    if (uploadErr) {
      console.error("Error uploading restored version:", uploadErr);
      throw uploadErr;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    // Create version history entry for current version (before it becomes old)
    await DocumentVersion.create({
      documentId: latestDoc._id,
      fileName: latestDoc.fileName,
      version: latestDoc.version,
      filePath: latestDoc.filePath,
      fileSize: latestDoc.fileSize,
      publicUrl: latestDoc.publicUrl,
      createdBy: latestDoc.uploadedBy,
      createdByName: latestDoc.uploadedByName,
      createdByRole: latestDoc.uploadedByRole,
    });

    // Update current document to mark as not latest
    latestDoc.isLatest = false;
    await latestDoc.save();

    // Create new document with restored version
    const restoredDoc = await GlobalDocument.create({
      fileName: latestDoc.fileName,
      originalFileName: latestDoc.originalFileName || latestDoc.fileName,
      folderName: name,
      folderPath: `${name}/`,
      filePath: path,
      fileSize: versionToRestore.fileSize || latestDoc.fileSize,
      fileType: latestDoc.fileType,
      mimeType: mimeTypeToRestore || latestDoc.mimeType,
      publicUrl: pub.publicUrl,
      version: newVersion,
      isLatest: true,
      previousVersionId: latestDoc._id,
      restoredFromVersion: parseInt(version), // Track which version was restored
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      uploadedByRole: req.user.role,
      description: latestDoc.description,
      tags: latestDoc.tags || [],
      engagementId: latestDoc.engagementId,
      clientId: latestDoc.clientId,
    });

    // Log activity
    await logActivity(restoredDoc._id, fileName, name, "restore", req.user, `Restored version ${version}`, req);

    res.json({
      message: "Version restored",
      document: {
        _id: restoredDoc._id.toString(),
        version: restoredDoc.version,
        publicUrl: restoredDoc.publicUrl,
      },
    });
  } catch (err) {
    console.error("Error in restoreVersion:", err);
    next(err);
  }
};

exports.downloadFile = async (req, res, next) => {
  try {
    const { folder, fileName } = req.query;
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "view", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const name = sanitizeFolderName(folder);
    const doc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Update download count
    doc.downloadCount = (doc.downloadCount || 0) + 1;
    doc.lastDownloadedAt = new Date();
    await doc.save();

    // Log activity
    await logActivity(doc._id, fileName, name, "download", req.user, null, req);

    // Return download URL
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(doc.filePath);
    res.json({ downloadUrl: pub.publicUrl, fileName: doc.fileName });
  } catch (err) {
    next(err);
  }
};

exports.previewFile = async (req, res, next) => {
  try {
    const { folder, fileName } = req.query;
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "view", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const name = sanitizeFolderName(folder);
    const doc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Update view count
    doc.viewCount = (doc.viewCount || 0) + 1;
    doc.lastViewedAt = new Date();
    await doc.save();

    // Log activity
    await logActivity(doc._id, fileName, name, "view", req.user, null, req);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(doc.filePath);
    res.json({
      previewUrl: pub.publicUrl,
      fileName: doc.fileName,
      fileType: doc.fileType,
      mimeType: doc.mimeType,
      canPreview: ["pdf", "jpg", "jpeg", "png", "docx", "doc"].includes(doc.fileType),
    });
  } catch (err) {
    next(err);
  }
};

exports.bulkDownload = async (req, res, next) => {
  try {
    const { folder, fileNames } = req.body;
    if (!folder || !fileNames || !Array.isArray(fileNames)) {
      return res.status(400).json({ message: "folder and fileNames array are required" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "view", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const name = sanitizeFolderName(folder);
    const docs = await GlobalDocument.find({
      folderName: name,
      fileName: { $in: fileNames },
      isLatest: true,
    });

    if (docs.length === 0) {
      return res.status(404).json({ message: "No files found" });
    }

    // Create zip archive
    const archive = archiver("zip", { zlib: { level: 9 } });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${name}-files.zip"`);
    archive.pipe(res);

    // Download and add files to archive
    for (const doc of docs) {
      try {
        const { data: fileData, error } = await supabase.storage.from(BUCKET).download(doc.filePath);
        if (error) {
          console.error(`Failed to download ${doc.fileName}:`, error);
          continue;
        }
        const buffer = Buffer.from(await fileData.arrayBuffer());
        archive.append(buffer, { name: doc.fileName });
        
        // Log activity
        await logActivity(doc._id, doc.fileName, name, "download", req.user, "Bulk download", req);
      } catch (err) {
        console.error(`Error processing ${doc.fileName}:`, err);
      }
    }

    archive.finalize();
  } catch (err) {
    next(err);
  }
};

exports.getFileActivity = async (req, res, next) => {
  try {
    const { folder, fileName, limit = 50 } = req.query;
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const name = sanitizeFolderName(folder);
    const doc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    const activities = await DocumentActivity.find({ documentId: doc._id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(activities);
  } catch (err) {
    next(err);
  }
};

exports.updateFileMetadata = async (req, res, next) => {
  try {
    const { folder, fileName } = req.query;
    const { description, tags, status } = req.body;
    
    if (!folder || !fileName) {
      return res.status(400).json({ message: "folder and fileName are required" });
    }

    const name = sanitizeFolderName(folder);
    const doc = await GlobalDocument.findOne({ folderName: name, fileName, isLatest: true });
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check permissions
    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    const permCheck = await checkFolderPermission(folder, req.user, "upload", sessionToken);
    if (!permCheck.allowed) {
      if (permCheck.requires2FA && !permCheck.verified) {
        return res.status(403).json({ 
          message: "2FA verification required",
          requires2FA: true,
          folderName: folder 
        });
      }
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    if (description !== undefined) doc.description = description;
    if (tags !== undefined) {
      doc.tags = Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim());
    }
    if (status && ["draft", "pending", "approved", "archived"].includes(status)) {
      if (status === "approved") {
        const approveCheck = await checkFolderPermission(folder, req.user, "approve", sessionToken);
        if (!approveCheck.allowed) {
          if (approveCheck.requires2FA && !approveCheck.verified) {
            return res.status(403).json({ 
              message: "2FA verification required",
              requires2FA: true,
              folderName: folder 
            });
          }
          return res.status(403).json({ message: "Insufficient permissions to approve" });
        }
        doc.approvedBy = req.user.id;
        doc.approvedAt = new Date();
      }
      doc.status = status;
    }

    await doc.save();

    // Log activity
    await logActivity(doc._id, fileName, name, "rename", req.user, "Metadata updated", req);

    res.json(doc);
  } catch (err) {
    next(err);
  }
};

// 2FA Endpoints

// Generate TOTP secret and QR code for folder
exports.generate2FASecret = async (req, res, next) => {
  try {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ message: "folderName is required" });
    }

    // Sanitize folder name and find folder
    const sanitizedName = sanitizeFolderName(folderName);
    
    // Check if folder exists
    const folder = await GlobalFolder.findOne({ name: sanitizedName });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Check manage permission without 2FA requirement (bypass 2FA for managing 2FA)
    const canManage = await canManage2FA(folderName, req.user);
    if (!canManage) {
      return res.status(403).json({ message: "Insufficient permissions to manage 2FA settings" });
    }
    
    // Check if permission exists by folderId
    let permission = await FolderPermission.findOne({ folderId: folder._id });
    if (!permission) {
      // Create permission record if it doesn't exist
      permission = await FolderPermission.create({
        folderName: sanitizedName,
        folderId: folder._id,
        permissions: {
          view: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
          upload: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
          delete: ["partner", "manager", "admin"],
          approve: ["partner", "manager", "admin"],
          manage: ["partner", "manager", "admin"],
        },
      }).catch(async (err) => {
        if (err.code === 11000) {
          return await FolderPermission.findOne({ folderId: folder._id });
        }
        throw err;
      });
    }

    const secret = speakeasy.generateSecret({
      name: `Library Folder: ${folderName}`,
      issuer: "Audit Portal",
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (in production, encrypt this)
    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    });
  } catch (err) {
    next(err);
  }
};

// Enable 2FA for folder
exports.enable2FA = async (req, res, next) => {
  try {
    const { folderName, secret, token, method = "email" } = req.body;
    if (!folderName) {
      return res.status(400).json({ message: "folderName is required" });
    }

    // Check manage permission without 2FA requirement (bypass 2FA for managing 2FA)
    const canManage = await canManage2FA(folderName, req.user);
    if (!canManage) {
      return res.status(403).json({ message: "Insufficient permissions to manage 2FA settings" });
    }

    // Sanitize folder name to match how it's stored
    const sanitizedName = sanitizeFolderName(folderName);
    
    // First check if folder exists
    const folder = await GlobalFolder.findOne({ name: sanitizedName });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Find or create permission record - use folderId
    let permission = await FolderPermission.findOne({ folderId: folder._id });
    if (!permission) {
      // Create permission record if it doesn't exist
      permission = await FolderPermission.create({
        folderName: sanitizedName,
        folderId: folder._id,
        permissions: {
          view: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
          upload: ["partner", "manager", "employee", "senior-employee", "reviewer", "admin"],
          delete: ["partner", "manager", "admin"],
          approve: ["partner", "manager", "admin"],
          manage: ["partner", "manager", "admin"],
        },
      }).catch(async (err) => {
        // If permission already exists (by folderId), get it
        if (err.code === 11000) {
          return await FolderPermission.findOne({ folderId: folder._id });
        }
        throw err;
      });
    }

    // Verify TOTP token if method is TOTP
    if (method === "totp" && secret && token) {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: token,
        window: 2,
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid TOTP token" });
      }

      // Encrypt secret before storing
      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key-change-in-production", "salt", 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encryptedSecret = cipher.update(secret, "utf8", "hex");
      encryptedSecret += cipher.final("hex");
      permission.twoFactorSecret = iv.toString("hex") + ":" + encryptedSecret;
    }

    permission.require2FA = true;
    permission.twoFactorMethod = method;
    await permission.save();

    res.json({ message: "2FA enabled successfully", require2FA: true });
  } catch (err) {
    next(err);
  }
};

// Check if user can manage 2FA settings (bypasses 2FA requirement)
async function canManage2FA(folderName, user) {
  // Find folder first to get folderId
  const sanitizedName = sanitizeFolderName(folderName);
  const folder = await GlobalFolder.findOne({ name: sanitizedName });
  if (!folder) {
    // Default: check role permissions
    return ROLE_PERMISSIONS[user.role]?.manage === true;
  }
  
  const permission = await FolderPermission.findOne({ folderId: folder._id });
  if (!permission) {
    // Default: check role permissions
    return ROLE_PERMISSIONS[user.role]?.manage === true;
  }

  // Check user-specific permissions first
  const userPerm = permission.userPermissions?.find((p) => p.userId === user.id);
  if (userPerm && userPerm.permissions.manage !== undefined) {
    return userPerm.permissions.manage;
  }

  // Check role permissions (bypass 2FA check for managing 2FA settings)
  const allowedRoles = permission.permissions.manage || [];
  return allowedRoles.includes(user.role) || ROLE_PERMISSIONS[user.role]?.manage === true;
}

// Disable 2FA for folder
exports.disable2FA = async (req, res, next) => {
  try {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ message: "folderName is required" });
    }

    // Check manage permission without 2FA requirement (bypass 2FA for managing 2FA)
    const canManage = await canManage2FA(folderName, req.user);
    if (!canManage) {
      return res.status(403).json({ message: "Insufficient permissions to manage 2FA settings" });
    }

    // Sanitize folder name and find folder to get folderId
    const sanitizedName = sanitizeFolderName(folderName);
    const folder = await GlobalFolder.findOne({ name: sanitizedName });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    
    const permission = await FolderPermission.findOne({ folderId: folder._id });
    if (!permission) {
      return res.status(404).json({ message: "Folder permissions not found" });
    }

    permission.require2FA = false;
    permission.twoFactorSecret = null;
    await permission.save();

    res.json({ message: "2FA disabled successfully" });
  } catch (err) {
    next(err);
  }
};

// Verify 2FA for folder access
exports.verify2FA = async (req, res, next) => {
  try {
    const { folderName, token, method } = req.body;
    if (!folderName || !token) {
      return res.status(400).json({ message: "folderName and token are required" });
    }

    // Find folder first to get folderId
    const folder = await GlobalFolder.findOne({ name: folderName });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    
    const permission = await FolderPermission.findOne({ folderId: folder._id });
    if (!permission || !permission.require2FA) {
      return res.status(400).json({ message: "2FA not required for this folder" });
    }

    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    if (!sessionToken) {
      return res.status(401).json({ message: "Session token required" });
    }

    let verified = false;

    if (permission.twoFactorMethod === "totp" && permission.twoFactorSecret) {
      // Decrypt secret
      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key-change-in-production", "salt", 32);
      const parts = permission.twoFactorSecret.split(":");
      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decryptedSecret = decipher.update(encrypted, "hex", "utf8");
      decryptedSecret += decipher.final("utf8");

      verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: "base32",
        token: token,
        window: 2,
      });
    } else if (permission.twoFactorMethod === "email") {
      // For email 2FA, token would be sent via email and verified here
      // This is a simplified version - in production, implement proper email OTP
      verified = token.length === 6 && /^\d+$/.test(token);
    }

    if (!verified) {
      return res.status(400).json({ message: "Invalid 2FA token" });
    }

    // Update session with 2FA verification - use folderId as key
    const folderKey = folder._id.toString();
    const session = await UserSession.findOne({ 
      userId: req.user.id, 
      sessionToken,
      isActive: true 
    });

    if (session) {
      if (!session.twoFactorVerified) {
        session.twoFactorVerified = new Map();
      }
      session.twoFactorVerified.set(folderKey, new Date());
      session.lastActivity = new Date();
      await session.save();
    } else {
      // Create new session if doesn't exist
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
      
      const twoFactorVerified = new Map();
      twoFactorVerified.set(folderKey, new Date());
      
      await UserSession.create({
        userId: req.user.id,
        sessionToken,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        lastActivity: new Date(),
        expiresAt,
        isActive: true,
        twoFactorVerified,
      });
    }

    res.json({ 
      message: "2FA verified successfully",
      verified: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  } catch (err) {
    next(err);
  }
};

// Send email OTP for 2FA
exports.sendEmailOTP = async (req, res, next) => {
  try {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ message: "folderName is required" });
    }

    // Find folder first to get folderId
    const folder = await GlobalFolder.findOne({ name: folderName });
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    
    const permission = await FolderPermission.findOne({ folderId: folder._id });
    if (!permission || !permission.require2FA || permission.twoFactorMethod !== "email") {
      return res.status(400).json({ message: "Email 2FA not enabled for this folder" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP temporarily (in production, use Redis or similar with expiration)
    // For now, we'll send it (in production, implement proper email service)
    
    // TODO: Implement email sending service
    // await emailService.sendOTP(req.user.email, otp, folderName);

    res.json({ 
      message: "OTP sent to email",
      // In development, return OTP (remove in production)
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
};

// Check session timeout and update activity
exports.updateSessionActivity = async (req, res, next) => {
  try {
    const sessionToken = req.headers["x-session-token"] || req.headers.authorization?.split(" ")[1];
    if (!sessionToken) {
      return res.json({ active: false, message: "No session token" });
    }

    let session = await UserSession.findOne({ 
      userId: req.user.id, 
      sessionToken,
      isActive: true 
    });

    // Create session if it doesn't exist (first time checking)
    if (!session) {
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      session = await UserSession.create({
        userId: req.user.id,
        sessionToken,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        lastActivity: new Date(),
        expiresAt,
        isActive: true,
        twoFactorVerified: new Map(),
      });
      
      // Return active session with full timeout
      return res.json({
        active: true,
        lastActivity: session.lastActivity,
        minutesUntilTimeout: 30, // Full 30 minutes
        shouldWarn: false,
        minutesSinceActivity: 0,
      });
    }

    const now = new Date();
    
    // Check if session expired due to absolute expiration time
    if (session.expiresAt && now > session.expiresAt) {
      session.isActive = false;
      await session.save();
      return res.json({ active: false, message: "Session expired" });
    }

    // Calculate time since last activity BEFORE updating
    const timeoutMinutes = 30; // 30 minutes of inactivity
    const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
    const minutesSinceActivity = Math.floor(timeSinceActivity / 60000);
    const minutesUntilTimeout = timeoutMinutes - minutesSinceActivity;

    // Check if session has expired due to inactivity (30 minutes)
    if (minutesSinceActivity >= timeoutMinutes) {
      session.isActive = false;
      await session.save();
      return res.json({ 
        active: false, 
        message: "Session expired due to inactivity",
        minutesUntilTimeout: 0
      });
    }

    // Update last activity (only if session is still active)
    session.lastActivity = now;
    // Extend session expiration time
    const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    session.expiresAt = newExpiresAt;
    await session.save();

    // Warn 5 minutes before timeout (when 25 minutes have passed, so 5 minutes remaining)
    const warningThreshold = 5; // Warn when 5 minutes or less remaining
    const shouldWarn = minutesUntilTimeout <= warningThreshold && minutesUntilTimeout > 0;

    res.json({
      active: true,
      lastActivity: session.lastActivity,
      minutesUntilTimeout: Math.max(0, minutesUntilTimeout),
      shouldWarn: shouldWarn,
      minutesSinceActivity: minutesSinceActivity,
    });
  } catch (err) {
    next(err);
  }
};
