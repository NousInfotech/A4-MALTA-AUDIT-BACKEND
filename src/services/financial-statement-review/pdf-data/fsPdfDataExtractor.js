const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const poppler = require("pdf-poppler");


/**
 * Extracts text content from FS PDF.
 * @param {Buffer} pdfBuffer - Uploaded FS file buffer
 * @returns {Promise<string>} - Extracted full text from PDF
 */
exports.fsPdfTextExtractor = async (pdfBuffer) => {
  try {
    if (!pdfBuffer) throw new Error("PDF buffer not provided.");

    const data = await pdfParse(pdfBuffer);

    if (!data || !data.text) {
      throw new Error("Failed to extract text from PDF.");
    }

    return data.text.trim();

  } catch (err) {
    console.error("fsPdfTextExtractor Error:", err);
    throw new Error("Failed to extract PDF text: " + err.message);
  }
};

/**
 * Converts PDF pages to base64 PNG images.
 * @param {Buffer} pdfBuffer - Uploaded FS file buffer
 * @returns {Promise<string[]>} - Array of base64 PNG strings (one per page)
 */
exports.fsPdfImageExtractor = async (pdfBuffer) => {
  try {
    if (!pdfBuffer) throw new Error("PDF buffer not provided.");

    // 1. Write temporary PDF file
    const tempDir = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    const outputBase = tempPdfPath.replace(".pdf", "");

    // 2. Poppler options
    const options = {
      format: "png",
      out_dir: tempDir,
      out_prefix: path.basename(outputBase),
      page: null
    };

    // 3. Convert PDF -> PNG
    await poppler.convert(tempPdfPath, options);

    // 4. Read generated images
    const images = [];
    const files = fs.readdirSync(tempDir);

    const pngFiles = files.filter(f =>
      f.startsWith(path.basename(outputBase)) && f.endsWith(".png")
    );

    for (const file of pngFiles) {
      const imgPath = path.join(tempDir, file);
      const base64 = fs.readFileSync(imgPath).toString("base64");

      images.push(`data:image/png;base64,${base64}`);

      // optional: delete image file after reading
      fs.unlinkSync(imgPath);
    }

    // 5. Cleanup: delete temp pdf
    fs.unlinkSync(tempPdfPath);

    // Sort by page order
    images.sort();

    return images;

  } catch (err) {
    console.error("fsPdfImageExtractor Error:", err);
    throw new Error("Failed to extract PDF images: " + err.message);
  }
};
