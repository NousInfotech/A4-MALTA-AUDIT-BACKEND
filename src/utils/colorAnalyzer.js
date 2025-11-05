const getColors = require('get-image-colors');

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Calculate relative luminance for contrast checking
 */
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(rgb1, rgb2) {
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get best text color (black or white) for a background
 */
function getBestTextColor(bgColor) {
  const whiteContrast = getContrastRatio(bgColor, { r: 255, g: 255, b: 255 });
  const blackContrast = getContrastRatio(bgColor, { r: 0, g: 0, b: 0 });
  
  if (whiteContrast > blackContrast) {
    return { r: 255, g: 255, b: 255, hsl: '0 0% 100%' };
  }
  return { r: 0, g: 0, b: 0, hsl: '0 0% 0%' };
}

/**
 * Extract dominant colors from image buffer
 */
async function extractColors(imageBuffer) {
  try {
    const colors = await getColors(imageBuffer, 'image/png');
    
    return colors.map(color => ({
      r: color.rgb()[0],
      g: color.rgb()[1],
      b: color.rgb()[2],
      hex: color.hex(),
      hsl: rgbToHsl(color.rgb()[0], color.rgb()[1], color.rgb()[2])
    }));
  } catch (error) {
    console.error('Error extracting colors:', error);
    throw error;
  }
}

/**
 * Generate theme suggestions based on extracted colors
 */
function generateThemeSuggestions(colors) {
  if (!colors || colors.length === 0) {
    return [];
  }

  // Sort colors by saturation and lightness
  const sortedColors = [...colors].sort((a, b) => {
    const scoreA = a.hsl.s + (50 - Math.abs(50 - a.hsl.l));
    const scoreB = b.hsl.s + (50 - Math.abs(50 - b.hsl.l));
    return scoreB - scoreA;
  });

  const suggestions = [];

  // Theme 1: Primary color based (using most vibrant color)
  const primaryColor = sortedColors[0];
  const primaryHsl = primaryColor.hsl;
  
  suggestions.push({
    name: 'Brand Primary',
    description: 'Based on your logo\'s primary color',
    colors: {
      sidebar_background_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
      sidebar_text_color: '220 14% 96%',
      body_background_color: `${primaryHsl.h} 40% 98%`,
      body_text_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
      primary_color: `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`,
      primary_foreground_color: getBestTextColor(primaryColor).hsl,
      accent_color: `${(primaryHsl.h + 30) % 360} 96% 56%`,
      accent_foreground_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`
    }
  });

  // Theme 2: Dark mode with accent (using darkest color)
  const darkColor = colors.reduce((prev, curr) => 
    curr.hsl.l < prev.hsl.l ? curr : prev
  );
  const darkHsl = darkColor.hsl;

  suggestions.push({
    name: 'Dark & Professional',
    description: 'Dark sidebar with brand accent',
    colors: {
      sidebar_background_color: `${darkHsl.h} ${Math.max(darkHsl.s, 20)}% ${Math.min(darkHsl.l, 15)}%`,
      sidebar_text_color: '220 14% 96%',
      body_background_color: '210 40% 98%',
      body_text_color: `${darkHsl.h} ${Math.max(darkHsl.s, 20)}% ${Math.min(darkHsl.l, 15)}%`,
      primary_color: `${darkHsl.h} ${Math.max(darkHsl.s, 20)}% ${Math.min(darkHsl.l, 15)}%`,
      primary_foreground_color: '0 0% 100%',
      accent_color: `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`,
      accent_foreground_color: getBestTextColor(primaryColor).hsl
    }
  });

  // Theme 3: Light & Airy (using lighter colors)
  const lightColor = colors.reduce((prev, curr) => 
    curr.hsl.l > prev.hsl.l ? curr : prev
  );
  const lightHsl = lightColor.hsl;

  suggestions.push({
    name: 'Light & Modern',
    description: 'Clean light theme with subtle accents',
    colors: {
      sidebar_background_color: `${lightHsl.h} 15% ${Math.max(lightHsl.l - 10, 92)}%`,
      sidebar_text_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
      body_background_color: '0 0% 100%',
      body_text_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
      primary_color: `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`,
      primary_foreground_color: getBestTextColor(primaryColor).hsl,
      accent_color: `${primaryHsl.h} ${Math.max(primaryHsl.s - 20, 50)}% ${Math.min(primaryHsl.l + 20, 70)}%`,
      accent_foreground_color: '0 0% 100%'
    }
  });

  // Theme 4: Monochrome with brand accent
  if (colors.length >= 2) {
    const secondaryColor = sortedColors[1];
    const secondaryHsl = secondaryColor.hsl;

    suggestions.push({
      name: 'Balanced Duo',
      description: 'Uses two main colors from your brand',
      colors: {
        sidebar_background_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
        sidebar_text_color: '220 14% 96%',
        body_background_color: `${secondaryHsl.h} 30% 97%`,
        body_text_color: `${primaryHsl.h} ${primaryHsl.s}% ${Math.max(primaryHsl.l - 40, 11)}%`,
        primary_color: `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`,
        primary_foreground_color: getBestTextColor(primaryColor).hsl,
        accent_color: `${secondaryHsl.h} ${secondaryHsl.s}% ${secondaryHsl.l}%`,
        accent_foreground_color: getBestTextColor(secondaryColor).hsl
      }
    });
  }

  return suggestions;
}

module.exports = {
  extractColors,
  generateThemeSuggestions,
  rgbToHsl,
  getBestTextColor
};

