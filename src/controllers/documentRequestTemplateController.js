const DocumentRequestTemplate = require("../models/DocumentRequestTemplate");
const { supabase } = require("../config/supabase");
// Single CRUD

// CREATE SINGLE
exports.createSingle = async (req, res) => {
  const { category } = req.query;

  try {
    const payload = {
      ...req.body,
      category: category,
      uploadedBy: req.user.id,
      organizationId: req.user.organizationId,
    };

    const newTemplate = await DocumentRequestTemplate.create(payload);

    return res.status(201).json({
      success: true,
      data: newTemplate,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// READ SINGLE
exports.getSingle = async (req, res) => {
  try {
    const id = req.params.id || req.body._id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Document id is required",
      });
    }

    const template = await DocumentRequestTemplate.findById(id);

    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: "Document not found",
    });
  }
};

// UPDATE SINGLE
exports.updateSingle = async (req, res) => {
  try {
    const id = req.params.id || req.body._id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Document id is required",
      });
    }

    const { category: categoryFromQuery } = req.query;
    const { _id: _ignored, category: categoryFromBody, ...rest } = req.body;

    // Prefer explicit category from query, then from body; otherwise keep existing value
    const updatePayload = {
      ...rest,
    };

    if (categoryFromQuery) {
      updatePayload.category = categoryFromQuery;
    } else if (categoryFromBody) {
      updatePayload.category = categoryFromBody;
    }

    const updated = await DocumentRequestTemplate.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true }
    );

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE SINGLE (soft delete)
exports.deleteSingle = async (req, res) => {
  try {
    const id = req.params.id || req.body._id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Document id is required",
      });
    }

    const deleted = await DocumentRequestTemplate.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document deleted",
      data: deleted,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk CRUD

// GET ALL (bulk read)
exports.getAllBulk = async (req, res) => {
  try {
    const filters = {
      organizationId: req.user.organizationId,
    };

    if (req.query.category) {
      filters.category = req.query.category;
    }

    const templates = await DocumentRequestTemplate.find(filters);

    return res.status(200).json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// BULK CREATE
exports.bulkCreate = async (req, res) => {
  const { category} = req.query;
  try {
    const payload = req.body.map((item) => ({
      ...item,
      category: category,
      organizationId: req.user.organizationId,
    }));

    const created = await DocumentRequestTemplate.insertMany(payload);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// BULK UPDATE
exports.bulkUpdate = async (req, res) => {
  try {
    const updates = req.body;
    const { category: categoryFromQuery } = req.query;

    const results = await Promise.all(
      updates.map((item) => {
        const { _id, category: categoryFromItem, ...rest } = item;

        if (!_id) return null;

        const updatePayload = {
          ...rest,
        };

        // Same precedence: query > item payload > existing
        if (categoryFromQuery) {
          updatePayload.category = categoryFromQuery;
        } else if (categoryFromItem) {
          updatePayload.category = categoryFromItem;
        }

        return DocumentRequestTemplate.findByIdAndUpdate(
          _id,
          updatePayload,
          { new: true }
        );
      })
    );

    return res.status(200).json({
      success: true,
      data: results.filter(Boolean),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// BULK DELETE (soft delete)
exports.bulkDelete = async (req, res) => {
  try {
    const ids = req.body; // array of _id

    const deleted = await DocumentRequestTemplate.deleteMany({
      _id: { $in: ids },
    });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Documents not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bulk documents deleted",
      modified: deleted.length,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// DOWNLOAD TEMPLATE

exports.uploadTemplate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const bucket = "global-documents";
    const category = req.query.category;
    const originalFilename = req.file.originalname;
    const ext = originalFilename.split(".").pop();
    const uniqueFilename = `template_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}.${ext}`;

    // Store templates in a templates folder
    const path = `document-request-templates/${category}/${uniqueFilename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res
        .status(500)
        .json({ message: "Failed to upload template file" });
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    res.json({
      success: true,
      url: urlData.publicUrl,
      filename: uniqueFilename,
      originalName: originalFilename,
    });
  } catch (error) {
    console.error("Template upload error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Upload multiple template files
exports.uploadMultipleTemplates = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const bucket = "global-documents";
    const category = req.query.category;
    const uploadResults = [];

    // Upload each file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const originalFilename = file.originalname;
      const ext = originalFilename.split(".").pop();
      const uniqueFilename = `template_${Date.now()}_${i}_${Math.random()
        .toString(36)
        .substr(2, 5)}.${ext}`;

      // Store templates in a templates folder
      const path = `document-request-templates/${category}/${uniqueFilename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file.buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimetype,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return res
          .status(500)
          .json({ message: `Failed to upload file: ${originalFilename}` });
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);

      uploadResults.push({
        url: urlData.publicUrl,
        filename: uniqueFilename,
        originalName: originalFilename,
        index: i,
      });
    }

    res.json({
      success: true,
      files: uploadResults,
    });
  } catch (error) {
    console.error("Multiple template upload error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};