# Analytical Review API Documentation

## Overview
The Analytical Review module allows auditors to create, manage, and version analytical reviews for engagements. Each engagement can have one analytical review with embedded version history.

---

## Models

### AnalyticalReview
```javascript
{
  _id: ObjectId,
  engagement: ObjectId (ref: 'Engagement', unique),
  auditorId: String,
  clientId: String,
  
  // Current data
  ratios: Map<String, Mixed>,
  commentary: String,
  conclusions: String,
  keyFindings: [String],
  riskAssessment: Enum ['low', 'medium', 'high', 'critical', ''],
  
  // Status
  status: Enum ['draft', 'in-progress', 'submitted', 'reviewed', 'approved', 'rejected'],
  
  // Version tracking
  currentVersion: Number,
  versions: [VersionSchema],
  
  // Metadata
  lastEditedBy: String,
  lastEditedAt: Date,
  
  // Review tracking
  submittedAt: Date,
  submittedBy: String,
  reviewedAt: Date,
  reviewedBy: String,
  reviewComments: String,
  approvedAt: Date,
  approvedBy: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Version Schema (Embedded)
```javascript
{
  versionNumber: Number,
  data: {
    ratios: Map<String, Mixed>,
    commentary: String,
    conclusions: String,
    keyFindings: [String],
    riskAssessment: String
  },
  editedBy: String,
  editedAt: Date,
  changeNote: String,
  ipAddress: String
}
```

---

## API Routes

### 🔷 Module-Based Routes (Prefix: `/api/analytical-review`)

#### 1. Get All Analytical Reviews
```http
GET /api/analytical-review
Authorization: Bearer <token>
Roles: employee, admin
```

**Query Parameters:**
- `status` (optional): Filter by status
- `auditorId` (optional): Filter by auditor
- `clientId` (optional): Filter by client

**Response:**
```json
{
  "message": "Analytical reviews retrieved successfully",
  "count": 5,
  "data": [...]
}
```

---

#### 2. Get Analytical Review by ID
```http
GET /api/analytical-review/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Analytical review retrieved successfully",
  "data": {
    "_id": "...",
    "engagement": {...},
    "ratios": {...},
    "status": "approved",
    ...
  }
}
```

---

#### 3. Get by Engagement ID
```http
GET /api/analytical-review/engagement/:engagementId
Authorization: Bearer <token>
```

---

#### 4. Get by Auditor
```http
GET /api/analytical-review/auditor/:auditorId
Authorization: Bearer <token>
Roles: employee, admin
```

**Query Parameters:**
- `status` (optional): Filter by status

---

#### 5. Get by Client
```http
GET /api/analytical-review/client/:clientId
Authorization: Bearer <token>
```

---

#### 6. Update Analytical Review
```http
PUT /api/analytical-review/:id
Authorization: Bearer <token>
Roles: employee, admin
Content-Type: application/json
```

**Request Body:**
```json
{
  "ratios": {
    "currentRatio": { "currentYear": 2.5, "priorYear": 2.1, "variance": 0.4 },
    "debtToEquity": { "currentYear": 1.2, "priorYear": 1.5, "variance": -0.3 }
  },
  "commentary": "Current ratio improved due to...",
  "conclusions": "Overall financial position strengthened",
  "keyFindings": [
    "Liquidity improved by 19%",
    "Debt levels reduced"
  ],
  "riskAssessment": "low",
  "changeNote": "Updated ratios with Q4 data"
}
```

**Response:**
```json
{
  "message": "Analytical review updated successfully",
  "data": {
    "currentVersion": 3,
    "versions": [2 versions saved],
    ...
  }
}
```

---

#### 7. Delete Analytical Review
```http
DELETE /api/analytical-review/:id
Authorization: Bearer <token>
Roles: employee, admin
```

---

### 📋 Version Management Routes

#### 8. Get All Versions
```http
GET /api/analytical-review/:id/versions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Versions retrieved successfully",
  "data": {
    "currentVersion": 3,
    "totalVersions": 2,
    "versions": [
      {
        "versionNumber": 2,
        "data": {...},
        "editedBy": "user-id",
        "editedAt": "2025-10-15T10:00:00Z",
        "changeNote": "Updated ratios"
      },
      {
        "versionNumber": 1,
        "data": {...},
        "editedBy": "user-id",
        "editedAt": "2025-10-14T09:00:00Z",
        "changeNote": "Initial version"
      }
    ]
  }
}
```

---

#### 9. Get Specific Version
```http
GET /api/analytical-review/:id/versions/:versionNumber
Authorization: Bearer <token>
```

---

#### 10. Restore to Version
```http
POST /api/analytical-review/:id/versions/:versionNumber/restore
Authorization: Bearer <token>
Roles: employee, admin
Content-Type: application/json
```

**Request Body:**
```json
{
  "changeNote": "Restored to version 2 due to error in v3"
}
```

---

### 🔄 Workflow Routes

#### 11. Submit for Review
```http
POST /api/analytical-review/:id/submit
Authorization: Bearer <token>
Roles: employee, admin
```

**Response:**
```json
{
  "message": "Analytical review submitted for review",
  "data": {
    "status": "submitted",
    "submittedAt": "2025-10-15T12:00:00Z",
    "submittedBy": "user-id"
  }
}
```

---

#### 12. Approve Review
```http
POST /api/analytical-review/:id/approve
Authorization: Bearer <token>
Roles: employee, admin
Content-Type: application/json
```

**Request Body:**
```json
{
  "comments": "Review approved. All ratios properly analyzed."
}
```

---

#### 13. Reject Review
```http
POST /api/analytical-review/:id/reject
Authorization: Bearer <token>
Roles: employee, admin
Content-Type: application/json
```

**Request Body:**
```json
{
  "comments": "Please provide more detailed analysis on current ratio variance."
}
```

---

#### 14. Update Status
```http
PATCH /api/analytical-review/:id/status
Authorization: Bearer <token>
Roles: employee, admin
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "in-progress"
}
```

**Valid Statuses:**
- `draft`
- `in-progress`
- `submitted`
- `reviewed`
- `approved`
- `rejected`

---

## 🔷 Engagement-Nested Routes (Prefix: `/api/engagements/:id`)

All the same functionality is available through engagement-nested routes:

### CRUD Operations
```http
POST   /api/engagements/:id/analytical-review
GET    /api/engagements/:id/analytical-review
PUT    /api/engagements/:id/analytical-review
DELETE /api/engagements/:id/analytical-review
```

### Version Management
```http
GET  /api/engagements/:id/analytical-review/versions
GET  /api/engagements/:id/analytical-review/versions/:versionNumber
POST /api/engagements/:id/analytical-review/versions/:versionNumber/restore
```

### Workflow
```http
POST  /api/engagements/:id/analytical-review/submit
POST  /api/engagements/:id/analytical-review/approve
POST  /api/engagements/:id/analytical-review/reject
PATCH /api/engagements/:id/analytical-review/status
```

---

## Usage Examples

### 1. Create Analytical Review for Engagement
```javascript
// POST /api/engagements/67890abc/analytical-review
const response = await fetch('/api/engagements/67890abc/analytical-review', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ratios: {
      currentRatio: {
        currentYear: 2.5,
        priorYear: 2.1,
        variance: 0.4,
        variancePercent: 19.05
      },
      quickRatio: {
        currentYear: 1.8,
        priorYear: 1.5,
        variance: 0.3,
        variancePercent: 20.0
      }
    },
    commentary: "Liquidity position has improved significantly.",
    keyFindings: [
      "Current ratio increased by 19%",
      "Quick ratio improved by 20%"
    ],
    riskAssessment: "low"
  })
});
```

### 2. Update with Version Creation
```javascript
// PUT /api/engagements/67890abc/analytical-review
const response = await fetch('/api/engagements/67890abc/analytical-review', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ratios: {
      currentRatio: {
        currentYear: 2.6,  // Updated value
        priorYear: 2.1,
        variance: 0.5,
        variancePercent: 23.81
      }
    },
    commentary: "Revised analysis with updated data",
    changeNote: "Updated with Q4 final numbers"
  })
});

// This automatically creates a version snapshot before updating
```

### 3. View Version History
```javascript
// GET /api/engagements/67890abc/analytical-review/versions
const response = await fetch('/api/engagements/67890abc/analytical-review/versions', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data } = await response.json();
console.log(`Current Version: ${data.currentVersion}`);
console.log(`Total Versions: ${data.totalVersions}`);
data.versions.forEach(v => {
  console.log(`v${v.versionNumber}: ${v.changeNote} by ${v.editedBy}`);
});
```

### 4. Restore Previous Version
```javascript
// POST /api/engagements/67890abc/analytical-review/versions/2/restore
const response = await fetch('/api/engagements/67890abc/analytical-review/versions/2/restore', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    changeNote: "Reverted to v2 - v3 had incorrect ratios"
  })
});

// This creates a new version with v2's data, then increments version number
```

### 5. Submit for Review Workflow
```javascript
// Step 1: Submit
await fetch('/api/engagements/67890abc/analytical-review/submit', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Step 2: Approve
await fetch('/api/engagements/67890abc/analytical-review/approve', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${reviewerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    comments: "Comprehensive analysis. Approved."
  })
});
```

### 6. Get All Reviews for Dashboard
```javascript
// GET /api/analytical-review?status=submitted
const response = await fetch('/api/analytical-review?status=submitted', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data, count } = await response.json();
console.log(`${count} reviews pending review`);
```

---

## Permissions Summary

| Action | Roles | Notes |
|--------|-------|-------|
| Create | employee, admin | Must be for valid engagement |
| Read (Own) | employee, client, admin | Clients see only their reviews |
| Update | employee, admin | Only owner auditor or admin |
| Delete | employee, admin | Only owner auditor or admin |
| Submit | employee, admin | Only owner auditor or admin |
| Approve/Reject | employee, admin | Typically reviewer role |
| Version History | All authenticated | Read-only access |
| Restore Version | employee, admin | Only owner auditor or admin |

---

## Versioning Behavior

### Automatic Version Creation
Every `PUT` request to update an analytical review automatically:
1. Creates a snapshot of current data
2. Stores it in `versions` array with metadata
3. Increments `currentVersion` number
4. Then applies the updates

### Version Restoration
When restoring to a previous version:
1. Current state is saved as a new version
2. Data from specified version is copied to current
3. Version counter increments
4. Change note indicates restoration

### Version Data Stored
- Complete snapshot of `ratios`, `commentary`, `conclusions`, `keyFindings`, `riskAssessment`
- Editor user ID and timestamp
- Change note (if provided)
- IP address (for audit trail)

---

## Error Handling

### Common Error Responses

**404 - Not Found**
```json
{
  "message": "Analytical review not found"
}
```

**400 - Duplicate**
```json
{
  "message": "Analytical review already exists for this engagement",
  "analyticalReviewId": "12345"
}
```

**403 - Forbidden**
```json
{
  "message": "You do not have permission to edit this review"
}
```

**400 - Invalid Status**
```json
{
  "message": "Invalid status value"
}
```

**404 - Version Not Found**
```json
{
  "message": "Version 5 not found"
}
```

---

## Integration Points

### Trial Balance Integration
```javascript
// Fetch trial balance for ratio calculation
const { data: review } = await fetch(`/api/engagements/${engagementId}/analytical-review`);
const { data: trialBalance } = await fetch(`/api/engagements/${engagementId}/trial-balance`);

// Calculate ratios from trial balance
const currentAssets = calculateFromTB(trialBalance, 'current-assets');
const currentLiabilities = calculateFromTB(trialBalance, 'current-liabilities');
const currentRatio = currentAssets / currentLiabilities;

// Update analytical review with calculated ratios
await fetch(`/api/engagements/${engagementId}/analytical-review`, {
  method: 'PUT',
  body: JSON.stringify({
    ratios: {
      currentRatio: {
        currentYear: currentRatio,
        priorYear: review.ratios.currentRatio?.currentYear || 0,
        variance: currentRatio - (review.ratios.currentRatio?.currentYear || 0)
      }
    }
  })
});
```

### Socket.IO Real-time Updates
```javascript
// On server when analytical review is updated
io.to(`engagement_${engagementId}`).emit('analyticalReviewUpdated', {
  engagementId,
  analyticalReviewId,
  action: 'updated',
  version: review.currentVersion
});

// On client
socket.on('analyticalReviewUpdated', (data) => {
  console.log(`Analytical review updated to v${data.version}`);
  // Refresh UI
});
```

---

## Model Methods

### Instance Methods

**createVersion(userId, changeNote, ipAddress)**
- Creates version snapshot before update
- Increments version counter

**getVersion(versionNumber)**
- Returns specific version by number

**restoreVersion(versionNumber, userId, changeNote)**
- Restores data from specified version
- Creates snapshot of current before restoring

**submitForReview(userId)**
- Changes status to 'submitted'
- Records submission metadata

**approve(userId, comments)**
- Changes status to 'approved'
- Records approval metadata

**reject(userId, comments)**
- Changes status to 'rejected'
- Records rejection reason

### Static Methods

**getByEngagement(engagementId)**
- Find review for specific engagement

**getByAuditor(auditorId, status)**
- Find all reviews by auditor (optionally filtered by status)

**getByClient(clientId)**
- Find all reviews for client

**getByStatus(status)**
- Find all reviews with specific status

---

## Created: October 15, 2025
## Version: 1.0.0

