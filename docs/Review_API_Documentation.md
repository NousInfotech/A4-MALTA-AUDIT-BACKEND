# Review & Sign-Off API Documentation

## Overview

The Review API provides comprehensive endpoints for managing audit item review workflows, including submission, assignment, review, approval, and sign-off processes. This system ensures ISQM compliance and maintains complete audit trails.

## Base URL
```
/api/review
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## User Roles & Permissions

| Role | Submit | Assign | Review | Approve | Sign-off | Reopen |
|------|--------|--------|--------|---------|----------|--------|
| `employee` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reviewer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `partner` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Note:** Currently, all authenticated users have full permissions for testing purposes. In production, you may want to restrict certain actions to specific roles.

## Review Workflow States

| State | Description | Next Possible States |
|-------|-------------|---------------------|
| `in-progress` | Item being worked on | `ready-for-review` |
| `ready-for-review` | Submitted for review | `under-review` |
| `under-review` | Currently being reviewed | `approved`, `rejected` |
| `approved` | Review completed successfully | `signed-off` |
| `rejected` | Review failed, needs changes | `in-progress` |
| `signed-off` | Final approval, item locked | `re-opened` |
| `re-opened` | Reopened for changes | `in-progress` |

---

## Endpoints

### 1. Submit Item for Review

Submit an audit item for review by a reviewer or partner.

**Endpoint:** `POST /api/review/submit/:itemType/:itemId`

**Parameters:**
- `itemType` (path): Type of audit item
  - Valid values: `procedure`, `planning-procedure`, `document-request`, `checklist-item`, `pbc`, `kyc`, `isqm-document`, `working-paper`
- `itemId` (path): ID of the audit item

**Request Body:**
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "comments": "Ready for review - all procedures completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item submitted for review successfully",
  "workflow": {
    "_id": "64a1b2c3d4e5f6789012346",
    "itemType": "procedure",
    "itemId": "64a1b2c3d4e5f6789012345",
    "engagement": "64a1b2c3d4e5f6789012345",
    "status": "ready-for-review",
    "submittedForReviewAt": "2024-01-15T10:30:00.000Z",
    "submittedBy": "user-123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid item type or item already submitted
- `403`: Insufficient permissions
- `404`: Item not found

---

### 2. Assign Reviewer

Assign a specific reviewer to an item ready for review.

**Endpoint:** `POST /api/review/assign/:itemId`

**Parameters:**
- `itemId` (path): ID of the review workflow

**Request Body:**
```json
{
  "reviewerId": "reviewer-456",
  "comments": "Assigned to senior reviewer for complex procedures"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reviewer assigned successfully",
  "workflow": {
    "_id": "64a1b2c3d4e5f6789012346",
    "status": "under-review",
    "assignedReviewer": "reviewer-456",
    "assignedAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Item not ready for review
- `403`: Insufficient permissions
- `404`: Review workflow not found

---

### 3. Perform Review

Approve or reject an item under review.

**Endpoint:** `POST /api/review/perform/:itemId`

**Parameters:**
- `itemId` (path): ID of the review workflow

**Request Body:**
```json
{
  "approved": true,
  "comments": "All procedures completed correctly. Documentation is comprehensive and meets audit standards."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item approved successfully",
  "workflow": {
    "_id": "64a1b2c3d4e5f6789012346",
    "status": "approved",
    "reviewedAt": "2024-01-15T14:30:00.000Z",
    "reviewedBy": "reviewer-456",
    "reviewComments": "All procedures completed correctly. Documentation is comprehensive and meets audit standards.",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Item not under review
- `403`: Insufficient permissions or not assigned reviewer
- `404`: Review workflow not found

---

### 4. Sign Off

Final approval by partner - locks the item from further changes.

**Endpoint:** `POST /api/review/signoff/:itemId`

**Parameters:**
- `itemId` (path): ID of the review workflow

**Request Body:**
```json
{
  "comments": "Final approval granted. All audit procedures completed satisfactorily."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item signed off successfully",
  "workflow": {
    "_id": "64a1b2c3d4e5f6789012346",
    "status": "signed-off",
    "signedOffAt": "2024-01-15T16:00:00.000Z",
    "signedOffBy": "partner-789",
    "signOffComments": "Final approval granted. All audit procedures completed satisfactorily.",
    "isLocked": true,
    "lockedAt": "2024-01-15T16:00:00.000Z",
    "lockedBy": "partner-789",
    "updatedAt": "2024-01-15T16:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Item not approved or already signed off
- `403`: Only partners can sign off
- `404`: Review workflow not found

---

### 5. Reopen Item

Reopen a signed-off item for changes (partner/admin only).

**Endpoint:** `POST /api/review/reopen/:itemId`

**Parameters:**
- `itemId` (path): ID of the review workflow

**Request Body:**
```json
{
  "reason": "Additional documentation required for compliance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item reopened successfully",
  "workflow": {
    "_id": "64a1b2c3d4e5f6789012346",
    "status": "re-opened",
    "reopenedAt": "2024-01-16T09:00:00.000Z",
    "reopenedBy": "partner-789",
    "reopenReason": "Additional documentation required for compliance",
    "isLocked": false,
    "lockedAt": null,
    "lockedBy": null,
    "version": 2,
    "previousVersion": 1,
    "updatedAt": "2024-01-16T09:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Item not signed off
- `403`: Only partners can reopen items
- `404`: Review workflow not found

---

### 6. Get Review Queue

Get items pending review for the current user or specified reviewer.

**Endpoint:** `GET /api/review/queue`

**Query Parameters:**
- `reviewerId` (optional): Specific reviewer ID (admin/partner only)
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "workflows": [
    {
      "_id": "64a1b2c3d4e5f6789012346",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": {
        "_id": "64a1b2c3d4e5f6789012345",
        "title": "ABC Company Audit 2024",
        "yearEndDate": "2024-12-31T00:00:00.000Z",
        "clientId": "client-123"
      },
      "status": "ready-for-review",
      "priority": "high",
      "dueDate": "2024-01-20T00:00:00.000Z",
      "submittedForReviewAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `403`: Insufficient permissions

---

### 7. Get Review History

Get complete review history for a specific item.

**Endpoint:** `GET /api/review/history/:itemId`

**Parameters:**
- `itemId` (path): ID of the review workflow

**Query Parameters:**
- `limit` (optional): Number of history entries to return (default: 50)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": "64a1b2c3d4e5f6789012345",
      "action": "signed-off",
      "performedBy": "partner-789",
      "performedAt": "2024-01-15T16:00:00.000Z",
      "previousStatus": "approved",
      "newStatus": "signed-off",
      "comments": "Final approval granted. All audit procedures completed satisfactorily.",
      "metadata": {
        "isLocked": true
      }
    },
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "action": "review-approved",
      "performedBy": "reviewer-456",
      "performedAt": "2024-01-15T14:30:00.000Z",
      "previousStatus": "under-review",
      "newStatus": "approved",
      "comments": "All procedures completed correctly."
    }
  ],
  "count": 2
}
```

**Error Responses:**
- `404`: Review workflow not found

---

### 8. Get Review Statistics

Get review statistics and progress metrics.

**Endpoint:** `GET /api/review/stats`

**Query Parameters:**
- `engagementId` (optional): Filter by specific engagement

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalItems": 25,
    "signedOffItems": 18,
    "pendingReview": 3,
    "statusBreakdown": [
      {
        "_id": "signed-off",
        "count": 18
      },
      {
        "_id": "approved",
        "count": 2
      },
      {
        "_id": "ready-for-review",
        "count": 2
      },
      {
        "_id": "under-review",
        "count": 1
      },
      {
        "_id": "rejected",
        "count": 2
      }
    ]
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions

---

### 9. Get Review Workflows for Engagement

Get all review workflows for a specific engagement with pagination and filtering.

**Endpoint:** `GET /api/review/workflows/engagement/:engagementId`

**Parameters:**
- `engagementId` (path): ID of the engagement

**Query Parameters:**
- `status` (optional): Filter by workflow status
- `limit` (optional): Number of results per page (default: 100)
- `page` (optional): Page number for pagination (default: 1)

**Response:**
```json
{
  "success": true,
  "workflows": [
    {
      "_id": "64a1b2c3d4e5f6789012346",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": {
        "_id": "64a1b2c3d4e5f6789012345",
        "title": "ABC Company Audit 2024",
        "yearEndDate": "2024-12-31T00:00:00.000Z",
        "clientId": "client-123"
      },
      "status": "ready-for-review",
      "priority": "high",
      "dueDate": "2024-01-20T00:00:00.000Z",
      "assignedReviewer": "reviewer-456",
      "submittedForReviewAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 100,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions
- `404`: Engagement not found

---

### 10. Get All Review Workflows

Get all review workflows across all engagements with pagination and filtering.

**Endpoint:** `GET /api/review/workflows`

**Query Parameters:**
- `status` (optional): Filter by workflow status
- `engagementId` (optional): Filter by specific engagement
- `reviewerId` (optional): Filter by assigned reviewer
- `limit` (optional): Number of results per page (default: 100)
- `page` (optional): Page number for pagination (default: 1)

**Response:**
```json
{
  "success": true,
  "workflows": [
    {
      "_id": "64a1b2c3d4e5f6789012346",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": {
        "_id": "64a1b2c3d4e5f6789012345",
        "title": "ABC Company Audit 2024",
        "yearEndDate": "2024-12-31T00:00:00.000Z",
        "clientId": "client-123"
      },
      "status": "under-review",
      "priority": "medium",
      "assignedReviewer": "reviewer-456",
      "assignedAt": "2024-01-15T11:00:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalCount": 500,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions

---

### 11. Get All Review History

Get all review history entries across all engagements with pagination and filtering.

**Endpoint:** `GET /api/review/history`

**Query Parameters:**
- `action` (optional): Filter by specific action type
- `engagementId` (optional): Filter by specific engagement
- `performedBy` (optional): Filter by user who performed the action
- `limit` (optional): Number of results per page (default: 100)
- `page` (optional): Page number for pagination (default: 1)

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": {
        "_id": "64a1b2c3d4e5f6789012345",
        "title": "ABC Company Audit 2024",
        "yearEndDate": "2024-12-31T00:00:00.000Z",
        "clientId": "client-123"
      },
      "action": "review-approved",
      "performedBy": "reviewer-456",
      "performedAt": "2024-01-15T14:30:00.000Z",
      "previousStatus": "under-review",
      "newStatus": "approved",
      "comments": "All procedures completed correctly.",
      "metadata": {
        "approved": true
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 20,
    "totalCount": 1000,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions

---

### 12. Get Review History for Engagement

Get all review history for a specific engagement with pagination and filtering.

**Endpoint:** `GET /api/review/engagement/:engagementId`

**Parameters:**
- `engagementId` (path): ID of the engagement

**Query Parameters:**
- `action` (optional): Filter by specific action type
- `performedBy` (optional): Filter by user who performed the action
- `limit` (optional): Number of results per page (default: 100)
- `page` (optional): Page number for pagination (default: 1)

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "itemType": "procedure",
      "itemId": "64a1b2c3d4e5f6789012345",
      "engagement": {
        "_id": "64a1b2c3d4e5f6789012345",
        "title": "ABC Company Audit 2024",
        "yearEndDate": "2024-12-31T00:00:00.000Z",
        "clientId": "client-123"
      },
      "action": "signed-off",
      "performedBy": "partner-789",
      "performedAt": "2024-01-15T16:00:00.000Z",
      "previousStatus": "approved",
      "newStatus": "signed-off",
      "comments": "Final approval granted. All audit procedures completed satisfactorily.",
      "metadata": {
        "isLocked": true
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 150,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Error Responses:**
- `403`: Insufficient permissions
- `404`: Engagement not found

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## WebSocket Events

The review system emits real-time events via Socket.IO:

### Events Emitted:
- `review:submitted` - When item is submitted for review
- `review:assigned` - When reviewer is assigned
- `review:completed` - When review is completed
- `review:signedoff` - When item is signed off
- `review:reopened` - When item is reopened

### Event Data Structure:
```json
{
  "workflowId": "64a1b2c3d4e5f6789012346",
  "itemType": "procedure",
  "itemId": "64a1b2c3d4e5f6789012345",
  "engagementId": "64a1b2c3d4e5f6789012345",
  "status": "approved",
  "performedBy": "reviewer-456",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

---

## Integration Examples

### Frontend Integration Example

```javascript
// Submit item for review
const submitForReview = async (itemType, itemId, engagementId, comments) => {
  const response = await fetch(`/api/review/submit/${itemType}/${itemId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      engagementId,
      comments
    })
  });
  
  return response.json();
};

// Get review queue
const getReviewQueue = async () => {
  const response = await fetch('/api/review/queue', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Get all review workflows for an engagement
const getReviewWorkflowsForEngagement = async (engagementId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.page) params.append('page', filters.page);
  
  const response = await fetch(`/api/review/workflows/engagement/${engagementId}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Get all review workflows
const getAllReviewWorkflows = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.engagementId) params.append('engagementId', filters.engagementId);
  if (filters.reviewerId) params.append('reviewerId', filters.reviewerId);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.page) params.append('page', filters.page);
  
  const response = await fetch(`/api/review/workflows?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Get all review history
const getAllReviews = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.action) params.append('action', filters.action);
  if (filters.engagementId) params.append('engagementId', filters.engagementId);
  if (filters.performedBy) params.append('performedBy', filters.performedBy);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.page) params.append('page', filters.page);
  
  const response = await fetch(`/api/review/history?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Get review history for an engagement
const getReviewsForEngagement = async (engagementId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.action) params.append('action', filters.action);
  if (filters.performedBy) params.append('performedBy', filters.performedBy);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.page) params.append('page', filters.page);
  
  const response = await fetch(`/api/review/engagement/${engagementId}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Perform review
const performReview = async (workflowId, approved, comments) => {
  const response = await fetch(`/api/review/perform/${workflowId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      approved,
      comments
    })
  });
  
  return response.json();
};
```

---

## Best Practices

1. **Always check permissions** before showing review actions
2. **Handle real-time updates** via WebSocket events
3. **Show clear status indicators** for each audit item
4. **Provide context** in review comments
5. **Implement proper error handling** for all API calls
6. **Cache review queue** for better performance
7. **Log all review actions** for audit trail compliance

---

## Support

For technical support or questions about the Review API, please contact the development team or refer to the frontend integration guide.
