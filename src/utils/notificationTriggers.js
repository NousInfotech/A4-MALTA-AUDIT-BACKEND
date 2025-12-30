/**
 * Notification Trigger Helpers
 * 
 * This file contains helper functions to trigger notifications for various events
 * Use these functions throughout your application to send notifications consistently
 */

const NotificationService = require('../services/notification.service');

/**
 * ============================================================
 * ENGAGEMENT MODULE NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify client when a new engagement is created
 */
exports.notifyEngagementCreated = async (engagementId, clientId, engagementTitle) => {
  return await NotificationService.send({
    userId: clientId,
    title: 'New Engagement Created',
    message: `Your engagement "${engagementTitle}" has been created successfully.`,
    type: 'engagement',
    category: 'engagement_created',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle }
  });
};

/**
 * Notify about engagement assignment
 */
exports.notifyEngagementAssigned = async (engagementId, auditorId, engagementTitle, assignedBy) => {
  return await NotificationService.send({
    userId: auditorId,
    title: 'Engagement Assigned to You',
    message: `You have been assigned as auditor for "${engagementTitle}".`,
    type: 'engagement',
    category: 'engagement_assigned',
    module: 'engagement',
    priority: 'high',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, assignedBy }
  });
};

/**
 * Notify about engagement status change
 */
exports.notifyEngagementStatusChange = async (engagementId, userIds, engagementTitle, oldStatus, newStatus) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Engagement Status Updated',
    message: `"${engagementTitle}" has moved from ${oldStatus} to ${newStatus}.`,
    type: 'engagement',
    category: 'engagement_status_change',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, oldStatus, newStatus }
  });
};

/**
 * Notify about upcoming engagement deadline
 */
exports.notifyEngagementDeadline = async (engagementId, userIds, engagementTitle, daysRemaining) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Engagement Deadline Approaching',
    message: `Your engagement "${engagementTitle}" deadline is due in ${daysRemaining} days.`,
    type: 'engagement',
    category: 'engagement_deadline',
    module: 'engagement',
    priority: daysRemaining <= 3 ? 'urgent' : 'high',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, daysRemaining }
  });
};

/**
 * Notify about audit completion
 */
exports.notifyAuditCompleted = async (engagementId, userIds, engagementTitle, completedBy) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Audit Completed',
    message: `The audit for "${engagementTitle}" has been completed.`,
    type: 'engagement',
    category: 'audit_completed',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, completedBy }
  });
};

/**
 * Notify about review request
 */
exports.notifyReviewRequested = async (engagementId, reviewerId, engagementTitle, requestedBy) => {
  return await NotificationService.send({
    userId: reviewerId,
    title: 'Review Requested',
    message: `You have been requested to review "${engagementTitle}".`,
    type: 'engagement',
    category: 'review_requested',
    module: 'engagement',
    priority: 'high',
    engagementId,
    actionUrl: `/engagements/${engagementId}/review`,
    data: { engagementTitle, requestedBy }
  });
};

/**
 * Notify client/auditor when review is started
 */
exports.notifyReviewStarted = async (engagementId, userIds, engagementTitle, reviewerName) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Review Started',
    message: `${reviewerName} started reviewing "${engagementTitle}".`,
    type: 'engagement',
    category: 'review_started',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}/review`,
    data: { engagementTitle, reviewerName }
  });
};

/**
 * Notify client/auditor when review is finished
 */
exports.notifyReviewFinished = async (engagementId, userIds, engagementTitle, reviewerName) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Review Finished',
    message: `${reviewerName} finished reviewing "${engagementTitle}".`,
    type: 'engagement',
    category: 'review_finished',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}/review`,
    data: { engagementTitle, reviewerName }
  });
};

/**
 * Notify auditor when client sends a message/request
 */
exports.notifyClientMessage = async (engagementId, auditorId, engagementTitle, clientName, messagePreview) => {
  return await NotificationService.send({
    userId: auditorId,
    title: 'New Message from Client',
    message: `${clientName} sent a message regarding "${engagementTitle}": "${messagePreview}"`,
    type: 'engagement',
    category: 'client_message',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, clientName, messagePreview }
  });
};

/**
 * Notify admin about engagement assignment (for tracking)
 */
exports.notifyAdminEngagementAssigned = async (adminIds, engagementId, engagementTitle, auditorName, assignedBy) => {
  return await NotificationService.send({
    userId: adminIds,
    title: 'Engagement Assigned',
    message: `"${engagementTitle}" has been assigned to ${auditorName} by ${assignedBy}.`,
    type: 'engagement',
    category: 'admin_engagement_assigned',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/admin/engagements/${engagementId}`,
    data: { engagementTitle, auditorName, assignedBy }
  });
};

/**
 * Notify admin about review request (for audit reassignment tracking)
 */
exports.notifyAdminReviewRequested = async (adminIds, engagementId, engagementTitle, reviewerName, requestedBy) => {
  return await NotificationService.send({
    userId: adminIds,
    title: 'Review Requested',
    message: `${requestedBy} requested ${reviewerName} to review "${engagementTitle}".`,
    type: 'engagement',
    category: 'admin_review_requested',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/admin/engagements/${engagementId}`,
    data: { engagementTitle, reviewerName, requestedBy }
  });
};

/**
 * Notify about mentions in chat/notes
 */
exports.notifyMention = async (userId, engagementId, mentionedBy, context) => {
  return await NotificationService.send({
    userId,
    title: 'You were mentioned',
    message: `${mentionedBy} mentioned you: "${context}"`,
    type: 'engagement',
    category: 'mention',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { mentionedBy, context }
  });
};

/**
 * ============================================================
 * DOCUMENT MODULE NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify about document request
 */
exports.notifyDocumentRequested = async (documentId, userId, documentName, requestedBy, category) => {
  return await NotificationService.send({
    userId,
    title: 'Document Requested',
    message: `"${documentName}" has been requested by ${requestedBy}.`,
    type: 'document',
    category: 'document_requested',
    module: 'document',
    priority: 'normal',
    documentId,
    actionUrl: `/client/document-requests?id=${documentId}`,
    data: { documentName, requestedBy, category }
  });
};

/**
 * Notify about document upload
 */
exports.notifyDocumentUploaded = async (documentId, userIds, documentName, uploadedBy, category) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Document Uploaded',
    message: `"${documentName}" has been uploaded by ${uploadedBy}.`,
    type: 'document',
    category: 'document_uploaded',
    module: 'document',
    priority: 'normal',
    documentId,
    actionUrl: `/client/document-requests?id=${documentId}`,
    data: { documentName, uploadedBy, category }
  });
};

/**
 * Notify admin about document uploaded for review
 */
exports.notifyAdminDocumentUploaded = async (adminIds, documentId, documentName, uploadedBy, category, uploadedByRole) => {
  return await NotificationService.send({
    userId: adminIds,
    title: 'Document Uploaded for Review',
    message: `${uploadedBy} (${uploadedByRole}) uploaded "${documentName}" in category "${category}" for review.`,
    type: 'document',
    category: 'admin_document_uploaded',
    module: 'document',
    priority: 'normal',
    documentId,
    actionUrl: `/admin/document-requests?id=${documentId}`,
    data: { documentName, uploadedBy, category, uploadedByRole }
  });
};

/**
 * ============================================================
 * TASK & CHECKLIST MODULE NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify about task assignment
 */
exports.notifyTaskAssigned = async (taskId, userId, taskTitle, assignedBy) => {
  return await NotificationService.send({
    userId,
    title: 'New Task Assigned',
    message: `You have been assigned the task: "${taskTitle}".`,
    type: 'task',
    category: 'task_assigned',
    module: 'task',
    priority: 'normal',
    taskId,
    actionUrl: `/tasks/${taskId}`,
    data: { taskTitle, assignedBy }
  });
};

/**
 * Notify about checklist update
 */
exports.notifyChecklistUpdate = async (userId, checklistId, engagementTitle, updatedBy) => {
  return await NotificationService.send({
    userId,
    title: 'Checklist Updated',
    message: `The checklist for "${engagementTitle}" has been updated.`,
    type: 'task',
    category: 'checklist_updated',
    module: 'task',
    priority: 'normal',
    actionUrl: `/checklist/${checklistId}`,
    data: { engagementTitle, updatedBy }
  });
};

/**
 * Notify admin about task assignment/update (for monitoring)
 */
exports.notifyAdminTaskUpdate = async (adminIds, taskId, taskTitle, action, userId, userName) => {
  const actionMessages = {
    assigned: `Task "${taskTitle}" has been assigned to ${userName}.`,
    updated: `Task "${taskTitle}" has been updated.`,
    completed: `Task "${taskTitle}" has been completed by ${userName}.`
  };
  
  return await NotificationService.send({
    userId: adminIds,
    title: 'Task Update',
    message: actionMessages[action] || `Task "${taskTitle}" has been ${action}.`,
    type: 'task',
    category: 'admin_task_update',
    module: 'task',
    priority: 'normal',
    taskId,
    actionUrl: `/admin/tasks/${taskId}`,
    data: { taskTitle, action, userId, userName }
  });
};

/**
 * ============================================================
 * USER MANAGEMENT MODULE NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify about password change
 */
exports.notifyPasswordChanged = async (userId, changedBy) => {
  return await NotificationService.send({
    userId,
    title: 'Password Changed',
    message: 'Your password has been changed successfully.',
    type: 'user',
    category: 'password_changed',
    module: 'user',
    priority: 'high',
    data: { changedBy, timestamp: new Date() }
  });
};

/**
 * Notify about subscription reminder
 */
exports.notifySubscriptionReminder = async (userId, daysRemaining, planName) => {
  return await NotificationService.send({
    userId,
    title: 'Subscription Reminder',
    message: `Your ${planName} subscription expires in ${daysRemaining} days.`,
    type: 'user',
    category: 'subscription_reminder',
    module: 'user',
    priority: daysRemaining <= 7 ? 'high' : 'normal',
    actionUrl: '/settings/subscription',
    data: { daysRemaining, planName }
  });
};

/**
 * ============================================================
 * SYSTEM MODULE NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify about system update
 */
exports.notifySystemUpdate = async (userIds, updateTitle, updateDescription) => {
  return await NotificationService.send({
    userId: userIds,
    title: updateTitle,
    message: updateDescription,
    type: 'system',
    category: 'system_update',
    module: 'system',
    priority: 'normal',
    data: { timestamp: new Date() }
  });
};

/**
 * ============================================================
 * ADMIN NOTIFICATIONS
 * ============================================================
 */

/**
 * Notify admins about new user registration
 */
exports.notifyAdminNewUser = async (adminIds, newUserEmail, newUserName) => {
  return await NotificationService.send({
    userId: adminIds,
    title: 'New User Registered',
    message: `${newUserName} (${newUserEmail}) has registered.`,
    type: 'user',
    category: 'new_user_registered',
    module: 'user',
    priority: 'normal',
    actionUrl: '/admin/users',
    data: { newUserEmail, newUserName }
  });
};

/**
 * Notify about unusual delay in engagement
 */
exports.notifyUnusualDelay = async (userIds, engagementId, engagementTitle, daysInactive) => {
  return await NotificationService.send({
    userId: userIds,
    title: 'Unusual Delay Detected',
    message: `No progress detected in "${engagementTitle}" for ${daysInactive} days.`,
    type: 'engagement',
    category: 'unusual_delay',
    module: 'engagement',
    priority: 'urgent',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, daysInactive }
  });
};

/**
 * ============================================================
 * CROSS-ROLE NOTIFICATION HELPERS
 * ============================================================
 * 
 * These helpers make it easier to send notifications between different roles
 */

/**
 * Send notification from auditor to client
 * @param {string} engagementId - Engagement ID
 * @param {string} clientId - Client user ID
 * @param {string} engagementTitle - Engagement title
 * @param {string} auditorName - Auditor name
 * @param {string} message - Custom message
 * @param {string} category - Notification category
 */
exports.notifyAuditorToClient = async (engagementId, clientId, engagementTitle, auditorName, message, category = 'engagement_update') => {
  return await NotificationService.send({
    userId: clientId,
    title: `Update from ${auditorName}`,
    message: message || `${auditorName} has an update regarding "${engagementTitle}".`,
    type: 'engagement',
    category: category,
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, auditorName }
  });
};

/**
 * Send notification from client to auditor
 * @param {string} engagementId - Engagement ID
 * @param {string} auditorId - Auditor user ID
 * @param {string} engagementTitle - Engagement title
 * @param {string} clientName - Client name
 * @param {string} message - Custom message
 */
exports.notifyClientToAuditor = async (engagementId, auditorId, engagementTitle, clientName, message) => {
  return await NotificationService.send({
    userId: auditorId,
    title: `Message from ${clientName}`,
    message: message || `${clientName} sent a message regarding "${engagementTitle}".`,
    type: 'engagement',
    category: 'client_message',
    module: 'engagement',
    priority: 'normal',
    engagementId,
    actionUrl: `/engagements/${engagementId}`,
    data: { engagementTitle, clientName }
  });
};

/**
 * Send notification from admin to auditor
 * @param {string} auditorId - Auditor user ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} category - Notification category
 * @param {string} actionUrl - Action URL
 * @param {Object} data - Additional data
 */
exports.notifyAdminToAuditor = async (auditorId, title, message, category = 'admin_notification', actionUrl = null, data = {}) => {
  return await NotificationService.send({
    userId: auditorId,
    title,
    message,
    type: 'engagement',
    category: category,
    module: 'engagement',
    priority: 'high',
    actionUrl: actionUrl,
    data: { ...data, fromRole: 'admin' }
  });
};

/**
 * Send notification from admin to client
 * @param {string} clientId - Client user ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} category - Notification category
 * @param {string} actionUrl - Action URL
 * @param {Object} data - Additional data
 */
exports.notifyAdminToClient = async (clientId, title, message, category = 'admin_notification', actionUrl = null, data = {}) => {
  return await NotificationService.send({
    userId: clientId,
    title,
    message,
    type: 'engagement',
    category: category,
    module: 'engagement',
    priority: 'normal',
    actionUrl: actionUrl,
    data: { ...data, fromRole: 'admin' }
  });
};

/**
 * Send notification from auditor to admin
 * @param {string|string[]} adminIds - Admin user ID(s)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} category - Notification category
 * @param {string} actionUrl - Action URL
 * @param {Object} data - Additional data
 */
exports.notifyAuditorToAdmin = async (adminIds, title, message, category = 'auditor_notification', actionUrl = null, data = {}) => {
  return await NotificationService.send({
    userId: adminIds,
    title,
    message,
    type: 'engagement',
    category: category,
    module: 'engagement',
    priority: 'normal',
    actionUrl: actionUrl,
    data: { ...data, fromRole: 'auditor' }
  });
};

/**
 * Send notification from client to admin
 * @param {string|string[]} adminIds - Admin user ID(s)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} category - Notification category
 * @param {string} actionUrl - Action URL
 * @param {Object} data - Additional data
 */
exports.notifyClientToAdmin = async (adminIds, title, message, category = 'client_notification', actionUrl = null, data = {}) => {
  return await NotificationService.send({
    userId: adminIds,
    title,
    message,
    type: 'engagement',
    category: category,
    module: 'engagement',
    priority: 'normal',
    actionUrl: actionUrl,
    data: { ...data, fromRole: 'client' }
  });
};

