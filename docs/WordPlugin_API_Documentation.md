# Word Plugin API Documentation

## Base URL
```
https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin
```

## Authentication

All endpoints require authentication using a Bearer token from Supabase. You must have access to the Supabase account and configure authentication settings there.

### Getting Your Bearer Token

1. Access your Supabase account (you should have been granted access to the developer account)
2. Configure authentication settings in the Supabase dashboard
3. Obtain your access token from Supabase Auth
4. Include the token in all API requests using the `Authorization` header:

```
Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN
```

### Required Role

All endpoints require the user to have the **"employee"** role. If your token doesn't have this role, requests will be rejected with a 403 Forbidden status.

---

## API Endpoints

### 1. Groups

Groups are collections that organize content blocks.

#### 1.1 Create Group
**POST** `/group`

**Request Body:**
```typescript
{
  groupName: string;      // Required - Name of the group
  updatedBy?: string;     // Optional - User ID (defaults to authenticated user)
  description?: string;   // Optional - Group description
}
```

**Response (201):**
```typescript
{
  success: true;
  data: {
    _id: string;
    groupName: string;
    updatedBy: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X POST https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Client Information",
    "description": "Template blocks for client details"
  }'
```

---

#### 1.2 Get Groups
**GET** `/group`

**Query Parameters:**
- `userId` (optional): Filter groups by user ID
- `search` (optional): Search groups by name (case-insensitive)

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    groupName: string;
    updatedBy: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET "https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group?userId=user123&search=client" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 1.3 Get Groups by User
**GET** `/group/user/:userId`

**Path Parameters:**
- `userId` (required): User ID to filter groups

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    groupName: string;
    updatedBy: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/user/user123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 1.4 Update Group
**PUT** `/group/:groupId`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the group

**Request Body:**
```typescript
{
  groupName?: string;
  updatedBy?: string;
  description?: string;
}
```

**Response (200):**
```typescript
{
  success: true;
  data: {
    _id: string;
    groupName: string;
    updatedBy: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X PUT https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Updated Group Name",
    "description": "Updated description"
  }'
```

---

#### 1.5 Delete Group
**DELETE** `/group/:groupId`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the group

**Note:** This will also delete all group contents associated with this group.

**Response (200):**
```typescript
{
  success: true;
  message: "Group removed";
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 1.6 Bulk Update Groups
**PUT** `/group/bulk`

**Request Body:**
```typescript
Array<{
  _id: string;            // Required - Group MongoDB ObjectId
  groupName?: string;
  updatedBy?: string;
  description?: string;
}>
```

**Response (200):**
```typescript
{
  success: true;
  data: Array<{
    _id: string;
    groupName: string;
    updatedBy: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X PUT https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "_id": "507f1f77bcf86cd799439011",
      "groupName": "Updated Group 1"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "groupName": "Updated Group 2"
    }
  ]'
```

---

#### 1.7 Bulk Delete Groups
**DELETE** `/group/bulk`

**Request Body:**
```typescript
{
  ids: string[];  // Array of MongoDB ObjectIds
}
```

**Response (200):**
```typescript
{
  success: true;
  deletedCount: number;
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
  }'
```

---

### 2. Group Content

Group content represents individual content blocks within a group.

#### 2.1 Create Group Content
**POST** `/group/:groupId/group-content`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group

**Request Body:**
```typescript
{
  contentText: string;    // Required - The content block text
  createdBy?: string;     // Optional - User ID (defaults to authenticated user)
  metadata?: any;         // Optional - Additional metadata object
}
```

**Response (201):**
```typescript
{
  success: true;
  data: {
    _id: string;
    groupId: string;
    contentText: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X POST https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentText": "This is a sample content block for the group",
    "metadata": {
      "tags": ["intro", "client-info"]
    }
  }'
```

---

#### 2.2 Get Group Contents
**GET** `/group/:groupId/group-content`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    groupId: string;
    contentText: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 2.3 Update Group Content
**PUT** `/group/:groupId/group-content/:contentId`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group
- `contentId` (required): MongoDB ObjectId of the content

**Request Body:**
```typescript
{
  contentText?: string;
  createdBy?: string;
  metadata?: any;
}
```

**Response (200):**
```typescript
{
  success: true;
  data: {
    _id: string;
    groupId: string;
    contentText: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X PUT https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content/507f1f77bcf86cd799439013 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentText": "Updated content text"
  }'
```

---

#### 2.4 Delete Group Content
**DELETE** `/group/:groupId/group-content/:contentId`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group
- `contentId` (required): MongoDB ObjectId of the content

**Response (200):**
```typescript
{
  success: true;
  message: "Content removed";
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content/507f1f77bcf86cd799439013 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 2.5 Bulk Update Group Contents
**PUT** `/group/:groupId/group-content/bulk`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group

**Request Body:**
```typescript
Array<{
  _id: string;            // Required - Content MongoDB ObjectId
  contentText?: string;
  createdBy?: string;
  metadata?: any;
}>
```

**Response (200):**
```typescript
{
  success: true;
  data: Array<{
    _id: string;
    groupId: string;
    contentText: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X PUT https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "_id": "507f1f77bcf86cd799439013",
      "contentText": "Updated content 1"
    },
    {
      "_id": "507f1f77bcf86cd799439014",
      "contentText": "Updated content 2"
    }
  ]'
```

---

#### 2.6 Bulk Delete Group Contents
**DELETE** `/group/:groupId/group-content/bulk`

**Path Parameters:**
- `groupId` (required): MongoDB ObjectId of the parent group

**Request Body:**
```typescript
{
  ids: string[];  // Array of MongoDB ObjectIds
}
```

**Response (200):**
```typescript
{
  success: true;
  deletedCount: number;
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/group/507f1f77bcf86cd799439011/group-content/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
  }'
```

---

### 3. Drafts

Drafts represent document drafts associated with engagements.

#### 3.1 Get Drafts by Engagement
**GET** `/drafts?engagementId={engagementId}`

**Query Parameters:**
- `engagementId` (required): Number - Engagement ID

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    draftId: number;
    engagementId: number;
    draftName: string;
    createdDate: string;
    createdBy?: string;
    metadata?: any;
    templateId?: number;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET "https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/drafts?engagementId=12345" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 3.2 Get Draft by Draft ID
**GET** `/drafts/:draftId`

**Path Parameters:**
- `draftId` (required): Number - Draft ID

**Response (200):**
```typescript
{
  success: true;
  data: {
    _id: string;
    draftId: number;
    engagementId: number;
    draftName: string;
    createdDate: string;
    createdBy?: string;
    metadata?: any;
    templateId?: number;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X GET https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/drafts/12345 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 3.3 Delete Draft
**DELETE** `/drafts/:draftId`

**Path Parameters:**
- `draftId` (required): Number - Draft ID

**Response (200):**
```typescript
{
  success: true;
  message: "Draft removed";
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/drafts/12345 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Templates

Templates are Word document templates associated with drafts.

#### 4.1 Get Template by Draft ID
**GET** `/draft/:draftId/template`

**Path Parameters:**
- `draftId` (required): Number - Draft ID

**Response (200):**
```typescript
{
  success: true;
  data: {
    _id: string;
    templateId: number;
    templateName: string;
    file: {
      originalName: string;
      mimeType: string;
      size: number;
      url?: string;
    };
    fileUrl?: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X GET https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/draft/12345/template \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 4.2 Download Template
**GET** `/draft/:draftId/template/download`

**Path Parameters:**
- `draftId` (required): Number - Draft ID

**Response (200):**
```typescript
{
  success: true;
  data: {
    templateId: number;
    templateName: string;
    file: {
      originalName: string;
      mimeType: string;
      size: number;
      url?: string;
    };
    fileUrl?: string;
  }
}
```

**Example:**
```bash
curl -X GET https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/draft/12345/template/download \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 4.3 Upload Template for Draft
**POST** `/draft/:draftId/template`

**Path Parameters:**
- `draftId` (required): Number - Draft ID

**Request Body:**
```typescript
{
  templateId: number;           // Required - Unique template identifier
  templateName: string;         // Required - Filename or display name
  file: {                       // Required - File object
    originalName: string;
    mimeType: string;
    size: number;
    url?: string;
  };
  fileUrl?: string;             // Optional - Stored path or downloadable URL
  userId?: string;              // Optional - Owner ID (defaults to authenticated user)
}
```

**Response (201):**
```typescript
{
  success: true;
  data: {
    _id: string;
    templateId: number;
    templateName: string;
    file: {
      originalName: string;
      mimeType: string;
      size: number;
      url?: string;
    };
    fileUrl?: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X POST https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/draft/12345/template \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": 1001,
    "templateName": "Engagement_Letter_v1.docx",
    "file": {
      "originalName": "Engagement_Letter_v1.docx",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 45678
    },
    "fileUrl": "https://storage.example.com/templates/engagement_letter_v1.docx"
  }'
```

---

#### 4.4 Get All Templates
**GET** `/draft/templates`

**Query Parameters:**
- `userId` (optional): Filter templates by user ID

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    templateId: number;
    templateName: string;
    file: {
      originalName: string;
      mimeType: string;
      size: number;
      url?: string;
    };
    fileUrl?: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET "https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/draft/templates?userId=user123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Variables

Custom variables are key-value pairs that can be used in templates.

#### 5.1 Create Custom Variable
**POST** `/variable/custom`

**Request Body:**
```typescript
{
  variableName: string;   // Required - Variable name
  variableValue: string;  // Required - Variable value
  userId?: string;        // Optional - Owner ID (defaults to authenticated user)
}
```

**Response (201):**
```typescript
{
  success: true;
  data: {
    _id: string;
    variableName: string;
    variableValue: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X POST https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/variable/custom \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variableName": "clientName",
    "variableValue": "ABC Corporation"
  }'
```

---

#### 5.2 Get Custom Variables
**GET** `/variable/custom`

**Query Parameters:**
- `userId` (optional): Filter variables by user ID

**Response (200):**
```typescript
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    variableName: string;
    variableValue: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }>
}
```

**Example:**
```bash
curl -X GET "https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/variable/custom?userId=user123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### 5.3 Update Custom Variable
**PUT** `/variable/custom`

**Request Body:**
```typescript
{
  _id: string;            // Required - MongoDB ObjectId of the variable
  variableName?: string;
  variableValue?: string;
  userId?: string;
}
```

**Response (200):**
```typescript
{
  success: true;
  data: {
    _id: string;
    variableName: string;
    variableValue: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Example:**
```bash
curl -X PUT https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/variable/custom \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "507f1f77bcf86cd799439015",
    "variableValue": "Updated Corporation"
  }'
```

---

#### 5.4 Delete Variable
**DELETE** `/variable/:id`

**Path Parameters:**
- `id` (required): MongoDB ObjectId of the variable

**Response (200):**
```typescript
{
  success: true;
  message: "Variable removed";
}
```

**Example:**
```bash
curl -X DELETE https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/variable/507f1f77bcf86cd799439015 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 6. Engagements

#### 6.1 Get Engagements
**GET** `/engagements`

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page
- `clientId` (optional): Filter engagements by client ID

**Response (200):**
```typescript
{
  success: true;
  data: Array<{
    _id: string;                    // MongoDB ObjectId
    excelURL?: string;              // Optional - Excel file URL
    clientId: string;               // Required - Client identifier
    organizationId: string;         // Required - Organization identifier
    companyId: string;              // Required - Company MongoDB ObjectId (reference to Company)
    title: string;                  // Required - Engagement title
    yearEndDate: string;            // Required - ISO date string (YYYY-MM-DD)
    status: "draft" | "active" | "completed";  // Enum - Engagement status (default: "draft")
    trialBalanceUrl?: string;       // Optional - Trial balance file URL (default: "")
    trialBalance?: string;          // Optional - TrialBalance MongoDB ObjectId (reference)
    assignedAuditors: Array<{       // Array of assigned auditors
      auditorId: string;            // Required - Auditor user ID
      assignedAt: string;           // ISO date string (default: current date)
      assignedBy: string;           // Required - User ID who assigned the auditor
    }>;
    createdAt: string;              // ISO date string (default: current date)
    createdBy: string;              // Required - User ID who created the engagement
  }>;
  total: number;                    // Total number of engagements (may not be included if not calculated)
  page: number;                     // Current page number
  limit: number;                    // Number of items per page
}
```

**Example:**
```bash
curl -X GET "https://a4-malta-audit-backend-yisl.onrender.com/api/word-plugin/engagements?page=1&limit=10&clientId=client123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "excelURL": "https://storage.example.com/excel/engagement1.xlsx",
      "clientId": "client123",
      "organizationId": "org456",
      "companyId": "507f1f77bcf86cd799439012",
      "title": "Annual Audit 2024",
      "yearEndDate": "2024-12-31T00:00:00.000Z",
      "status": "active",
      "trialBalanceUrl": "https://storage.example.com/trial-balance.xlsx",
      "trialBalance": "507f1f77bcf86cd799439013",
      "assignedAuditors": [
        {
          "auditorId": "user789",
          "assignedAt": "2024-01-15T10:30:00.000Z",
          "assignedBy": "user456"
        }
      ],
      "createdAt": "2024-01-01T08:00:00.000Z",
      "createdBy": "user456"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request:**
```typescript
{
  success: false;
  message: string;  // Error description
}
```

**401 Unauthorized:**
```json
{
  "message": "Missing or malformed Authorization header"
}
```
or
```json
{
  "message": "Invalid or expired token"
}
```

**403 Forbidden:**
```json
{
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```typescript
{
  success: false;
  message: string;  // Resource not found description
}
```

**500 Internal Server Error:**
```json
{
  "message": "Internal server error"
}
```

---

## Notes

1. **Authentication**: All endpoints require a valid Bearer token with the "employee" role. Make sure your Supabase account has authentication configured and you're using the correct token.

2. **ObjectIds**: Many endpoints use MongoDB ObjectIds. These are 24-character hexadecimal strings.

3. **Timestamps**: All models include `createdAt` and `updatedAt` timestamps that are automatically managed.

4. **Bulk Operations**: When performing bulk operations, ensure all IDs are valid MongoDB ObjectIds or numbers (for draftId/templateId).

5. **File Uploads**: For template file uploads, the file data should be included in the request body as structured JSON. Actual file uploads may require multipart/form-data in production.

6. **Pagination**: The engagements endpoint supports pagination using `page` and `limit` query parameters.

---

