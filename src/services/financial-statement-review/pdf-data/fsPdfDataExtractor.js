const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const poppler = require("pdf-poppler");


/**
 * Extracts text from all pages and splits by page.
 * Uses multiple methods to ensure all pages are captured.
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {number} totalPages - Total number of pages in the PDF
 * @returns {Promise<string[]>} - Array of text per page
 */
const extractTextPerPage = async (pdfBuffer, totalPages) => {
  try {
    const data = await pdfParse(pdfBuffer);
    if (!data || !data.text) {
      // Return empty strings for all pages if no text found
      return Array(totalPages).fill("");
    }
    
    // Method 1: Split by form feed character (\f) which is used as page separator
    let pages = data.text.split('\f');
    
    // If form feed splitting didn't work well (too few or too many pages),
    // try alternative methods
    if (pages.length !== totalPages) {
      // Method 2: Try splitting by common page break patterns
      // Some PDFs use form feed followed by newline, or multiple newlines
      pages = data.text.split(/\f+\n?|\n{3,}/);
      
      // If still not matching, try to estimate page breaks
      if (pages.length !== totalPages && totalPages > 1) {
        // Estimate average characters per page
        const avgCharsPerPage = Math.ceil(data.text.length / totalPages);
        pages = [];
        
        // Split text into roughly equal chunks
        for (let i = 0; i < totalPages; i++) {
          const start = i * avgCharsPerPage;
          const end = (i + 1) * avgCharsPerPage;
          pages.push(data.text.substring(start, end).trim());
        }
      }
    }
    
    // Ensure we have exactly totalPages entries
    while (pages.length < totalPages) {
      pages.push(""); // Add empty strings for missing pages
    }
    
    // Trim each page text and limit to totalPages
    return pages.slice(0, totalPages).map(page => page.trim());
  } catch (err) {
    console.error("Error extracting text per page:", err);
    // Return empty strings for all pages on error
    return Array(totalPages).fill("");
  }
};

/**
 * Extracts data per page from FS PDF.
 * @param {Buffer} pdfBuffer - Uploaded FS file buffer
 * @param {string} sessionId - Unique session ID for this request (used to prevent filename conflicts)
 * @param {string} outputDir - Directory to save images (optional, defaults to tmp/images)
 * @returns {Promise<Object>} - Object with pageDataArray and imageFiles array for cleanup
 */
exports.fsPdfDataExtractor = async (pdfBuffer, sessionId = null, outputDir = null) => {
  try {
    if (!pdfBuffer) throw new Error("PDF buffer not provided.");

    // Generate unique session ID if not provided (engagementId_timestamp_random)
    const uniqueSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Get total number of pages
    const pdfData = await pdfParse(pdfBuffer);
    const totalPages = pdfData.numpages || 1;

    // Setup output directory for images
    const imagesOutputDir = outputDir || path.join(__dirname, "../../tmp/images");
    if (!fs.existsSync(imagesOutputDir)) {
      fs.mkdirSync(imagesOutputDir, { recursive: true });
    }

    // Setup temporary directory for PDF processing
    const tempDir = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPdfPath = path.join(tempDir, `temp-${uniqueSessionId}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    const outputBase = tempPdfPath.replace(".pdf", "");

    // Convert PDF to PNG images
    const options = {
      format: "png",
      out_dir: tempDir,
      out_prefix: path.basename(outputBase),
      page: null
    };

    await poppler.convert(tempPdfPath, options);

    // Read generated image files
    const files = fs.readdirSync(tempDir);
    const pngFiles = files
      .filter(f => f.startsWith(path.basename(outputBase)) && f.endsWith(".png"))
      .sort(); // Sort to maintain page order

    // Extract text per page (pass totalPages for better extraction)
    const textPages = await extractTextPerPage(pdfBuffer, totalPages);

    // Extract data per page and track image files for cleanup
    const pageDataArray = [];
    const imageFiles = []; // Track all image files created for cleanup

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1;
      
      // Get text from this page (use extracted text or empty string)
      const pageText = i < textPages.length ? textPages[i] : "";

      // Get corresponding image file
      let imageName = null;
      if (i < pngFiles.length) {
        const sourceImagePath = path.join(tempDir, pngFiles[i]);
        const imageExtension = path.extname(pngFiles[i]) || ".png";
        // Use unique session ID in filename to prevent conflicts
        imageName = `${uniqueSessionId}_page_${pageNumber}${imageExtension}`;
        const destImagePath = path.join(imagesOutputDir, imageName);

        // Copy image to output directory with unique name
        fs.copyFileSync(sourceImagePath, destImagePath);
        
        // Track image file for cleanup
        imageFiles.push(destImagePath);

        // Delete temporary image file
        fs.unlinkSync(sourceImagePath);
      }

      pageDataArray.push({
        page_no: pageNumber,
        text: pageText,
        imageName: imageName // This will be the unique filename
      });
    }

    // Cleanup: delete temp PDF
    fs.unlinkSync(tempPdfPath);

    return {
      pageDataArray,
      imageFiles, // Return list of image files for cleanup
      sessionId: uniqueSessionId
    };

  } catch (err) {
    console.error("fsPdfDataExtractor Error:", err);
    throw new Error("Failed to extract PDF data: " + err.message);
  }
};
