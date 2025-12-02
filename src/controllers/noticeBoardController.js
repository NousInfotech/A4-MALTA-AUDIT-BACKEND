const NoticeBoard = require("../models/NoticeBoard");

/**
 * Create a new notice
 * POST /api/notices
 */
exports.createNotice = async (req, res) => {
  try {
    const { title, description, roles, type, priority, expiresAt } = req.body;
    const organizationId = req.user.organizationId;
    const createdByUserId = req.user.id;
    
    // Determine createdBy based on user role
    const createdBy = req.user.role === "super-admin" ? "super-admin" : "admin";

    const notice = new NoticeBoard({
      title,
      description,
      roles,
      type,
      organizationId,
      createdBy,
      createdByUserId,
      priority: priority || 0,
      expiresAt: expiresAt || null,
    });

    await notice.save();

    res.status(201).json({
      success: true,
      message: "Notice created successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error creating notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notice",
      error: error.message,
    });
  }
};

/**
 * Get all notices with filtering, sorting, pagination, and search
 * GET /api/notices
 */
exports.getAllNotices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      search = "",
      type,
      roles,
      isActive,
      createdBy,
      priority,
      fieldName, // For custom field filtering
    } = req.query;

    // Build filter query
    const filter = { organizationId };

    // Type filter
    if (type) {
      filter.type = type;
    }

    // Roles filter (if user wants to see notices for specific roles)
    if (roles) {
      const roleArray = Array.isArray(roles) ? roles : [roles];
      filter.roles = { $in: roleArray };
    }

    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    // Created by filter
    if (createdBy) {
      filter.createdBy = createdBy;
    }

    // Priority filter
    if (priority !== undefined) {
      filter.priority = parseInt(priority);
    }

    // Custom field filtering
    if (fieldName) {
      try {
        const fieldFilters = JSON.parse(fieldName);
        Object.keys(fieldFilters).forEach((key) => {
          filter[key] = fieldFilters[key];
        });
      } catch (e) {
        // If not valid JSON, ignore
      }
    }

    // Search filter (title and description)
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    const sortOrder = order === "asc" ? 1 : -1;
    const sortQuery = { [sort]: sortOrder };

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const notices = await NoticeBoard.find(filter)
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const total = await NoticeBoard.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: notices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching notices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notices",
      error: error.message,
    });
  }
};

/**
 * Get active notices for current user based on their role
 * GET /api/notices/active
 */
exports.getActiveNotices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userRole = req.user.role;

    const notices = await NoticeBoard.getActiveNotices(organizationId, userRole);

    res.status(200).json({
      success: true,
      data: notices,
      count: notices.length,
    });
  } catch (error) {
    console.error("Error fetching active notices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active notices",
      error: error.message,
    });
  }
};

/**
 * Get single notice by ID
 * GET /api/notices/:id
 */
exports.getNoticeById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const notice = await NoticeBoard.findOne({
      _id: id,
      organizationId,
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notice,
    });
  } catch (error) {
    console.error("Error fetching notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notice",
      error: error.message,
    });
  }
};

/**
 * Update notice
 * PUT /api/notices/:id
 */
exports.updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const updates = req.body;

    // Find notice and verify organization
    const notice = await NoticeBoard.findOne({
      _id: id,
      organizationId,
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      "title",
      "description",
      "roles",
      "type",
      "priority",
      "isActive",
      "expiresAt",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        notice[field] = updates[field];
      }
    });

    await notice.save();

    res.status(200).json({
      success: true,
      message: "Notice updated successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error updating notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notice",
      error: error.message,
    });
  }
};

/**
 * Delete notice
 * DELETE /api/notices/:id
 */
exports.deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const notice = await NoticeBoard.findOneAndDelete({
      _id: id,
      organizationId,
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error deleting notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notice",
      error: error.message,
    });
  }
};

/**
 * Soft delete - mark as inactive
 * PATCH /api/notices/:id/deactivate
 */
exports.deactivateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const notice = await NoticeBoard.findOneAndUpdate(
      { _id: id, organizationId },
      { isActive: false },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notice deactivated successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error deactivating notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate notice",
      error: error.message,
    });
  }
};

/**
 * Mark notice as viewed by current user
 * POST /api/notices/:id/view
 */
exports.markAsViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const notice = await NoticeBoard.findOne({
      _id: id,
      organizationId,
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    await notice.markAsViewed(userId);

    res.status(200).json({
      success: true,
      message: "Notice marked as viewed",
      data: notice,
    });
  } catch (error) {
    console.error("Error marking notice as viewed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notice as viewed",
      error: error.message,
    });
  }
};

/**
 * Mark notice as acknowledged by current user
 * POST /api/notices/:id/acknowledge
 */
exports.markAsAcknowledged = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const notice = await NoticeBoard.findOne({
      _id: id,
      organizationId,
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    await notice.markAsAcknowledged(userId);

    res.status(200).json({
      success: true,
      message: "Notice acknowledged successfully",
      data: notice,
    });
  } catch (error) {
    console.error("Error acknowledging notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge notice",
      error: error.message,
    });
  }
};

/**
 * Get notices by type
 * GET /api/notices/type/:type
 */
exports.getNoticesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const organizationId = req.user.organizationId;

    const notices = await NoticeBoard.getByType(organizationId, type);

    res.status(200).json({
      success: true,
      data: notices,
      count: notices.length,
    });
  } catch (error) {
    console.error("Error fetching notices by type:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notices by type",
      error: error.message,
    });
  }
};

/**
 * Get notice statistics
 * GET /api/notices/stats
 */
exports.getNoticeStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const stats = await NoticeBoard.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
        },
      },
    ]);

    const total = await NoticeBoard.countDocuments({ organizationId });
    const active = await NoticeBoard.countDocuments({
      organizationId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        active,
        byType: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching notice stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notice statistics",
      error: error.message,
    });
  }
};

/**
 * Bulk delete notices
 * POST /api/notices/bulk-delete
 */
exports.bulkDeleteNotices = async (req, res) => {
  try {
    const { ids } = req.body;
    const organizationId = req.user.organizationId;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of notice IDs",
      });
    }

    const result = await NoticeBoard.deleteMany({
      _id: { $in: ids },
      organizationId,
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} notices deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting notices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notices",
      error: error.message,
    });
  }
};

