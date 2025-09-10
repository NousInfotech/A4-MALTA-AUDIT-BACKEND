# KYC (Know Your Client) API Documentation

## Overview
The KYC API provides endpoints for managing Know Your Client workflows, including document review, discussions, and status tracking for audit engagements.

## Base URL
```
/api/kyc
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## KYC Workflow Endpoints

### 1. Create KYC Workflow
**POST** `/api/kyc/`

Creates a new KYC workflow for an engagement.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequestId": "64a1b2c3d4e5f6789012346"
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "engagement": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequests": "64a1b2c3d4e5f6789012346",
  "discussions": [],
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get KYC by Engagement
**GET** `/api/kyc/engagement/:engagementId`

Retrieves KYC workflow details for a specific engagement.

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "engagement": {
    "_id": "64a1b2c3d4e5f6789012345",
    "title": "Annual Audit 2024",
    "yearEndDate": "2023-12-31T00:00:00.000Z",
    "clientId": "client-user-id"
  },
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequests": {
    "_id": "64a1b2c3d4e5f6789012346",
    "category": "Financial Statements",
    "description": "Annual financial statements",
    "status": "pending",
    "documents": [
      {
        "name": "balance-sheet.pdf",
        "url": "https://supabase.url/file.pdf",
        "uploadedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "discussions": [],
  "status": "pending"
}
```

### 3. Get KYC by ID
**GET** `/api/kyc/:id`

Retrieves KYC workflow details by ID.

**Response:** Same as above.

### 4. Update KYC Workflow
**PATCH** `/api/kyc/:id`

Updates KYC workflow properties.

**Body:**
```json
{
  "status": "in-review",
  "documentRequestId": "64a1b2c3d4e5f6789012347"
}
```

### 5. Delete KYC Workflow
**DELETE** `/api/kyc/:id`

Deletes KYC workflow and all associated discussions.

**Response:**
```json
{
  "message": "KYC workflow deleted successfully"
}
```

### 6. Get All KYC Workflows
**GET** `/api/kyc/`

Retrieves all KYC workflows (for dashboard).

**Query Parameters:**
- `status`: Filter by status (pending, in-review, completed)
- `clientId`: Filter by client ID
- `auditorId`: Filter by auditor ID

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012348",
    "engagement": {
      "_id": "64a1b2c3d4e5f6789012345",
      "title": "Annual Audit 2024",
      "yearEndDate": "2023-12-31T00:00:00.000Z",
      "clientId": "client-user-id"
    },
    "status": "pending"
  }
]
```

## KYC Discussion Endpoints

### 1. Add Discussion to KYC
**POST** `/api/kyc/:id/discussions`

Adds a discussion message to a KYC workflow.

**Body:**
```json
{
  "message": "I need clarification on the revenue recognition policy.",
  "replyTo": "64a1b2c3d4e5f678901234b",
  "documentRef": {
    "documentRequestId": "64a1b2c3d4e5f6789012346",
    "documentIndex": 0
  }
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "discussions": [
    {
      "_id": "64a1b2c3d4e5f678901234c",
      "role": "client",
      "message": "I need clarification on the revenue recognition policy.",
      "replyTo": "64a1b2c3d4e5f678901234b",
      "documentRef": {
        "documentRequestId": "64a1b2c3d4e5f6789012346",
        "documentIndex": 0
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 2. Update Discussion
**PATCH** `/api/kyc/:id/discussions/:discussionId`

Updates a discussion message (only own messages).

**Body:**
```json
{
  "message": "Updated clarification request on revenue recognition policy."
}
```

### 3. Delete Discussion
**DELETE** `/api/kyc/:id/discussions/:discussionId`

Deletes a discussion message (only own messages).

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "discussions": []
}
```

### 4. Get Discussions by Document
**GET** `/api/kyc/discussions/document/:documentRequestId/:documentIndex`

Retrieves all discussions related to a specific document.

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f678901234c",
    "role": "client",
    "message": "I need clarification on the revenue recognition policy.",
    "replyTo": null,
    "documentRef": {
      "documentRequestId": "64a1b2c3d4e5f6789012346",
      "documentIndex": 0
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "kycId": "64a1b2c3d4e5f6789012348",
    "engagement": {
      "_id": "64a1b2c3d4e5f6789012345",
      "title": "Annual Audit 2024",
      "yearEndDate": "2023-12-31T00:00:00.000Z"
    }
  }
]
```

### 5. Update KYC Status
**PATCH** `/api/kyc/:id/status`

Updates the KYC workflow status.

**Body:**
```json
{
  "status": "completed"
}
```

## KYC Workflow States

1. **pending**: Initial state, awaiting review
2. **in-review**: Currently being reviewed by auditor
3. **completed**: Review completed

## Discussion Roles

- **client**: Client user discussions
- **auditor**: Auditor/employee discussions

## Error Responses

**400 Bad Request:**
```json
{
  "message": "KYC workflow already exists for this engagement"
}
```

**404 Not Found:**
```json
{
  "message": "KYC workflow not found"
}
```

**403 Forbidden:**
```json
{
  "message": "You can only edit your own discussions"
}
```

## Role Permissions

- **employee** (auditor): Can create, update, delete KYC workflows and update status
- **client**: Can view KYC workflows, add discussions, and edit own discussions
- **admin**: Full access to all KYC operations

## Usage Examples

### 1. Create KYC Workflow:
```javascript
POST /api/kyc/
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "documentRequestId": "64a1b2c3d4e5f6789012346"
}
```

### 2. Add Discussion with Document Reference:
```javascript
POST /api/kyc/kycId/discussions
{
  "message": "The balance sheet figures don't match the trial balance.",
  "documentRef": {
    "documentRequestId": "64a1b2c3d4e5f6789012346",
    "documentIndex": 0
  }
}
```

### 3. Reply to Discussion:
```javascript
POST /api/kyc/kycId/discussions
{
  "message": "Please check the reconciliation statement I uploaded.",
  "replyTo": "64a1b2c3d4e5f678901234c"
}
```

### 4. Update KYC Status:
```javascript
PATCH /api/kyc/kycId/status
{
  "status": "completed"
}
```

## Integration Notes

- KYC workflows are linked to engagements and document requests
- Discussions can reference specific documents within document requests
- Role-based access control ensures clients can only edit their own discussions
- Document references use documentRequestId and documentIndex for precise targeting
