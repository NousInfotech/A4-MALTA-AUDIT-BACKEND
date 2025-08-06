// testGoogleSheets.js
require('dotenv').config();
const { fetch } = require('./src/services/googleSheetsService');

async function main() {
  const sheetUrl = process.argv[2];
  if (!sheetUrl) {
    console.error('Usage: node testGoogleSheets.js <GOOGLE_SHEET_URL>');
    process.exit(1);
  }

  try {
    console.log(`Fetching data from: ${sheetUrl}\n`);
    const rows = await fetch(sheetUrl);
    console.log('Fetched rows:');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error('Error fetching sheet data:', err.message);
    process.exit(1);
  }
}

main();
