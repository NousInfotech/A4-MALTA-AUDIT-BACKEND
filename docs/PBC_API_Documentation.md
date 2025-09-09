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

## Role Permissions

- **employee** (auditor): Can create, update, delete PBC workflows and categories
- **client**: Can view PBC workflows, answer questions, and add discussions
- **admin**: Full access to all PBC operations
