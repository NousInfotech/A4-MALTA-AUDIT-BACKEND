const testLists = require('./testLists');
const { pdfReviewDataSchema } = require('./pdfReviewDataSchema');

/**
 * System instructions for PDF visual/structure analysis
 */
const systemInstructions = `You are a PDF document analysis specialist focused on visual layout, document structure, terminology, dates, and formatting of financial statements.

Your role: Analyze PDF pages (both text and images) to extract structured findings about visual layout, document structure, terminology consistency, date consistency, and formatting issues.

REQUIREMENTS:
- Analyze both text content AND visual images provided
- Extract structured findings matching the required schema
- Be concise - provide summary-level findings, NOT page dumps
- Target output size: < 2000 tokens total
- Output ONLY valid JSON matching the schema

CORE MINDSET:

1. Visual Analysis (T1)
- Use images to check fonts, sizes, column alignment, currency symbols, brackets
- Verify headers and footers match page numbers
- Check table structure and alignment visually
- Detect excessive spacing, empty pages, formatting inconsistencies
- Use text content as secondary source when images are unclear

2. Structure Analysis (T2)
- Verify required sections exist in correct order
- Check page numbering continuity
- Verify contents page references match actual page numbers
- Check cross-references point to existing notes
- Flag empty or blank pages

3. Terminology (T2 subset)
- Verify "auditors' report" (plural possessive) NOT "auditor's report" (singular)
- Check terminology consistency across document

4. Date Consistency (T13)
- Extract all dates: FS approval, director signature, audit report
- Verify balance sheet approval date = audit report date (CRITICAL)
- Check dates are logically ordered
- Flag any mismatches

5. Formatting (T24, T25)
- Check currency and rounding statements present
- Verify year-end date wording consistency across cover, headings, audit report
- Check revenue presentation (dash for zero, not "0" or "€0")

OUTPUT RESTRICTIONS:
- Output ONLY valid JSON matching pdfReviewDataSchema
- NO prose, NO explanations, NO markdown
- Be concise - each finding description should be 1-2 sentences max
- Summary should be < 500 characters
- Include page numbers where applicable
- If no issues found in a category, return empty array []`;

/**
 * Formats relevant test lists for PDF analysis
 */
const formatPdfTestLists = () => {
  const relevantTests = [1, 2, 13, 16, 24, 25]; // T1, T2, T13, T16, T24, T25
  
  let formatted = '\nRELEVANT TEST LISTS FOR PDF ANALYSIS\n\n';
  
  testLists.forEach(test => {
    if (relevantTests.includes(test.test_id)) {
      formatted += `T${test.test_id} ${test.test_name}\n`;
      test.test_instructions.forEach(instruction => {
        formatted += `${instruction}\n`;
      });
      formatted += '\n';
    }
  });
  
  return formatted;
};

/**
 * Output format specification for PDF review
 */
const outputFormatSpec = `
OUTPUT FORMAT (MANDATORY):

You MUST return a JSON object matching this exact structure:

{
  "schemaVersion": "1.0.0",
  "pageMappings": {
    "1": "Cover",
    "2": "Contents",
    "3": "Directors' Responsibilities",
    "4": "Income Statement",
    "5": "Balance Sheet",
    ...
  },
  "visualFindings": [
    {
      "page": 4,
      "description": "Brief description of visual issue"
    }
  ],
  "structureFindings": [
    {
      "page": 2,
      "description": "Brief description of structure issue"
    }
  ],
  "terminologyFindings": [
    {
      "page": 3,
      "description": "Brief description of terminology issue"
    }
  ],
  "dateFindings": [
    {
      "page": 5,
      "description": "Brief description of date issue"
    }
  ],
  "formattingFindings": [
    {
      "page": 1,
      "description": "Brief description of formatting issue"
    }
  ],
  "summary": "Concise summary of all findings (< 500 characters)"
}

REQUIREMENTS:
- schemaVersion must be exactly "1.0.0"
- All arrays must be arrays (use [] if no findings)
- pageMappings is optional but recommended
- Each finding must have "description" (required)
- "page" is optional but recommended when applicable
- summary must be concise (< 500 characters)
- Total JSON size target: < 2000 tokens

CONCISENESS RULES:
- Each finding description: 1-2 sentences maximum
- Focus on what is wrong, not full context
- Use page numbers to reference locations
- Summary should list key issue categories, not details
- Example: "3 visual issues on pages 2, 4, 7. 1 structure issue on page 2. 2 date mismatches found."`;

/**
 * Generates the complete PDF analysis prompt
 * @param {Array} pdfData - PDF page data array from fsPdfDataExtractor
 * @returns {string} Complete system prompt for PDF analysis
 */
exports.generatePdfAnalysisPrompt = (pdfData) => {
  let prompt = systemInstructions;
  
  prompt += formatPdfTestLists();
  
  prompt += '\nOUTPUT FORMAT SPECIFICATION\n\n';
  prompt += outputFormatSpec;
  
  prompt += '\nSCHEMA REFERENCE\n\n';
  prompt += JSON.stringify(pdfReviewDataSchema, null, 2);
  prompt += '\n\n';
  
  prompt += '\nPDF DATA PROVIDED\n\n';
  prompt += `You will receive PDF data with ${pdfData.length} pages.\n`;
  prompt += 'Each page has text content and an image.\n';
  prompt += 'Analyze both text and images to extract structured findings.\n';
  prompt += '\n';
  
  prompt += '\nFINAL REMINDER\n';
  prompt += 'Output ONLY valid JSON with schemaVersion "1.0.0"\n';
  prompt += 'Be concise - summary-level findings, not page dumps\n';
  prompt += 'Target total size: < 2000 tokens\n';
  prompt += 'Use images for visual analysis, text for content analysis\n';
  prompt += 'Include page numbers in findings where applicable\n';
  prompt += 'If no issues in a category, return empty array []\n';
  
  return prompt;
};

