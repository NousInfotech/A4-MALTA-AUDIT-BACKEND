# PBC (Prepared By Client) API Documentation

## Overview
The PBC API provides endpoints for managing the Prepared By Client workflow, including document collection, Q&A preparation, client responses, and doubt resolution.

## Base URL
```
/api/pbc
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## PBC Workflow Endpoints

### 1. Create PBC Workflow
**POST** `/api/pbc/`

Creates a new PBC workflow for an engagement.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequests": ["64a1b2c3d4e5f6789012346", "64a1b2c3d4e5f6789012347"]
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "engagement": "64a1b2c3d4e5f6789012345",
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequests": ["64a1b2c3d4e5f6789012346"],
  "status": "document-collection",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get PBC by Engagement
**GET** `/api/pbc/engagement/:engagementId`

Retrieves PBC workflow details for a specific engagement.

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "engagement": {
    "_id": "64a1b2c3d4e5f6789012345",
    "title": "Annual Audit 2024",
    "yearEndDate": "2023-12-31T00:00:00.000Z"
  },
  "clientId": "client-user-id",
  "auditorId": "auditor-user-id",
  "documentRequests": [
    {
      "_id": "64a1b2c3d4e5f6789012346",
      "category": "Financial Statements",
      "description": "Annual financial statements",
      "status": "pending"
    }
  ],
  "status": "document-collection",
  "categories": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "title": "Revenue Recognition",
      "qnaQuestions": []
    }
  ]
}
```

### 3. Update PBC Workflow
**PATCH** `/api/pbc/:id`

Updates PBC workflow status and other properties.

**Body:**
```json
{
  "status": "qna-preparation",
  "documentRequests": ["64a1b2c3d4e5f6789012346", "64a1b2c3d4e5f6789012347"]
}
```

### 4. Delete PBC Workflow
**DELETE** `/api/pbc/:id`

Deletes PBC workflow and all associated categories/questions.

**Response:**
```json
{
  "message": "PBC workflow deleted successfully"
}
```

### 5. Get All PBC Workflows
**GET** `/api/pbc/`

Retrieves all PBC workflows (for dashboard).

**Query Parameters:**
- `status`: Filter by status
- `clientId`: Filter by client ID

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012348",
    "engagement": {
      "_id": "64a1b2c3d4e5f6789012345",
      "title": "Annual Audit 2024",
      "yearEndDate": "2023-12-31T00:00:00.000Z"
    },
    "status": "document-collection"
  }
]
```

## QnA Category Endpoints

### 1. Create QnA Category
**POST** `/api/pbc/categories`

Creates a new QnA category within a PBC workflow.

**Body:**
```json
{
  "pbcId": "64a1b2c3d4e5f6789012348",
  "title": "Revenue Recognition"
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012349",
  "pbcId": "64a1b2c3d4e5f6789012348",
  "title": "Revenue Recognition",
  "qnaQuestions": [],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get Categories by PBC
**GET** `/api/pbc/categories/pbc/:pbcId`

Retrieves all categories for a specific PBC workflow.

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012349",
    "pbcId": "64a1b2c3d4e5f6789012348",
    "title": "Revenue Recognition",
    "qnaQuestions": [
      {
        "_id": "64a1b2c3d4e5f678901234a",
        "question": "How do you recognize revenue from sales?",
        "isMandatory": true,
        "answer": "",
        "status": "unanswered",
        "discussions": [],
        "answeredAt": null
      }
    ]
  }
]
```

### 3. Add Question to Category
**POST** `/api/pbc/categories/:categoryId/questions`

Adds a new question to a category.

**Body:**
```json
{
  "question": "How do you recognize revenue from sales?",
  "isMandatory": true
}
```

### 4. Update Question Status
**PATCH** `/api/pbc/categories/:categoryId/questions/:questionIndex`

Updates the status of a specific question (answered/unanswered/doubt).

**Body:**
```json
{
  "status": "answered",
  "answer": "We recognize revenue when goods are delivered and payment is received."
}
```

**For doubt status:**
```json
{
  "status": "doubt",
  "doubtReason": "I need clarification on the specific criteria for revenue recognition."
}
```

### 5. Add Discussion to Question
**POST** `/api/pbc/categories/:categoryId/questions/:questionIndex/discussions`

Adds a discussion message to a question (for doubt resolution).

**Body:**
```json
{
  "message": "Please refer to the revenue recognition policy document I shared earlier.",
  "replyTo": "64a1b2c3d4e5f678901234b"
}
```

### 6. Delete Category
**DELETE** `/api/pbc/categories/:categoryId`

Deletes a category and all its questions.

**Response:**
```json
{
  "message": "Category and all questions deleted successfully"
}
```

## PBC Workflow States

1. **document-collection**: Initial data collection phase
2. **qna-preparation**: Auditor preparing Q&A questions
3. **client-responses**: Client answering questions
4. **doubt-resolution**: Resolving client doubts
5. **submitted**: PBC workflow completed

## Question Status Values

- **unanswered**: Question not yet answered
- **answered**: Question answered by client
- **doubt**: Client has doubts about the question

## Error Responses

**400 Bad Request:**
```json
{
  "message": "PBC workflow already exists for this engagement"
}
```

**404 Not Found:**
```json
{
  "message": "PBC workflow not found"
}
```

**403 Forbidden:**
```json
{
  "message": "Insufficient permissions"
}
```

## PBC Document Request Endpoints

### 1. Create PBC Document Request
**POST** `/api/pbc/document-requests`

Creates a new document request specifically for PBC workflow with auto-categorization.

**Body:**
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "description": "Annual financial statements for PBC review",
  "documents": []
}
```

**Response:**
```json
{
  "success": true,
  "message": "PBC document request created successfully",
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "engagement": "64a1b2c3d4e5f6789012345",
    "clientId": "client-user-id",
    "category": "pbc",
    "description": "Annual financial statements for PBC review",
    "status": "pending",
    "requestedAt": "2024-01-15T10:30:00.000Z",
    "documents": []
  }
}
```

### 2. Get PBC Document Requests by Engagement
**GET** `/api/pbc/document-requests/engagement/:engagementId`

Retrieves all PBC document requests for a specific engagement.

**Response:**
```json
{
  "success": true,
  "documentRequests": [
    {
      "_id": "64a1b2c3d4e5f6789012346",
      "engagement": "64a1b2c3d4e5f6789012345",
      "clientId": "client-user-id",
      "category": "pbc",
      "description": "Annual financial statements for PBC review",
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
    }
  ]
}
```

### 3. Update PBC Document Request
**PATCH** `/api/pbc/document-requests/:requestId`

Updates PBC document request properties (category and engagement cannot be changed).

**Body:**
```json
{
  "description": "Updated description for PBC document request",
  "status": "completed"
}
```

### 4. Delete PBC Document Request
**DELETE** `/api/pbc/document-requests/:requestId`

Deletes a PBC document request (auditors only).

**Response:**
```json
{
  "success": true,
  "message": "PBC document request deleted successfully"
}
```

### 5. Bulk Upload Documents to PBC Request
**POST** `/api/pbc/document-requests/:requestId/documents`

Uploads multiple documents to a PBC document request.

**Headers:**
- `Content-Type: multipart/form-data`

**Body:**
- `files`: Array of files to upload
- `markCompleted`: Optional boolean to mark request as completed

**Response:**
```json
{
  "success": true,
  "message": "2 document(s) uploaded successfully",
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "documents": [
      {
        "name": "balance-sheet.pdf",
        "url": "https://supabase.url/file1.pdf",
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "status": "uploaded"
      },
      {
        "name": "income-statement.pdf",
        "url": "https://supabase.url/file2.pdf",
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "status": "uploaded"
      }
    ]
  }
}
```

### 6. Upload Single Document to PBC Request
**POST** `/api/pbc/document-requests/:requestId/document`

Uploads a single document to a PBC document request.

**Headers:**
- `Content-Type: multipart/form-data`

**Body:**
- `file`: Single file to upload

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "name": "balance-sheet.pdf",
    "url": "https://supabase.url/file.pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "status": "uploaded"
  },
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "documents": [...]
  }
}
```

### 7. Update Individual Document Status
**PATCH** `/api/pbc/document-requests/:requestId/documents/:documentIndex/status`

Updates the status of a specific document within a PBC request (auditors only).

**Body:**
```json
{
  "status": "approved"
}
```

**Valid Status Values:**
- `pending`: Document not yet uploaded
- `uploaded`: Document uploaded by client
- `in-review`: Document under auditor review
- `approved`: Document approved by auditor
- `rejected`: Document rejected by auditor

**Response:**
```json
{
  "success": true,
  "message": "PBC document status updated successfully",
  "document": {
    "name": "balance-sheet.pdf",
    "url": "https://supabase.url/file.pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "status": "approved"
  },
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "documents": [...]
  }
}
```

### 8. Bulk Update Document Statuses
**PATCH** `/api/pbc/document-requests/:requestId/documents/bulk-status`

Updates multiple document statuses at once (auditors only).

**Body:**
```json
{
  "updates": [
    {
      "documentIndex": 0,
      "status": "approved"
    },
    {
      "documentIndex": 1,
      "status": "rejected"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 PBC document status(es) updated successfully",
  "updatedCount": 2,
  "documentRequest": {
    "_id": "64a1b2c3d4e5f6789012346",
    "documents": [...]
  }
}
```

### 9. Get PBC Document Request Statistics
**GET** `/api/pbc/document-requests/engagement/:engagementId/stats`

Retrieves comprehensive statistics for PBC document requests.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 5,
    "pendingRequests": 2,
    "completedRequests": 3,
    "totalDocuments": 15,
    "uploadedDocuments": 12,
    "inReviewDocuments": 2,
    "approvedDocuments": 10,
    "rejectedDocuments": 1
  }
}
```

## AI QnA Generation

### Generate QnA Using AI
**POST** `/api/pbc/:pbcId/generate-qna-ai`

Generates Q&A questions using OpenAI based on engagement context and uploaded documents.

**Body:**
```json
{
  "context": "Annual audit for manufacturing company",
  "focusAreas": ["revenue recognition", "inventory valuation", "fixed assets"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Q&A generated successfully using AI",
  "generatedCategories": [
    {
      "title": "Revenue Recognition",
      "questions": [
        {
          "question": "How do you recognize revenue from product sales?",
          "isMandatory": true
        },
        {
          "question": "What is your policy for recognizing revenue from service contracts?",
          "isMandatory": false
        }
      ]
    }
  ],
  "pbc": {
    "_id": "64a1b2c3d4e5f6789012348",
    "categories": [...]
  }
}
```

## Document Status Management

Both PBC document requests and regular document requests support the complete document lifecycle:

- **`pending`**: Document not yet uploaded
- **`uploaded`**: Document uploaded by client
- **`in-review`**: Document under auditor review
- **`approved`**: Document approved by auditor
- **`rejected`**: Document rejected by auditor

## Role Permissions

- **employee** (auditor): Can create, update, delete PBC workflows, categories, and document requests; can change document statuses
- **client**: Can view PBC workflows, answer questions, add discussions, upload documents to their own requests
- **admin**: Full access to all PBC operations

## Usage Examples

### 1. Create PBC Document Request:
```javascript
POST /api/pbc/document-requests
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "description": "Annual financial statements for PBC review"
}
```

### 2. Upload Multiple Documents:
```javascript
POST /api/pbc/document-requests/:requestId/documents
Content-Type: multipart/form-data
Body: files (multiple files)
```

### 3. Update Document Status:
```javascript
PATCH /api/pbc/document-requests/:requestId/documents/:documentIndex/status
{
  "status": "approved"
}
```

### 4. Generate AI QnA:
```javascript
POST /api/pbc/:pbcId/generate-qna-ai
{
  "context": "Annual audit for manufacturing company",
  "focusAreas": ["revenue recognition", "inventory valuation"]
}
```

### 5. Get Statistics:
```javascript
GET /api/pbc/document-requests/engagement/:engagementId/stats
```

## Integration Notes

- PBC document requests are automatically categorized as "pbc"
- Document status tracking provides complete audit trail
- AI QnA generation uses OpenAI to create contextually relevant questions
- File uploads are stored in Supabase with proper organization
- Role-based access control ensures proper security
