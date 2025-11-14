const router = require("express").Router()
const { requireAuth, requireRole } = require("../middlewares/auth")
const upload = require("../middlewares/upload")
const glc = require("../controllers/libcontroller")

// Allow all authenticated users with valid roles (using existing Supabase roles)
router.use(requireAuth, requireRole(["employee", "partner", "manager", "senior-employee", "reviewer", "admin", "client"]))

router.get("/folders", glc.listFolders)
router.post("/folders", glc.createFolder)
router.patch("/folders/:id", glc.renameFolder)
router.delete("/folders/:id", glc.deleteFolder)

router.get("/files", glc.listFiles)
router.post("/files/upload", upload.single("file"), glc.upload)
router.post("/files/move", glc.moveFile)
router.delete("/files", glc.deleteFile)

// New endpoints
router.get("/files/versions", glc.getFileVersions)
router.post("/files/restore-version", glc.restoreVersion)
router.get("/files/download", glc.downloadFile)
router.get("/files/preview", glc.previewFile)
router.post("/files/bulk-download", glc.bulkDownload)
router.get("/files/activity", glc.getFileActivity)
router.patch("/files/metadata", glc.updateFileMetadata)

// 2FA endpoints
router.post("/2fa/generate-secret", glc.generate2FASecret)
router.post("/2fa/enable", glc.enable2FA)
router.post("/2fa/disable", glc.disable2FA)
router.post("/2fa/verify", glc.verify2FA)
router.post("/2fa/send-email-otp", glc.sendEmailOTP)

// Session management
router.post("/session/activity", glc.updateSessionActivity)

module.exports = router
