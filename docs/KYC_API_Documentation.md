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
  "documentRequest": {
    "name": "KYC Financial Documents",
    "description": "Annual financial statements for KYC review",
    "documents": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "KYC workflow created successfully",
  "kyc": {
    "_id": "64a1b2c3d4e5f6789012348",
    "engagement": {
      "_id": "64a1b2c3d4e5f6789012345",
      "entityName": "ABC Company Ltd",
      "status": "active",
      "yearEndDate": "2023-12-31T00:00:00.000Z"
    },
    "clientId": "client-user-id",
    "auditorId": "auditor-user-id",
    "documentRequests": {
      "_id": "64a1b2c3d4e5f6789012346",
      "engagement": "64a1b2c3d4e5f6789012345",
      "clientId": "client-user-id",
      "name": "KYC Financial Documents",
      "category": "kyc",
      "description": "Financial statements for KYC review",
      "status": "pending",
      "requestedAt": "2024-01-15T10:30:00.000Z",
      "documents": []
    },
    "discussions": [],
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
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
    "engagement": "64a1b2c3d4e5f6789012345",
    "clientId": "client-user-id",
    "name": "KYC Financial Documents",
    "category": "kyc",
    "description": "Annual financial statements",
    "status": "pending",
    "requestedAt": "2024-01-15T10:30:00.000Z",
    "documents": [
      {
        "name": "balance-sheet.pdf",
        "url": "https://supabase.url/file.pdf",
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "status": "uploaded"
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

### 6. Get All KYC Workflows (Auditors Only)
**GET** `/api/kyc/`

Retrieves all KYC workflows (for auditor dashboard).

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

### 7. Get Client's Own KYCs (Clients Only)
**GET** `/api/kyc/my`

Retrieves all KYC workflows for the authenticated client.

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
    "clientId": "client-user-id",
    "auditorId": "auditor-user-id",
    "documentRequests": {
      "_id": "64a1b2c3d4e5f6789012346",
      "engagement": "64a1b2c3d4e5f6789012345",
      "clientId": "client-user-id",
      "name": "KYC Financial Documents",
      "category": "kyc",
      "description": "Annual financial statements",
      "status": "pending",
      "requestedAt": "2024-01-15T10:30:00.000Z",
      "documents": []
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

### 2. Get All Discussions for a KYC
**GET** `/api/kyc/:id/discussions`

Retrieves all discussions for a specific KYC workflow (useful for chat-style UI).

**Response:**
```json
{
  "kycId": "64a1b2c3d4e5f6789012348",
  "engagement": {
    "_id": "64a1b2c3d4e5f6789012345",
    "title": "Annual Audit 2024",
    "yearEndDate": "2023-12-31T00:00:00.000Z",
    "clientId": "client-user-id"
  },
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "category": "Financial Statements",
    "description": "Annual financial statements",
    "status": "pending",
    "documents": []
  },
  "discussions": [
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
      "engagement": "64a1b2c3d4e5f6789012345",
      "documentRequest": "64a1b2c3d4e5f6789012346"
    },
    {
      "_id": "64a1b2c3d4e5f678901234d",
      "role": "auditor",
      "message": "Please refer to the revenue recognition policy document I shared earlier.",
      "replyTo": "64a1b2c3d4e5f678901234c",
      "documentRef": {
        "documentRequestId": "64a1b2c3d4e5f6789012346",
        "documentIndex": 0
      },
      "createdAt": "2024-01-15T11:00:00.000Z",
      "engagement": "64a1b2c3d4e5f6789012345",
      "documentRequest": "64a1b2c3d4e5f6789012346"
    }
  ]
}
```

### 3. Update Discussion
**PATCH** `/api/kyc/:id/discussions/:discussionId`

Updates a discussion message (only own messages).

**Body:**
```json
{
  "message": "Updated clarification request on revenue recognition policy."
}
```

### 4. Delete Discussion
**DELETE** `/api/kyc/:id/discussions/:discussionId`

Deletes a discussion message (only own messages).

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "discussions": []
}
```

### 5. Get Discussions by Document
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

## Document Request Management

### 1. Add DocumentRequest to KYC
**POST** `/api/kyc/:id/document-requests`

Attaches a new DocumentRequest to an existing KYC workflow.

**Body:**
```json
{
  "documentRequestId": "64a1b2c3d4e5f6789012347"
}
```

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
    "_id": "64a1b2c3d4e5f6789012347",
    "engagement": "64a1b2c3d4e5f6789012345",
    "clientId": "client-user-id",
    "name": "KYC Tax Documents",
    "category": "kyc",
    "description": "Corporate tax returns",
    "status": "pending",
    "requestedAt": "2024-01-15T10:30:00.000Z",
    "documents": []
  },
  "discussions": [],
  "status": "pending"
}
```

## Status Management

### 1. Update KYC Status
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

- **employee** (auditor): Can create, update, delete KYC workflows, add document requests, and update status
- **client**: Can view their own KYC workflows, add discussions, and edit own discussions
- **admin**: Full access to all KYC operations

## Usage Examples

### 1. Create KYC Workflow:
```javascript
POST /api/kyc/
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequest": {
    "name": "KYC Financial Documents",
    "description": "Annual financial statements for KYC review",
    "documents": []
  }
}
```

### 2. Add DocumentRequest to Existing KYC:
```javascript
POST /api/kyc/kycId/document-requests
{
  "documentRequestId": "64a1b2c3d4e5f6789012347"
}
```

### 3. Get All Discussions (Chat-style UI):
```javascript
GET /api/kyc/kycId/discussions
```

### 4. Client Views Their KYCs:
```javascript
GET /api/kyc/my
```

### 5. Add Discussion with Document Reference:
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

### 6. Reply to Discussion:
```javascript
POST /api/kyc/kycId/discussions
{
  "message": "Please check the reconciliation statement I uploaded.",
  "replyTo": "64a1b2c3d4e5f678901234c"
}
```

### 7. Update KYC Status:
```javascript
PATCH /api/kyc/kycId/status
{
  "status": "completed"
}
```

## New Features Added

### 1. Document Request Attachment
- Auditors can attach new DocumentRequests to ongoing KYC workflows
- Prevents duplicate attachments
- Validates DocumentRequest belongs to same engagement

### 2. Complete Discussion Thread
- Get all discussions for a KYC workflow
- Useful for chat-style UI implementations
- Includes engagement and document request context

### 3. Client-Specific View
- Clients can view their own KYC workflows
- Filtered by client ID automatically
- Includes engagement and document request details

## Integration Notes

- KYC workflows are linked to engagements and document requests
- Document requests are created automatically when creating a KYC workflow with category set to 'kyc'
- Discussions can reference specific documents within document requests
- Role-based access control ensures clients can only edit their own discussions
- Document references use documentRequestId and documentIndex for precise targeting
- New DocumentRequests can be attached to existing KYC workflows without recreating the entire workflow
- Document requests are returned as populated objects in all KYC responses
