# ClassificationReview API Documentation

## Overview
The ClassificationReview API provides endpoints for managing classification reviews in the audit system. Reviews track the status and comments for classification sections during the audit process.

## Base URL
```
/api/classification-reviews
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header.

## Authorization
- **Allowed Roles**: `employee`, `reviewer`, `partner`, `admin`, `senior-employee`
- **Excluded Role**: `user`

---

## Endpoints

### 1. Create Classification Review

**POST** `/api/classification-reviews`

Creates a new classification review.

#### Request Body
```json
{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "classificationId": "64a1b2c3d4e5f6789012346",
  "comment": "Initial review of cash classification",
  "location": "Malta Office",
  "ipAddress": "192.168.1.100",
  "sessionId": "sess_abc123",
  "systemVersion": "v1.2.3"
}
```

#### Required Fields
- `engagementId`: MongoDB ObjectId of the engagement
- `classificationId`: MongoDB ObjectId of the classification section
- `comment`: Review comment text

#### Optional Fields
- `location`: Physical location where review was conducted
- `ipAddress`: IP address of the reviewer
- `sessionId`: Session identifier
- `systemVersion`: Version of the system used

#### Response
```json
{
  "message": "Review created successfully",
  "review": {
    "_id": "64a1b2c3d4e5f6789012347",
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "reviewedBy": {
      "userId": "64a1b2c3d4e5f6789012348",
      "name": "John Smith",
      "email": "john.smith@company.com",
      "role": "senior-employee"
    },
    "comment": "Initial review of cash classification",
    "status": "pending",
    "reviewedOn": "2024-01-15T10:30:00.000Z",
    "location": "Malta Office",
    "ipAddress": "192.168.1.100",
    "sessionId": "sess_abc123",
    "systemVersion": "v1.2.3",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Status Codes
- `201`: Review created successfully
- `400`: Invalid request data
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 2. Get All Reviews

**GET** `/api/classification-reviews`

Retrieves all classification reviews with optional filtering.

#### Query Parameters
- `engagementId` (optional): Filter by engagement ID
- `status` (optional): Filter by status (`pending`, `in-review`, `signed-off`)

#### Example Request
```
GET /api/classification-reviews?engagementId=64a1b2c3d4e5f6789012345&status=pending
```

#### Response
```json
{
  "message": "Reviews retrieved successfully",
  "reviews": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "engagementId": "64a1b2c3d4e5f6789012345",
      "classificationId": {
        "_id": "64a1b2c3d4e5f6789012346",
        "classification": "cash",
        "status": "ready-for-review"
      },
      "reviewedBy": {
        "userId": "64a1b2c3d4e5f6789012348",
        "name": "John Smith",
        "email": "john.smith@company.com",
        "role": "senior-employee"
      },
      "comment": "Initial review of cash classification",
      "status": "pending",
      "reviewedOn": "2024-01-15T10:30:00.000Z",
      "location": "Malta Office",
      "ipAddress": "192.168.1.100",
      "sessionId": "sess_abc123",
      "systemVersion": "v1.2.3",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Status Codes
- `200`: Reviews retrieved successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 3. Get Reviews by Classification

**GET** `/api/classification-reviews/classification/:classificationId`

Retrieves all reviews for a specific classification section.

#### Path Parameters
- `classificationId`: MongoDB ObjectId of the classification section

#### Example Request
```
GET /api/classification-reviews/classification/64a1b2c3d4e5f6789012346
```

#### Response
```json
{
  "message": "Reviews retrieved successfully",
  "reviews": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "engagementId": "64a1b2c3d4e5f6789012345",
      "classificationId": {
        "_id": "64a1b2c3d4e5f6789012346",
        "classification": "cash",
        "status": "ready-for-review"
      },
      "reviewedBy": {
        "userId": "64a1b2c3d4e5f6789012348",
        "name": "John Smith",
        "email": "john.smith@company.com",
        "role": "senior-employee"
      },
      "comment": "Initial review of cash classification",
      "status": "pending",
      "reviewedOn": "2024-01-15T10:30:00.000Z",
      "location": "Malta Office",
      "ipAddress": "192.168.1.100",
      "sessionId": "sess_abc123",
      "systemVersion": "v1.2.3",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Status Codes
- `200`: Reviews retrieved successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `500`: Server error

---

### 4. Update Review Status

**PATCH** `/api/classification-reviews/:reviewId/status`

Updates the status of a classification review.

#### Path Parameters
- `reviewId`: MongoDB ObjectId of the review

#### Request Body
```json
{
  "status": "in-review"
}
```

#### Valid Status Values
- `pending`: Review is pending
- `in-review`: Review is currently being reviewed
- `signed-off`: Review has been signed off

#### Response
```json
{
  "message": "Review status updated successfully",
  "review": {
    "_id": "64a1b2c3d4e5f6789012347",
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "reviewedBy": {
      "userId": "64a1b2c3d4e5f6789012348",
      "name": "John Smith",
      "email": "john.smith@company.com",
      "role": "senior-employee"
    },
    "comment": "Initial review of cash classification",
    "status": "in-review",
    "reviewedOn": "2024-01-15T11:00:00.000Z",
    "location": "Malta Office",
    "ipAddress": "192.168.1.100",
    "sessionId": "sess_abc123",
    "systemVersion": "v1.2.3",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

#### Status Codes
- `200`: Status updated successfully
- `400`: Invalid status value
- `401`: Unauthorized
- `403`: Insufficient permissions
- `404`: Review not found
- `500`: Server error

---

### 5. Delete Review

**DELETE** `/api/classification-reviews/:reviewId`

Deletes a classification review.

#### Path Parameters
- `reviewId`: MongoDB ObjectId of the review

#### Example Request
```
DELETE /api/classification-reviews/64a1b2c3d4e5f6789012347
```

#### Response
```json
{
  "message": "Review deleted successfully"
}
```

#### Status Codes
- `200`: Review deleted successfully
- `401`: Unauthorized
- `403`: Insufficient permissions
- `404`: Review not found
- `500`: Server error

---

## Data Models

### ClassificationReview Schema
```javascript
{
  engagementId: ObjectId, // Reference to Engagement
  classificationId: ObjectId, // Reference to ClassificationSection
  reviewedBy: {
    userId: String, // Supabase user ID
    name: String,
    email: String,
    role: String
  },
  comment: String,
  status: String, // "pending", "in-review", "signed-off"
  reviewedOn: Date,
  location: String,
  ipAddress: String,
  sessionId: String,
  systemVersion: String,
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

### Creating a Review
```bash
curl -X POST /api/classification-reviews \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "engagementId": "64a1b2c3d4e5f6789012345",
    "classificationId": "64a1b2c3d4e5f6789012346",
    "comment": "Review completed for cash classification",
    "location": "Malta Office"
  }'
```

### Updating Review Status
```bash
curl -X PATCH /api/classification-reviews/64a1b2c3d4e5f6789012347/status \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "signed-off"
  }'
```

### Getting Reviews by Classification
```bash
curl -X GET /api/classification-reviews/classification/64a1b2c3d4e5f6789012346 \
  -H "Authorization: Bearer your-token-here"
```
