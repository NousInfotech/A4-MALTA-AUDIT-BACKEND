# PDF Data Flow to ChatGPT

## Current Implementation

### 1. PDF Extraction (`fsPdfDataExtractor.js`)

**Returns:**
```javascript
{
  pageDataArray: [
    {
      page_no: 1,           // Page number (1-indexed)
      text: "extracted text", // Text content from page
      imageName: "sessionId_page_1.png" // Filename only (NOT full path)
    },
    // ... more pages
  ],
  imageFiles: ["/full/path/to/tmp/images/sessionId_page_1.png", ...], // Full paths for cleanup
  sessionId: "unique_session_id"
}
```

### 2. Data Sent to AI (`aiFSReviewConfig.js`)

**System Prompt includes:**
- PDF data structure explanation
- Actual `pdfData` (pageDataArray) as JSON string

**User Message includes:**
```json
{
  "portalData": {...},
  "pdfData": [
    {
      "page_no": 1,
      "text": "...",
      "imageName": "sessionId_page_1.png"
    }
  ]
}
```

### 3. Current Issue

**Problem:** The AI receives:
- ✅ Page numbers (`page_no`)
- ✅ Text content (`text`)
- ❌ Only image filenames (`imageName`), NOT actual images

**Impact:**
- AI cannot perform visual checks (T1) because it cannot see the images
- AI can only use text content for analysis
- Visual layout integrity tests cannot be properly executed

### 4. Image Storage

Images are:
- Saved to: `tmp/images/sessionId_page_1.png`
- Referenced by filename only in JSON
- Cleaned up after review completes
- NOT accessible to the AI

## Recommendations

### Option 1: Base64 Encoding (For Vision Models)
Convert images to base64 and include in messages:
```javascript
{
  page_no: 1,
  text: "...",
  imageBase64: "data:image/png;base64,iVBORw0KGgo..." // Full base64 string
}
```

### Option 2: OpenAI Files API
Upload images to OpenAI Files API and reference file IDs:
```javascript
{
  page_no: 1,
  text: "...",
  openaiFileId: "file-abc123" // OpenAI file ID
}
```

### Option 3: Vision API with Image URLs
If images are publicly accessible, use URLs in vision API calls.

## Current Workaround

The prompt instructs AI to use images, but since images aren't accessible:
- AI relies primarily on text extraction
- Visual checks (T1) may be incomplete
- Page number references should be accurate based on text analysis

## Next Steps

1. Determine if gpt-5.1 supports vision API
2. If yes, implement base64 encoding or file upload
3. If no, update prompts to clarify that visual checks are limited to text-based analysis
4. Consider using a vision-capable model for T1 tests

