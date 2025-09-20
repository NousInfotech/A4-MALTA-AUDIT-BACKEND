# ClassificationEvidence API Documentation

## Overview
The ClassificationEvidence API provides endpoints for managing evidence files and comments associated with classification sections in the audit system. Evidence can be uploaded and commented on by authorized users.

## Base URL
```
/api/classification-evidence
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## Authorization
- **Allowed Roles**: `employee`, `reviewer`, `partner`, `admin`, `senior-employee`
- **Excluded Role**: `user`

---

## Endpoints

### 1. Create Classification Evidence

**POST** `/api/classification-evidence`

Creates a new classification evidence record.

#### Request Body
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "classificationId": "64a1b2c3d4e5f6789012346",
  "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf"
}
```

#### Required Fields
- `engagementId`: MongoDB ObjectId of the engagement
- `classificationId`: MongoDB ObjectId of the classification section
- `evidenceUrl`: URL to the evidence file

#### Response
```json
{
  "message": "Evidence created successfully",
  "evidence": {
    "_id": "64a1b2c3d4e5f6789012347",
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "uploadedBy": {
      "userId": "64a1b2c3d4e5f6789012348",
      "name": "Jane Smith",
      "email": "jane.smith@company.com",
      "role": "employee"
    },
    "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf",
    "evidenceComments": [],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Status Codes
- `201`: Evidence created successfully
- `400`: Invalid request data
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 2. Get All Evidence

**GET** `/api/classification-evidence`

Retrieves all classification evidence with optional filtering.

#### Query Parameters
- `engagementId` (optional): Filter by engagement ID
- `classificationId` (optional): Filter by classification ID

#### Example Request
```
GET /api/classification-evidence?engagementId=64a1b2c3d4e5f6789012345&classificationId=64a1b2c3d4e5f6789012346
```

#### Response
```json
{
  "message": "Evidence retrieved successfully",
  "evidence": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "engagementId": "64a1b2c3d4e5f6789012345",
      "classificationId": {
        "_id": "64a1b2c3d4e5f6789012346",
        "classification": "cash",
        "status": "ready-for-review"
      },
      "uploadedBy": {
        "userId": "64a1b2c3d4e5f6789012348",
        "name": "Jane Smith",
        "email": "jane.smith@company.com",
        "role": "employee"
      },
      "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf",
      "evidenceComments": [
        {
          "commentor": {
            "userId": "64a1b2c3d4e5f6789012349",
            "name": "John Reviewer",
            "email": "john.reviewer@company.com"
          },
          "comment": "Evidence looks good, approved",
          "timestamp": "2024-01-15T11:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

#### Status Codes
- `200`: Evidence retrieved successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 3. Get Evidence by Classification

**GET** `/api/classification-evidence/classification/:classificationId`

Retrieves all evidence for a specific classification section.

#### Path Parameters
- `classificationId`: MongoDB ObjectId of the classification section

#### Example Request
```
GET /api/classification-evidence/classification/64a1b2c3d4e5f6789012346
```

#### Response
```json
{
  "message": "Evidence retrieved successfully",
  "evidence": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "engagementId": "64a1b2c3d4e5f6789012345",
      "classificationId": {
        "_id": "64a1b2c3d4e5f6789012346",
        "classification": "cash",
        "status": "ready-for-review"
      },
      "uploadedBy": {
        "userId": "64a1b2c3d4e5f6789012348",
        "name": "Jane Smith",
        "email": "jane.smith@company.com",
        "role": "employee"
      },
      "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf",
      "evidenceComments": [
        {
          "commentor": {
            "userId": "64a1b2c3d4e5f6789012349",
            "name": "John Reviewer",
            "email": "john.reviewer@company.com"
          },
          "comment": "Evidence looks good, approved",
          "timestamp": "2024-01-15T11:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

#### Status Codes
- `200`: Evidence retrieved successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 4. Add Comment to Evidence

**POST** `/api/classification-evidence/:evidenceId/comments`

Adds a comment to existing evidence.

#### Path Parameters
- `evidenceId`: MongoDB ObjectId of the evidence

#### Request Body
```json
{
  "comment": "This evidence supports the cash classification. All bank statements are included."
}
```

#### Required Fields
- `comment`: Comment text

#### Response
```json
{
  "message": "Comment added successfully",
  "evidence": {
    "_id": "64a1b2c3d4e5f6789012347",
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "uploadedBy": {
      "userId": "64a1b2c3d4e5f6789012348",
      "name": "Jane Smith",
      "email": "jane.smith@company.com",
      "role": "employee"
    },
    "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf",
    "evidenceComments": [
      {
        "commentor": {
          "userId": "64a1b2c3d4e5f6789012349",
          "name": "John Reviewer",
          "email": "john.reviewer@company.com"
        },
        "comment": "This evidence supports the cash classification. All bank statements are included.",
        "timestamp": "2024-01-15T11:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:30:00.000Z"
  }
}
```

#### Status Codes
- `200`: Comment added successfully
- `400`: Invalid request data
- `401`: Unauthorized
- `403`: Insufficient permissions
- `404`: Evidence not found
- `500`: Server error

---

### 5. Update Evidence URL

**PATCH** `/api/classification-evidence/:evidenceId/url`

Updates the URL of existing evidence.

#### Path Parameters
- `evidenceId`: MongoDB ObjectId of the evidence

#### Request Body
```json
{
  "evidenceUrl": "https://storage.example.com/evidence/updated-cash-evidence-2024.pdf"
}
```

#### Required Fields
- `evidenceUrl`: New URL for the evidence file

#### Response
```json
{
  "message": "Evidence URL updated successfully",
  "evidence": {
    "_id": "64a1b2c3d4e5f6789012347",
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "uploadedBy": {
      "userId": "64a1b2c3d4e5f6789012348",
      "name": "Jane Smith",
      "email": "jane.smith@company.com",
      "role": "employee"
    },
    "evidenceUrl": "https://storage.example.com/evidence/updated-cash-evidence-2024.pdf",
    "evidenceComments": [
      {
        "commentor": {
          "userId": "64a1b2c3d4e5f6789012349",
          "name": "John Reviewer",
          "email": "john.reviewer@company.com"
        },
        "comment": "This evidence supports the cash classification. All bank statements are included.",
        "timestamp": "2024-01-15T11:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z"
  }
}
```

#### Status Codes
- `200`: URL updated successfully
- `400`: Invalid request data
- `401`: Unauthorized
- `403`: Insufficient permissions
- `404`: Evidence not found
- `500`: Server error

---

### 6. Delete Evidence

**DELETE** `/api/classification-evidence/:evidenceId`

Deletes classification evidence and all associated comments.

#### Path Parameters
- `evidenceId`: MongoDB ObjectId of the evidence

#### Example Request
```
DELETE /api/classification-evidence/64a1b2c3d4e5f6789012347
```

#### Response
```json
{
  "message": "Evidence deleted successfully"
}
```

#### Status Codes
- `200`: Evidence deleted successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `404`: Evidence not found
- `500`: Server error

---

## Data Models

### ClassificationEvidence Schema
```javascript
{
  engagementId: ObjectId, // Reference to Engagement
  classificationId: ObjectId, // Reference to ClassificationSection
  uploadedBy: {
    userId: String, // Supabase user ID
    name: String,
    email: String,
    role: String
  },
  evidenceUrl: String,
  evidenceComments: [
    {
      commentor: {
        userId: String, // Supabase user ID
        name: String,
        email: String
      },
      comment: String,
      timestamp: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Responses

### Common Error Format
```json
{
  "error": "Error message description"
}
```

### Error Codes
- `400 Bad Request`: Invalid request data or parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions for the operation
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

---

## Usage Examples

### Creating Evidence
```bash
curl -X POST /api/classification-evidence \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "evidenceUrl": "https://storage.example.com/evidence/cash-evidence-2024.pdf"
  }'
```

### Adding Comment to Evidence
```bash
curl -X POST /api/classification-evidence/64a1b2c3d4e5f6789012347/comments \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Evidence reviewed and approved by senior auditor"
  }'
```

### Updating Evidence URL
```bash
curl -X PATCH /api/classification-evidence/64a1b2c3d4e5f6789012347/url \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceUrl": "https://storage.example.com/evidence/updated-cash-evidence-2024.pdf"
  }'
```

### Getting Evidence by Classification
```bash
curl -X GET /api/classification-evidence/classification/64a1b2c3d4e5f6789012346 \
  -H "Authorization: Bearer your-token-here"
```

### Filtering Evidence by Engagement
```bash
curl -X GET "/api/classification-evidence?engagementId=64a1b2c3d4e5f6789012345" \
  -H "Authorization: Bearer your-token-here"
```

---

## Integration Notes

### File Upload Considerations
- The API accepts evidence URLs, not direct file uploads
- File upload should be handled by a separate service (e.g., AWS S3, Google Cloud Storage)
- The evidence URL should be accessible to authorized users
- Consider implementing file type validation and size limits in your upload service

### Comment System
- Comments are stored as an array within the evidence document
- Each comment includes the commentor's details and timestamp
- Comments cannot be edited or deleted individually
- Consider implementing comment threading if needed

### Performance Considerations
- For large numbers of evidence files, consider implementing pagination
- Index the `engagementId` and `classificationId` fields for better query performance
- Consider implementing caching for frequently accessed evidence

### Security Considerations
- Ensure evidence URLs are properly secured and accessible only to authorized users
- Validate file types and scan uploaded files for malware
- Implement proper access controls for evidence files
- Consider implementing audit trails for evidence access
