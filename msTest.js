// testMicrosoftExcelService.js
// Smoke test for services/microsoftExcelService.js
// - Verifies env
// - ensureWorkbook() creates or reuses /Apps/ETB/{engagementId}/etb.xlsx
// - writeSheet() writes a 2D array to a fresh worksheet
// - readSheet() reads values back and compares
require("dotenv").config()

const {
  ensureWorkbook,
  writeSheet,
  readSheet,
} = require("./src/services/microsoftExcelService");

function assertEnv() {
  const required = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required env: ${missing.join(", ")}. ` +
      `Also set MS_DRIVE_ID or MS_SITE_ID (app-only cannot use /me/drive).`
    );
  }
  if (!process.env.MS_DRIVE_ID && !process.env.MS_SITE_ID) {
    throw new Error("Set MS_DRIVE_ID or MS_SITE_ID in env.");
  }
}

// Handy pretty logger
function logStep(title) {
  const line = "─".repeat(Math.max(6, title.length + 4));
  console.log(`\n${line}\n• ${title}\n${line}`);
}

// Deep equality check for 2D arrays (values)
function valuesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i], rb = b[i];
    if (!Array.isArray(ra) || !Array.isArray(rb)) return false;
    if (ra.length !== rb.length) return false;
    for (let j = 0; j < ra.length; j++) {
      // Normalize numbers vs strings for simple comparisons
      const va = ra[j];
      const vb = rb[j];
      if (Number.isFinite(va) && Number.isFinite(vb)) {
        if (Number(va) !== Number(vb)) return false;
      } else if (String(va) !== String(vb)) {
        return false;
      }
    }
  }
  return true;
}

(async () => {
  try {
    assertEnv();

    // You can pass ENGAGEMENT_ID via env; otherwise random-ish default:
    const engagementId = process.env.ENGAGEMENT_ID || `local-${Date.now()}`;
    const worksheetName = `Test_${new Date().toISOString().replace(/[:.]/g, "-")}`;

    // Sample 2D array with mixed types
    const values = [
      ["Name", "Qty", "Price", "InStock", "Date"],
      ["Widget", 10, 2.5, true, "2024-01-01"],
      ["Gadget", 5, 9.99, false, "2024-02-15"],
      ["Thingy", 1, 123.456, true, "2025-08-16"],
    ];

    logStep("1) ensureWorkbook() — create or reuse workbook");
    const wk1 = await ensureWorkbook({ engagementId });
    console.log("Workbook:", wk1);

    logStep("2) ensureWorkbook() again — should return same driveItemId");
    const wk2 = await ensureWorkbook({ engagementId });
    console.log("Workbook (second call):", wk2);

    if (wk1.id !== wk2.id) {
      throw new Error("ensureWorkbook returned different IDs for the same engagementId.");
    }

    logStep(`3) writeSheet() — write ${values.length}x${values[0].length} values to '${worksheetName}'`);
    await writeSheet({
      driveItemId: wk1.id,
      worksheetName,
      values,
    });
    console.log("Write OK");

    logStep(`4) readSheet() — read back values from '${worksheetName}'`);
    const readBack = await readSheet({
      driveItemId: wk1.id,
      worksheetName,
    });

    // Print a preview
    console.log("Read back (first few rows):");
    console.table(readBack.slice(0, 5));

    // Basic equality check
    if (!valuesEqual(values, readBack)) {
      console.error("❌ Mismatch between written and read values.");
      console.error("Written:", values);
      console.error("Read   :", readBack);
      process.exitCode = 2;
      return;
    }

    console.log("✅ All checks passed.");
    console.log(`Open in browser (if your org policy allows): ${wk1.webUrl}`);
  } catch (err) {
    console.error("\n❌ Test failed:", err.stack || err);
    process.exitCode = 1;
  }
})();
