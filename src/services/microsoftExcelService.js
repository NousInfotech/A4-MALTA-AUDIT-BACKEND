// services/microsoftExcelService.js
// OneDrive / Excel Online integration via Microsoft Graph (app-only / client credentials)

const fetch = require("node-fetch");

const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_DRIVE_ID, // preferred
  MS_SITE_ID,  // alternative to DRV: use /sites/{site-id}/drive
  MS_SHARE_SCOPE = "anonymous", // "anonymous" | "organization"
  MS_SHARE_TYPE = "view",       // "view" | "edit"
} = process.env;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function assertEnv() {
  const missing = [];
  if (!MS_TENANT_ID) missing.push("MS_TENANT_ID");
  if (!MS_CLIENT_ID) missing.push("MS_CLIENT_ID");
  if (!MS_CLIENT_SECRET) missing.push("MS_CLIENT_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing required env: ${missing.join(", ")}. ` +
      `Also provide MS_DRIVE_ID or MS_SITE_ID because app-only cannot use /me/drive.`
    );
  }
  if (!MS_DRIVE_ID && !MS_SITE_ID) {
    throw new Error(
      "App-only Graph cannot use /me/drive. Set MS_DRIVE_ID or MS_SITE_ID in env."
    );
  }
}

// Build the drive root path for app-only
function driveRoot() {
  if (MS_DRIVE_ID) return `/drives/${MS_DRIVE_ID}`;
  if (MS_SITE_ID) return `/sites/${MS_SITE_ID}/drive`;
  // We never return /me/drive in app-only
  throw new Error("No drive context. Set MS_DRIVE_ID or MS_SITE_ID.");
}

// Obtain app-only token (client credentials)
async function getAccessToken() {
  assertEnv();
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, { method: "POST", body });
  const text = await res.text();
  if (!res.ok) {
    // Surface helpful hint for AADSTS700016
    if (text.includes("AADSTS700016")) {
      throw new Error(
        `Graph token error (AADSTS700016): The client_id is not found in tenant ${MS_TENANT_ID}. ` +
        `Verify MS_TENANT_ID, MS_CLIENT_ID, app is registered in this tenant, and admin consent is granted. ` +
        `Raw: ${res.status} ${text}`
      );
    }
    throw new Error(`Graph token error: ${res.status} ${text}`);
  }
  const json = JSON.parse(text);
  return json.access_token;
}

// Ensure a folder path exists (creates nested folders under the chosen drive)
// IMPORTANT: when addressing items/root by ID, use slash form `/children` (NOT `:/children`)
async function ensureFolderPath(token, segments) {
  let parent = `${driveRoot()}/root`;

  for (const seg of segments) {
    // List children and find a folder with exact name
    const listUrl = `${GRAPH_BASE}${parent}/children`;
    let res = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Graph list children failed: ${res.status} ${t}`);
    }
    const listing = await res.json();
    let child = listing.value?.find((i) => i.name === seg && !!i.folder);

    if (!child) {
      // Create folder
      const createUrl = `${GRAPH_BASE}${parent}/children`;
      res = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: seg,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Graph create folder failed: ${res.status} ${t}`);
      }
      child = await res.json();
    }

    // Next hop: address by item id
    parent = `${driveRoot()}/items/${child.id}`;
  }

  const id = parent.split("/").pop();
  return { id, path: parent };
}

// Create (or reuse) workbook file and return { id, webUrl }
async function ensureWorkbook({ engagementId }) {
  const token = await getAccessToken();

  // Example path: /{drive}/root:/Apps/ETB/{engagementId}/
  const appSegments = ["Apps", "ETB", String(engagementId)];
  const folder = await ensureFolderPath(token, appSegments);

  // List children to find existing 'etb.xlsx'
  const listRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${folder.id}/children`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`Graph list children failed: ${listRes.status} ${t}`);
  }
  const listing = await listRes.json();
  let workbook = listing.value?.find(
    (i) => i.file && i.name?.toLowerCase() === "etb.xlsx"
  );

  if (!workbook) {
    // Create an empty workbook (0-byte PUT to /content)
    // Path addressing variant is correct for naming a child under an item id
    const uploadRes = await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${folder.id}:/etb.xlsx:/content`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: Buffer.from(""),
      }
    );
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      throw new Error(`Graph create workbook failed: ${uploadRes.status} ${t}`);
    }
    workbook = await uploadRes.json();
  }

  // Try to create a sharing link per env preferences (anonymous by default)
  let webUrl = workbook.webUrl;
  try {
    const linkRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${workbook.id}/createLink`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "edit", scope: "anonymous" }) // anyone can edit
});

    if (linkRes.ok) {
      const linkJson = await linkRes.json();
      webUrl = linkJson.link?.webUrl || webUrl;
    } else {
      // Non-fatal; tenant policy can block anonymous/organization links
      // const t = await linkRes.text(); console.warn("createLink failed:", t);
    }
  } catch {
    // ignore non-fatal link creation errors
  }

  return { id: workbook.id, webUrl };
}

// Create or get a worksheet by name
async function ensureWorksheet(token, driveItemId, worksheetName) {
  let res = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph list worksheets failed: ${res.status} ${t}`);
  }
  const ws = await res.json();
  let sheet = ws.value?.find((w) => w.name === worksheetName);

  if (!sheet) {
    res = await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets/add`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: worksheetName }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Graph add worksheet failed: ${res.status} ${t}`);
    }
    sheet = await res.json();
  }
  return sheet;
}

// --- helpers for writing ranges ---
function numberToColumnName(n) {
  // 1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA, ...
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeRect(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { rows: 0, cols: 0, rect: [] };
  }
  const cols = Math.max(...values.map((r) => Array.isArray(r) ? r.length : 0));
  const rect = values.map((row) => {
    const r = Array.isArray(row) ? row.slice() : [row];
    while (r.length < cols) r.push("");
    return r;
  });
  return { rows: rect.length, cols, rect };
}

function isIsoDateString(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// Overwrite a sheet’s content with a 2D array (A1 write)
async function writeSheet({ driveItemId, worksheetName, values }) {
  const token = await getAccessToken();
  await ensureWorksheet(token, driveItemId, worksheetName);

  // Normalize to a proper rectangle and get exact range
  const { rows, cols, rect } = normalizeRect(values);
  if (rows === 0 || cols === 0) {
    // Nothing to write; just clear and return
    await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
        worksheetName
      )}')/usedRange/clear`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ applyTo: "contents" }),
      }
    );
    return true;
  }

  // If the header row contains a "Date" column, force those cells to text
  // so they round-trip exactly and don't become Excel serials.
  const header = rect[0] || [];
  const dateCols = [];
  for (let c = 0; c < header.length; c++) {
    if (String(header[c]).trim().toLowerCase() === "date") {
      dateCols.push(c);
    }
  }
  if (dateCols.length) {
    for (let r = 1; r < rect.length; r++) {
      for (const c of dateCols) {
        const val = rect[r][c];
        if (isIsoDateString(val)) {
          rect[r][c] = `'${val}`; // Excel text literal
        }
      }
    }
  }

  const lastCol = numberToColumnName(cols);
  const lastRow = rows;
  const address = `A1:${lastCol}${lastRow}`;

  // Clear used range (optional)
  await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName
    )}')/usedRange/clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applyTo: "contents" }),
    }
  );

  // Write the exact-sized range
  const res = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName
    )}')/range(address='${address}')`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rect }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      `Graph write range failed: ${res.status} ${t} (address='${address}', rows=${rows}, cols=${cols})`
    );
  }
  return true;
}

// Read the sheet back (usedRange)
async function readSheet({ driveItemId, worksheetName }) {
  const token = await getAccessToken();
  await ensureWorksheet(token, driveItemId, worksheetName);

  const res = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName
    )}')/usedRange(valuesOnly=true)?$select=values`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph read range failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.values || [];
}

module.exports = {
  ensureWorkbook,
  writeSheet,
  readSheet,
};
