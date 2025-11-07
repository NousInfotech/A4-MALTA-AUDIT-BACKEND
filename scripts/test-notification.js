#!/usr/bin/env node

/**
 * Quick script to test notifications
 * 
 * Usage:
 *   node scripts/test-notification.js [options]
 * 
 * Options:
 *   --email <email>     User email (required)
 *   --password <pass>   User password (required)
 *   --title <title>     Notification title (optional)
 *   --message <msg>     Notification message (optional)
 *   --url <url>         API URL (default: http://localhost:8000)
 * 
 * Example:
 *   node scripts/test-notification.js --email user@example.com --password pass123
 */

const https = require('https');
const http = require('http');

const args = process.argv.slice(2);
const options = {};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    const value = args[i + 1];
    if (value && !value.startsWith('--')) {
      options[key] = value;
      i++;
    } else {
      options[key] = true;
    }
  }
}

const API_URL = options.url || 'http://localhost:8000';
const email = options.email;
const password = options.password;
const title = options.title || 'Test Notification';
const message = options.message || 'This is a test notification from the script';

if (!email || !password) {
  console.error('❌ Error: Email and password are required');
  console.log('\nUsage:');
  console.log('  node scripts/test-notification.js --email <email> --password <password> [options]');
  console.log('\nOptions:');
  console.log('  --title <title>     Notification title (default: "Test Notification")');
  console.log('  --message <msg>     Notification message (default: "This is a test notification...")');
  console.log('  --url <url>         API URL (default: http://localhost:8000)');
  process.exit(1);
}

// Helper function to make HTTP requests
function makeRequest(url, method, headers, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testNotification() {
  try {
    console.log('🔐 Step 1: Logging in...');
    
    // Step 1: Login
    const loginResponse = await makeRequest(
      `${API_URL}/api/auth/login`,
      'POST',
      { 'Content-Type': 'application/json' },
      { email, password }
    );

    if (loginResponse.status !== 200) {
      console.error('❌ Login failed:', loginResponse.data);
      process.exit(1);
    }

    const token = loginResponse.data.token || loginResponse.data.data?.token;
    if (!token) {
      console.error('❌ No token received:', loginResponse.data);
      process.exit(1);
    }

    console.log('✅ Login successful');
    console.log(`📝 Token: ${token.substring(0, 20)}...`);

    // Step 2: Send test notification
    console.log('\n📤 Step 2: Sending test notification...');
    console.log(`   Title: ${title}`);
    console.log(`   Message: ${message}`);

    const notificationResponse = await makeRequest(
      `${API_URL}/api/notifications/test`,
      'POST',
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      { title, message }
    );

    if (notificationResponse.status === 200 || notificationResponse.status === 201) {
      console.log('✅ Test notification sent successfully!');
      console.log('\n📊 Response:');
      console.log(JSON.stringify(notificationResponse.data, null, 2));
      console.log('\n💡 Check your browser for the notification!');
    } else {
      console.error('❌ Failed to send notification:', notificationResponse.data);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure your backend server is running on', API_URL);
    }
    process.exit(1);
  }
}

testNotification();

