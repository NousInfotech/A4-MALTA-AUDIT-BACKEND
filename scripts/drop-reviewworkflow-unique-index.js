/**
 * Script to drop the unique index on itemType + itemId from ReviewWorkflow collection
 * This allows multiple ReviewWorkflow entries for the same item to track status history
 * 
 * Usage: node scripts/drop-reviewworkflow-unique-index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ReviewWorkflow = require('../src/models/ReviewWorkflow');

async function dropUniqueIndex() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');

    // Get the collection
    const collection = mongoose.connection.db.collection('reviewworkflows');
    
    // List all indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check if the unique index exists
    const uniqueIndex = indexes.find(
      index => index.name === 'itemType_1_itemId_1' && index.unique === true
    );

    if (uniqueIndex) {
      console.log('\n🗑️  Dropping unique index: itemType_1_itemId_1');
      await collection.dropIndex('itemType_1_itemId_1');
      console.log('✅ Unique index dropped successfully!');
      
      // Verify it's gone
      console.log('\n📋 Updated indexes:');
      const updatedIndexes = await collection.indexes();
      updatedIndexes.forEach(index => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    } else {
      console.log('\nℹ️  Unique index "itemType_1_itemId_1" not found. It may have already been dropped.');
      
      // Check if non-unique index exists
      const nonUniqueIndex = indexes.find(
        index => index.name === 'itemType_1_itemId_1'
      );
      
      if (nonUniqueIndex) {
        console.log('✅ Non-unique index already exists. No action needed.');
      } else {
        console.log('⚠️  No index found. The schema will create a new non-unique index on next save.');
      }
    }

    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 27) {
      console.log('ℹ️  Index not found. It may have already been dropped.');
    }
    
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
dropUniqueIndex();

