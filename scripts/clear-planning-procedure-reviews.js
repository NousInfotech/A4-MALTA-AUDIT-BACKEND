require('dotenv').config();
const mongoose = require('mongoose');
const ReviewWorkflow = require('../src/models/ReviewWorkflow');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in your .env file.');
  process.exit(1);
}

async function clearPlanningProcedureReviews() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully.');

    // Count reviews before deletion
    const countBefore = await ReviewWorkflow.countDocuments({ itemType: 'planning-procedure' });
    console.log(`Found ${countBefore} reviews with itemType: 'planning-procedure'`);

    if (countBefore === 0) {
      console.log('No reviews to delete.');
      await mongoose.disconnect();
      return;
    }

    // Ask for confirmation (in a real scenario, you might want to add a prompt)
    console.log(`\n⚠️  WARNING: This will delete ${countBefore} review(s) with itemType: 'planning-procedure'`);
    console.log('Proceeding with deletion...\n');

    // Delete all reviews with itemType: 'planning-procedure'
    const result = await ReviewWorkflow.deleteMany({ itemType: 'planning-procedure' });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} review(s) with itemType: 'planning-procedure'`);

    // Verify deletion
    const countAfter = await ReviewWorkflow.countDocuments({ itemType: 'planning-procedure' });
    console.log(`\nVerification: ${countAfter} review(s) remaining with itemType: 'planning-procedure'`);

  } catch (error) {
    console.error('Error clearing planning-procedure reviews:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

clearPlanningProcedureReviews();

