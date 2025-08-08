// routes/global-library.js
const router = require("express").Router()
const { requireAuth, requireRole } = require("../middlewares/auth")
const upload = require("../middlewares/upload")
const glc = require("../controllers/libcontroller")

// All routes require an authenticated employee
router.use(requireAuth, requireRole("employee"))

// Folders
router.get("/folders", glc.listFolders)
router.post("/folders", glc.createFolder)
router.patch("/folders/:id", glc.renameFolder)
router.delete("/folders/:id", glc.deleteFolder)

// Files
router.get("/files", glc.listFiles)
router.post("/files/upload", upload.single("file"), glc.upload)
router.post("/files/move", glc.moveFile)
router.delete("/files", glc.deleteFile)

module.exports = router
