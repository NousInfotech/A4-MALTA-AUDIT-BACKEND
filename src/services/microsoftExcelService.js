const fetch = require("node-fetch")

const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_DRIVE_ID, 
  MS_SITE_ID,
  MS_SHARE_SCOPE = "anonymous", 
  MS_SHARE_TYPE = "view", 
} = process.env

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

function assertEnv() {
  const missing = []
  if (!MS_TENANT_ID) missing.push("MS_TENANT_ID")
  if (!MS_CLIENT_ID) missing.push("MS_CLIENT_ID")
  if (!MS_CLIENT_SECRET) missing.push("MS_CLIENT_SECRET")
  if (missing.length) {
    throw new Error(
      `Missing required env: ${missing.join(", ")}. ` +
        `Also provide MS_DRIVE_ID or MS_SITE_ID because app-only cannot use /me/drive.`,
    )
  }
  if (!MS_DRIVE_ID && !MS_SITE_ID) {
    throw new Error("App-only Graph cannot use /me/drive. Set MS_DRIVE_ID or MS_SITE_ID in env.")
  }
}

function driveRoot() {
  if (MS_DRIVE_ID) return `/drives/${MS_DRIVE_ID}`
  if (MS_SITE_ID) return `/sites/${MS_SITE_ID}/drive`
  throw new Error("No drive context. Set MS_DRIVE_ID or MS_SITE_ID.")
}

async function getAccessToken() {
  assertEnv()
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  })

  const res = await fetch(url, { method: "POST", body })
  const text = await res.text()
  if (!res.ok) {
    if (text.includes("AADSTS700016")) {
      throw new Error(
        `Graph token error (AADSTS700016): The client_id is not found in tenant ${MS_TENANT_ID}. ` +
          `Verify MS_TENANT_ID, MS_CLIENT_ID, app is registered in this tenant, and admin consent is granted. ` +
          `Raw: ${res.status} ${text}`,
      )
    }
    throw new Error(`Graph token error: ${res.status} ${text}`)
  }
  const json = JSON.parse(text)
  return json.access_token
}

async function ensureFolderPath(token, segments) {
  let parent = `${driveRoot()}/root`

  for (const seg of segments) {
    const listUrl = `${GRAPH_BASE}${parent}/children`
    let res = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Graph list children failed: ${res.status} ${t}`)
    }
    const listing = await res.json()
    let child = listing.value?.find((i) => i.name === seg && !!i.folder)

    if (!child) {
      const createUrl = `${GRAPH_BASE}${parent}/children`
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
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Graph create folder failed: ${res.status} ${t}`)
      }
      child = await res.json()
    }

    parent = `${driveRoot()}/items/${child.id}`
  }

  const id = parent.split("/").pop()
  return { id, path: parent }
}

async function ensureWorkbook({ engagementId, classification }) {
  const token = await getAccessToken()

  let appSegments, workbookName

  if (classification) {
    appSegments = ["Apps", "ETB", String(engagementId), classification.replace(/[^\w\s]/g, "").substring(0, 50)]
    workbookName = `${classification.replace(/[^\w\s]/g, "").substring(0, 30)}.xlsx`
  } else {
    appSegments = ["Apps", "ETB", String(engagementId)]
    workbookName = "ETB.xlsx"
  }

  const folder = await ensureFolderPath(token, appSegments)

  const listRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${folder.id}/children`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!listRes.ok) {
    const t = await listRes.text()
    throw new Error(`Graph list children failed: ${listRes.status} ${t}`)
  }
  const listing = await listRes.json()
  let workbook = listing.value?.find((i) => i.file && i.name?.toLowerCase() === workbookName.toLowerCase())

  if (!workbook) {
    const uploadRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${folder.id}:/${workbookName}:/content`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: Buffer.from(""),
    })
    if (!uploadRes.ok) {
      const t = await uploadRes.text()
      throw new Error(`Graph create workbook failed: ${uploadRes.status} ${t}`)
    }
    workbook = await uploadRes.json()
  }

  let webUrl = workbook.webUrl
  try {
    const linkRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${workbook.id}/createLink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "edit", scope: "anonymous" }), 
    })

    if (linkRes.ok) {
      const linkJson = await linkRes.json()
      webUrl = linkJson.link?.webUrl || webUrl
    } else {
    }
  } catch {
  }

  return { id: workbook.id, webUrl }
}

async function ensureWorksheet(token, driveItemId, worksheetName) {
   // --- ADD THIS LOGGING IMMEDIATELY BEFORE THE FIRST FETCH ---
  const requestUrl = `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets`;
  console.log(`[ensureWorksheet] Attempting to list worksheets for driveItemId: ${driveItemId}`);
  console.log(`[ensureWorksheet] Request URL: ${requestUrl}`);
  // -----------------------------------------------------------
  let res = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Graph list worksheets failed: ${res.status} ${t}`)
  }
  const ws = await res.json()
  const all = ws.value || []
  if (all.length === 0) {
    throw new Error("Workbook has no worksheets (unexpected).")
  }

  const desired = all.find((w) => w.name === worksheetName)
  if (desired) {
    try {
      if (typeof desired.position === "number" && desired.position !== 0) {
        const moveRes = await fetch(
          `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets/${desired.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ position: 0 }),
          },
        )
        if (!moveRes.ok) {
        } else {
          desired.position = 0
        }
      }
    } catch {
    }
    return desired
  }

  const first = all.find((w) => (typeof w.position === "number" ? w.position === 0 : true)) || all[0]

  if (first.name === worksheetName) return first

  res = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets/${first.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: worksheetName, position: 0 }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Graph rename/move worksheet failed: ${res.status} ${t}`)
  }
  return { ...first, name: worksheetName, position: 0 }
}

function numberToColumnName(n) {
  let s = ""
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function normalizeRect(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { rows: 0, cols: 0, rect: [] }
  }
  const cols = Math.max(...values.map((r) => (Array.isArray(r) ? r.length : 0)))
  const rect = values.map((row) => {
    const r = Array.isArray(row) ? row.slice() : [row]
    while (r.length < cols) r.push("")
    return r
  })
  return { rows: rect.length, cols, rect }
}

function isIsoDateString(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

async function writeSheet({ driveItemId, worksheetName, values }) {
  const token = await getAccessToken()
  await ensureWorksheet(token, driveItemId, worksheetName)

  const { rows, cols, rect } = normalizeRect(values)
  if (rows === 0 || cols === 0) {
    await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
        worksheetName,
      )}')/usedRange/clear`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ applyTo: "contents" }),
      },
    )
    return true
  }

  const lastCol = numberToColumnName(cols)
  const lastRow = rows
  const address = `A1:${lastCol}${lastRow}`

  await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName,
    )}')/usedRange/clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applyTo: "contents" }),
    },
  )

  const writeRes = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName,
    )}')/range(address='${address}')`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rect }),
    },
  )
  if (!writeRes.ok) {
    const t = await writeRes.text()
    throw new Error(
      `Graph write range failed: ${writeRes.status} ${t} (address='${address}', rows=${rows}, cols=${cols})`,
    )
  }

  const header = (rect[0] || []).map((h) =>
    String(h || "")
      .trim()
      .toLowerCase(),
  )
  const findCol = (name) => header.findIndex((h) => h === name.toLowerCase())

  const iCY = findCol("current year")
  const iAdj = findCol("adjustments")
  const iFB = findCol("final balance")

  if (rows > 1 && iCY !== -1 && iAdj !== -1 && iFB !== -1) {
    const cyCol = numberToColumnName(iCY + 1)
    const adjCol = numberToColumnName(iAdj + 1)
    const fbCol = numberToColumnName(iFB + 1)

    const startRow = 2 
    const endRow = rows
    const formulaRange = `${fbCol}${startRow}:${fbCol}${endRow}`

    const formulas = []
    for (let r = startRow; r <= endRow; r++) {
      formulas.push([`=${cyCol}${r}+${adjCol}${r}`])
    }

    const formulaRes = await fetch(
      `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
        worksheetName,
      )}')/range(address='${formulaRange}')`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ formulas }),
      },
    )

    if (!formulaRes.ok) {
    }
  }

  return true
}

async function readSheet({ driveItemId, worksheetName }) {
  const token = await getAccessToken();
  await ensureWorksheet(token, driveItemId, worksheetName);

  // Fetch the usedRange including its address
  const res = await fetch(
    `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets('${encodeURIComponent(
      worksheetName,
    )}')/usedRange?$select=address,values`, // Request both address and values
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph read range failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  
  // Return both the values and the address
  return {
    values: json.values || [],
    address: json.address // e.g., "Sheet1!A1:D10"
  };
}


async function uploadWorkbookFile({ engagementId, classification, fileName, fileBuffer }) {
  const token = await getAccessToken();

  const cleanClassification = classification?.replace(/[^\w\s]/g, "").substring(0, 50) || "Unclassified";
  const segments = ["Apps", String(engagementId), cleanClassification, "workbooks"];

  const folder = await ensureFolderPath(token, segments);

  const uploadRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${folder.id}:/${fileName}:/content`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    throw new Error(`Graph file upload failed: ${uploadRes.status} ${t}`);
  }

  const uploadedFile = await uploadRes.json();

  let sharepointDocId = null;
  let anonymousWebUrl = uploadedFile.webUrl; // Default to direct webUrl

  // Extract GUID from webUrl if it's a SharePoint URL
  if (uploadedFile.webUrl && uploadedFile.webUrl.includes("sourcedoc=%7B")) {
    const match = uploadedFile.webUrl.match(/sourcedoc=%7B([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})%7D/);
    if (match && match[1]) {
      sharepointDocId = match[1];
    }
  }

  // --- NEW: Create an anonymous sharing link ---
  try {
    const linkRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${uploadedFile.id}/createLink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // You can choose "view" or "edit" here based on your requirements
      body: JSON.stringify({ type: MS_SHARE_TYPE, scope: MS_SHARE_SCOPE }),
    });

    if (linkRes.ok) {
      const linkJson = await linkRes.json();
      if (linkJson.link?.webUrl) {
        anonymousWebUrl = linkJson.link.webUrl;
        console.log(`[Backend Debug - uploadWorkbookFile Service] Anonymous share link created: ${anonymousWebUrl}`);
      } else {
        console.warn("[Backend Debug - uploadWorkbookFile Service] createLink successful but no webUrl found in response.");
      }
    } else {
      const errorText = await linkRes.text();
      console.warn(`[Backend Debug - uploadWorkbookFile Service] Failed to create anonymous link: ${linkRes.status} - ${errorText}`);
      // Fallback to original webUrl if link creation fails
    }
  } catch (error) {
    console.error("[Backend Debug - uploadWorkbookFile Service] Error creating anonymous link:", error);
    // Fallback to original webUrl if an error occurs
  }
  // --- END NEW SECTION ---

  const finalReturnObject = {
    id: uploadedFile.id,
    sharepointDocId: sharepointDocId,
    webUrl: anonymousWebUrl, // Use the anonymousWebUrl
    name: uploadedFile.name,
  };

  console.log("[Backend Debug - uploadWorkbookFile Service] Final object being returned:", finalReturnObject);

  return finalReturnObject;
}



async function listWorkbooks({ engagementId, classification }) {
  const token = await getAccessToken()

  const cleanClassification = classification?.replace(/[^\w\s]/g, "").substring(0, 50) || "Unclassified"
  const segments = ["Apps", String(engagementId), cleanClassification, "workbooks"]

  // Resolve the folder path
  const folder = await ensureFolderPath(token, segments)

  // List children in the folder
  const listUrl = `${GRAPH_BASE}${driveRoot()}/items/${folder.id}/children`
  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Graph list folder contents failed: ${res.status} ${t}`)
  }

  const json = await res.json()

  // Filter to only .xlsx files
  const workbooks = (json.value || []).filter(item => {
    return item.file && item.name.toLowerCase().endsWith(".xlsx")
  })

  // --- MODIFIED SECTION: Generate anonymous links for each workbook ---
  const workbooksWithShareableUrls = await Promise.all(workbooks.map(async (wb) => {
    let anonymousWebUrl = wb.webUrl; // Default to the original webUrl

    try {
      const linkRes = await fetch(`${GRAPH_BASE}${driveRoot()}/items/${wb.id}/createLink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: MS_SHARE_TYPE, scope: MS_SHARE_SCOPE }),
      });

      if (linkRes.ok) {
        const linkJson = await linkRes.json();
        if (linkJson.link?.webUrl) {
          anonymousWebUrl = linkJson.link.webUrl;
          console.log(`[Backend Debug - listWorkbooks Service] Anonymous share link created for ${wb.name}: ${anonymousWebUrl}`);
        } else {
          console.warn(`[Backend Debug - listWorkbooks Service] createLink successful for ${wb.name} but no webUrl found in response.`);
        }
      } else {
        const errorText = await linkRes.text();
        console.warn(`[Backend Debug - listWorkbooks Service] Failed to create anonymous link for ${wb.name}: ${linkRes.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`[Backend Debug - listWorkbooks Service] Error creating anonymous link for ${wb.name}:`, error);
    }

    return {
      id: wb.id,
      name: wb.name,
      webUrl: anonymousWebUrl, // Use the potentially new anonymousWebUrl
      size: wb.size,
      lastModifiedDateTime: wb.lastModifiedDateTime,
    };
  }));
  // --- END MODIFIED SECTION ---

  return workbooksWithShareableUrls; // Return the new array with shareable URLs
}




async function listWorksheets(driveItemId) {
  const token = await getAccessToken();
  const requestUrl = `${GRAPH_BASE}${driveRoot()}/items/${driveItemId}/workbook/worksheets`;
  
  const res = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph list worksheets failed: ${res.status} ${t} (URL: ${requestUrl})`);
  }
  const json = await res.json();
  return json.value;
}



async function writeWorkbook({ driveItemId, workbookData }) {
  // workbookData is expected to be an object where keys are sheet names
  // and values are the 2D array sheet data (e.g., { "Sheet1": [[...]], "Sheet2": [[...]] })

  if (!workbookData || typeof workbookData !== 'object') {
    throw new Error('Invalid workbookData provided. Expected an object mapping sheet names to 2D arrays.');
  }

  const sheetNames = Object.keys(workbookData);

  // Iterate over each sheet and call writeSheet
  for (const sheetName of sheetNames) {
    const values = workbookData[sheetName];
    if (!Array.isArray(values)) {
      console.warn(`Skipping sheet '${sheetName}' due to invalid data format.`);
      continue; // Skip if sheet data is not a 2D array
    }
    
    // Call the existing writeSheet function for each individual sheet
    await writeSheet({ driveItemId, worksheetName: sheetName, values });
  }

  return { success: true, message: `Workbook ${driveItemId} saved successfully.` };
}


module.exports = {
  ensureWorkbook,
  writeSheet,
  readSheet,
  getAccessToken,
  uploadWorkbookFile,
  listWorkbooks,
  listWorksheets,
  writeWorkbook
}
