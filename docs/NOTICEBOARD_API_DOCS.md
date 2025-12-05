# NoticeBoard API Documentation

## Overview
The NoticeBoard module provides a centralized announcement and notification system for organizations. It supports role-based notices, tracking views/acknowledgments, and comprehensive filtering.

## Base URL
```
/api/notices
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

The system automatically filters notices by `organizationId` from the authenticated user's context.

---

## Endpoints

### 1. Create Notice
**POST** `/api/notices`

Creates a new notice for the organization.

**Request Body:**
```json
{
  "title": "System Maintenance",
  "description": "Scheduled maintenance on Sunday at 2 AM",
  "roles": ["admin", "employee"],
  "type": "warning",
  "priority": 5,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notice created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "System Maintenance",
    "organizationId": "org123",
    "createdBy": "admin",
    "createdByUserId": "user123",
    "portalNotificationId": null,
    "isActive": true,
    "createdAt": "2024-12-02T10:00:00Z",
    ...
  }
}
```

---

### 2. Get All Notices (with Filtering)
**GET** `/api/notices`

Retrieves all notices with advanced filtering, sorting, pagination, and search.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `sort` | string | "createdAt" | Field to sort by |
| `order` | string | "desc" | Sort order (asc/desc) |
| `search` | string | "" | Search in title and description |
| `type` | string | - | Filter by notice type |
| `roles` | string\|array | - | Filter by roles |
| `isActive` | boolean | - | Filter by active status |
| `createdBy` | string | - | Filter by creator (admin/super-admin) |
| `priority` | number | - | Filter by priority |
| `fieldName` | JSON | - | Custom field filtering |

**Example Requests:**
```bash
# Get all active emergency notices
GET /api/notices?type=emergency&isActive=true

# Search for "maintenance" in title/description
GET /api/notices?search=maintenance

# Get notices for clients, sorted by priority
GET /api/notices?roles=client&sort=priority&order=desc

# Paginated results
GET /api/notices?page=2&limit=20

# Custom field filtering (JSON)
GET /api/notices?fieldName={"priority":5,"type":"warning"}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "System Maintenance",
      "description": "...",
      "type": "warning",
      "roles": ["admin", "employee"],
      "priority": 5,
      "isActive": true,
      "userInteractions": [
        {
          "userId": "user123",
          "isViewed": true,
          "viewedAt": "2024-12-02T10:15:00Z",
          "isAcknowledged": false,
          "acknowledgedAt": null
        }
      ],
      ...
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 3. Get Active Notices
**GET** `/api/notices/active`

Retrieves all active notices for the current user based on their role.

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 12
}
```

---

### 4. Get Single Notice
**GET** `/api/notices/:id`

Retrieves a specific notice by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "System Maintenance",
    ...
  }
}
```

---

### 5. Update Notice
**PUT** `/api/notices/:id`

Updates an existing notice.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "roles": ["admin", "employee", "client"],
  "type": "info",
  "priority": 3,
  "isActive": true,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notice updated successfully",
  "data": {...}
}
```

---

### 6. Delete Notice
**DELETE** `/api/notices/:id`

Permanently deletes a notice.

**Response:**
```json
{
  "success": true,
  "message": "Notice deleted successfully",
  "data": {...}
}
```

---

### 7. Deactivate Notice
**PATCH** `/api/notices/:id/deactivate`

Soft deletes a notice by marking it as inactive.

**Response:**
```json
{
  "success": true,
  "message": "Notice deactivated successfully",
  "data": {...}
}
```

---

### 8. Mark as Viewed
**POST** `/api/notices/:id/view`

Marks a notice as viewed by the current user.

**Response:**
```json
{
  "success": true,
  "message": "Notice marked as viewed",
  "data": {...}
}
```

---

### 9. Mark as Acknowledged
**POST** `/api/notices/:id/acknowledge`

Marks a notice as acknowledged by the current user.

**Response:**
```json
{
  "success": true,
  "message": "Notice acknowledged successfully",
  "data": {...}
}
```

---

### 10. Get Notices by Type
**GET** `/api/notices/type/:type`

Retrieves all active notices of a specific type.

**Valid Types:**
- `emergency`
- `warning`
- `update`
- `announcement`
- `reminder`
- `info`
- `success`

**Example:**
```bash
GET /api/notices/type/emergency
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

---

### 11. Get Notice Statistics
**GET** `/api/notices/stats`

Retrieves statistics about notices in the organization.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 45,
    "active": 32,
    "byType": [
      {
        "_id": "emergency",
        "count": 5,
        "active": 3
      },
      {
        "_id": "warning",
        "count": 12,
        "active": 10
      },
      ...
    ]
  }
}
```

---

### 12. Bulk Delete Notices
**POST** `/api/notices/bulk-delete`

Deletes multiple notices at once.

**Request Body:**
```json
{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 notices deleted successfully",
  "deletedCount": 3
}
```

---

## Data Models

### Notice Types
```javascript
[
  "emergency",    // Critical issues requiring immediate attention
  "warning",      // Important warnings
  "update",       // System or feature updates
  "announcement", // General announcements
  "reminder",     // Reminders for tasks/deadlines
  "info",         // Informational messages
  "success"       // Success notifications
]
```

### Roles
```javascript
[
  "admin",     // Admin users
  "employee",  // Employee users
  "client"     // Client users
]
```

### Created By
```javascript
[
  "admin",       // Created by admin
  "super-admin"  // Created by super admin
]
```

### User Interactions Structure
Each notice tracks user interactions in a unified array:
```javascript
userInteractions: [
  {
    userId: "user123",          // User ID
    isViewed: true,             // Has the user viewed this notice?
    viewedAt: "2024-12-02T...", // When did they view it?
    isAcknowledged: false,      // Has the user acknowledged it?
    acknowledgedAt: null        // When did they acknowledge it?
  }
]
```

---

## Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | Yes | Notice title (max 200 chars) |
| `description` | String | Yes | Notice description |
| `roles` | Array | Yes | Target roles (at least one) |
| `type` | String | Yes | Notice type |
| `createdBy` | String | Yes | Creator type (admin/super-admin) |
| `organizationId` | String | Yes | Organization ID (auto-filled) |
| `portalNotificationId` | String | No | Portal notification tracking ID |
| `isActive` | Boolean | No | Active status (default: true) |
| `priority` | Number | No | Priority level (default: 0) |
| `expiresAt` | Date | No | Expiration date |
| `createdByUserId` | String | Yes | User ID of creator |
| `userInteractions` | Array | No | User interactions (views & acknowledgments) |

---

## Examples

### Create an Emergency Notice
```javascript
const response = await fetch('/api/notices', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'System Down',
    description: 'Our systems are currently experiencing issues',
    roles: ['admin', 'employee', 'client'],
    type: 'emergency',
    priority: 10
  })
});
```

### Get Filtered Notices
```javascript
const response = await fetch(
  '/api/notices?type=warning&isActive=true&sort=priority&order=desc&page=1&limit=20',
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);
```

### Mark Notice as Acknowledged
```javascript
const response = await fetch('/api/notices/507f1f77bcf86cd799439011/acknowledge', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Features

✅ **Organization Isolation** - All notices are automatically filtered by organization
✅ **Role-Based Filtering** - Target specific user roles
✅ **Advanced Search** - Full-text search in title and description
✅ **Flexible Sorting** - Sort by any field (priority, date, type, etc.)
✅ **Pagination** - Efficient data loading
✅ **Tracking** - Track who viewed and acknowledged notices
✅ **Expiration** - Auto-deactivate expired notices
✅ **Statistics** - Get insights about notice distribution
✅ **Bulk Operations** - Delete multiple notices at once

---

## Best Practices

1. **Set Priorities** - Use priority levels (1-10) to ensure important notices appear first
2. **Use Expiration** - Set expiration dates for time-sensitive notices
3. **Target Roles** - Only send notices to relevant user roles
4. **Track Engagement** - Use view/acknowledgment tracking for critical notices
5. **Clean Up** - Regularly delete or deactivate old notices
6. **Proper Types** - Use appropriate notice types for better categorization

---

## Notes

- The `organizationId` is automatically extracted from the authenticated user
- Expired notices are automatically marked as inactive
- Portal notification IDs can be used to link with external notification systems
- All timestamps are in ISO 8601 format
- The system supports text search with case-insensitive matching

