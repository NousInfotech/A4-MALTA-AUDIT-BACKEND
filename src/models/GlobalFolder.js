const mongoose = require("mongoose")
const { Schema } = mongoose

const GlobalFolderSchema = new Schema({
  name: { type: String, required: true, trim: true },
  path: { type: String, required: true },
  parentId: { type: Schema.Types.ObjectId, ref: "GlobalFolder", default: null },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }, 
})

// Compound index to ensure unique folder names within the same parent
GlobalFolderSchema.index({ name: 1, parentId: 1 }, { unique: true })

const GlobalFolder = mongoose.model("GlobalFolder", GlobalFolderSchema)

// Migration: Drop old unique index on 'name' if it exists
// This allows folders with the same name in different parents
// Run this after MongoDB connection is established
if (mongoose.connection.readyState === 1) {
  // Already connected, run migration immediately
  migrateIndexes()
} else {
  // Wait for connection
  mongoose.connection.once('connected', migrateIndexes)
}

async function migrateIndexes() {
  try {
    const indexes = await GlobalFolder.collection.getIndexes()
    
    // Check if old unique index on 'name' exists
    if (indexes.name_1) {
      console.log('🔄 Migrating GlobalFolder indexes: Dropping old unique index on "name"...')
      try {
        await GlobalFolder.collection.dropIndex('name_1')
        console.log('✅ Successfully dropped old index on "name"')
      } catch (err) {
        if (err.code === 27 || err.codeName === 'IndexNotFound') {
          console.log('ℹ️  Old index already removed')
        } else {
          console.warn('⚠️  Warning: Could not drop old index:', err.message)
        }
      }
    }
    
    // Ensure compound index exists
    const currentIndexes = await GlobalFolder.collection.getIndexes()
    const compoundIndexExists = Object.keys(currentIndexes).some(key => 
      key.includes('name_1') && key.includes('parentId_1')
    )
    
    if (!compoundIndexExists) {
      console.log('🔄 Creating compound index on "name" and "parentId"...')
      await GlobalFolder.collection.createIndex({ name: 1, parentId: 1 }, { unique: true })
      console.log('✅ Compound index created successfully')
    }
  } catch (err) {
    console.warn('⚠️  Warning: Could not migrate indexes:', err.message)
  }
}

module.exports = GlobalFolder
