const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

/* ----------------------------- */
/* TEXT EXTRACTION PER PAGE      */
/* ----------------------------- */
const extractTextPerPage = async (pdfBuffer, totalPages) => {
  try {
    const data = await pdfParse(pdfBuffer);
    if (!data?.text) return Array(totalPages).fill("");

    let pages = data.text.split("\f");

    if (pages.length !== totalPages && totalPages > 1) {
      const avg = Math.ceil(data.text.length / totalPages);
      pages = Array.from({ length: totalPages }, (_, i) =>
        data.text.slice(i * avg, (i + 1) * avg).trim()
      );
    }

    while (pages.length < totalPages) pages.push("");
    return pages.slice(0, totalPages).map(p => p.trim());
  } catch (err) {
    console.error("Text extraction failed:", err);
    return Array(totalPages).fill("");
  }
};

/* ----------------------------- */
/* PDF → IMAGE (POPPLER CLI)     */
/* ----------------------------- */
const convertPdfToImages = async (pdfPath, outDir, prefix) => {
  const cmd = `pdftoppm -png -r 150 "${pdfPath}" "${path.join(outDir, prefix)}"`;
  await execAsync(cmd);
};

/* ----------------------------- */
/* MAIN EXPORT                   */
/* ----------------------------- */
exports.fsPdfDataExtractor = async (
  pdfBuffer,
  sessionId = null,
  outputDir = null
) => {
  if (!pdfBuffer) throw new Error("PDF buffer not provided");

  const uniqueSessionId =
    sessionId ||
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const tempDir = path.join(__dirname, "../../tmp");
  const imagesOutputDir =
    outputDir || path.join(__dirname, "../../tmp/images");

  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(imagesOutputDir, { recursive: true });

  const tempPdfPath = path.join(tempDir, `temp-${uniqueSessionId}.pdf`);
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  try {
    /* ---------- Page count ---------- */
    const { numpages: totalPages = 1 } = await pdfParse(pdfBuffer);

    /* ---------- Convert PDF to images ---------- */
    const prefix = uniqueSessionId;
    await convertPdfToImages(tempPdfPath, tempDir, prefix);

    /* ---------- Collect generated images ---------- */
    const pngFiles = fs
      .readdirSync(tempDir)
      .filter(f => f.startsWith(prefix) && f.endsWith(".png"))
      .sort((a, b) => {
        const pa = parseInt(a.split("-").pop());
        const pb = parseInt(b.split("-").pop());
        return pa - pb;
      });

    /* ---------- Extract text ---------- */
    const textPages = await extractTextPerPage(pdfBuffer, totalPages);

    const pageDataArray = [];
    const imageFiles = [];

    for (let i = 0; i < totalPages; i++) {
      const pageNo = i + 1;
      let imageName = null;

      if (pngFiles[i]) {
        const src = path.join(tempDir, pngFiles[i]);
        imageName = `${uniqueSessionId}_page_${pageNo}.png`;
        const dest = path.join(imagesOutputDir, imageName);

        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);

        imageFiles.push(dest);
      }

      pageDataArray.push({
        page_no: pageNo,
        text: textPages[i] || "",
        imageName
      });
    }

    fs.unlinkSync(tempPdfPath);

    return {
      pageDataArray,
      imageFiles,
      sessionId: uniqueSessionId
    };
  } catch (err) {
    console.error("fsPdfDataExtractor Error:", err);
    throw new Error("Failed to extract PDF data: " + err.message);
  }
};
