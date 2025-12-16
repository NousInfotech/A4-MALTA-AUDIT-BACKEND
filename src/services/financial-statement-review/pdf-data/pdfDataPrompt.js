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
- imageName is filename only, not full path
- If imageName is null, image extraction failed (still use text)
- Page numbers start at 1
- Text extraction may not be 100% accurate, verify critical numbers
- Images preserve exact visual appearance`;

module.exports = pdfDataPrompt;
