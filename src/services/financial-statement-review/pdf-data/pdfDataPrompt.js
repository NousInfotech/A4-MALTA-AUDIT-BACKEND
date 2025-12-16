/**
 * PDF Data Structure Prompt - Optimized for OpenAI
 */
const pdfDataPrompt = `PDF DATA STRUCTURE AND USAGE

PDF data is extracted from financial statements. Each page has text and an image reference.

STRUCTURE:
[
  {
    "page_no": 1,
    "text": "Financial Statements\\nWhite Investments Limited\\n...",
    "imageName": "page_1.png"
  },
  {
    "page_no": 2,
    "text": "Directors' Responsibilities\\n...",
    "imageName": "page_2.png"
  }
]

PREPROCESSING:
1. PDF converted to page images: one PNG per page, saved as page_{page_no}.png in tmp/images/
2. Text extracted per-page using form feed character as separator

USAGE FOR TESTS:

VISUAL LAYOUT (T1):
- Use imageName to check fonts, sizes, column alignment, currency symbols, brackets, headers, footers, table positions
- If imageName is null, visual checks cannot be performed for that page
- Images are authoritative source for layout/formatting

TEXT-BASED TESTS (T2-T26):
- Use text field to extract numbers, check structure, verify references, extract policies, check grammar, verify dates
- Use page_no to report location

NUMERICAL EXTRACTION:
- Extract numbers from text for calculations (T3, T4, T5, T7, T19, T20)
- Handle negative numbers in brackets or with minus signs

LOCATION TRACKING:
- Use page_no for location.page
- Use text content to identify sections and notes
- Combine page_no with text analysis for precise location

CONFLICTS:
- If text and image conflict, trust images for layout/formatting
- Use text for numerical values and content analysis

KEY POINTS:
- Each page has page_no, text, imageName
- imageName is filename reference (e.g., "sessionId_page_1.png") - this is the name of the image file that was created
- Images are created by fsPdfDataExtractor and saved to disk
- The imageName in the JSON is a REFERENCE to indicate which image file corresponds to which page
- CURRENT IMPLEMENTATION: Only the imageName (filename string) is sent in JSON - actual image content is NOT included
- The images exist on the server disk but are not accessible to the AI model
- For visual checks (T1), you must rely on text content structure and page organization analysis
- The imageName reference helps you understand the page-to-image mapping structure
- If imageName is null, image extraction failed for that page (still use text)
- Page numbers start at 1
- Text extraction may not be 100% accurate, verify critical numbers
- IMPORTANT: Use page_no from the data structure to report accurate page references
- Verify page numbers by analyzing text content location (e.g., "Balance Sheet" text determines actual page number)
- NOTE: To enable actual image viewing, images would need to be converted to base64 and included in the message content`;

module.exports = pdfDataPrompt;
