const { supabase } = require('../config/supabase');
const BrandingSettings = require('../models/BrandingSettings');
const { extractColors, generateThemeSuggestions } = require('../utils/colorAnalyzer');
const sharp = require('sharp');

/**
 * Get branding settings for the current user's organization
 */
exports.getBrandingSettings = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Find branding settings for this organization
    let settings = await BrandingSettings.findOne({ organizationId });
    
    // If no settings exist, create default settings for this organization
    if (!settings) {
      settings = await BrandingSettings.create({
        organizationId,
        organization_name: 'Audit Portal',
        organization_subname: 'AUDIT & COMPLIANCE',
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

    res.json(settings);
  } catch (error) {
    console.error('Error in getBrandingSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update branding settings (Admin only) - for the current user's organization
 */
exports.updateBrandingSettings = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const {
      organization_name,
      organization_subname,
      logo_url,
      sidebar_background_color,
      sidebar_text_color,
      body_background_color,
      body_text_color,
      primary_color,
      primary_foreground_color,
      accent_color,
      accent_foreground_color
    } = req.body;

    // Get or create settings for this organization
    let settings = await BrandingSettings.findOne({ organizationId });
    
    if (!settings) {
      settings = await BrandingSettings.create({
        organizationId,
        organization_name: organization_name || 'Audit Portal',
        organization_subname: organization_subname || 'AUDIT & COMPLIANCE',
        sidebar_background_color: sidebar_background_color || '222 47% 11%',
        sidebar_text_color: sidebar_text_color || '220 14% 96%',
        body_background_color: body_background_color || '48 100% 96%',
        body_text_color: body_text_color || '222 47% 11%',
        primary_color: primary_color || '222 47% 11%',
        primary_foreground_color: primary_foreground_color || '0 0% 100%',
        accent_color: accent_color || '0 0% 45%',
        accent_foreground_color: accent_foreground_color || '0 0% 100%'
      });
    } else {
      // Update the settings
      if (organization_name !== undefined) settings.organization_name = organization_name;
      if (organization_subname !== undefined) settings.organization_subname = organization_subname;
      if (logo_url !== undefined) settings.logo_url = logo_url;
      if (sidebar_background_color !== undefined) settings.sidebar_background_color = sidebar_background_color;
      if (sidebar_text_color !== undefined) settings.sidebar_text_color = sidebar_text_color;
      if (body_background_color !== undefined) settings.body_background_color = body_background_color;
      if (body_text_color !== undefined) settings.body_text_color = body_text_color;
      if (primary_color !== undefined) settings.primary_color = primary_color;
      if (primary_foreground_color !== undefined) settings.primary_foreground_color = primary_foreground_color;
      if (accent_color !== undefined) settings.accent_color = accent_color;
      if (accent_foreground_color !== undefined) settings.accent_foreground_color = accent_foreground_color;

      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    console.error('Error in updateBrandingSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload logo (Admin only)
 * Automatically resizes images to 512x512px (maintaining aspect ratio) for optimal display
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    let processedBuffer = file.buffer;
    let contentType = file.mimetype;
    let fileExtension = 'png'; // Default extension

    // Resize image to 512x512px (maintaining aspect ratio) using sharp
    // This ensures all images work well regardless of original size
    try {
      // If it's SVG, keep it as is (vector graphics don't need resizing)
      if (file.mimetype === 'image/svg+xml') {
        // SVG files are vector-based, no resizing needed
        processedBuffer = file.buffer;
        contentType = 'image/svg+xml';
        // Preserve original extension for SVG
        const originalExt = file.originalname.split('.').pop();
        fileExtension = originalExt || 'svg';
      } else {
        // Resize raster images (PNG, JPG, etc.) to max 512x512px while maintaining aspect ratio
        const image = sharp(file.buffer);
        const metadata = await image.metadata();
        
        processedBuffer = await image
          .resize(512, 512, {
            fit: 'inside', // Maintain aspect ratio, fit within 512x512
            withoutEnlargement: false, // Allow upscaling if image is smaller
            background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background for PNG
          })
          .png({ quality: 90, compressionLevel: 9 }) // Convert to PNG with good quality
          .toBuffer();
        
        contentType = 'image/png';
        fileExtension = 'png';
        console.log(`✅ Image resized from ${metadata.width}x${metadata.height} to max 512x512px`);
      }
    } catch (resizeError) {
      console.error('Error resizing image:', resizeError);
      // If resize fails, use original image
      processedBuffer = file.buffer;
      // Try to preserve original extension
      const originalExt = file.originalname.split('.').pop();
      if (originalExt) {
        fileExtension = originalExt;
      }
    }

    const baseFileName = file.originalname.replace(/\.[^/.]+$/, '') || 'logo';
    const fileName = `logos/${Date.now()}_${baseFileName}.${fileExtension}`;

    // Extract colors from the processed image for theme suggestions
    let themeSuggestions = [];
    try {
      const colors = await extractColors(processedBuffer);
      themeSuggestions = generateThemeSuggestions(colors);
      console.log('Generated theme suggestions:', themeSuggestions.length);
    } catch (colorError) {
      console.error('Error generating theme suggestions:', colorError);
      // Continue with upload even if color extraction fails
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('branding')
      .upload(fileName, processedBuffer, {
        contentType: contentType,
        upsert: false
      });

    if (error) {
      console.error('Error uploading logo:', error);
      return res.status(500).json({ error: 'Failed to upload logo' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('branding')
      .getPublicUrl(fileName);

    res.json({ 
      logo_url: publicUrl,
      theme_suggestions: themeSuggestions
    });
  } catch (error) {
    console.error('Error in uploadLogo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reset branding settings to defaults (Admin only) - for the current user's organization
 */
exports.resetBrandingSettings = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Get or create settings for this organization
    let settings = await BrandingSettings.findOne({ organizationId });
    
    if (!settings) {
      settings = await BrandingSettings.create({
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
    } else {
      // Reset to defaults
      settings.organization_name = 'Audit Portal';
      settings.organization_subname = 'AUDIT & COMPLIANCE';
      settings.logo_url = null;
      settings.sidebar_background_color = '222 47% 11%';
      settings.sidebar_text_color = '220 14% 96%';
      settings.body_background_color = '48 100% 96%';
      settings.body_text_color = '222 47% 11%';
      settings.primary_color = '222 47% 11%';
      settings.primary_foreground_color = '0 0% 100%';
      settings.accent_color = '0 0% 45%';
      settings.accent_foreground_color = '0 0% 100%';

      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    console.error('Error in resetBrandingSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

