const router = require("express").Router();
const controller = require("../controllers/wordPluginController");
const { requireAuth, requireRole } = require("../middlewares/auth");

router.use(requireAuth, requireRole(["employee"]));

router.get('/clients', controller.getClients);
router.get('/employees', controller.getEmployees);

/* GROUP ROUTES */
router.post("/group", controller.createGroup);
router.put("/group/:groupId", controller.updateGroup);
router.delete("/group/:groupId", controller.deleteGroup);
router.get("/group", controller.getGroups);
router.get("/group/user/:userId", controller.getGroupsByUser);
router.put("/group/bulk", controller.bulkUpdateGroups);
router.delete("/group/bulk", controller.bulkDeleteGroups);

/* GROUP CONTENT ROUTES */
router.post(
  "/group/:groupId/group-content",
  controller.createGroupContent
);
router.get("/group/:groupId/group-content", controller.getGroupContents);
router.put(
  "/group/:groupId/group-content/:contentId",
  controller.updateGroupContent
);
router.delete(
  "/group/:groupId/group-content/:contentId",
  controller.deleteGroupContent
);
router.put(
  "/group/:groupId/group-content/bulk",
  controller.bulkUpdateGroupContents
);
router.delete(
  "/group/:groupId/group-content/bulk",
  controller.bulkDeleteGroupContents
);

/* DRAFT ROUTES */
router.get("/drafts", controller.getDraftsByEngagement);
router.get("/drafts/:draftId", controller.getDraftByDraftId);
router.delete("/drafts/:draftId", controller.deleteDraftByDraftId);

/* TEMPLATE ROUTES */
router.get("/draft/:draftId/template", controller.getTemplateByDraftId);
router.get(
  "/draft/:draftId/template/download",
  controller.downloadTemplateByDraftId
);
router.post("/draft/:draftId/template", controller.uploadTemplateForDraft);
router.get("/draft/templates", controller.getAllTemplates);

/* VARIABLE ROUTES */
router
  .route("/variable/custom")
  .post(controller.createCustomVariable)
  .get(controller.getCustomVariables)
  .put(controller.updateCustomVariable);
router.delete("/variable/:id", controller.deleteVariable);

router.get("/engagements", controller.getEngagements);




module.exports = router;

