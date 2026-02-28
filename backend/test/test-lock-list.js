import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔒 Testing TTLock Get Lock List API');
console.log('===================================');
console.log('');

// Get credentials from command line or env vars (no hardcoded defaults)
const username = process.argv[2] || process.env.TTLOCK_TEST_USERNAME;
const password = process.argv[3] || process.env.TTLOCK_TEST_PASSWORD;
if (!username || !password) {
  console.error('❌ Error: Username and password required');
  console.error('Usage: node test-lock-list.js <username> <password>');
  console.error('Or set TTLOCK_TEST_USERNAME and TTLOCK_TEST_PASSWORD env vars');
  process.exit(1);
}
const pageNo = parseInt(process.argv[4]) || 1;
const pageSize = parseInt(process.argv[5]) || 20;

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Page:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

async function testLockList() {
  try {
    // Step 1: Get access token
    console.log('Step 1: Getting access token...');
    const hashedPassword = md5(password).toLowerCase();

    const tokenResponse = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      null,
      {
        params: {
          client_id: TTLOCK_CLIENT_ID,
          client_secret: TTLOCK_CLIENT_SECRET,
          username: username,
          password: hashedPassword,
          grant_type: 'password'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Access token obtained');
    console.log('   Token:', accessToken.substring(0, 20) + '...');
    console.log('');

    // Step 2: Get lock list
    console.log('Step 2: Getting lock list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/list`,
      null,
      { params }
    );

    console.log('✅ SUCCESS! Lock list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.list && response.data.list.length > 0) {
      console.log('🔐 LOCKS FOUND:');
      console.log('   Total locks:', response.data.total || response.data.list.length);
      if (response.data.pages !== undefined) {
        console.log('   Total pages:', response.data.pages);
        console.log('   Current page:', response.data.pageNo);
        console.log('   Page size:', response.data.pageSize);
      }
      console.log('');
      console.log('Locks on this page:');
      response.data.list.forEach((lock, index) => {
        console.log(`\n   ${index + 1}. ${lock.lockName || 'Unnamed Lock'}`);
        console.log(`      Lock ID: ${lock.lockId}`);
        console.log(`      Lock Alias: ${lock.lockAlias || 'N/A'}`);
        console.log(`      Lock MAC: ${lock.lockMac}`);
        console.log(`      Battery: ${lock.electricQuantity}%`);
        console.log(`      Has Gateway: ${lock.hasGateway === 1 ? 'Yes' : 'No'}`);
        if (lock.groupName) {
          console.log(`      Group: ${lock.groupName} (ID: ${lock.groupId})`);
        }
        console.log(`      Initialized: ${new Date(lock.date).toISOString()}`);
      });
    } else {
      console.log('ℹ️  No locks found for this account');
      console.log('');
      console.log('To add locks:');
      console.log('1. Use TTLock mobile app to add locks, OR');
      console.log('2. Use TTLock SDK in your app and call /lock/initialize API');
    }

  } catch (error) {
    console.error('❌ FAILED! Get lock list error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testLockList();
