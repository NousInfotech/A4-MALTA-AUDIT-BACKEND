# KYC Model - Relationship Summary

## Relationship Structure

### ✅ Current Setup (Correct)

```
Engagement (1) ──── (Many) KYC
     │
     └── Multiple KYCs can exist per engagement

KYC (1) ──── (Many) DocumentRequest  
     │
     └── Each KYC can have multiple DocumentRequests
```

## KYC Schema
```javascript
const KYCSchema = new Schema({
  engagement: { type: Types.ObjectId, ref: 'Engagement', required: true },
  clientId: { type: String, required: true },
  auditorId: { type: String, required: true },
  documentRequests: [{ type: Types.ObjectId, ref: 'DocumentRequest' }], // Array ✅
  discussions: [KYCDiscussionSchema],
  status: {
    type: String,
    enum: ['pending', 'in-review', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });
```

## Fixed Issues

### 🐛 Bug 1: Creating KYC with Single DocumentRequest
**Before (Wrong):**
```javascript
documentRequests: createdDocumentRequest ? createdDocumentRequest._id : null  // ❌
```

**After (Fixed):**
```javascript
documentRequests: createdDocumentRequest ? [createdDocumentRequest._id] : []  // ✅
```

### 🐛 Bug 2: Adding DocumentRequest Replaced Array
**Before (Wrong):**
```javascript
kyc.documentRequests = documentRequestId;  // ❌ Replaces entire array
```

**After (Fixed):**
```javascript
kyc.documentRequests.push(documentRequestId);  // ✅ Adds to array
```

### 🐛 Bug 3: Duplicate Check Logic
**Before (Wrong):**
```javascript
if (kyc.documentRequests && kyc.documentRequests.toString() === documentRequestId)  // ❌
```

**After (Fixed):**
```javascript
if (kyc.documentRequests && kyc.documentRequests.some(id => id.toString() === documentRequestId))  // ✅
```

## Usage Examples

### Create KYC with Multiple DocumentRequests
```javascript
POST /api/kyc

{
  "engagementId": "64a1b2c3d4e5f6789012345",
  "clientId": "client-123",
  "auditorId": "auditor-456",
  "documentRequest": {
    "category": "kyc",
    "description": "Identity Documents",
    "documents": [
      {
        "name": "Passport",
        "template": {
          "url": "https://storage.url/passport-template.pdf",
          "instruction": "Please upload a clear copy of your passport"
        }
      },
      {
        "name": "Proof of Address",
        "template": {
          "url": "https://storage.url/address-template.pdf",
          "instruction": "Upload utility bill not older than 3 months"
        }
      }
    ]
  }
}
```

### Add Additional DocumentRequest to Existing KYC
```javascript
POST /api/kyc/:id/document-request

{
  "documentRequestId": "64a1b2c3d4e5f6789012347"
}
```

## DocumentRequest Integration

Each DocumentRequest in KYC can have:
- **Multiple documents** (already supported)
- **Template-based workflow** (newly added)
- **Direct upload workflow** (existing)

### Template-based Document in KYC
```javascript
{
  "_id": "doc-req-123",
  "engagement": "engagement-456",
  "clientId": "client-789",
  "category": "kyc",
  "description": "Client Identity Verification",
  "documents": [
    {
      "name": "Passport Copy",
      "template": {
        "url": "https://storage.url/passport-requirements.pdf",
        "instruction": "Upload clear color scan of passport photo page"
      },
      "url": null,  // Client hasn't uploaded yet
      "status": "pending"
    },
    {
      "name": "Proof of Address",
      "template": null,  // Direct upload, no template
      "url": "https://storage.url/utility-bill.pdf",  // Client uploaded
      "status": "uploaded",
      "comment": "Electricity bill from September 2024"
    }
  ]
}
```

## Workflow

1. **Create KYC for Engagement**
   - One engagement can have multiple KYC workflows
   - Each KYC can be for different purposes (e.g., initial KYC, annual update, beneficial owner KYC)

2. **Add Document Requests to KYC**
   - Each KYC can have multiple DocumentRequests
   - Each DocumentRequest can have multiple documents
   - Documents can be template-based or direct-upload

3. **Client Responses**
   - If template exists → download, fill, upload
   - If no template → direct upload
   - Can add comments for each document

4. **Discussions**
   - Threaded discussions per document
   - Links to specific document via `documentRef`

## Summary

✅ **One Engagement** → **Many KYCs**  
✅ **One KYC** → **Many DocumentRequests**  
✅ **One DocumentRequest** → **Many Documents**  
✅ **Each Document** → **Template (optional)** + **Client Upload**

All relationships are now correctly implemented as arrays where needed.

