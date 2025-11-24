/**
 * Migration Script: Convert Global Branding to Organization-Specific Branding
 * 
 * This script migrates existing global branding settings to organization-specific branding.
 * 
 * Usage:
 *   node scripts/migrateBrandingToOrganizations.js [organizationId]
 * 
 * If organizationId is provided, the existing global branding will be assigned to that organization.
 * Otherwise, default branding will be created for all existing organizations.
 */

const mongoose = require('mongoose');
const BrandingSettings = require('../src/models/BrandingSettings');
const Organization = require('../src/models/Organization');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function migrateBranding() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/audit-portal');
    console.log('✅ Connected to MongoDB');

    // Get organizationId from command line args
    const targetOrganizationId = process.argv[2];

    if (targetOrganizationId) {
      // Migrate existing global branding to specific organization
      console.log(`\n📦 Migrating global branding to organization: ${targetOrganizationId}`);
      
      // Find any branding without organizationId (old global branding)
      const globalBranding = await BrandingSettings.findOne({ organizationId: { $exists: false } });
      
      if (globalBranding) {
        // Check if target organization already has branding
        const existingBranding = await BrandingSettings.findOne({ organizationId: targetOrganizationId });
        
        if (existingBranding) {
          console.log(`⚠️  Organization ${targetOrganizationId} already has branding. Skipping migration.`);
        } else {
          // Create new branding for target organization based on global branding
          const newBranding = await BrandingSettings.create({
            organizationId: targetOrganizationId,
            organization_name: globalBranding.organization_name,
            organization_subname: globalBranding.organization_subname,
            logo_url: globalBranding.logo_url,
            sidebar_background_color: globalBranding.sidebar_background_color,
            sidebar_text_color: globalBranding.sidebar_text_color,
            body_background_color: globalBranding.body_background_color,
            body_text_color: globalBranding.body_text_color,
            primary_color: globalBranding.primary_color,
            primary_foreground_color: globalBranding.primary_foreground_color,
            accent_color: globalBranding.accent_color,
            accent_foreground_color: globalBranding.accent_foreground_color,
          });
          
          console.log(`✅ Created branding for organization ${targetOrganizationId}`);
          console.log(`   Branding ID: ${newBranding._id}`);
          
          // Optionally delete old global branding
          // await BrandingSettings.deleteOne({ _id: globalBranding._id });
          // console.log('✅ Deleted old global branding');
        }
      } else {
        console.log('⚠️  No global branding found. Creating default branding for organization.');
        await createDefaultBranding(targetOrganizationId);
      }
    } else {
      // Create default branding for all organizations
      console.log('\n📦 Creating default branding for all organizations...');
      
      const organizations = await Organization.find({});
      console.log(`Found ${organizations.length} organizations`);
      
      let created = 0;
      let skipped = 0;
      
      for (const org of organizations) {
        const orgId = org._id.toString();
        const existing = await BrandingSettings.findOne({ organizationId: orgId });
        
        if (existing) {
          console.log(`⏭️  Organization ${orgId} already has branding. Skipping.`);
          skipped++;
        } else {
          await createDefaultBranding(orgId);
          console.log(`✅ Created default branding for organization ${orgId}`);
          created++;
        }
      }
      
      console.log(`\n📊 Migration Summary:`);
      console.log(`   Created: ${created}`);
      console.log(`   Skipped: ${skipped}`);
      console.log(`   Total: ${organizations.length}`);
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

async function createDefaultBranding(organizationId) {
  return await BrandingSettings.create({
    organizationId,
    organization_name: 'Audit Portal',
    organization_subname: 'AUDIT & COMPLIANCE',
    logo_url: null,
    sidebar_background_color: '222 47% 11%',
    sidebar_text_color: '220 14% 96%',
    body_background_color: '48 100% 96%',
    body_text_color: '222 47% 11%',
    primary_color: '222 47% 11%',
    primary_foreground_color: '0 0% 100%',
    accent_color: '0 0% 45%',
    accent_foreground_color: '0 0% 100%'
  });
}

// Run migration
migrateBranding();

