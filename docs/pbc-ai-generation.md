# PBC AI QnA Generation API Documentation

## Overview
The PBC AI QnA Generation endpoint uses OpenAI's GPT models to automatically generate relevant questions and categories for Prepared By Client (PBC) workflows based on uploaded documents and engagement context.

## Endpoint
```
POST /api/pbc/:pbcId/generate-qna-ai
```

## Authentication & Authorization
- **Authentication**: Required (Bearer token)
- **Authorization**: Employee role only (auditors)
- **Rate Limiting**: Subject to OpenAI API limits

## Request Parameters

### Path Parameters
- `pbcId` (string, required): The MongoDB ObjectId of the PBC workflow

### Request Body
No request body required. The endpoint uses existing PBC data and associated documents.

## Prerequisites

### PBC Status Requirement
The PBC workflow must be in `qna-preparation` status. The endpoint will return an error if the PBC is in any other status.

### Document Requirements
- At least one DocumentRequest must be associated with the PBC
- DocumentRequests must have `status: 'completed'`
- Documents must be uploaded and accessible via URL

## Process Flow

### 1. Validation Phase
- Validates PBC ID format
- Checks if PBC exists
- Verifies PBC is in `qna-preparation` status
- Retrieves completed DocumentRequests

### 2. Document Processing Phase
For each document in completed DocumentRequests:

#### Text Files (CSV, TXT, JSON, XML)
- Downloads file content
- Extracts text snippet (max 64KB)
- Includes snippet directly in AI prompt

#### Binary Files (PDF, Excel, Word, etc.)
- Downloads file content
- Uploads to OpenAI Files API
- Stores OpenAI file ID in DocumentRequest
- References file ID in AI prompt

### 3. AI Generation Phase
- Builds comprehensive prompt using `pbcPromptGenerator`
- Calls OpenAI GPT-4o-mini model
- Uses low temperature (0.2) for consistency
- Expects JSON response with categories and questions

### 4. Persistence Phase
- Parses AI response JSON
- Creates QnACategory documents
- Maps questions to proper schema format
- Returns created categories

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "createdCount": 3,
  "categories": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "pbcId": "64a1b2c3d4e5f6789012348",
      "title": "Revenue Recognition",
      "qnaQuestions": [
        {
          "_id": "64a1b2c3d4e5f678901234a",
          "question": "Please provide a detailed breakdown of revenue by major product lines.",
          "isMandatory": true,
          "answer": "",
          "status": "unanswered",
          "discussions": [],
          "answeredAt": null
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Invalid PBC ID
```json
{
  "success": false,
  "message": "Invalid pbcId"
}
```

#### 404 Not Found - PBC Not Found
```json
{
  "success": false,
  "message": "PBC not found"
}
```

#### 400 Bad Request - Wrong Status
```json
{
  "success": false,
  "message": "PBC not in qna-preparation stage"
}
```

#### 500 Internal Server Error - AI Response Issues
```json
{
  "success": false,
  "message": "OpenAI returned empty response"
}
```

#### 500 Internal Server Error - JSON Parse Error
```json
{
  "success": false,
  "message": "Failed to parse AI response as JSON. Raw output included.",
  "raw": "AI response text here..."
}
```

## AI Prompt Structure

The AI prompt includes:

### Engagement Context
- Entity name
- Period start/end dates
- Currency
- Accounting framework (IFRS/GAPSME)
- Industry
- Materiality threshold
- Risk notes
- Trial balance URL

### Document Information
- File names and URLs
- Text snippets for readable files
- OpenAI file IDs for binary files

### Instructions
- Analyze trial balance and documents
- Generate relevant audit questions
- Prioritize by risk and materiality
- Remove duplicates
- Specify acceptance criteria
- Adjust for accounting framework

## Expected AI Response Format

The AI should return a JSON array with this structure:

```json
[
  {
    "category": "Revenue Recognition",
    "questions": [
      {
        "question": "Please provide a detailed breakdown of revenue by major product lines.",
        "isMandatory": true,
        "acceptanceCriteria": "Excel or CSV, reconciled to TB balances",
        "reason": "Material revenue fluctuations noted"
      },
      {
        "question": "Provide supporting documentation for any revenue recognition policy changes.",
        "isMandatory": false,
        "acceptanceCriteria": "Policy documents and implementation notes",
        "reason": "Ensure compliance with accounting standards"
      }
    ]
  },
  {
    "category": "Inventory Management",
    "questions": [
      {
        "question": "Provide inventory count sheets and reconciliation to general ledger.",
        "isMandatory": true,
        "acceptanceCriteria": "Physical count sheets, reconciliation schedules",
        "reason": "Material inventory balances require verification"
      }
    ]
  }
]
```

## File Processing Details

### Supported Text Formats
- CSV files
- TXT files
- JSON files
- XML files
- Any file with text/* content type

### Supported Binary Formats
- PDF documents
- Excel files (.xlsx, .xls)
- Word documents (.docx, .doc)
- PowerPoint presentations
- Images (for OCR processing)

### File Size Limits
- Text snippets: Maximum 64KB
- OpenAI file uploads: Subject to OpenAI limits (typically 512MB)

## Error Handling

### Document Fetch Errors
- Individual file fetch failures are logged but don't stop the process
- Files with fetch errors are included in prompt with error information
- Process continues with available documents

### OpenAI Upload Errors
- Binary file upload failures are logged
- Files are included in prompt without OpenAI file ID
- Process continues with available files

### AI Response Errors
- Empty responses return 500 error
- JSON parse failures include raw output for debugging
- Invalid JSON structure returns 500 error with parsed content

## Usage Examples

### Basic Usage
```javascript
// Generate QnA for PBC in qna-preparation status
POST /api/pbc/64a1b2c3d4e5f6789012348/generate-qna-ai

// Response
{
  "success": true,
  "createdCount": 2,
  "categories": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "title": "Revenue Recognition",
      "qnaQuestions": [...]
    }
  ]
}
```

### Error Handling
```javascript
// PBC not in correct status
POST /api/pbc/64a1b2c3d4e5f6789012348/generate-qna-ai

// Response
{
  "success": false,
  "message": "PBC not in qna-preparation stage"
}
```

## Integration Notes

### PBC Workflow Integration
- Only works when PBC status is `qna-preparation`
- Generated categories are immediately available for client responses
- PBC status remains unchanged after generation

### Document Management
- OpenAI file IDs are stored in DocumentRequest documents
- Text snippets are included directly in prompts
- Binary files are uploaded to OpenAI for AI processing

### Performance Considerations
- Process can take 30-60 seconds depending on document count and size
- Large files may timeout during upload
- Consider implementing progress tracking for UI

## Security Considerations

### Access Control
- Only authenticated auditors can trigger generation
- PBC ownership is validated through engagement relationship

### Data Privacy
- Documents are uploaded to OpenAI (review OpenAI data policies)
- Text snippets are included in prompts (ensure no sensitive data)
- Consider data retention policies for uploaded files

### Rate Limiting
- Subject to OpenAI API rate limits
- Consider implementing client-side rate limiting
- Monitor usage to avoid quota exhaustion

## Troubleshooting

### Common Issues

1. **"PBC not in qna-preparation stage"**
   - Ensure PBC status is set to `qna-preparation`
   - Use PATCH endpoint to update status first

2. **"OpenAI returned empty response"**
   - Check OpenAI API key and quota
   - Verify model availability
   - Review prompt length and complexity

3. **"Failed to parse AI response as JSON"**
   - AI may have returned non-JSON response
   - Check raw output in error response
   - Consider adjusting prompt instructions

4. **Document fetch errors**
   - Verify document URLs are accessible
   - Check file permissions and CORS settings
   - Ensure files are not corrupted

### Debug Information
- Check server logs for detailed error information
- Review OpenAI API response for debugging
- Verify document accessibility and format
- Test with smaller document sets first
