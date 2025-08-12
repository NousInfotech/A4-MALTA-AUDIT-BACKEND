require("dotenv").config();
const { google } = require("googleapis");
const { URL } = require("url");

const SHEET_NAME = "Sheet1";

function extractSpreadsheetId(sheetUrl) {
  const u = new URL(sheetUrl);
  const match = u.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  const id = u.searchParams.get("id");
  if (id) return id;
  throw new Error("No spreadsheet ID found in URL");
}

function isQuotaExceededError(e) {
  const msg = String(e?.message || "");
  const code = e?.code || e?.response?.status;
  return (
    code === 403 &&
    (msg.includes("Drive storage quota") ||
      msg.includes("storage quota has been exceeded") ||
      msg.includes("exceeded") ||
      msg.includes("Quota") ||
      msg.includes("quota"))
  );
}

async function getAuth() {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error("GOOGLE_CREDENTIALS environment variable is not set");
  }

  const credentials =
    typeof process.env.GOOGLE_CREDENTIALS === "string"
      ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
      : process.env.GOOGLE_CREDENTIALS;

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

module.exports.isQuotaExceededError = isQuotaExceededError;
module.exports.extractSpreadsheetId = extractSpreadsheetId;

module.exports.fetch = async function fetchAllRows(sheetUrl) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const range = `${SHEET_NAME}!A:Z`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values || [];
};

/**
 * Create a Google Sheet:
 * - Prefer placing it in GOOGLE_DRIVE_FOLDER_ID (if valid & accessible)
 * - Else fall back to SA's My Drive
 * - Then write data and set public read permissions
 *
 * Throws an Error('DRIVE_QUOTA_EXCEEDED') if Drive quota is exceeded.
 */
module.exports.createSpreadsheet = async function createSpreadsheet(title, data) {
  const auth = await getAuth();
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const parents = [];
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_PARENT_ID;

  if (parentId) {
    try {
      const parentInfo = await drive.files.get({
        fileId: parentId,
        fields: "id, mimeType, name",
        supportsAllDrives: true,
      });

      if (parentInfo.data.mimeType !== "application/vnd.google-apps.folder") {
        console.warn(
          `[sheetsService] Provided parentId (${parentId}) is not a folder. Falling back to My Drive.`
        );
      } else {
        parents.push(parentId);
      }
    } catch (e) {
      console.warn(
        `[sheetsService] Cannot access parentId (${parentId}): ${e.message}. Falling back to My Drive.`
      );
    }
  }

  let spreadsheetId;
  try {
    const fileCreate = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.spreadsheet",
        ...(parents.length ? { parents } : {}),
      },
      fields: "id,webViewLink",
    });

    spreadsheetId = fileCreate.data.id;
  } catch (e) {
    if (parents.length && String(e?.message || "").includes("Insufficient permissions for the specified parent")) {
      console.warn("[sheetsService] Retrying create in My Drive without parents…");
      const retry = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: title,
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
        fields: "id,webViewLink",
      });
      spreadsheetId = retry.data.id;
    } else if (isQuotaExceededError(e)) {
      const err = new Error("DRIVE_QUOTA_EXCEEDED");
      err.code = 403;
      throw err;
    } else {
      throw e;
    }
  }

  if (Array.isArray(data) && data.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: data },
    });
  }

  await drive.permissions.create({
    fileId: spreadsheetId,
    supportsAllDrives: true,
    requestBody: { type: "anyone", role: "reader" },
  });

  const info = await drive.files.get({
    fileId: spreadsheetId,
    fields: "id,webViewLink, name",
    supportsAllDrives: true,
  });

  return {
    spreadsheetId,
    properties: { title: info.data.name || title },
    webViewLink: info.data.webViewLink,
  };
};

module.exports.updateSpreadsheet = async function updateSpreadsheet(spreadsheetId, data) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: data },
  });

  return true;
};
