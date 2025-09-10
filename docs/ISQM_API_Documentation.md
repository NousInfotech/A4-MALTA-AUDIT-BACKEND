# ISQM (International Standard on Quality Management) API Documentation

## Overview
The ISQM API provides comprehensive management of International Standard on Quality Management questionnaires and assessments. It supports hierarchical questionnaire structures with parent-child relationships, answer tracking, completion statistics, and export capabilities.

## Base URL
```
/api/isqm
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## Data Structure

### ISQM Parent
Contains metadata about the entire ISQM pack and references to child questionnaires.

### ISQM Questionnaire
Individual questionnaires (ISQM_1, ISQM_2, ISA_220_Revised, etc.) with sections and Q&A pairs.

## ISQM Parent Endpoints

### 1. Create ISQM Parent
**POST** `/api/isqm/parents`

Creates a new ISQM Parent from JSON upload with optional child questionnaires.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "metadata": {
    "title": "ISQM Quality Management Pack 2024",
    "version": "1.0",
    "jurisdiction_note": "Applicable for UK entities",
    "sources": ["IAASB", "FRC"],
    "generated": "2024-01-15T10:30:00.000Z"
  },
  "questionnaires": [
    {
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "description": "Quality management system requirements",
      "version": "1.0",
      "framework": "IFRS",
      "sections": [
        {
          "heading": "Leadership and Governance",
          "sectionId": "leadership",
          "order": 1,
          "qna": [
            {
              "question": "Does the firm have a quality management system in place?",
              "questionId": "q1",
              "isMandatory": true,
              "questionType": "yes-no"
            }
          ]
        }
      ]
    }
  ],
  "status": "draft"
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "metadata": {
    "title": "ISQM Quality Management Pack 2024",
    "version": "1.0",
    "jurisdiction_note": "Applicable for UK entities",
    "sources": ["IAASB", "FRC"],
    "generated": "2024-01-15T10:30:00.000Z"
  },
  "children": ["64a1b2c3d4e5f6789012349"],
  "createdBy": "user-123",
  "status": "draft",
  "completionStats": {
    "totalQuestions": 0,
    "answeredQuestions": 0,
    "completionPercentage": 0
  },
  "questionnaires": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "status": "not-started",
      "stats": {
        "totalQuestions": 1,
        "answeredQuestions": 0,
        "completionPercentage": 0
      }
    }
  ]
}
```

### 2. Get All ISQM Parents
**GET** `/api/isqm/parents`

Retrieves all ISQM Parents with filtering and pagination.

**Query Parameters:**
- `status` (string): Filter by status (draft, in-progress, completed, archived)
- `createdBy` (string): Filter by creator
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): Sort order - asc/desc (default: desc)

**Response:**
```json
{
  "parents": [
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "metadata": {
        "title": "ISQM Quality Management Pack 2024"
      },
      "status": "draft",
      "completionStats": {
        "totalQuestions": 50,
        "answeredQuestions": 25,
        "completionPercentage": 50
      },
      "questionnaires": [
        {
          "_id": "64a1b2c3d4e5f6789012349",
          "key": "ISQM_1",
          "heading": "ISQM 1 - Quality Management",
          "status": "in-progress"
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 45,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. Get ISQM Parent by ID
**GET** `/api/isqm/parents/:id`

Retrieves a specific ISQM Parent with all questionnaires.

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012348",
  "metadata": {
    "title": "ISQM Quality Management Pack 2024",
    "version": "1.0",
    "jurisdiction_note": "Applicable for UK entities",
    "sources": ["IAASB", "FRC"],
    "generated": "2024-01-15T10:30:00.000Z"
  },
  "children": ["64a1b2c3d4e5f6789012349"],
  "createdBy": "user-123",
  "status": "draft",
  "questionnaires": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "sections": [
        {
          "heading": "Leadership and Governance",
          "qna": [
            {
              "question": "Does the firm have a quality management system in place?",
              "answer": "",
              "state": false,
              "isMandatory": true
            }
          ]
        }
      ]
    }
  ]
}
```

### 4. Update ISQM Parent
**PATCH** `/api/isqm/parents/:id`

Updates ISQM Parent metadata and status.

**Body:**
```json
{
  "status": "in-progress",
  "metadata": {
    "title": "Updated ISQM Quality Management Pack 2024"
  }
}
```

### 5. Delete ISQM Parent
**DELETE** `/api/isqm/parents/:id`

Deletes ISQM Parent and all associated questionnaires.

**Response:**
```json
{
  "message": "ISQM Parent and all questionnaires deleted successfully"
}
```

## ISQM Questionnaire Endpoints

### 1. Create Questionnaire
**POST** `/api/isqm/questionnaires`

Creates a new questionnaire within an ISQM Parent.

**Body:**
```json
{
  "parentId": "64a1b2c3d4e5f6789012348",
  "key": "ISQM_2",
  "heading": "ISQM 2 - Engagement Quality",
  "description": "Quality management for individual engagements",
  "version": "1.0",
  "framework": "IFRS",
  "sections": [
    {
      "heading": "Engagement Planning",
      "sectionId": "planning",
      "order": 1,
      "qna": [
        {
          "question": "Has engagement planning been completed?",
          "questionId": "q1",
          "isMandatory": true,
          "questionType": "yes-no"
        }
      ]
    }
  ]
}
```

### 2. Get Questionnaires by Parent
**GET** `/api/isqm/parents/:parentId/questionnaires`

Retrieves all questionnaires for a specific parent.

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012349",
    "parentId": "64a1b2c3d4e5f6789012348",
    "key": "ISQM_1",
    "heading": "ISQM 1 - Quality Management",
    "status": "in-progress",
    "stats": {
      "totalQuestions": 25,
      "answeredQuestions": 15,
      "completionPercentage": 60
    },
    "parent": {
      "metadata": {
        "title": "ISQM Quality Management Pack 2024"
      }
    }
  }
]
```

### 3. Get Questionnaire by ID
**GET** `/api/isqm/questionnaires/:id`

Retrieves a specific questionnaire with all sections and questions.

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012349",
  "parentId": "64a1b2c3d4e5f6789012348",
  "key": "ISQM_1",
  "heading": "ISQM 1 - Quality Management",
  "description": "Quality management system requirements",
  "version": "1.0",
  "framework": "IFRS",
  "status": "in-progress",
  "stats": {
    "totalQuestions": 25,
    "answeredQuestions": 15,
    "completionPercentage": 60,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "sections": [
    {
      "heading": "Leadership and Governance",
      "sectionId": "leadership",
      "order": 1,
      "isCompleted": false,
      "completionPercentage": 50,
      "qna": [
        {
          "question": "Does the firm have a quality management system in place?",
          "answer": "Yes",
          "state": true,
          "questionId": "q1",
          "isMandatory": true,
          "questionType": "yes-no",
          "answeredAt": "2024-01-15T10:30:00.000Z",
          "answeredBy": "user-123"
        }
      ],
      "notes": []
    }
  ]
}
```

### 4. Update Questionnaire
**PATCH** `/api/isqm/questionnaires/:id`

Updates questionnaire structure and metadata.

**Body:**
```json
{
  "heading": "Updated ISQM 1 - Quality Management",
  "description": "Updated description",
  "assignedTo": "user-456"
}
```

### 5. Delete Questionnaire
**DELETE** `/api/isqm/questionnaires/:id`

Deletes a questionnaire and removes it from parent's children array.

**Response:**
```json
{
  "message": "Questionnaire deleted successfully"
}
```

## Question Answer Management

### 1. Update Question Answer
**PATCH** `/api/isqm/questionnaires/:questionnaireId/sections/:sectionIndex/questions/:questionIndex`

Updates a specific question answer.

**Body:**
```json
{
  "answer": "Yes, we have implemented a comprehensive quality management system",
  "comments": "Additional notes about the implementation"
}
```

**Response:** Updated questionnaire with recalculated statistics

### 2. Add Section Note
**POST** `/api/isqm/questionnaires/:questionnaireId/sections/:sectionIndex/notes`

Adds a note to a specific section.

**Body:**
```json
{
  "text": "This section requires additional review by senior management"
}
```

### 3. Bulk Update Answers
**PATCH** `/api/isqm/questionnaires/:questionnaireId/answers/bulk`

Updates multiple answers in one request.

**Body:**
```json
{
  "answers": [
    {
      "sectionIndex": 0,
      "questionIndex": 0,
      "answer": "Yes"
    },
    {
      "sectionIndex": 0,
      "questionIndex": 1,
      "answer": "No"
    }
  ]
}
```

**Response:**
```json
{
  "message": "2 answers updated successfully",
  "updatedCount": 2,
  "questionnaire": { /* updated questionnaire */ }
}
```

## Statistics and Reporting

### 1. Get Questionnaire Statistics
**GET** `/api/isqm/questionnaires/:id/stats`

Retrieves detailed statistics for a questionnaire.

**Response:**
```json
{
  "questionnaire": {
    "id": "64a1b2c3d4e5f6789012349",
    "key": "ISQM_1",
    "heading": "ISQM 1 - Quality Management",
    "status": "in-progress"
  },
  "overall": {
    "totalQuestions": 25,
    "answeredQuestions": 15,
    "completionPercentage": 60,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "sections": [
    {
      "heading": "Leadership and Governance",
      "totalQuestions": 10,
      "answeredQuestions": 8,
      "completionPercentage": 80,
      "isCompleted": false
    },
    {
      "heading": "Risk Assessment",
      "totalQuestions": 15,
      "answeredQuestions": 7,
      "completionPercentage": 47,
      "isCompleted": false
    }
  ]
}
```

### 2. Export Questionnaire Data
**GET** `/api/isqm/questionnaires/:id/export`

Exports questionnaire data in CSV or JSON format.

**Query Parameters:**
- `format` (string): Export format - csv/json (default: json)

**Response:**
- **CSV Format**: Downloads CSV file with section, question, answer data
- **JSON Format**: Returns complete questionnaire JSON

## Question Types

The system supports various question types:

- **yes-no**: Boolean yes/no questions
- **text**: Short text answers
- **textarea**: Long text answers
- **select**: Single selection from options
- **multi-select**: Multiple selections from options

## Status Values

### Parent Status
- **draft**: Initial creation state
- **in-progress**: Being worked on
- **completed**: All questionnaires completed
- **archived**: Archived for historical reference

### Questionnaire Status
- **not-started**: No answers provided
- **in-progress**: Some answers provided
- **completed**: All questions answered
- **under-review**: Being reviewed by supervisor

## Error Responses

**400 Bad Request:**
```json
{
  "message": "Questionnaire with this key already exists for this parent"
}
```

**404 Not Found:**
```json
{
  "message": "ISQM Parent not found"
}
```

**403 Forbidden:**
```json
{
  "message": "Insufficient permissions"
}
```

## Role Permissions

- **employee** (auditor): Can create, update, delete ISQM packs and questionnaires
- **client**: Can view assigned questionnaires and update answers
- **admin**: Full access to all ISQM operations

## Usage Examples

### 1. Create ISQM Pack from JSON:
```javascript
POST /api/isqm/parents
{
  "metadata": {
    "title": "ISQM Quality Management Pack 2024",
    "version": "1.0"
  },
  "questionnaires": [
    {
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "sections": [...]
    }
  ]
}
```

### 2. Answer Questions:
```javascript
PATCH /api/isqm/questionnaires/questionnaireId/sections/0/questions/0
{
  "answer": "Yes, we have implemented comprehensive quality controls"
}
```

### 3. Get Completion Statistics:
```javascript
GET /api/isqm/questionnaires/questionnaireId/stats
```

### 4. Export Data:
```javascript
GET /api/isqm/questionnaires/questionnaireId/export?format=csv
```

## Integration Notes

### Automatic Statistics Calculation
- Statistics are automatically calculated on save
- Completion percentages are updated in real-time
- Status changes based on completion levels

### Hierarchical Structure
- Parent contains metadata and references to children
- Children contain actual questionnaire data
- Cascade deletion removes all related data

### Engagement Integration
- ISQM packs are standalone quality management assessments
- No engagement linking required - this is an internal employee tool
- Supports firm-wide quality management compliance

## 📄 Supporting Documents API

### 1. Create Supporting Document Request
**POST** `/api/isqm/supporting-documents`

Creates a new supporting document request for an ISQM pack.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "parentId": "64a1b2c3d4e5f6789012345",
  "category": "Policy Documents",
  "title": "Quality Management Policy",
  "description": "Firm's quality management policy document",
  "priority": "high",
  "isMandatory": true,
  "dueDate": "2024-02-15T00:00:00.000Z",
  "tags": ["policy", "quality", "management"],
  "framework": "IFRS",
  "jurisdiction": "UK"
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012350",
  "parentId": "64a1b2c3d4e5f6789012345",
  "category": "Policy Documents",
  "title": "Quality Management Policy",
  "description": "Firm's quality management policy document",
  "status": "pending",
  "priority": "high",
  "isMandatory": true,
  "dueDate": "2024-02-15T00:00:00.000Z",
  "tags": ["policy", "quality", "management"],
  "framework": "IFRS",
  "jurisdiction": "UK",
  "requestedBy": "user-123",
  "requestedAt": "2024-01-15T10:30:00.000Z",
  "documents": [],
  "notes": [],
  "completionPercentage": 0
}
```

### 2. Get Supporting Documents by Parent
**GET** `/api/isqm/parents/:parentId/supporting-documents`

Retrieves all supporting documents for a specific ISQM parent.

**Query Parameters:**
- `category` (string): Filter by document category
- `status` (string): Filter by status (pending, uploaded, reviewed, approved, rejected)
- `priority` (string): Filter by priority (low, medium, high, critical)

**Response:**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012350",
    "parentId": "64a1b2c3d4e5f6789012345",
    "category": "Policy Documents",
    "title": "Quality Management Policy",
    "status": "uploaded",
    "priority": "high",
    "isMandatory": true,
    "dueDate": "2024-02-15T00:00:00.000Z",
    "documents": [
      {
        "name": "quality_policy_v1.pdf",
        "url": "https://supabase.com/storage/v1/object/public/documents/quality_policy_v1.pdf",
        "uploadedAt": "2024-01-16T09:15:00.000Z",
        "uploadedBy": "user-123",
        "fileSize": 1024000,
        "mimeType": "application/pdf",
        "version": "1.0",
        "isLatest": true
      }
    ],
    "completionPercentage": 100,
    "parent": {
      "_id": "64a1b2c3d4e5f6789012345",
      "metadata": {
        "title": "ISQM Quality Management Pack 2024"
      }
    }
  }
]
```

### 3. Upload Document File
**POST** `/api/isqm/supporting-documents/:id/upload`

Uploads files to a supporting document request.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Body:**
- `files`: File uploads (multiple files supported)
- `version`: Document version (optional, default: "1.0")

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012350",
  "status": "uploaded",
  "documents": [
    {
      "name": "quality_policy_v2.pdf",
      "url": "https://supabase.com/storage/v1/object/public/documents/quality_policy_v2.pdf",
      "uploadedAt": "2024-01-16T14:30:00.000Z",
      "uploadedBy": "user-123",
      "fileSize": 1200000,
      "mimeType": "application/pdf",
      "version": "2.0",
      "isLatest": true
    }
  ],
  "completionPercentage": 100
}
```

### 4. Review Supporting Document
**PATCH** `/api/isqm/supporting-documents/:id/review`

Reviews and approves/rejects a supporting document.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "status": "approved",
  "reviewComments": "Document meets quality standards and is approved for use."
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012350",
  "status": "approved",
  "reviewedBy": "user-456",
  "reviewedAt": "2024-01-17T10:00:00.000Z",
  "reviewComments": "Document meets quality standards and is approved for use.",
  "approvedBy": "user-456",
  "approvedAt": "2024-01-17T10:00:00.000Z"
}
```

### 5. Add Document Note
**POST** `/api/isqm/supporting-documents/:id/notes`

Adds a note to a supporting document.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "text": "This document requires annual review and update."
}
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012350",
  "notes": [
    {
      "text": "This document requires annual review and update.",
      "addedBy": "user-123",
      "addedAt": "2024-01-16T16:45:00.000Z"
    }
  ]
}
```

### 6. Get Supporting Document Statistics
**GET** `/api/isqm/parents/:parentId/supporting-documents/stats`

Retrieves statistics for supporting documents in an ISQM pack.

**Response:**
```json
{
  "overall": {
    "totalDocuments": 15,
    "pendingDocuments": 3,
    "uploadedDocuments": 8,
    "reviewedDocuments": 2,
    "approvedDocuments": 2,
    "rejectedDocuments": 0,
    "averageCompletion": 73.3
  },
  "byCategory": [
    {
      "_id": "Policy Documents",
      "count": 5,
      "completed": 3
    },
    {
      "_id": "Training Records",
      "count": 4,
      "completed": 2
    },
    {
      "_id": "Audit Evidence",
      "count": 6,
      "completed": 1
    }
  ]
}
```

## 🔧 Supporting Document Features

### Document Lifecycle
1. **Pending** - Document request created
2. **Uploaded** - Files uploaded to request
3. **Reviewed** - Document under review
4. **Approved** - Document approved for use
5. **Rejected** - Document rejected, needs revision

### Document Management
- **Version Control** - Track multiple versions of documents
- **File Metadata** - Store file size, MIME type, upload details
- **Priority Levels** - Low, medium, high, critical
- **Due Dates** - Track document deadlines
- **Tags** - Categorize documents for easy filtering
- **Notes** - Add comments and observations

### Integration with ISQM
- **Parent Linking** - Documents linked to ISQM packs
- **Category Organization** - Group documents by type
- **Completion Tracking** - Monitor document completion status
- **Statistics** - Get insights on document progress

The ISQM API provides comprehensive quality management questionnaire capabilities and supporting document management essential for audit compliance and quality assurance! 🎉
