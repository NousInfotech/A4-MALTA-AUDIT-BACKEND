const fs = require("fs");
const path = require("path");

// Import your service (adjust path if needed)
const { extractPortalData } = require("../portal-data/extractPortalData.service");

// Engagement ID to test
const TEST_ENGAGEMENT_ID = "693c090b97e042e7f12aee2c";

exports.generateTestOutput = async () => {
  try {
    console.log("Extracting portal data for engagement:", TEST_ENGAGEMENT_ID);

    const data = await extractPortalData(TEST_ENGAGEMENT_ID);

    // Convert to proper JSON
    const jsonData = JSON.stringify(data, null, 2);

    // Save file in same folder
    const outputPath = path.join(__dirname, "output.json");

    fs.writeFileSync(outputPath, jsonData);

    console.log("\n✅ output.json generated successfully at:");
    console.log(outputPath);
  } catch (err) {
    console.error("\n❌ Error generating output.json:");
    console.error(err);
  } finally {
    process.exit(0);
  }
}