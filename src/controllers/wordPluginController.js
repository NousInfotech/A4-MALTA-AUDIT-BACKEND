const WordPluginGroup = require("../models/WordPluginGroup");
const WordPluginGroupContent = require("../models/WordPluginGroupContent");
const WordPluginDraft = require("../models/WordPluginDraft");
const WordPluginDraftTemplate = require("../models/WordPluginDraftTemplate");
const WordPluginVariable = require("../models/WordPluginVariable");
const Engagement = require("../models/Engagement");
const { supabase } = require("../config/supabase");

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// get clients

exports.getClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const from = (pageNumber - 1) * limitNumber;
    const to = from + limitNumber - 1;

    // Fetch profiles
    const { data: clients, error } = await supabase
      .from("profiles")
      .select("user_id, name", { count: "exact" })
      .eq("organization_id", req.user.organizationId)
      .eq("role", "client")
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(from, to);

    if (error) throw error;

    // Fetch all auth users (emails)
    const { data: auth } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(auth.users.map(u => [u.id, u.email]));

    const final = clients.map(c => ({
      ...c,
      email: emailMap.get(c.user_id) ?? null,
    }));

    return res.status(200).json({
      success: true,
      data: final,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: clients.length
      }
    });

  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const from = (pageNumber - 1) * limitNumber;
    const to = from + limitNumber - 1;

    // Fetch profiles
    const { data: employees, error } = await supabase
      .from("profiles")
      .select("user_id, name", { count: "exact" })
      .eq("organization_id", req.user.organizationId)
      .eq("role", "employee")
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(from, to);

    if (error) throw error;

    // Fetch auth emails
    const { data: auth } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(auth.users.map(u => [u.id, u.email]));

    const final = employees.map(e => ({
      ...e,
      email: emailMap.get(e.user_id) ?? null,
    }));

    return res.status(200).json({
      success: true,
      data: final,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: employees.length
      }
    });

  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


/* GROUP HANDLERS */
exports.createGroup = async (req, res) => {
  try {
    const payload = {
      groupName: req.body.groupName,
      updatedBy: req.body.updatedBy || req.user.id,
      description: req.body.description,
    };

    const group = await WordPluginGroup.create(payload);

    return res.status(201).json({ success: true, data: group });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const updated = await WordPluginGroup.findByIdAndUpdate(
      req.params.groupId,
      { ...req.body, updatedBy: req.body.updatedBy || req.user.id },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const deleted = await WordPluginGroup.findByIdAndDelete(req.params.groupId);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    await WordPluginGroupContent.deleteMany({ groupId: req.params.groupId });

    return res.status(200).json({ success: true, message: "Group removed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const filters = {};

    if (req.query.userId) {
      filters.updatedBy = req.query.userId;
    }

    if (req.query.search) {
      filters.groupName = new RegExp(req.query.search, "i");
    }

    const groups = await WordPluginGroup.find(filters).sort("-updatedAt");

    return res
      .status(200)
      .json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getGroupsByUser = async (req, res) => {
  try {
    const groups = await WordPluginGroup.find({
      updatedBy: req.params.userId,
    }).sort("-updatedAt");

    return res
      .status(200)
      .json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkUpdateGroups = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Payload must be a non-empty array" });
    }

    const updates = await Promise.all(
      req.body.map(({ _id, ...rest }) =>
        WordPluginGroup.findByIdAndUpdate(
          _id,
          { ...rest, updatedBy: rest.updatedBy || req.user.id },
          { new: true }
        )
      )
    );

    return res.status(200).json({ success: true, data: updates });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkDeleteGroups = async (req, res) => {
  try {
    const ids = req.body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids array is required" });
    }

    await WordPluginGroupContent.deleteMany({ groupId: { $in: ids } });
    const result = await WordPluginGroup.deleteMany({ _id: { $in: ids } });

    return res
      .status(200)
      .json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/* GROUP CONTENT HANDLERS */
exports.createGroupContent = async (req, res) => {
  try {
    const payload = {
      groupId: req.params.groupId,
      contentText: req.body.contentText,
      createdBy: req.body.createdBy || req.user.id,
      metadata: req.body.metadata,
    };

    const content = await WordPluginGroupContent.create(payload);

    return res.status(201).json({ success: true, data: content });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getGroupContents = async (req, res) => {
  try {
    const contents = await WordPluginGroupContent.find({
      groupId: req.params.groupId,
    }).sort("createdAt");

    return res
      .status(200)
      .json({ success: true, count: contents.length, data: contents });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateGroupContent = async (req, res) => {
  try {
    const updated = await WordPluginGroupContent.findOneAndUpdate(
      { _id: req.params.contentId, groupId: req.params.groupId },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Group content not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteGroupContent = async (req, res) => {
  try {
    const deleted = await WordPluginGroupContent.findOneAndDelete({
      _id: req.params.contentId,
      groupId: req.params.groupId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Group content not found" });
    }

    return res.status(200).json({ success: true, message: "Content removed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkUpdateGroupContents = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Payload must be a non-empty array" });
    }

    const updates = await Promise.all(
      req.body.map(({ _id, ...rest }) =>
        WordPluginGroupContent.findOneAndUpdate(
          { _id, groupId: req.params.groupId },
          rest,
          { new: true }
        )
      )
    );

    return res.status(200).json({ success: true, data: updates });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkDeleteGroupContents = async (req, res) => {
  try {
    const ids = req.body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids array is required" });
    }

    const result = await WordPluginGroupContent.deleteMany({
      _id: { $in: ids },
      groupId: req.params.groupId,
    });

    return res
      .status(200)
      .json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/* DRAFT HANDLERS */
exports.getDraftsByEngagement = async (req, res) => {
  try {
    const engagementId = parseNumber(req.query.engagementId);

    if (engagementId === null) {
      return res
        .status(400)
        .json({ success: false, message: "engagementId query is required" });
    }

    const drafts = await WordPluginDraft.find({ engagementId }).sort(
      "-createdAt"
    );

    return res
      .status(200)
      .json({ success: true, count: drafts.length, data: drafts });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDraftByDraftId = async (req, res) => {
  try {
    const draftId = parseNumber(req.params.draftId);

    if (draftId === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid draftId" });
    }

    const draft = await WordPluginDraft.findOne({ draftId });

    if (!draft) {
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });
    }

    return res.status(200).json({ success: true, data: draft });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDraftByDraftId = async (req, res) => {
  try {
    const draftId = parseNumber(req.params.draftId);

    if (draftId === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid draftId" });
    }

    const deleted = await WordPluginDraft.findOneAndDelete({ draftId });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });
    }

    return res.status(200).json({ success: true, message: "Draft removed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/* TEMPLATE HELPERS */
const fetchTemplateForDraft = async (draftId) => {
  const draft = await WordPluginDraft.findOne({ draftId });

  if (!draft || !draft.templateId) {
    return { draft, template: null };
  }

  const template = await WordPluginDraftTemplate.findOne({
    templateId: draft.templateId,
  });

  return { draft, template };
};

/* TEMPLATE HANDLERS */
exports.getTemplateByDraftId = async (req, res) => {
  try {
    const draftId = parseNumber(req.params.draftId);

    if (draftId === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid draftId" });
    }

    const { draft, template } = await fetchTemplateForDraft(draftId);

    if (!draft) {
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });
    }

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not assigned to draft" });
    }

    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.downloadTemplateByDraftId = async (req, res) => {
  try {
    const draftId = parseNumber(req.params.draftId);

    if (draftId === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid draftId" });
    }

    const { draft, template } = await fetchTemplateForDraft(draftId);

    if (!draft) {
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });
    }

    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Template not assigned to draft" });
    }

    return res.status(200).json({
      success: true,
      data: {
        templateId: template.templateId,
        templateName: template.templateName,
        file: template.file,
        fileUrl: template.fileUrl,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.uploadTemplateForDraft = async (req, res) => {
  try {
    const draftId = parseNumber(req.params.draftId);

    if (draftId === null) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid draftId" });
    }

    const draft = await WordPluginDraft.findOne({ draftId });

    if (!draft) {
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });
    }

    const templatePayload = {
      templateId: req.body.templateId,
      templateName: req.body.templateName,
      file: req.body.file,
      fileUrl: req.body.fileUrl,
      userId: req.body.userId || req.user.id,
    };

    if (
      !templatePayload.templateId ||
      !templatePayload.templateName ||
      !templatePayload.file
    ) {
      return res.status(400).json({
        success: false,
        message: "templateId, templateName and file are required",
      });
    }

    const template = await WordPluginDraftTemplate.findOneAndUpdate(
      { templateId: templatePayload.templateId },
      templatePayload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    draft.templateId = template.templateId;
    await draft.save();

    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllTemplates = async (req, res) => {
  try {
    const filters = {};

    if (req.query.userId) {
      filters.userId = req.query.userId;
    }

    const templates = await WordPluginDraftTemplate.find(filters).sort(
      "-updatedAt"
    );

    return res
      .status(200)
      .json({ success: true, count: templates.length, data: templates });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/* VARIABLE HANDLERS */
exports.createCustomVariable = async (req, res) => {
  try {
    const payload = {
      variableName: req.body.variableName,
      variableValue: req.body.variableValue,
      userId: req.body.userId || req.user.id,
    };

    const variable = await WordPluginVariable.create(payload);

    return res.status(201).json({ success: true, data: variable });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCustomVariables = async (req, res) => {
  try {
    const filter = {};

    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    const variables = await WordPluginVariable.find(filter).sort(
      "variableName"
    );

    return res
      .status(200)
      .json({ success: true, count: variables.length, data: variables });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCustomVariable = async (req, res) => {
  try {
    const { _id, ...updates } = req.body;

    if (!_id) {
      return res
        .status(400)
        .json({ success: false, message: "_id is required" });
    }

    const updated = await WordPluginVariable.findByIdAndUpdate(_id, updates, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Variable not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteVariable = async (req, res) => {
  try {
    const deleted = await WordPluginVariable.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Variable not found" });
    }

    return res.status(200).json({ success: true, message: "Variable removed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getEngagements = async (req, res) => {
  const { page, limit, clientId } = req.query;
  const skip = (page - 1) * limit;

  const engagements = await Engagement.find({
    organization: req.user.organizationId,
    clientId: clientId ? new ObjectId(clientId) : undefined,
  })
    .skip(skip)
    .limit(limit)
    .sort("-createdAt");

  return res
    .status(200)
    .json({ success: true, data: engagements, total, page, limit });
};
