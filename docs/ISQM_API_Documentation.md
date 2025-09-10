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

## 🤖 AI Document Generation API

### 1. Generate Policy Document
**POST** `/api/isqm/questionnaires/:questionnaireId/generate/policy`

Generates a formal quality management policy based on completed ISQM questionnaire responses.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "firmDetails": {
    "size": "mid-sized",
    "specializations": ["audit", "tax", "advisory"],
    "jurisdiction": "UK",
    "additionalInfo": "Any additional firm-specific details"
  }
}
```

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "generatedDocument": "# Quality Management Policy\n\n## 1. Policy Title and Purpose\n\nThis policy establishes the framework for quality management...",
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "user-123",
    "model": "gpt-4o-mini",
    "promptType": "POLICY_GENERATOR"
  }
}
```

### 2. Generate Procedure Document
**POST** `/api/isqm/questionnaires/:questionnaireId/generate/procedure`

Generates detailed implementation procedures based on ISQM questionnaire responses and policy requirements.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "firmDetails": {
    "size": "mid-sized",
    "specializations": ["audit", "tax", "advisory"],
    "processes": ["existing process details"],
    "jurisdiction": "UK"
  },
  "policyDetails": {
    "title": "Quality Management Policy",
    "requirements": ["requirement1", "requirement2"],
    "responsibilities": {
      "engagementPartner": "Overall responsibility",
      "qualityReviewer": "Review and approval"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "generatedDocument": "# Quality Management Procedures\n\n## 1. Procedure Title\n\nQuality Management Implementation Procedures...",
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "user-123",
    "model": "gpt-4o-mini",
    "promptType": "PROCEDURE_GENERATOR"
  }
}
```

### 3. Generate Risk Assessment
**POST** `/api/isqm/questionnaires/:questionnaireId/generate/risk-assessment`

Generates a comprehensive risk assessment based on ISQM questionnaire responses.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "firmDetails": {
    "size": "mid-sized",
    "specializations": ["audit", "tax", "advisory"],
    "jurisdiction": "UK"
  }
}
```

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "generatedDocument": "# Quality Management Risk Assessment\n\n## 1. Risk Identification\n\nBased on the questionnaire responses, the following risks have been identified...",
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "user-123",
    "model": "gpt-4o-mini",
    "promptType": "RISK_ASSESSMENT_GENERATOR"
  }
}
```

### 4. Generate Compliance Checklist
**POST** `/api/isqm/questionnaires/:questionnaireId/generate/compliance-checklist`

Generates a practical compliance checklist based on ISQM requirements and questionnaire responses.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "firmDetails": {
    "size": "mid-sized",
    "specializations": ["audit", "tax", "advisory"],
    "jurisdiction": "UK"
  }
}
```

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "generatedDocument": "# ISQM Compliance Checklist\n\n## Compliance Areas\n\n### 1. Quality Management System\n- [ ] Policy documented and approved...",
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "user-123",
    "model": "gpt-4o-mini",
    "promptType": "COMPLIANCE_CHECKLIST_GENERATOR"
  }
}
```

### 5. Automatic ISQM Document Generation
**POST** `/api/isqm/parents/:parentId/generate-documents`

Automatically generates both policy and procedure documents for all completed questionnaires in an ISQM pack. This is the main endpoint for bulk document generation.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "firmDetails": {
    "size": "mid-sized",
    "specializations": ["audit", "tax", "advisory"],
    "jurisdiction": "UK",
    "additionalInfo": "Any additional firm-specific details"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully generated 3 policy documents and 3 procedure documents",
  "parent": {
    "id": "64a1b2c3d4e5f6789012345",
    "title": "ISQM Quality Management Pack 2024",
    "version": "1.0",
    "jurisdiction": "UK"
  },
  "questionnaires": [
    {
      "id": "64a1b2c3d4e5f6789012349",
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "completionPercentage": 100,
      "totalQuestions": 25,
      "answeredQuestions": 25
    },
    {
      "id": "64a1b2c3d4e5f6789012350",
      "key": "ISQM_2",
      "heading": "ISQM 2 - Engagement Quality",
      "completionPercentage": 100,
      "totalQuestions": 20,
      "answeredQuestions": 20
    }
  ],
  "policies": [
    {
      "questionnaireId": "64a1b2c3d4e5f6789012349",
      "componentName": "ISQM 1 - Quality Management",
      "componentKey": "ISQM_1",
      "document": "# Quality Management Policy\n\n## 1. Policy Title and Purpose\n\nThis policy establishes the framework for quality management...",
      "pdfPath": "/temp/ISQM_1_policy_2024-01-15T10-30-00-000Z.pdf",
      "pdfFilename": "ISQM_1_policy_2024-01-15T10-30-00-000Z.pdf",
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "generatedBy": "user-123",
      "model": "gpt-4o-mini",
      "promptType": "POLICY_GENERATOR"
    },
    {
      "questionnaireId": "64a1b2c3d4e5f6789012350",
      "componentName": "ISQM 2 - Engagement Quality",
      "componentKey": "ISQM_2",
      "document": "# Engagement Quality Policy\n\n## 1. Policy Title and Purpose\n\nThis policy establishes the framework for engagement quality...",
      "pdfPath": "/temp/ISQM_2_policy_2024-01-15T10-30-00-000Z.pdf",
      "pdfFilename": "ISQM_2_policy_2024-01-15T10-30-00-000Z.pdf",
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "generatedBy": "user-123",
      "model": "gpt-4o-mini",
      "promptType": "POLICY_GENERATOR"
    }
  ],
  "procedures": [
    {
      "questionnaireId": "64a1b2c3d4e5f6789012349",
      "componentName": "ISQM 1 - Quality Management",
      "componentKey": "ISQM_1",
      "document": "# Quality Management Procedures\n\n## 1. Procedure Title\n\nQuality Management Implementation Procedures...",
      "pdfPath": "/temp/ISQM_1_procedure_2024-01-15T10-30-00-000Z.pdf",
      "pdfFilename": "ISQM_1_procedure_2024-01-15T10-30-00-000Z.pdf",
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "generatedBy": "user-123",
      "model": "gpt-4o-mini",
      "promptType": "PROCEDURE_GENERATOR"
    },
    {
      "questionnaireId": "64a1b2c3d4e5f6789012350",
      "componentName": "ISQM 2 - Engagement Quality",
      "componentKey": "ISQM_2",
      "document": "# Engagement Quality Procedures\n\n## 1. Procedure Title\n\nEngagement Quality Implementation Procedures...",
      "pdfPath": "/temp/ISQM_2_procedure_2024-01-15T10-30-00-000Z.pdf",
      "pdfFilename": "ISQM_2_procedure_2024-01-15T10-30-00-000Z.pdf",
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "generatedBy": "user-123",
      "model": "gpt-4o-mini",
      "promptType": "PROCEDURE_GENERATOR"
    }
  ],
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "user-123",
    "model": "gpt-4o-mini",
    "totalQuestionnaires": 2
  }
}
```

**Error Responses:**
- `404` - ISQM Parent not found
- `400` - No completed questionnaires found
- `500` - Failed to generate any documents

### 6. Get Available Generation Types
**GET** `/api/isqm/generation/types`

Retrieves available document generation types.

**Response:**
```json
{
  "success": true,
  "availableTypes": [
    {
      "type": "POLICY_GENERATOR",
      "description": "Generate formal quality management policies"
    },
    {
      "type": "PROCEDURE_GENERATOR",
      "description": "Generate detailed implementation procedures"
    },
    {
      "type": "RISK_ASSESSMENT_GENERATOR",
      "description": "Generate comprehensive risk assessments"
    },
    {
      "type": "COMPLIANCE_CHECKLIST_GENERATOR",
      "description": "Generate compliance checklists"
    }
  ]
}
```

## 🔧 AI Generation Features

### Document Types
- **Policy Documents** - Formal quality management policies
- **Procedure Documents** - Detailed implementation procedures
- **Risk Assessments** - Comprehensive risk analysis
- **Compliance Checklists** - Practical compliance tools

### AI Integration
- **OpenAI GPT-4o-mini** - Advanced language model for document generation
- **openai_pbc** - Uses dedicated OpenAI instance for ISQM generation
- **PDF Generation** - Automatically converts generated content to PDF format
- **Context-Aware** - Uses questionnaire responses and firm details
- **Professional Quality** - Generates audit-portal-ready documents
- **Customizable** - Firm-specific details and requirements

### Input Data Format
The system accepts ISQM questionnaire data in the following JSON structure:
```json
{
  "componentName": "Component Name",
  "questionnaire": {
    "key": "ISQM_1",
    "heading": "Component Heading",
    "sections": [
      {
        "heading": "Section Title",
        "qna": [
          {
            "question": "Question text",
            "answer": "Response text",
            "state": true/false
          }
        ]
      }
    ]
  },
  "firmDetails": {
    "size": "mid-sized",
    "jurisdiction": "UK",
    "specializations": ["audit", "tax", "advisory"]
  }
}
```

### Security & Access Control
- **Employee-only generation** - Only authenticated employees can generate documents
- **Role-based access** - `requireRole('employee')` for all generation endpoints
- **Audit logging** - All generation activities are logged
- **Data validation** - Input data is validated before processing

## 🔗 URL Management API

### 1. Add Procedure URL
**POST** `/api/isqm/questionnaires/:id/procedure-urls`

Adds a procedure document URL to a questionnaire.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "ISQM 1 Quality Management Procedures v2.0",
  "url": "https://supabase.com/storage/v1/object/public/procedures/isqm1_procedures_v2.pdf",
  "version": "2.0",
  "description": "Updated procedures for quality management implementation"
}
```

**Response:**
```json
{
  "success": true,
  "questionnaire": {
    "_id": "64a1b2c3d4e5f6789012349",
    "procedureUrls": [
      {
        "_id": "64a1b2c3d4e5f6789012351",
        "name": "ISQM 1 Quality Management Procedures v2.0",
        "url": "https://supabase.com/storage/v1/object/public/procedures/isqm1_procedures_v2.pdf",
        "version": "2.0",
        "uploadedBy": "user-123",
        "description": "Updated procedures for quality management implementation",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "message": "Procedure URL added successfully"
}
```

### 2. Add Policy URL
**POST** `/api/isqm/questionnaires/:id/policy-urls`

Adds a policy document URL to a questionnaire.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "ISQM 1 Quality Management Policy v1.5",
  "url": "https://supabase.com/storage/v1/object/public/policies/isqm1_policy_v1.5.pdf",
  "version": "1.5",
  "description": "Quality management policy document"
}
```

**Response:**
```json
{
  "success": true,
  "questionnaire": {
    "_id": "64a1b2c3d4e5f6789012349",
    "policyUrls": [
      {
        "_id": "64a1b2c3d4e5f6789012352",
        "name": "ISQM 1 Quality Management Policy v1.5",
        "url": "https://supabase.com/storage/v1/object/public/policies/isqm1_policy_v1.5.pdf",
        "version": "1.5",
        "uploadedBy": "user-123",
        "description": "Quality management policy document",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "message": "Policy URL added successfully"
}
```

### 3. Get Questionnaire URLs
**GET** `/api/isqm/questionnaires/:id/urls`

Retrieves all URLs associated with a questionnaire.

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "componentKey": "ISQM_1",
  "procedureUrls": [
    {
      "_id": "64a1b2c3d4e5f6789012351",
      "name": "ISQM 1 Quality Management Procedures v2.0",
      "url": "https://supabase.com/storage/v1/object/public/procedures/isqm1_procedures_v2.pdf",
      "version": "2.0",
      "uploadedBy": "user-123",
      "description": "Updated procedures for quality management implementation",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "policyUrls": [
    {
      "_id": "64a1b2c3d4e5f6789012352",
      "name": "ISQM 1 Quality Management Policy v1.5",
      "url": "https://supabase.com/storage/v1/object/public/policies/isqm1_policy_v1.5.pdf",
      "version": "1.5",
      "uploadedBy": "user-123",
      "description": "Quality management policy document",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "latestProcedure": {
    "_id": "64a1b2c3d4e5f6789012351",
    "name": "ISQM 1 Quality Management Procedures v2.0",
    "url": "https://supabase.com/storage/v1/object/public/procedures/isqm1_procedures_v2.pdf",
    "version": "2.0",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "latestPolicy": {
    "_id": "64a1b2c3d4e5f6789012352",
    "name": "ISQM 1 Quality Management Policy v1.5",
    "url": "https://supabase.com/storage/v1/object/public/policies/isqm1_policy_v1.5.pdf",
    "version": "1.5",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Remove Procedure URL
**DELETE** `/api/isqm/questionnaires/:id/procedure-urls/:urlId`

Removes a procedure URL from a questionnaire.

**Response:**
```json
{
  "success": true,
  "message": "Procedure URL removed successfully"
}
```

### 5. Remove Policy URL
**DELETE** `/api/isqm/questionnaires/:id/policy-urls/:urlId`

Removes a policy URL from a questionnaire.

**Response:**
```json
{
  "success": true,
  "message": "Policy URL removed successfully"
}
```

## 🏷️ Dynamic Tagging API

### 1. Get Questionnaire Tags
**GET** `/api/isqm/questionnaires/:id/tags`

Generates and retrieves dynamic tags for a questionnaire based on its key, heading, and other attributes.

**Response:**
```json
{
  "success": true,
  "questionnaireId": "64a1b2c3d4e5f6789012349",
  "componentName": "ISQM 1 - Quality Management",
  "componentKey": "ISQM_1",
  "generatedTags": [
    "ISQM_1",
    "ISQM",
    "ISQM_1",
    "quality",
    "management",
    "ifrs",
    "in-progress"
  ],
  "tagCount": 7
}
```

### 2. Get Questionnaires by Component Type
**GET** `/api/isqm/questionnaires/component/:componentType`

Retrieves all questionnaires for a specific component type (e.g., ISQM, ISA).

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "componentType": "ISQM",
  "questionnaires": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "status": "in-progress",
      "parent": {
        "_id": "64a1b2c3d4e5f6789012345",
        "metadata": {
          "title": "ISQM Quality Management Pack 2024"
        }
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### 3. Get Questionnaires by Tags
**GET** `/api/isqm/questionnaires/by-tags`

Retrieves questionnaires matching specific tags.

**Query Parameters:**
- `tags` (string): Comma-separated tags or array of tags
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Example:**
```
GET /api/isqm/questionnaires/by-tags?tags=ISQM,quality,management&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "tags": ["ISQM", "quality", "management"],
  "questionnaires": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "key": "ISQM_1",
      "heading": "ISQM 1 - Quality Management",
      "status": "in-progress",
      "parent": {
        "_id": "64a1b2c3d4e5f6789012345",
        "metadata": {
          "title": "ISQM Quality Management Pack 2024"
        }
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## 🔧 Enhanced Features

### Dynamic Tagging System
- **Automatic Tag Generation** - Creates tags based on component key, heading, framework, and status
- **Component-Based Tags** - Extracts ISQM, ISA, etc. from component keys
- **Heading-Based Tags** - Generates tags from questionnaire headings
- **Framework Tags** - Adds framework-specific tags (IFRS, GAPSME, etc.)
- **Status Tags** - Includes current status as tags

### URL Management
- **Version Control** - Track multiple versions of procedures and policies
- **Metadata Tracking** - Store upload details, descriptions, and timestamps
- **Latest Version Access** - Easy access to most recent documents
- **URL Organization** - Separate procedure and policy URL arrays
- **Employee Tracking** - Track who uploaded each document

### Advanced Querying
- **Component Type Filtering** - Find questionnaires by component type
- **Tag-Based Search** - Search using generated tags
- **Pagination Support** - Efficient handling of large result sets
- **Flexible Tag Input** - Support both comma-separated and array formats

### Security & Access Control
- **Employee-only URL management** - Only authenticated employees can manage URLs
- **Role-based access** - `requireRole('employee')` for URL operations
- **Audit logging** - All URL management activities are logged
- **Data validation** - Input data is validated before processing

The ISQM API provides comprehensive quality management questionnaire capabilities, supporting document management, AI-powered document generation, URL management, and dynamic tagging essential for audit compliance and quality assurance! 🎉
