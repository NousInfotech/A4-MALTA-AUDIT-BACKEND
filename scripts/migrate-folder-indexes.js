/**
 * Migration script to fix GlobalFolder and FolderPermission indexes
 * Run this once: node scripts/migrate-folder-indexes.js
 */

require("dotenv").config()
const mongoose = require("mongoose")
const connectDB = require("../src/config/db")

async function migrateIndexes() {
  try {
    // Connect to database
    await connectDB()
    
    const GlobalFolder = mongoose.model("GlobalFolder", new mongoose.Schema({}, { strict: false }))
    const FolderPermission = mongoose.model("FolderPermission", new mongoose.Schema({}, { strict: false }))
    
    console.log("🔄 Checking GlobalFolder indexes...")
    const folderIndexes = await GlobalFolder.collection.getIndexes()
    console.log("Current GlobalFolder indexes:", Object.keys(folderIndexes))
    
    // Drop old unique index on 'name' if it exists
    if (folderIndexes.name_1) {
      console.log("🔄 Dropping old unique index on 'name'...")
      try {
        await GlobalFolder.collection.dropIndex("name_1")
        console.log("✅ Successfully dropped old index on 'name'")
      } catch (err) {
        if (err.code === 27 || err.codeName === "IndexNotFound") {
          console.log("ℹ️  Old index already removed")
        } else {
          throw err
        }
      }
    } else {
      console.log("ℹ️  No old index found on 'name'")
    }
    
    // Create compound index if it doesn't exist
    const currentFolderIndexes = await GlobalFolder.collection.getIndexes()
    const compoundIndexExists = Object.keys(currentFolderIndexes).some(key => 
      key.includes("name_1") && key.includes("parentId_1")
    )
    
    if (!compoundIndexExists) {
      console.log("🔄 Creating compound index on 'name' and 'parentId'...")
      await GlobalFolder.collection.createIndex(
        { name: 1, parentId: 1 }, 
        { unique: true, name: "name_1_parentId_1" }
      )
      console.log("✅ Compound index created successfully")
    } else {
      console.log("ℹ️  Compound index already exists")
    }
    
    console.log("\n🔄 Checking FolderPermission indexes...")
    const permIndexes = await FolderPermission.collection.getIndexes()
    console.log("Current FolderPermission indexes:", Object.keys(permIndexes))
    
    // Drop old unique index on 'folderName' if it exists
    if (permIndexes.folderName_1) {
      console.log("🔄 Dropping old unique index on 'folderName'...")
      try {
        await FolderPermission.collection.dropIndex("folderName_1")
        console.log("✅ Successfully dropped old index on 'folderName'")
      } catch (err) {
        if (err.code === 27 || err.codeName === "IndexNotFound") {
          console.log("ℹ️  Old index already removed")
        } else {
          console.warn("⚠️  Warning:", err.message)
        }
      }
    } else {
      console.log("ℹ️  No old index found on 'folderName'")
    }
    
    // Ensure unique index on folderId exists
    const currentPermIndexes = await FolderPermission.collection.getIndexes()
    const folderIdIndexExists = Object.keys(currentPermIndexes).some(key => 
      key.includes("folderId_1")
    )
    
    if (!folderIdIndexExists) {
      console.log("🔄 Creating unique index on 'folderId'...")
      await FolderPermission.collection.createIndex(
        { folderId: 1 }, 
        { unique: true, name: "folderId_1" }
      )
      console.log("✅ Unique index on 'folderId' created successfully")
    } else {
      console.log("ℹ️  Unique index on 'folderId' already exists")
    }
    
    // Show final indexes
    const finalFolderIndexes = await GlobalFolder.collection.getIndexes()
    const finalPermIndexes = await FolderPermission.collection.getIndexes()
    console.log("\n✅ Migration complete!")
    console.log("Final GlobalFolder indexes:", Object.keys(finalFolderIndexes))
    console.log("Final FolderPermission indexes:", Object.keys(finalPermIndexes))
    
    process.exit(0)
  } catch (err) {
    console.error("❌ Migration failed:", err)
    process.exit(1)
  }
}

migrateIndexes()

