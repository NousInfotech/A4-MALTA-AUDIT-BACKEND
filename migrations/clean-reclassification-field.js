/**
 * Migration Script: Clean Reclassification Field
 * 
 * This script converts all string reclassification values to numbers in the ExtendedTrialBalance collection.
 * Run this once to fix existing data after changing the reclassification field from String to Number.
 * 
 * Usage:
 *   node migrations/clean-reclassification-field.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function cleanReclassificationField() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("extendedtrialbalances");

    console.log("\n📊 Fetching all ETB documents...");
    const allDocs = await collection.find({}).toArray();
    console.log(`Found ${allDocs.length} ETB documents`);

    let totalUpdated = 0;
    let totalRowsProcessed = 0;

    for (const doc of allDocs) {
      if (!doc.rows || !Array.isArray(doc.rows)) continue;

      let docModified = false;
      const cleanedRows = doc.rows.map((row) => {
        totalRowsProcessed++;

        // Check if reclassification is a string
        if (typeof row.reclassification === "string") {
          docModified = true;
          const parsed = parseFloat(row.reclassification);
          const numValue = isNaN(parsed) ? 0 : parsed;
          
          console.log(
            `  Converting: "${row.reclassification}" → ${numValue} (Code: ${row.code || "N/A"})`
          );
          
          return {
            ...row,
            reclassification: numValue,
          };
        }

        // Ensure it's a number (could be undefined or null)
        if (row.reclassification === undefined || row.reclassification === null) {
          docModified = true;
          return {
            ...row,
            reclassification: 0,
          };
        }

        return row;
      });

      if (docModified) {
        console.log(`\n🔧 Updating ETB document: ${doc._id}`);
        await collection.updateOne(
          { _id: doc._id },
          { $set: { rows: cleanedRows, updatedAt: new Date() } }
        );
        totalUpdated++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration Complete!");
    console.log(`   Documents updated: ${totalUpdated}/${allDocs.length}`);
    console.log(`   Total rows processed: ${totalRowsProcessed}`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the migration
cleanReclassificationField();

