const { Log, Action } = require('../models/EmployeeLog');
const { supabase } = require('../config/supabase');

/**
 * Employee Log Controllers
 */

// Create a new employee log entry
exports.createLog = async (req, res, next) => {
  try {
    const { 
      employeeId, 
      employeeName, 
      employeeEmail, 
      action, 
      details, 
      ipAddress, 
      location, 
      deviceInfo, 
      status = 'SUCCESS' 
    } = req.body;

    // Validate action
    if (!Object.values(Action).includes(action)) {
      return res.status(400).json({ 
        message: 'Invalid action. Must be one of: ' + Object.values(Action).join(', ') 
      });
    }

    // Validate status
    if (!['SUCCESS', 'FAIL'].includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be SUCCESS or FAIL' 
      });
    }

    const logEntry = await Log.create({
      employeeId,
      employeeName,
      employeeEmail,
      action,
      details,
      ipAddress,
      location,
      deviceInfo,
      status,
      timestamp: new Date()
    });

    res.status(201).json(logEntry);
  } catch (err) {
    next(err);
  }
};

// Get all employee logs with filtering and pagination
exports.getAllLogs = async (req, res, next) => {
  try {
    const { 
      employeeId, 
      action, 
      status, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    let filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (action) filter.action = action;
    if (status) filter.status = status;
    
    // Date range filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const logs = await Log.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Log.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + logs.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get logs for a specific employee
exports.getLogsByEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { 
      action, 
      status, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;

    // Build filter object
    let filter = { employeeId };
    if (action) filter.action = action;
    if (status) filter.status = status;
    
    // Date range filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Log.countDocuments(filter);

    res.json({
      employeeId,
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + logs.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get log statistics
exports.getLogStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    // Build filter object
    let filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Get statistics
    const [
      totalLogs,
      successLogs,
      failedLogs,
      actionStats,
      employeeStats,
      recentLogs
    ] = await Promise.all([
      Log.countDocuments(filter),
      Log.countDocuments({ ...filter, status: 'SUCCESS' }),
      Log.countDocuments({ ...filter, status: 'FAIL' }),
      Log.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Log.aggregate([
        { $match: filter },
        { $group: { _id: '$employeeId', employeeName: { $first: '$employeeName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Log.find(filter)
        .sort({ timestamp: -1 })
        .limit(10)
        .select('employeeName action status timestamp details')
    ]);

    res.json({
      summary: {
        totalLogs,
        successLogs,
        failedLogs,
        successRate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(2) : 0
      },
      actionBreakdown: actionStats,
      topEmployees: employeeStats,
      recentActivity: recentLogs
    });
  } catch (err) {
    next(err);
  }
};

// Get log by ID
exports.getLogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const log = await Log.findById(id);
    if (!log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    res.json(log);
  } catch (err) {
    next(err);
  }
};

// Update log entry
exports.updateLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.employeeId;
    delete updates.timestamp;
    delete updates._id;

    // Validate action if provided
    if (updates.action && !Object.values(Action).includes(updates.action)) {
      return res.status(400).json({ 
        message: 'Invalid action. Must be one of: ' + Object.values(Action).join(', ') 
      });
    }

    // Validate status if provided
    if (updates.status && !['SUCCESS', 'FAIL'].includes(updates.status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be SUCCESS or FAIL' 
      });
    }

    const log = await Log.findByIdAndUpdate(id, updates, { new: true });
    if (!log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    res.json(log);
  } catch (err) {
    next(err);
  }
};

// Delete log entry
exports.deleteLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const log = await Log.findByIdAndDelete(id);
    if (!log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    res.json({ message: 'Log entry deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Bulk delete logs
exports.bulkDeleteLogs = async (req, res, next) => {
  try {
    const { logIds, employeeId, action, status, startDate, endDate } = req.body;

    let filter = {};
    
    if (logIds && Array.isArray(logIds)) {
      filter._id = { $in: logIds };
    } else {
      // Build filter for bulk deletion
      if (employeeId) filter.employeeId = employeeId;
      if (action) filter.action = action;
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }
    }

    const result = await Log.deleteMany(filter);
    
    res.json({ 
      message: `${result.deletedCount} log entries deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    next(err);
  }
};

// Export logs to CSV
exports.exportLogs = async (req, res, next) => {
  try {
    const { 
      employeeId, 
      action, 
      status, 
      startDate, 
      endDate,
      format = 'csv'
    } = req.query;

    // Build filter object
    let filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await Log.find(filter).sort({ timestamp: -1 });

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Employee ID,Employee Name,Employee Email,Action,Details,IP Address,Location,Device Info,Status,Timestamp\n';
      const csvRows = logs.map(log => 
        `"${log.employeeId}","${log.employeeName}","${log.employeeEmail}","${log.action}","${log.details || ''}","${log.ipAddress || ''}","${log.location || ''}","${log.deviceInfo || ''}","${log.status}","${log.timestamp.toISOString()}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=employee_logs.csv');
      res.send(csvContent);
    } else {
      // Return JSON
      res.json(logs);
    }
  } catch (err) {
    next(err);
  }
};

// Helper function to log employee activity (for use in other controllers)
exports.logEmployeeActivity = async (employeeId, action, details = '', req = null) => {
  try {
    // Get employee info from Supabase if not provided
    let employeeName = '';
    let employeeEmail = '';
    
    if (req && req.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', employeeId)
        .single();
      
      employeeName = profile?.full_name || 'Unknown';
      employeeEmail = profile?.email || 'Unknown';
    }

    // Extract request info
    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'Unknown';
    const userAgent = req?.get('User-Agent') || 'Unknown';
    const location = req?.get('X-Forwarded-For') || ipAddress;

    await Log.create({
      employeeId,
      employeeName,
      employeeEmail,
      action,
      details,
      ipAddress,
      location,
      deviceInfo: userAgent,
      status: 'SUCCESS',
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log employee activity:', err);
    // Don't throw error to avoid breaking the main operation
  }
};

// Get available actions
exports.getAvailableActions = async (req, res, next) => {
  try {
    res.json({
      actions: Object.values(Action),
      actionDescriptions: {
        LOGIN: 'Employee logged into the system',
        LOGOUT: 'Employee logged out of the system',
        UPLOAD_DOCUMENT: 'Employee uploaded a document',
        VIEW_CLIENT_FILE: 'Employee viewed a client file',
        UPDATE_PROFILE: 'Employee updated their profile',
        DELETE_DOCUMENT: 'Employee deleted a document',
        VIEW_DASHBOARD: 'Employee viewed the dashboard',
        CREATE_ENGAGEMENT: 'Employee created a new engagement',
        UPDATE_ENGAGEMENT: 'Employee updated an engagement',
        CREATE_CLIENT: 'Employee created a new client',
        UPDATE_CLIENT: 'Employee updated a client',
        VIEW_ENGAGEMENT: 'Employee viewed an engagement',
        START_ENGAGEMENT: 'Employee started an engagement',
        KYC_SETUP: 'Employee initiated KYC setup',
        KYC_COMPLETE: 'Employee completed KYC setup',
        E_SIGNATURE: 'Employee performed e-signature action'
      }
    });
  } catch (err) {
    next(err);
  }
};
