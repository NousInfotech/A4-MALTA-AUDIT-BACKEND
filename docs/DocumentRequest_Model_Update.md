# DocumentRequest Model Update - Template Support

## Overview
The `DocumentRequest` model has been updated to support two types of document workflows at the document level:

1. **Direct Upload** (existing behavior)
2. **Template-based Upload** (new feature)

## Model Changes

### Updated Document Schema
```javascript
documents: [{
  name: { type: String, required: true },
  
  // Optional: Template for client to download and fill (template-based workflow)
  template: {
    url: { type: String },        // Auditor's uploaded template URL
    instruction: { type: String }  // Instructions for filling the template
  },
  
  // Client's uploaded document (works for both workflows)
  url: { type: String },           // Supabase file URL 
  uploadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'uploaded', 'in-review', 'approved', 'rejected'],
    default: 'pending'
  },
  comment: { type: String, default: "" }
}]
```

## Two Workflows

### 1. Direct Upload (Default Behavior)
**Current/existing behavior - no changes required**

- Auditor creates a document request with description
- `template` field is `null` or not provided
- Client directly uploads the requested document to `url`
- Frontend: If `document.template` is falsy, show direct upload UI

**Example:**
```javascript
{
  name: "Bank Statements",
  url: "https://storage.url/bank-statements.pdf", // Client upload
  template: null, // or undefined
  status: "uploaded",
  comment: "Q4 2023 statements"
}
```

### 2. Template-based Upload (New Feature)
**New workflow for documents that need a template**

- Auditor creates a document request with a template
- Auditor uploads template file to `template.url`
- Auditor provides instructions in `template.instruction`
- Client downloads template from `template.url`
- Client fills/edits the template
- Client uploads completed document to `url`
- Both files are preserved for audit trail

**Example:**
```javascript
{
  name: "Fixed Assets Schedule",
  template: {
    url: "https://storage.url/fixed-assets-template.xlsx",
    instruction: "Please fill in all asset details including purchase date, cost, and depreciation"
  },
  url: "https://storage.url/fixed-assets-filled.xlsx", // Client's filled template
  status: "uploaded",
  comment: "Completed as per template"
}
```

## Frontend Implementation Guide

### Detecting Workflow Type
```javascript
// Check if document is template-based
const isTemplateBased = document.template && document.template.url;

if (isTemplateBased) {
  // Show template download button + upload for response
  // Display template instructions
} else {
  // Show direct upload UI (existing)
}
```

### Template-based UI Flow
1. **Display Template Download**
   ```javascript
   if (document.template?.url) {
     // Show download button
     <DownloadButton url={document.template.url} />
     
     // Show instructions
     if (document.template.instruction) {
       <Instructions text={document.template.instruction} />
     }
   }
   ```

2. **Show Upload for Completed Template**
   ```javascript
   // Client uploads their filled template
   <UploadButton 
     onUpload={(file) => uploadToDocumentUrl(file)}
     label="Upload Completed Template"
   />
   ```

3. **Display Both Files (if uploaded)**
   ```javascript
   // Template (original from auditor)
   <FileLink url={document.template.url} label="Download Template" />
   
   // Response (filled by client)
   {document.url && (
     <FileLink url={document.url} label="Download Submitted Document" />
   )}
   ```

### Direct Upload UI (Existing)
```javascript
// No template - show simple upload
if (!document.template?.url) {
  <UploadButton 
    onUpload={(file) => uploadToDocumentUrl(file)}
    label="Upload Document"
  />
}
```

## API Endpoints (No Changes Required)

### Creating Document Request with Template
```javascript
POST /api/document-requests

{
  "engagementId": "...",
  "category": "pbc",
  "description": "Fixed Assets Schedule",
  "documents": [{
    "name": "Fixed Assets Schedule",
    "template": {
      "url": "https://storage.url/template.xlsx",
      "instruction": "Fill in all columns with asset details"
    },
    "status": "pending"
  }]
}
```

### Client Uploads Completed Template
```javascript
POST /api/document-requests/:id/documents
// Upload file to documents[index].url

// The template.url remains unchanged - preserving the original
```

## Benefits

✅ **Backward Compatible**: Existing direct uploads work unchanged
✅ **Cross-Reference**: Both template and response preserved
✅ **Clear Instructions**: Auditors can provide specific guidance
✅ **Simple Detection**: Frontend checks if `template` exists
✅ **No API Changes**: Existing endpoints handle both workflows

## Dependencies

### Modules Using DocumentRequest:
- ✅ `documentRequestController.js` - Works as-is, no changes needed
- ✅ `pbcController.js` - Compatible, handles template field automatically
- ✅ `kycController.js` - Compatible, handles template field automatically
- ✅ `engagementController.js` - Populates as-is
- ✅ `userController.js` - Deletes as-is

All existing functionality remains intact. Frontend determines workflow based on presence of `template` field.

## Migration Notes

- **Existing Data**: All existing documents without `template` field continue to work
- **New Template Uploads**: Auditors can now optionally add `template.url` and `template.instruction`
- **No Breaking Changes**: The addition is purely additive

