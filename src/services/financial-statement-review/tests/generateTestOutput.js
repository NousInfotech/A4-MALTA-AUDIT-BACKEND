const fs = require("fs");
const path = require("path");

// Import your service (adjust path if needed)
const {
  extractPortalData,
} = require("../portal-data/extractPortalData.service");
const {
  fsPdfTextExtractor,
  fsPdfImageExtractor,
} = require("../pdf-data/fsPdfDataExtractor");

const { 
  generateFinancialStatementReview
} = require("../generateFSReview.service");

// Engagement ID to test
const TEST_ENGAGEMENT_ID = "693c090b97e042e7f12aee2c";
const pdfFile = path.join(__dirname, "white_investment_limited.pdf");

exports.generateTestOutput = async () => {
  try {
    console.log("Extracting portal data for engagement:", TEST_ENGAGEMENT_ID);

    const data = await extractPortalData(TEST_ENGAGEMENT_ID);

    // Convert to proper JSON
    const jsonData = JSON.stringify(data, null, 2);

    // Save file in same folder
    const outputPath = path.join(__dirname, "output.json");

    fs.writeFileSync(outputPath, jsonData);

    console.log("\n✅ output.json generated successfully at:");
    console.log(outputPath);
  } catch (err) {
    console.error("\n❌ Error generating output.json:");
    console.error(err);
  } finally {
    process.exit(0);
  }
};

exports.extractFsPdfDataTestOutput = async () => {
  try {
    if (!fs.existsSync(pdfFile)) {
      throw new Error("PDF file not found");
    }

    const baseDir = __dirname;

    // Ensure output folders exist
    const imagesDir = path.join(baseDir, "images");
    const dataDir = path.join(baseDir, "data");

    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    // Read PDF as buffer
    const pdfBuffer = fs.readFileSync(pdfFile);

    // Extract
    const [text, images] = await Promise.all([
      fsPdfTextExtractor(pdfBuffer),
      fsPdfImageExtractor(pdfBuffer),
    ]);

    // --------------------
    // SAVE TEXT
    // --------------------
    const textPath = path.join(dataDir, "pdf-text.json");

    fs.writeFileSync(
      textPath,
      JSON.stringify(
        {
          source: "white_investment_limited.pdf",
          extractedAt: new Date().toISOString(),
          text,
        },
        null,
        2
      )
    );

    // --------------------
    // SAVE IMAGES
    // --------------------
    images.forEach((base64, index) => {
      const imageBuffer = Buffer.from(
        base64.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );

      const imagePath = path.join(imagesDir, `page-${index + 1}.png`);
      fs.writeFileSync(imagePath, imageBuffer);
    });

    // ✅ RETURN METADATA ONLY
    return {
      textFile: "data/pdf-text.json",
      imagesSaved: images.length,
      imageFolder: "images/",
    };

  } catch (err) {
    console.error("extractFsPdfDataTestOutput Error:", err);
    throw err; // controller will handle
  }
};

exports.testFsReview = async () => {
  try {
    if (!fs.existsSync(pdfFile)) {
      throw new Error("PDF file not found: " + pdfFile);
    }

    console.log("Starting FS Review test...");
    console.log("Engagement ID:", TEST_ENGAGEMENT_ID);
    console.log("PDF File:", pdfFile);

    // Read PDF file as buffer
    const pdfBuffer = fs.readFileSync(pdfFile);
    
    // Create mock multer file object
    const mockFile = {
      buffer: pdfBuffer,
      originalname: path.basename(pdfFile),
      mimetype: "application/pdf",
      size: pdfBuffer.length
    };

    // Generate financial statement review
    console.log("\nGenerating financial statement review...");
    const output = await generateFinancialStatementReview(TEST_ENGAGEMENT_ID, mockFile);

    // Save output to JSON file in same folder
    const outputPath = path.join(__dirname, "fs-output.json");
    const jsonData = JSON.stringify(output, null, 2);
    
    fs.writeFileSync(outputPath, jsonData);

    console.log("\n✅ fs-output.json generated successfully at:");
    console.log(outputPath);
    console.log("\nReview Summary:");
    console.log(`- Section A (Confirmed): ${output.A?.items?.length || 0} items`);
    console.log(`- Section B (Critical Errors): ${output.B?.items?.length || 0} items`);
    console.log(`- Section C (Disclosure Breaches): ${output.C?.items?.length || 0} items`);
    console.log(`- Final Verdict: ${output.E?.verdict || 'Unknown'}`);

    return output;

  } catch (err) {
    console.error("\n❌ Error in testFsReview:");
    console.error(err);
    throw err;
  }
};