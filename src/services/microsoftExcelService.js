// services/microsoftExcelService.js
// OneDrive / Excel Online integration via Microsoft Graph (app-only / client credentials)

const fetch = require("node-fetch");

const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_DRIVE_ID, // preferred
  MS_SITE_ID,  // alternative to DRV: use /sites/{site-id}/drive
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
async function ensureFolderPath(token, segments) {
  let parent = `${driveRoot()}/root`;

  for (const seg of segments) {
    // Try to find an existing child folder with the exact name
    const listUrl = `${GRAPH_BASE}${parent}:/children?$filter=name eq '${seg.replace(/'/g, "''")}'`;
    let res = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Graph list children failed: ${res.status} ${t}`);
    }
    const listing = await res.json();
    let child = listing.value?.find((i) => i.name === seg && i.folder);

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

  // Try to create an org sharing link; if blocked, fall back to webUrl we already have
  let webUrl = workbook.webUrl;
  try {
    const linkRes = await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${workbook.id}/createLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "edit", scope: "organization" }),
      }
    );
    if (linkRes.ok) {
      const linkJson = await linkRes.json();
      webUrl = linkJson.link?.webUrl || webUrl;
    } else {
      // Non-fatal; tenant policy can block this.
      // const t = await linkRes.text(); console.warn("createLink failed:", t);
    }
  } catch {
    // ignore
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

// Overwrite a sheet’s content with a 2D array (A1 write)
async function writeSheet({ driveItemId, worksheetName, values }) {
  const token = await getAccessToken();
  await ensureWorksheet(token, driveItemId, worksheetName);

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

  // Write at A1
  const res = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName
    )}')/range(address='A1')`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph write range failed: ${res.status} ${t}`);
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
