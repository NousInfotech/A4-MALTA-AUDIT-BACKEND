const fs = require('fs');
const path = require('path');

/**
 * Converts image files to base64 data URLs for OpenAI vision API
 * @param {Array} imageFiles - Array of image file paths
 * @param {Array} pdfDataArray - Array of page data objects with page_no and imageName
 * @returns {Promise<Array>} Array of { page_no, base64Image } objects
 */
async function convertImagesToBase64(imageFiles, pdfDataArray) {
  if (!imageFiles || !Array.isArray(imageFiles) || imageFiles.length === 0) {
    return [];
  }

  if (!pdfDataArray || !Array.isArray(pdfDataArray)) {
    throw new Error("pdfDataArray is required to map images to page numbers");
  }

  // Create a map of imageName to page_no from pdfDataArray
  const imageNameToPageMap = {};
  pdfDataArray.forEach(page => {
    if (page.imageName) {
      // Extract just the filename from the full path if needed
      const imageName = path.basename(page.imageName);
      imageNameToPageMap[imageName] = page.page_no;
    }
  });

  const base64Images = [];

  for (const imagePath of imageFiles) {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`[Image Utils] Image file not found: ${imagePath}`);
        continue;
      }

      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Convert to base64
      const base64String = imageBuffer.toString('base64');
      const base64Image = `data:image/png;base64,${base64String}`;

      // Extract image filename to find corresponding page number
      const imageName = path.basename(imagePath);
      const pageNo = imageNameToPageMap[imageName] || null;

      // Try to extract page number from filename if not found in map
      // Format: sessionId_page_X.png
      let extractedPageNo = pageNo;
      if (!extractedPageNo) {
        const match = imageName.match(/_page_(\d+)\.png$/);
        if (match) {
          extractedPageNo = parseInt(match[1], 10);
        }
      }

      base64Images.push({
        page_no: extractedPageNo,
        base64Image: base64Image,
        imageName: imageName
      });

    } catch (error) {
      console.error(`[Image Utils] Failed to convert image: ${imagePath}`, error);
      // Continue with other images instead of failing completely
      // This allows partial processing if some images fail
    }
  }

  // Sort by page number for consistency
  base64Images.sort((a, b) => {
    if (a.page_no === null && b.page_no === null) return 0;
    if (a.page_no === null) return 1;
    if (b.page_no === null) return -1;
    return a.page_no - b.page_no;
  });

  return base64Images;
}

module.exports = {
  convertImagesToBase64
};

