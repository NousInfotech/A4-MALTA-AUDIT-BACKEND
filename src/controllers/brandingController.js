const { supabase } = require('../config/supabase');
const BrandingSettings = require('../models/BrandingSettings');
const { extractColors, generateThemeSuggestions } = require('../utils/colorAnalyzer');

/**
 * Get branding settings
 */
exports.getBrandingSettings = async (req, res) => {
  try {
    let settings = await BrandingSettings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await BrandingSettings.create({
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
 * Update branding settings (Admin only)
 */
exports.updateBrandingSettings = async (req, res) => {
  try {
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

    // Get or create settings
    let settings = await BrandingSettings.findOne();
    
    if (!settings) {
      settings = await BrandingSettings.create({});
    }

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

    res.json(settings);
  } catch (error) {
    console.error('Error in updateBrandingSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload logo (Admin only)
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = `logos/${Date.now()}_${file.originalname}`;

    // Extract colors from the image for theme suggestions
    let themeSuggestions = [];
    try {
      const colors = await extractColors(file.buffer);
      themeSuggestions = generateThemeSuggestions(colors);
      console.log('Generated theme suggestions:', themeSuggestions.length);
    } catch (colorError) {
      console.error('Error generating theme suggestions:', colorError);
      // Continue with upload even if color extraction fails
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('branding')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
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
 * Reset branding settings to defaults (Admin only)
 */
exports.resetBrandingSettings = async (req, res) => {
  try {
    // Get or create settings
    let settings = await BrandingSettings.findOne();
    
    if (!settings) {
      settings = await BrandingSettings.create({});
    }

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

    res.json(settings);
  } catch (error) {
    console.error('Error in resetBrandingSettings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

