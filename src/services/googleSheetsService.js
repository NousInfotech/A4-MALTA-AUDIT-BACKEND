// services/googleSheetsService.js
require('dotenv').config();
const { google } = require('googleapis');
const { URL } = require('url');

// Name of the sheet tab
const SHEET_NAME = 'Sheet1';

/**
 * Extract the spreadsheetId from any Google Sheets URL.
 */
function extractSpreadsheetId(sheetUrl) {
  const u = new URL(sheetUrl);
  const match = u.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const id = u.searchParams.get('id');
  if (id) return id;
  throw new Error('No spreadsheet ID found in URL');
}

// Initialize Google auth (reads JSON from GOOGLE_APPLICATION_CREDENTIALS)
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetch ALL rows from the sheet, log them, and return the raw 2D array.
 *
 * @param {string} sheetUrl Full Google Sheets URL
 * @returns {Promise<string[][]>} All rows (including header)
 */
module.exports.fetch = async function fetchAllRows(sheetUrl) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  // Grab columns A through Z—adjust if your data spills further right
  const range = `${SHEET_NAME}!A:Z`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  const rows = res.data.values || [];
  console.log(`\n✅ Fetched ${rows.length} rows from "${SHEET_NAME}":\n`);
  
  // Log each row
  rows.forEach((row, i) => {
    if (i === 0) {
      console.log('[HEADER]', row.join(' | '));
    } else {
      console.log(`[Row ${i}]`, row.join(' | '));
    }
  });

  // Also print a table view
  console.log('\nAs table:\n');
  console.table(rows);

  return rows;
};
