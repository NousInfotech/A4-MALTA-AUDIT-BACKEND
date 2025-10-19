# 🚀 Analytical Review - Quick Start Guide

## ✅ What Was Created

### Files Created
1. **`src/models/AnalyticalReview.js`** - Model with embedded version history
2. **`src/controllers/analyticalReviewController.js`** - 15 controller functions
3. **`src/routes/analyticalReview.js`** - Module-based routes
4. **`docs/AnalyticalReview_API_Documentation.md`** - Complete API docs
5. **`docs/AnalyticalReview_Implementation_Summary.md`** - Detailed implementation guide

### Files Modified
1. **`src/routes/engagements.js`** - Added 11 engagement-nested routes
2. **`src/server.js`** - Registered analytical review routes

---

## 🎯 Quick Test Commands

### 1. Start Server
```bash
npm start
# or
npm run dev
```

### 2. Create Analytical Review
```bash
curl -X POST http://localhost:8000/api/engagements/YOUR_ENGAGEMENT_ID/analytical-review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ratios": {
      "currentRatio": {"currentYear": 2.5, "priorYear": 2.1, "variance": 0.4}
    },
    "commentary": "Test commentary",
    "riskAssessment": "low"
  }'
```

### 3. Get Analytical Review
```bash
curl http://localhost:8000/api/engagements/YOUR_ENGAGEMENT_ID/analytical-review \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Update (Auto-creates version)
```bash
curl -X PUT http://localhost:8000/api/engagements/YOUR_ENGAGEMENT_ID/analytical-review \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commentary": "Updated commentary",
    "changeNote": "Fixed typo"
  }'
```

### 5. View Version History
```bash
curl http://localhost:8000/api/engagements/YOUR_ENGAGEMENT_ID/analytical-review/versions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 API Endpoints

### Engagement-Nested (Recommended for UI)
```
POST   /api/engagements/:id/analytical-review              → Create
GET    /api/engagements/:id/analytical-review              → Read
PUT    /api/engagements/:id/analytical-review              → Update
DELETE /api/engagements/:id/analytical-review              → Delete
GET    /api/engagements/:id/analytical-review/versions     → List versions
POST   /api/engagements/:id/analytical-review/submit       → Submit for review
POST   /api/engagements/:id/analytical-review/approve      → Approve
POST   /api/engagements/:id/analytical-review/reject       → Reject
```

### Module-Based (Recommended for Dashboard)
```
GET    /api/analytical-review                              → Get all
GET    /api/analytical-review/:id                          → Get by ID
GET    /api/analytical-review/engagement/:engagementId     → Get by engagement
GET    /api/analytical-review/auditor/:auditorId           → Get by auditor
PUT    /api/analytical-review/:id                          → Update
DELETE /api/analytical-review/:id                          → Delete
```

---

## 🔑 Key Features

✅ **Embedded Version History** - Every update creates a version snapshot  
✅ **Dual API Pattern** - Engagement-nested + Module-based routes  
✅ **Auto-Versioning** - No manual version creation needed  
✅ **Status Workflow** - Draft → Submitted → Approved/Rejected  
✅ **Role-Based Access** - Employee/Admin can edit, Client can view  
✅ **Restore Versions** - Roll back to any previous version  
✅ **Audit Trail** - Who, when, what changed, from where (IP)  

---

## 📋 Data Structure

```javascript
{
  engagement: ObjectId,           // Link to engagement
  auditorId: String,             // Who created it
  clientId: String,              // Client reference
  
  // Current data
  ratios: Map<String, Mixed>,    // Any ratio structure
  commentary: String,            // Analysis text
  conclusions: String,           // Final conclusions
  keyFindings: [String],         // Bullet points
  riskAssessment: Enum,          // low/medium/high/critical
  
  // Status
  status: Enum,                  // draft/in-progress/submitted/reviewed/approved/rejected
  currentVersion: Number,        // Current version number
  
  // Embedded versions
  versions: [
    {
      versionNumber: Number,
      data: { ratios, commentary, ... },
      editedBy: String,
      editedAt: Date,
      changeNote: String,
      ipAddress: String
    }
  ]
}
```

---

## 🔐 Permissions

| Role | Create | Read | Update | Delete | Approve |
|------|:------:|:----:|:------:|:------:|:-------:|
| Employee | ✅ | ✅ | ✅ Own | ✅ Own | ✅ |
| Admin | ✅ | ✅ | ✅ All | ✅ All | ✅ |
| Client | ❌ | ✅ Own | ❌ | ❌ | ❌ |

---

## 🧪 Testing Workflow

### Step 1: Create
```javascript
POST /api/engagements/123/analytical-review
{
  "ratios": { "currentRatio": { "currentYear": 2.5 } },
  "commentary": "Initial analysis"
}
// Status: draft, Version: 1, Versions array: []
```

### Step 2: Update (Creates Version 1)
```javascript
PUT /api/engagements/123/analytical-review
{
  "commentary": "Updated analysis",
  "changeNote": "Added more details"
}
// Status: draft, Version: 2, Versions array: [v1 snapshot]
```

### Step 3: Update Again (Creates Version 2)
```javascript
PUT /api/engagements/123/analytical-review
{
  "commentary": "Final analysis",
  "changeNote": "Finalized"
}
// Status: draft, Version: 3, Versions array: [v1, v2]
```

### Step 4: View Versions
```javascript
GET /api/engagements/123/analytical-review/versions
// Returns: {
//   currentVersion: 3,
//   totalVersions: 2,
//   versions: [v2, v1]  // Sorted newest first
// }
```

### Step 5: Restore Version 1
```javascript
POST /api/engagements/123/analytical-review/versions/1/restore
{
  "changeNote": "Reverted to v1"
}
// Status: draft, Version: 4, Versions array: [v3, v2, v1]
// Current data now matches v1
```

### Step 6: Submit for Review
```javascript
POST /api/engagements/123/analytical-review/submit
// Status: submitted
```

### Step 7: Approve
```javascript
POST /api/engagements/123/analytical-review/approve
{
  "comments": "Looks good!"
}
// Status: approved
```

---

## 🔍 Querying Examples

### Get all pending reviews
```javascript
GET /api/analytical-review?status=submitted
```

### Get all reviews by auditor
```javascript
GET /api/analytical-review/auditor/user-123
```

### Get all reviews by auditor with status filter
```javascript
GET /api/analytical-review/auditor/user-123?status=approved
```

### Get review for specific engagement
```javascript
GET /api/engagements/engagement-123/analytical-review
```

---

## 📱 Frontend Integration Example

```javascript
// React/Vue component example

// Create
const createReview = async (engagementId, data) => {
  const response = await fetch(`/api/engagements/${engagementId}/analytical-review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};

// Update (auto-versions)
const updateReview = async (engagementId, data, changeNote) => {
  const response = await fetch(`/api/engagements/${engagementId}/analytical-review`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...data, changeNote })
  });
  return response.json();
};

// Get versions
const getVersions = async (engagementId) => {
  const response = await fetch(
    `/api/engagements/${engagementId}/analytical-review/versions`,
    { headers: { 'Authorization': `Bearer ${token}` }}
  );
  return response.json();
};

// Restore version
const restoreVersion = async (engagementId, versionNumber) => {
  const response = await fetch(
    `/api/engagements/${engagementId}/analytical-review/versions/${versionNumber}/restore`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeNote: `Restored to version ${versionNumber}`
      })
    }
  );
  return response.json();
};

// Submit
const submitReview = async (engagementId) => {
  const response = await fetch(
    `/api/engagements/${engagementId}/analytical-review/submit`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return response.json();
};
```

---

## 🐛 Common Issues

### Issue: "Analytical review already exists"
**Solution:** Each engagement can only have ONE analytical review. Use PUT to update instead of POST.

### Issue: No versions showing
**Solution:** Versions are only created on UPDATE, not on initial CREATE. Make an update first.

### Issue: Permission denied
**Solution:** Check that the authenticated user is the auditor who created the review, or is an admin.

### Issue: Version not found
**Solution:** Check available versions first with GET /versions before trying to restore.

---

## 📚 Full Documentation

For complete details, see:
- **API Reference:** `docs/AnalyticalReview_API_Documentation.md`
- **Implementation Guide:** `docs/AnalyticalReview_Implementation_Summary.md`

---

## ✅ Pre-Flight Checklist

Before testing:
- [ ] MongoDB is running
- [ ] `.env` has `MONGODB_URI` configured
- [ ] Server started with `npm start` or `npm run dev`
- [ ] You have a valid authentication token
- [ ] You have a valid engagement ID to test with

---

## 🎉 You're Ready!

The Analytical Review module is **fully implemented and ready to use**. Start by creating your first analytical review using the test commands above!

**Created:** October 15, 2025  
**Status:** ✅ Complete

