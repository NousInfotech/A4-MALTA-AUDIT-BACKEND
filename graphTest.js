require('dotenv').config();
const fetch = require('node-fetch');

// Configuration from environment
const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_DRIVE_ID,
  MS_SITE_ID,
} = process.env;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Helper functions
function driveRoot() {
  if (MS_DRIVE_ID) return `/drives/${MS_DRIVE_ID}`;
  if (MS_SITE_ID) return `/sites/${MS_SITE_ID}/drive`;
  throw new Error("No drive context. Set MS_DRIVE_ID or MS_SITE_ID.");
}

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token error: ${res.status} ${text}`);
  }
  return (await res.json()).access_token;
}

// Test functions
async function testDriveRootAccess(token) {
  console.log('\n=== Testing Drive Root Access ===');
  const url = `${GRAPH_BASE}${driveRoot()}/root`;
  console.log(`Request URL: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`❌ Failed to access drive root (${res.status}):`, error);
      return false;
    }

    const data = await res.json();
    console.log('✅ Successfully accessed drive root:');
    console.log({
      id: data.id,
      name: data.name,
      webUrl: data.webUrl,
      driveType: data.driveType
    });
    return true;
  } catch (error) {
    console.error('❌ Drive root access failed:', error.message);
    return false;
  }
}

async function testFolderCreation(token, folderPath) {
  console.log('\n=== Testing Folder Creation ===');
  console.log(`Folder path: ${folderPath.join('/')}`);

  let parent = `${driveRoot()}/root`;
  console.log(`Starting parent: ${parent}`);

  for (const folderName of folderPath) {
    console.log(`\nProcessing folder: ${folderName}`);

    // Try to get existing folder
    const listUrl = `${GRAPH_BASE}${parent}/children?$select=name,id,folder&$filter=name eq '${encodeURIComponent(folderName)}'`;
    console.log(`List children URL: ${listUrl}`);

    let folderId;
    try {
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (listRes.ok) {
        const data = await listRes.json();
        const existingFolder = data.value.find(f => f.name === folderName && f.folder);
        
        if (existingFolder) {
          console.log(`✅ Folder already exists: ${existingFolder.id}`);
          folderId = existingFolder.id;
          parent = `${driveRoot()}/items/${folderId}`;
          continue;
        }
      } else {
        console.log(`ℹ️ List children failed (${listRes.status}), attempting to create folder`);
      }
    } catch (error) {
      console.log(`ℹ️ List children errored, attempting to create folder: ${error.message}`);
    }

    // Create folder if not exists
    const createUrl = `${GRAPH_BASE}${parent}/children`;
    console.log(`Create folder URL: ${createUrl}`);

    try {
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail" // Change to "rename" if you want auto-rename
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        throw new Error(`Create failed (${createRes.status}): ${error}`);
      }

      const newFolder = await createRes.json();
      console.log(`✅ Created new folder: ${newFolder.id}`);
      folderId = newFolder.id;
      parent = `${driveRoot()}/items/${folderId}`;
    } catch (error) {
      console.error(`❌ Failed to create folder '${folderName}':`, error.message);
      return false;
    }
  }

  console.log('\n✅ Folder path successfully created/verified');
  return true;
}

async function testWorkbookOperations(token, folderPath, fileName) {
  console.log('\n=== Testing Workbook Operations ===');
  
  // First ensure folder path exists
  if (!await testFolderCreation(token, folderPath)) {
    return false;
  }

  // Get the full path to our target folder
  const fullPath = `${driveRoot()}/root:/${folderPath.join('/')}`;
  const fileUrl = `${GRAPH_BASE}${fullPath}/${fileName}`;
  console.log(`File URL: ${fileUrl}`);

  // Check if file exists
  try {
    const fileRes = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (fileRes.ok) {
      const fileData = await fileRes.json();
      console.log(`✅ File already exists: ${fileData.id}`);
      return true;
    }
  } catch (error) {
    console.log(`ℹ️ File check failed, will attempt creation: ${error.message}`);
  }

  // Create new workbook
  const uploadUrl = `${fileUrl}:/content`;
  console.log(`Upload URL: ${uploadUrl}`);

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: Buffer.from("") // Empty content creates a new Excel file
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      throw new Error(`Upload failed (${uploadRes.status}): ${error}`);
    }

    const fileData = await uploadRes.json();
    console.log(`✅ Successfully created workbook: ${fileData.id}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create workbook:`, error.message);
    return false;
  }
}

// Main test function
async function runAllTests() {
  console.log('=== Starting Microsoft Graph API Tests ===');
  console.log('Configuration:');
  console.log({
    tenantId: MS_TENANT_ID,
    clientId: MS_CLIENT_ID,
    driveId: MS_DRIVE_ID,
    siteId: MS_SITE_ID
  });

  try {
    // Step 1: Get access token
    console.log('\n=== Getting Access Token ===');
    const token = await getAccessToken();
    console.log('✅ Successfully obtained access token');

    // Step 2: Test drive root access
    if (!await testDriveRootAccess(token)) {
      throw new Error('Drive root access test failed');
    }

    // Step 3: Test folder creation
    const testFolderPath = ['Apps', 'ETB', 'test-folder-123'];
    if (!await testFolderCreation(token, testFolderPath)) {
      throw new Error('Folder creation test failed');
    }

    // Step 4: Test workbook operations
    if (!await testWorkbookOperations(token, testFolderPath, 'test-workbook.xlsx')) {
      throw new Error('Workbook operations test failed');
    }

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the tests
runAllTests();