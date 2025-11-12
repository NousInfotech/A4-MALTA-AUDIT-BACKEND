const Engagement = require("../models/Engagement");
const TrialBalance = require("../models/TrialBalance");
const ExtendedTrialBalance = require("../models/ExtendedTrialBalance");

/**
 * Populates prior year data in the current year's Trial Balance and Extended Trial Balance
 * by fetching data from the previous year's engagement (if it exists and matches)
 * 
 * @param {String} engagementId - The ID of the current engagement
 * @returns {Object} Result object with status and message
 */
async function populatePriorYearData(engagementId) {
  try {
    // Step 1: Identify Current Engagement
    const currentEngagement = await Engagement.findById(engagementId);
    if (!currentEngagement) {
      return {
        success: false,
        message: "Current engagement not found",
        populated: false
      };
    }

    const { clientId, title, yearEndDate } = currentEngagement;

    // Extract year from yearEndDate
    const currentYear = new Date(yearEndDate).getFullYear();

    // Step 2: Check for Multiple Engagements under Client
    const clientEngagementsCount = await Engagement.countDocuments({ clientId });

    if (clientEngagementsCount <= 1) {
      return {
        success: true,
        message: "Only one engagement exists for this client",
        populated: false
      };
    }

    // Step 3: Check for Engagements with Same Base Title (excluding year)
    // Extract base title by removing year pattern (e.g., "Audit 2024" -> "Audit")
    // Common patterns: "Company Audit 2024", "Company Review 2024", "Company 2024"
    const baseTitle = extractBaseTitle(title);

    // Find all engagements for this client
    const allClientEngagements = await Engagement.find({
      clientId,
      _id: { $ne: engagementId }
    }).sort({ yearEndDate: -1 });

    // Filter engagements that have the same base title
    const sameTitleEngagements = allClientEngagements.filter(eng => {
      const engBaseTitle = extractBaseTitle(eng.title);
      return engBaseTitle === baseTitle;
    });

    if (sameTitleEngagements.length === 0) {
      return {
        success: true,
        message: "No other engagements with same base title found",
        populated: false
      };
    }

    // Step 4: Identify Previous Year Engagement
    const previousYear = currentYear - 1;
    const previousYearEngagement = sameTitleEngagements.find(eng => {
      const engYear = new Date(eng.yearEndDate).getFullYear();
      return engYear === previousYear;
    });

    if (!previousYearEngagement) {
      return {
        success: true,
        message: `No engagement found for previous year (${previousYear})`,
        populated: false
      };
    }

    // Step 5: Fetch and Compare Trial Balance Data
    const [previousTB, currentTB, previousETB, currentETB] = await Promise.all([
      TrialBalance.findOne({ engagement: previousYearEngagement._id }),
      TrialBalance.findOne({ engagement: engagementId }),
      ExtendedTrialBalance.findOne({ engagement: previousYearEngagement._id }),
      ExtendedTrialBalance.findOne({ engagement: engagementId })
    ]);

    if (!previousTB || !previousTB.rows || previousTB.rows.length === 0) {
      return {
        success: true,
        message: "Previous year trial balance not found or empty",
        populated: false
      };
    }

    if (!currentTB || !currentTB.rows || currentTB.rows.length === 0) {
      return {
        success: true,
        message: "Current year trial balance not found or empty",
        populated: false
      };
    }

    // Map previous year data by accountCode only for quick lookup
    const previousTBMap = buildTrialBalanceMap(previousTB);
    const previousETBMap = previousETB ? buildExtendedTrialBalanceMap(previousETB) : null;

    // Check matching statistics (for reporting, but don't block on low match)
    const matchResult = checkTrialBalanceMatch(currentTB, previousTBMap);

    // Step 6: Update Current Year Data
    let tbUpdatedCount = 0;
    let tbNewAccountCount = 0;
    let etbUpdatedCount = 0;
    let etbNewAccountCount = 0;

    // CRITICAL: Prioritize ETB finalBalance over TB Final Balance
    // ETB has the finalBalance field, TB usually doesn't have "Final Balance" column
    const priorYearIndex = findColumnIndex(currentTB.headers, "Prior Year");
    const prevFinalBalanceIndex = findColumnIndex(previousTB.headers, "Final Balance");
    const prevCurrentYearIndex = findColumnIndex(previousTB.headers, "Current Year");
    
    const updatedTBRows = currentTB.rows.map((row, rowIndex) => {
      const key = buildRowKey(row, currentTB.headers);
      const previousTBRow = previousTBMap.get(key);
      const previousETBRow = previousETBMap ? previousETBMap.get(key) : null;
      
      // Always keep the row (even if no match found)
      const updatedRow = [...row];
      
      if (priorYearIndex !== -1) {
        let valueToUse = 0;
        
        if (previousTBRow || previousETBRow) {
          // Match found - populate from previous year
          // Priority 1: Use previous year's ETB finalBalance (most accurate)
          if (previousETBRow && previousETBRow.finalBalance !== undefined && previousETBRow.finalBalance !== null) {
            valueToUse = previousETBRow.finalBalance;
          }
          // Priority 2: Use previous year's TB "Final Balance" column (if exists)
          else if (previousTBRow && prevFinalBalanceIndex !== -1) {
            valueToUse = previousTBRow[prevFinalBalanceIndex] || 0;
          }
          // Priority 3: Use previous year's TB "Current Year" column (fallback)
          else if (previousTBRow && prevCurrentYearIndex !== -1) {
            valueToUse = previousTBRow[prevCurrentYearIndex] || 0;
          }
          
          tbUpdatedCount++;
        } else {
          // No match found - this is a new account code
          // Keep priorYear as 0 (or existing value)
          tbNewAccountCount++;
        }
        
        updatedRow[priorYearIndex] = valueToUse;
      }
      
      return updatedRow;
    });

    currentTB.rows = updatedTBRows;
    await currentTB.save();

    // Build a map of account codes to determine which are new
    // AND store classification/grouping data from previous year for matched accounts
    const accountCodeStatusMap = {};
    const accountCodeClassificationMap = {}; // Store previous year's classification data
    
    // Check which account codes from current TB exist in previous year
    currentTB.rows.forEach(row => {
      const key = buildRowKey(row, currentTB.headers);
      if (key) {
        const existsInPreviousYear = previousTBMap.has(key) || (previousETBMap && previousETBMap.has(key));
        accountCodeStatusMap[key] = existsInPreviousYear ? false : true; // true = isNewAccount
        
        if (existsInPreviousYear && previousETBMap && previousETBMap.has(key)) {
          // Store previous year's classification and grouping data
          const previousETBRow = previousETBMap.get(key);
          accountCodeClassificationMap[key] = {
            classification: previousETBRow.classification || "",
            grouping1: previousETBRow.grouping1 || "",
            grouping2: previousETBRow.grouping2 || "",
            grouping3: previousETBRow.grouping3 || "",
            grouping4: previousETBRow.grouping4 || "",
          };
          console.log(`[populatePriorYearData] Stored classification for ${key}: ${previousETBRow.classification}`);
        } else if (!existsInPreviousYear) {
          console.log(`[populatePriorYearData] NEW ACCOUNT CODE DETECTED: ${key}`);
        }
      }
    });
    
    // Update ExtendedTrialBalance if it exists
    if (currentETB && currentETB.rows && currentETB.rows.length > 0) {
      currentETB.rows = currentETB.rows.map(row => {
        const key = String(row.code || "").trim();
        const previousRow = previousETBMap ? previousETBMap.get(key) : null;
        
        if (previousRow) {
          // Match found - populate from previous year's data
          row.priorYear = previousRow.finalBalance || 0;
          row.isNewAccount = false; // Mark as existing account
          
          // Populate classification and grouping from previous year (if current year doesn't have them)
          if (!row.classification || row.classification === "") {
            row.classification = previousRow.classification || "";
            row.grouping1 = previousRow.grouping1 || "";
            row.grouping2 = previousRow.grouping2 || "";
            row.grouping3 = previousRow.grouping3 || "";
            row.grouping4 = previousRow.grouping4 || "";
            console.log(`[populatePriorYearData] Populated classification for ${key}: ${row.classification}`);
          }
          
          etbUpdatedCount++;
        } else {
          // No match found - this is a new account code
          row.priorYear = 0; // Keep as 0 for new accounts
          row.isNewAccount = true; // Mark as new account for frontend highlighting
          etbNewAccountCount++;
        }
        return row;
      });

      console.log(`[populatePriorYearData] Setting isNewAccount flags - New: ${etbNewAccountCount}, Existing: ${etbUpdatedCount}`);
      await currentETB.save();
      console.log(`[populatePriorYearData] ETB saved successfully with isNewAccount flags and classifications`);
    }

    return {
      success: true,
      message: "Prior year data populated successfully",
      populated: true,
      updatedRows: {
        trialBalance: tbUpdatedCount,
        extendedTrialBalance: etbUpdatedCount
      },
      newAccounts: {
        trialBalance: tbNewAccountCount,
        extendedTrialBalance: etbNewAccountCount
      },
      matchPercentage: matchResult.matchPercentage,
      details: `Populated ${tbUpdatedCount} existing accounts and found ${tbNewAccountCount} new accounts`,
      accountCodeStatusMap, // ✅ Return the map so controller can use it when creating ETB
      accountCodeClassificationMap // ✅ Return classification/grouping data from previous year
    };

  } catch (error) {
    console.error(`[populatePriorYearData] Error: ${error.message}`);
    return {
      success: false,
      message: `Error populating prior year data: ${error.message}`,
      populated: false,
      error: error.message
    };
  }
}

/**
 * Extracts the base title by removing year patterns
 * Examples:
 *   "Acme Corp Audit 2024" -> "Acme Corp Audit"
 *   "Company Review 2023" -> "Company Review"
 *   "ABC 2025" -> "ABC"
 */
function extractBaseTitle(title) {
  if (!title || typeof title !== 'string') {
    return '';
  }
  
  // Remove trailing year patterns like "Audit 2024", "Review 2023", or just "2024"
  // This regex matches optional comma/space + 4-digit year at the end
  const withoutYear = title
    .replace(/\s*,?\s*\d{4}\s*$/g, '')  // Remove trailing year: " 2024", ", 2024"
    .replace(/\s*Audit\s*$/gi, '')      // Remove trailing "Audit" word if no year follows
    .replace(/\s*Review\s*$/gi, '')     // Remove trailing "Review" word if no year follows
    .trim();
  
  return withoutYear;
}

/**
 * Builds a map of trial balance rows keyed by accountCode + accountName
 */
function buildTrialBalanceMap(trialBalance) {
  const map = new Map();
  const { headers, rows } = trialBalance;
  
  rows.forEach(row => {
    const key = buildRowKey(row, headers);
    if (key) {
      map.set(key, row);
    }
  });
  
  return map;
}

/**
 * Builds a map of extended trial balance rows keyed by code ONLY
 * Updated to match only on account code, ignoring account name differences
 */
function buildExtendedTrialBalanceMap(extendedTrialBalance) {
  const map = new Map();
  
  extendedTrialBalance.rows.forEach(row => {
    const key = String(row.code || "").trim();
    map.set(key, row);
  });
  
  return map;
}

/**
 * Builds a unique key for a trial balance row using accountCode ONLY
 * Updated to match only on account code, ignoring account name differences
 */
function buildRowKey(row, headers) {
  const codeIndex = findColumnIndex(headers, "Code");
  
  if (codeIndex === -1) {
    return null;
  }
  
  const code = row[codeIndex] || "";
  
  // Return just the code as the key (ignore account name)
  return String(code).trim();
}

/**
 * Finds the index of a column in the headers array (case-insensitive)
 */
function findColumnIndex(headers, columnName) {
  return headers.findIndex(
    header => header && header.toLowerCase().trim() === columnName.toLowerCase().trim()
  );
}

/**
 * Checks if current and previous trial balances match sufficiently
 * Returns true if at least 80% of current year accounts exist in previous year
 */
function checkTrialBalanceMatch(currentTB, previousTBMap) {
  let matchedRows = 0;
  let totalRows = 0;
  
  currentTB.rows.forEach(row => {
    const key = buildRowKey(row, currentTB.headers);
    if (key) {
      totalRows++;
      if (previousTBMap.has(key)) {
        matchedRows++;
      }
    }
  });
  
  const matchPercentage = totalRows > 0 ? (matchedRows / totalRows) * 100 : 0;
  const isMatch = matchPercentage >= 80;
  
  return {
    isMatch,
    matchPercentage,
    matchedRows,
    totalRows
  };
}

module.exports = {
  populatePriorYearData,
  extractBaseTitle // Export for testing or external use
};

