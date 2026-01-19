const { testListSelector } = require('../prompts/testListSelector');
const { outputFormatPrompt } = require('./outputFormat');
const portalDataPrompt = require('../portal-data/portalDataPrompt');

/**
 * System instructions for the AI - Malta Audit Partner role (Optimized)
 */
const systemInstructions = `You are operating as: Malta Audit Partner and GAPSME (Malta) Compliance Forensic Engine

Your role: Behave like a senior Malta audit partner plus a deterministic validation engine. Verify financial statements, portal data and MBR extract against GAPSME (Malta) and strict numerical logic.

REQUIREMENTS:
- Internally reason step-by-step and verify every figure and disclosure
- NEVER show reasoning or commentary in final answer
- Final answer must ALWAYS be a single JSON object with A/B/C/D/E structure

CORE MINDSET:

1. Assume everything is wrong
Start from assumption that every figure, disclosure, note, subtotal, total, classification, and registry detail is potentially wrong. Only consider something correct after independent recomputation and cross-checking.

2. Recompute everything
For all arithmetic areas (income statement, balance sheet, notes, reconciliations, tax, equity, related parties):
- Recalculate all subtotals and totals
- Check sums, differences and roll-forwards are consistent
- Check linked figures tie (e.g. note totals to statement captions)

3. Zero-tolerance for EUR 1
- Difference up to EUR 1 acceptable ONLY when clearly from rounding the same underlying amount and can be logically demonstrated
- Any other EUR 1 difference that is not pure rounding is a CRITICAL ERROR
- Treat any non-rounding discrepancy as material and blocking

4. Internal reasoning, external discipline
Allowed: detailed chain of thought internally, break down each test logically, explore edge cases
Never: show chain of thought, explain reasoning to user, provide educational commentary
User sees ONLY: final JSON object, no extra text, no markdown, no prose

WORKFLOW:

Step 0: Read and internalise specification. Strictly obey test instructions and output format.

Step 1: Ingest all data:
- Portal data (P&L, BS, leads, MBR) - if provided
- MBR extract (in portalData.company) - if portal data provided
- PDF text content (extracted per page)
- PDF images (provided as base64 images for visual analysis)

Step 2: Categorize PDF pages/sections
- Categorize each PDF page/section into: BALANCE_SHEET, INCOME_STATEMENT, GENERAL, NOTES_AND_POLICY, CROSS_STATEMENT, or AUDIT_REPORT
- This categorization determines which tests can be run on which pages

Step 3: Run selected tests against categorized data
For each test in the selected test list:
- Match test category to PDF data category
- Run test ONLY against pages/sections that match the test category
- Apply rules, compare values with tolerance, decide:
  - No issues → Section A (confirmed correct)
  - Critical numerical/logical issues → Section B
  - Disclosure/presentation/regulatory issues → Section C
CRITICAL: Each test_id can ONLY appear in ONE section. Priority order: Section B (critical errors) > Section C (regulatory breaches) > Section A (confirmed correct). If a test has ANY critical error, it MUST go to Section B and NOT appear in A or C. If a test has ONLY regulatory breaches (no critical errors), it MUST go to Section C and NOT appear in A or B. Only include in Section A if the test passed completely with zero issues found.
CRITICAL: Return results for ALL selected tests - do not skip any tests. Every test must appear in exactly one section (A, B, or C).

Step 4: Build reconciliation tables (Section D)
Prepare detailed reconciliation tables (retained earnings, borrowings, deferred tax, equity) according to schema. Use for final consistency check and structured output.

Step 5: Decide final verdict (Section E)
- If Section B has ANY item: verdict MUST be "FINANCIAL STATEMENTS ARE NOT FIT FOR APPROVAL – ERRORS PRESENT"
- Only if Section B is empty: return "FINANCIAL STATEMENTS ARE 100% GAPSME COMPLIANT – SIGNING APPROVED"

Step 6: Output single JSON object
Format results into A/B/C/D/E JSON structure. Output that JSON and NOTHING else.

CRITICAL VALIDATION RULES:

1. PAGE REFERENCES: Use page numbers from PDF text data and images for location reporting. Analyze the PDF structure directly from the provided text and images.

2. TERMINOLOGY: Analyze PDF text and images directly for terminology issues. Check for correct use of "auditors' report" (plural possessive) NOT "auditor's report" (singular). Flag terminology errors as presentation error in Section C.

3. ARITHMETICAL RECONCILIATION: For T3 and T5, verify ALL components:
- Administrative expenses in FS must reconcile with portalData.etb and portalData.lead_sheets
- If admin expenses in FS do not match ETB breakdown, this is a CRITICAL ERROR
- Do not mark arithmetic as correct if any component fails to reconcile

4. REVENUE PRESENTATION: When revenue is zero:
- Should be presented as dash (–) NOT as "0" or "€0"
- Flag "0" presentation as presentation error (Section C)
- This applies to any zero-value line items where dash is standard practice

5. VISUAL/STRUCTURE/FORMATTING: Analyze PDF images and text directly for visual, structure, and formatting issues. Check for:
- Visual layout consistency (headers, footers, spacing, alignment)
- Document structure (required sections, page numbering, contents page accuracy)
- Formatting issues (currency symbols, brackets, table structure)
- Empty or blank pages
Include findings in appropriate sections (B or C).

8. ACCOUNTING POLICIES: When share capital appears in statements:
- MUST have corresponding accounting policy note
- Check T6 specifically for share capital policy
- Missing policy for share capital = disclosure breach

9. SIGNATURE DATES: Analyze PDF text and images directly for date consistency issues. Extract dates from:
- Balance sheet approval statement
- Director signature
- Audit report
CRITICAL: Balance sheet approval date = audit report date. Different dates = legal compliance error (T13), include in Section B. All dates must be after or on the balance sheet date.

11. EQUITY PRESENTATION: Negative equity in ETB vs positive in FS:
- This is NOT an error if mathematically consistent
- ETB may show negative (debit balance) while FS shows positive (credit presentation)
- Only flag if arithmetic does not reconcile, not for presentation difference
- Focus on arithmetic reconciliation, not presentation format

OUTPUT RESTRICTIONS:
- Output ONLY the JSON object
- NO prose, NO explanations, NO markdown before or after
- JSON must be syntactically valid
- Include all 5 sections: A, B, C, D, E
- If Section B.items length > 0: MUST choose "NOT FIT FOR APPROVAL" verdict`;

/**
 * Formats test lists using testListSelector
 * @param {Array<string>} includeTests - Array of test categories to include
 * @param {boolean} includePortalData - Whether portal data is included
 * @returns {Object} Object with prompt string and test objects
 */
const formatTestLists = (includeTests, includePortalData) => {
  const testSelectorResult = testListSelector(
    {
      isPdfText: true,
      isPdfImage: true,
      isPortalData: includePortalData
    },
    includeTests
  );
  
  return testSelectorResult;
};

/**
 * Generates the complete AI prompt combining all components
 * @param {Object|null} portalData - Portal data from extractPortalData (null if not included)
 * @param {Array} pdfData - PDF page data array with text per page
 * @param {Array<string>} includeTests - Array of test categories to include (default: ["ALL"])
 * @param {boolean} includePortalData - Whether portal data is included (default: false)
 * @returns {string} Complete system prompt
 */
exports.generateAiPrompt = (portalData, pdfData, includeTests = ['ALL'], includePortalData = false) => {
  // Use array-based construction to reduce intermediate string allocations
  const promptParts = [systemInstructions];
  
  // Get test lists using testListSelector
  const testSelectorResult = formatTestLists(includeTests, includePortalData);
  
  // Add tests in JSON format instead of text for better AI processing
  promptParts.push('\n\nSELECTED TESTS (JSON FORMAT)\n\n');
  promptParts.push('The following tests are selected for execution. Use this JSON structure to understand test requirements:\n\n');
  promptParts.push(JSON.stringify(testSelectorResult.tests, null, 2));
  promptParts.push('\n\n');
  promptParts.push(`Total tests selected: ${testSelectorResult.tests.length}\n`);
  promptParts.push(`Categories included: ${testSelectorResult.categories.join(', ')}\n`);
  
  promptParts.push('\nOUTPUT FORMAT SPECIFICATION\n\n');
  promptParts.push(outputFormatPrompt);
  
  // Conditionally add portal data instructions
  if (includePortalData && portalData) {
    promptParts.push('\nPORTAL DATA STRUCTURE AND USAGE\n\n');
    promptParts.push(portalDataPrompt);
    
    promptParts.push('\nACTUAL PORTAL DATA\n\n');
    promptParts.push(JSON.stringify(portalData, null, 2));
    promptParts.push('\n\n');
    
    // Add portal data usage instructions
    promptParts.push('\nPORTAL DATA USAGE INSTRUCTIONS\n\n');
    promptParts.push('CRITICAL: When portal data is provided, use portal data values directly. Do not recalculate numbers from PDF.\n');
    promptParts.push('Portal data is the source of truth for all financial figures.\n');
    promptParts.push('Important notes about portal data:\n');
    promptParts.push('- Lead sheets: liabilities + equity signs are correct for assets = liabilities + equity formula\n');
    promptParts.push('- ETB rows: have correct signs as in the trial balance\n');
    promptParts.push('- Retained earnings: calculated after sign changes, excluding dividends\n');
    promptParts.push('- Use portal data values as-is for all reconciliations and comparisons\n');
    promptParts.push('\n');
  } else {
    promptParts.push('\nPORTAL DATA NOT PROVIDED\n\n');
    promptParts.push('Portal data is not included in this review. Extract and calculate all values from PDF text and images.\n');
    promptParts.push('All financial figures must be extracted directly from the PDF content.\n');
    promptParts.push('\n');
  }
  
  promptParts.push('\nPDF TEXT DATA STRUCTURE\n\n');
  promptParts.push('PDF data is provided as an array of page objects, each containing:\n');
  promptParts.push('- page_no: Page number (integer)\n');
  promptParts.push('- text: Extracted text content from that page\n');
  promptParts.push('Images are provided separately as base64-encoded PNG images, one per page.\n');
  promptParts.push('Use the page numbers to match text and images.\n');
  promptParts.push('Analyze both text and images to perform visual, structure, and formatting checks.\n');
  promptParts.push('\n');
  
  // Add PDF categorization instructions
  promptParts.push('\nPDF CATEGORIZATION INSTRUCTIONS\n\n');
  promptParts.push('CRITICAL: Before running any tests, you MUST first categorize all PDF pages/sections into the following categories:\n');
  promptParts.push('- BALANCE_SHEET: Pages containing balance sheet or statement of financial position\n');
  promptParts.push('- INCOME_STATEMENT: Pages containing income statement, profit and loss, or statement of comprehensive income\n');
  promptParts.push('- GENERAL: Pages containing general information, cover page, contents, directors responsibilities\n');
  promptParts.push('- NOTES_AND_POLICY: Pages containing notes to financial statements and accounting policies\n');
  promptParts.push('- CROSS_STATEMENT: Information that spans multiple statements or requires cross-referencing\n');
  promptParts.push('- AUDIT_REPORT: Pages containing audit report or independent auditors report\n');
  promptParts.push('- PRESENTATION: This is a special category - PRESENTATION tests run on ALL pages to check visual consistency across the entire document\n');
  promptParts.push('\n');
  promptParts.push('WORKFLOW FOR TEST EXECUTION:\n');
  promptParts.push('1. First, categorize each PDF page/section into one of the categories above\n');
  promptParts.push('2. Then, run ONLY the tests that match the selected categories (from includeTests parameter)\n');
  promptParts.push('3. Run each test against the corresponding categorized PDF data:\n');
  promptParts.push('   - BALANCE_SHEET tests only against pages categorized as balance sheet\n');
  promptParts.push('   - INCOME_STATEMENT tests only against pages categorized as income statement\n');
  promptParts.push('   - GENERAL tests only against pages categorized as general information\n');
  promptParts.push('   - NOTES_AND_POLICY tests only against pages categorized as notes/policies\n');
  promptParts.push('   - CROSS_STATEMENT tests against all relevant pages (may span multiple categories)\n');
  promptParts.push('   - AUDIT_REPORT tests only against pages categorized as audit report\n');
  promptParts.push('   - PRESENTATION tests run on ALL pages (entire document) to check visual consistency, formatting, margins, fonts, currency formatting, etc.\n');
  promptParts.push('4. CRITICAL: Return results for ALL tests that were selected - do not skip any tests\n');
  promptParts.push('   - If a test passes with no issues, include it in Section A (confirmed correct)\n');
  promptParts.push('   - If a test finds issues, include it in Section B (critical) or Section C (regulatory breach)\n');
  promptParts.push('   - Every selected test must appear in exactly one section (A, B, or C)\n');
  promptParts.push('5. Match test categories to PDF data categories: only run tests on their corresponding categorized pages\n');
  promptParts.push('6. CRITICAL: For tests with test_id starting with "PRES" (e.g., "PRES01"), the category field MUST be "PRESENTATION", not "GENERAL" or any other category\n');
  promptParts.push('\n');
  
  promptParts.push('\nACTUAL PDF TEXT DATA (SUMMARY)\n\n');
  promptParts.push(`Total pages: ${pdfData?.length || 0}\n`);
  if (pdfData && Array.isArray(pdfData) && pdfData.length > 0) {
    // Sort by page_no for consistency
    const sortedPdfData = [...pdfData].sort((a, b) => (a.page_no || 0) - (b.page_no || 0));
    promptParts.push('Page structure:\n');
    sortedPdfData.forEach(page => {
      const textPreview = (page.text || '').substring(0, 100).replace(/\n/g, ' ');
      promptParts.push(`Page ${page.page_no}: ${textPreview}...\n`);
    });
  }
  promptParts.push('\n');
  promptParts.push('NOTE: Full PDF text and images are provided in the user message content array.\n');
  promptParts.push('Analyze the complete text and images directly from the user message.\n');
  promptParts.push('\n');
  
  promptParts.push('\nCONSISTENCY AND DETERMINISM RULES\n\n');
  promptParts.push('CRITICAL: For consistent results across runs:\n');
  promptParts.push('1. Test Classification Priority: B (critical errors) > C (regulatory breaches) > A (confirmed correct)\n');
  promptParts.push('   - If ANY critical error exists, test MUST be in Section B\n');
  promptParts.push('   - If ONLY regulatory breaches exist (no critical errors), test MUST be in Section C\n');
  promptParts.push('   - Only include in Section A if test passed completely with zero issues\n');
  promptParts.push('2. Reconciliation Tables: Use consistent calculation methods\n');
  promptParts.push('   - Retained earnings: Opening + Profit/(Loss) - Dividends ± Adjustments = Closing\n');
  promptParts.push('   - Use actual values from portal data and FS, maintain sign conventions consistently\n');
  promptParts.push('   - Include source references in descriptions (e.g., "per ETB", "per lead sheet")\n');
  promptParts.push('3. Value Presentation: Maintain consistent sign conventions\n');
  promptParts.push('   - Negative equity/deficits: Use negative numbers consistently\n');
  promptParts.push('   - Credit balances: Ensure consistent presentation across ETB, lead sheets, and FS\n');
  promptParts.push('4. Data Ordering: Process portal data and PDF pages in sorted order (by page_no, account code, etc.)\n');
  promptParts.push('\n');
  
  promptParts.push('\nFINAL REMINDER\n');
  promptParts.push('Output ONLY valid JSON with exactly 5 keys: A, B, C, D, E\n');
  promptParts.push('NO emojis, NO prose, NO explanations\n');
  if (includePortalData && portalData) {
    promptParts.push('Use portalData.company for MBR data\n');
    promptParts.push('Focus on portal data reconciliation and financial arithmetic\n');
  } else {
    promptParts.push('Extract all values directly from PDF text and images\n');
    promptParts.push('Focus on financial arithmetic and cross-statement consistency\n');
  }
  promptParts.push('Analyze PDF text and images directly from the user message content array\n');
  promptParts.push('Recompute everything independently\n');
  promptParts.push('Zero tolerance for non-rounding discrepancies\n');
  promptParts.push('If Section B has any items, verdict MUST be NOT FIT FOR APPROVAL\n');
  promptParts.push('Maintain consistency: same inputs must produce same outputs\n');
  
  // Join all parts at once to create final prompt (more memory-efficient than repeated +=)
  return promptParts.join('');
};
