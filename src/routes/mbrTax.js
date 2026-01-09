const router = require("express").Router();
const mbrController = require("../controllers/mbrController");
const taxController = require("../controllers/taxController");
const { requireAuth, requireRole } = require("../middlewares/auth");
const multer = require("multer");
const multer_upload = multer({ storage: multer.memoryStorage() });

// MBR Routes
router.get("/mbr/engagement/:engagementId", requireAuth, mbrController.getMBRByEngagement);
router.get("/mbr/:id", requireAuth, mbrController.getMBRById);
router.post("/mbr/:id/status", requireAuth, requireRole("employee"), mbrController.updateStatus);
router.post("/mbr/:id/upload", requireAuth, requireRole("employee"), multer_upload.single("file"), mbrController.uploadDocument);

// Tax Routes
router.get("/tax/engagement/:engagementId", requireAuth, taxController.getTaxByEngagement);
router.get("/tax/:id", requireAuth, taxController.getTaxById);
router.post("/tax/:id/status", requireAuth, requireRole("employee"), taxController.updateStatus);
router.post("/tax/:id/upload", requireAuth, requireRole("employee"), multer_upload.single("file"), taxController.uploadDocument);
router.post("/tax/:id/upload-draft", requireAuth, requireRole("employee"), multer_upload.single("file"), taxController.uploadDraftDocument);

// Combined status update route (as per requirements: POST /api/:type/:id/status)
router.post("/:type/:id/status", requireAuth, requireRole("employee"), async (req, res, next) => {
  const { type, id } = req.params;
  
  if (type === "mbr") {
    return mbrController.updateStatus(req, res, next);
  } else if (type === "tax") {
    return taxController.updateStatus(req, res, next);
  } else {
    return res.status(400).json({
      message: "Invalid type. Must be 'mbr' or 'tax'"
    });
  }
});

module.exports = router;

