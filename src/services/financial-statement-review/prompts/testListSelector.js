// Test List Selector
// 
// Purpose: Select and filter tests from all categories based on:
// - Category selection (AUDIT_REPORT, BALANCE_SHEET, etc. or ALL)
// - Evidence requirements (pdf_text, pdf_images, portalData)
//
// Returns: Combined prompt string with selected tests

const {
  auditReportTests,
  auditReportPrompt,
} = require('./categories/auditReport.prompt.js');

const {
  balanceSheetTests,
  balanceSheetPrompt,
} = require('./categories/balanceSheet.prompt.js');

const {
  incomeStatementTests,
  incomeStatementPrompt,
} = require('./categories/incomeStatement.prompt.js');

const {
  generalTests,
  generalPrompt,
} = require('./categories/general.prompt.js');

const {
  notesPolicyTests,
  notesPolicyPrompt,
} = require('./categories/notesPolicy.prompt.js');

const {
  crossStatementTests,
  crossStatementPrompt,
} = require('./categories/crossStatement.prompt.js');

const {
  presentationTests,
  presentationPrompt,
} = require('./categories/presentation.prompt.js');

// Category mapping
const CATEGORY_MAP = {
  AUDIT_REPORT: {
    tests: auditReportTests,
    prompt: auditReportPrompt,
  },
  BALANCE_SHEET: {
    tests: balanceSheetTests,
    prompt: balanceSheetPrompt,
  },
  INCOME_STATEMENT: {
    tests: incomeStatementTests,
    prompt: incomeStatementPrompt,
  },
  GENERAL: {
    tests: generalTests,
    prompt: generalPrompt,
  },
  NOTES_AND_POLICY: {
    tests: notesPolicyTests,
    prompt: notesPolicyPrompt,
  },
  CROSS_STATEMENT: {
    tests: crossStatementTests,
    prompt: crossStatementPrompt,
  },
  PRESENTATION: {
    tests: presentationTests,
    prompt: presentationPrompt,
  },
};

/**
 * Filters tests based on evidence requirements
 * @param {Array} tests - Array of test objects
 * @param {Object} required - Evidence requirements object
 * @param {boolean} required.isPdfText - Filter for tests requiring pdf_text
 * @param {boolean} required.isPdfImage - Filter for tests requiring pdf_images
 * @param {boolean} required.isPortalData - Filter for tests requiring portalData
 * @returns {Array} Filtered array of tests
 */
function filterTestsByEvidence(tests, required = {}) {
  const {
    isPdfText = true,
    isPdfImage = true,
    isPortalData = true,
  } = required;

  return tests.filter((test) => {
    const evidence = test.evidence_required || [];
    
    // If all evidence types are required (default), include all tests
    if (isPdfText && isPdfImage && isPortalData) {
      return true;
    }

    // Check if test requires any of the specified evidence types
    const requiresPdfText = evidence.includes('pdf_text');
    const requiresPdfImage = evidence.includes('pdf_images');
    const requiresPortalData = evidence.some((e) => 
      e === 'portalData' || e.startsWith('portalData.')
    );

    // Include test if it requires at least one of the requested evidence types
    // OR if it requires no specific evidence (empty evidence_required)
    if (evidence.length === 0) {
      return true;
    }

    const matchesEvidence =
      (requiresPdfText && isPdfText) ||
      (requiresPdfImage && isPdfImage) ||
      (requiresPortalData && isPortalData);

    return matchesEvidence;
  });
}

/**
 * Selects and combines tests from specified categories
 * @param {Object} required - Evidence requirements
 * @param {boolean} required.isPdfText - Include tests requiring pdf_text (default: true)
 * @param {boolean} required.isPdfImage - Include tests requiring pdf_images (default: true)
 * @param {boolean} required.isPortalData - Include tests requiring portalData (default: true)
 * @param {Array<string>} tests_included - Array of category names or ["ALL"] (default: ["ALL"])
 * @returns {Object} Object containing prompt string, tests array, and categories array
 */
function testListSelector(required = {}, tests_included = ['ALL']) {
  const {
    isPdfText = true,
    isPdfImage = true,
    isPortalData = true,
  } = required;

  // Determine which categories to include
  // PRESENTATION is always included as it's mandatory
  let categoriesToInclude = tests_included.includes('ALL')
    ? Object.keys(CATEGORY_MAP)
    : tests_included;
  
  // Always include PRESENTATION category (mandatory)
  if (!categoriesToInclude.includes('PRESENTATION')) {
    categoriesToInclude = [...categoriesToInclude, 'PRESENTATION'];
  }

  // Collect all selected tests
  const selectedTests = [];
  const categoryPrompts = [];

  for (const category of categoriesToInclude) {
    if (!CATEGORY_MAP[category]) {
      console.warn(`Warning: Unknown category "${category}" skipped.`);
      continue;
    }

    const { tests, prompt } = CATEGORY_MAP[category];
    
    // Filter tests by evidence requirements
    const filteredTests = filterTestsByEvidence(tests, {
      isPdfText,
      isPdfImage,
      isPortalData,
    });

    // Add category to each test for easy mapping
    const testsWithCategory = filteredTests.map(test => ({
      ...test,
      category: category
    }));

    // Add filtered tests to selected list
    selectedTests.push(...testsWithCategory);

    // Build category-specific prompt
    if (filteredTests.length > 0) {
      const categoryTestNames = filteredTests
        .map((test) => `- ${test.test_name}`)
        .join('\n');
      
      categoryPrompts.push(`
  ${category} tests:
  ${categoryTestNames}
      `);
    }
  }

  // Combine all prompts
  const combinedPrompt = `
The following tests are to be run against the financial statements:

${categoryPrompts.join('\n')}

Total tests selected: ${selectedTests.length}
  `.trim();

  return {
    prompt: combinedPrompt,
    tests: selectedTests,
    categories: categoriesToInclude
  };
}

module.exports = {
  testListSelector,
  filterTestsByEvidence,
  CATEGORY_MAP,
};

