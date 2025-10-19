
const mongoose = require("mongoose");
const { Workbook, HistoricalSheet } = require("./ExcelWorkbook.js"); 
const Sheet = require("./Sheet.js"); 


const mongoURI = "";

async function deleteHistoricalData() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB...");

    // Start a session for atomicity (recommended)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("Deleting all HistoricalSheet documents...");
      const historicalDeleteResult = await HistoricalSheet.deleteMany({}, { session });
      console.log(`Deleted ${historicalDeleteResult.deletedCount} HistoricalSheet documents.`);

      console.log("Updating all Workbook documents to clear their versions array and reset version tag...");
      const workbookUpdateResult = await Workbook.updateMany(
        {}, // Target all workbooks
        { $set: { versions: [], version: "v1" } }, // Clear versions array and reset current version tag
        { session }
      );
      console.log(`Updated ${workbookUpdateResult.modifiedCount} Workbook documents.`);

      // Optional: If your "current" sheets might have historical associations that are now broken,
      // and you want to ensure they don't point to non-existent historical versions.
      // This is generally not needed if 'sheets' on the Workbook directly refers to the Sheet model.
      // If a new initial version is created, it will link to the *current* sheets.

      await session.commitTransaction();
      console.log("Transaction committed successfully.");
    } catch (error) {
      await session.abortTransaction();
      console.error("Transaction aborted due to an error:", error);
      throw error;
    } finally {
      session.endSession();
    }

    console.log("Historical data cleanup complete.");
  } catch (err) {
    console.error("Error during historical data cleanup:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

deleteHistoricalData();