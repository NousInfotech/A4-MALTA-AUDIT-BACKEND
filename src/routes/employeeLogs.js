const router = require('express').Router();
const employeeLogController = require('../controllers/employeeLogController');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * Employee Log Routes
 */

// Create a new employee log entry
router.post(
  '/',
  requireAuth,
  requireRole('employee'), // Only employees can create log entries
  employeeLogController.createLog
);

// Get all employee logs with filtering and pagination
router.get(
  '/',
  requireAuth,
  requireRole('employee'), // Only employees can view all logs
  employeeLogController.getAllLogs
);

// Get logs for a specific employee
router.get(
  '/employee/:employeeId',
  requireAuth,
  employeeLogController.getLogsByEmployee
);

// Get log statistics
router.get(
  '/statistics',
  requireAuth,
  requireRole('employee'), // Only employees can view statistics
  employeeLogController.getLogStatistics
);

// Get log by ID
router.get(
  '/:id',
  requireAuth,
  employeeLogController.getLogById
);

// Update log entry
router.patch(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only employees can update logs
  employeeLogController.updateLog
);

// Delete log entry
router.delete(
  '/:id',
  requireAuth,
  requireRole('employee'), // Only employees can delete logs
  employeeLogController.deleteLog
);

// Bulk delete logs
router.delete(
  '/bulk',
  requireAuth,
  requireRole('employee'), // Only employees can bulk delete logs
  employeeLogController.bulkDeleteLogs
);

// Export logs to CSV/JSON
router.get(
  '/export/data',
  requireAuth,
  requireRole('employee'), // Only employees can export logs
  employeeLogController.exportLogs
);

// Get available actions
router.get(
  '/actions/available',
  requireAuth,
  employeeLogController.getAvailableActions
);

module.exports = router;
