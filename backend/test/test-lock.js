import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔒 Testing TTLock Lock via Gateway API');
console.log('======================================');
console.log('');

// Get credentials from command line or env vars (no hardcoded defaults)
const username = process.argv[2] || process.env.TTLOCK_TEST_USERNAME;
const password = process.argv[3] || process.env.TTLOCK_TEST_PASSWORD;
const lockId = process.argv[4]; // Lock ID is required

if (!username || !password || !lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock.js <username> <password> <lockId>');
  console.log('   Or set TTLOCK_TEST_USERNAME and TTLOCK_TEST_PASSWORD env vars');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock.js user@example.com yourpassword 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API only works with locks that have WiFi gateway connectivity');
  console.log('   2. The lock must be online and connected to a gateway');
  console.log('   3. Remote control must be enabled in Sciener APP lock settings');
  console.log('');
  console.log('⚠️  WARNING: This will PHYSICALLY LOCK your lock!');
  console.log('   Only use this for testing with locks you own and control.');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');
console.log('⚠️  WARNING: This will attempt to physically lock the lock!');
console.log('');

async function testLock() {
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

    if (!accessToken) {
      console.error('❌ No access token received');
      console.error('OAuth Response:', tokenResponse.data);
      return;
    }

    console.log('✅ Access token obtained');
    console.log('   Token:', accessToken.substring(0, 20) + '...');
    console.log('');

    // Step 2: Lock the lock
    console.log('Step 2: Sending lock command...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Lock API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/lock`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/lock`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Lock failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -4043) {
        console.error('ℹ️  Error -4043: Remote control is not enabled');
        console.error('');
        console.error('To fix this:');
        console.error('1. Open Sciener APP (TTLock app)');
        console.error('2. Go to lock settings for this lock');
        console.error('3. Find and enable remote control options');
        console.error('4. Try this test again');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock is offline');
        console.error('   The lock is not connected to WiFi/gateway or is offline.');
        console.error('');
        console.error('To fix this:');
        console.error('1. Ensure the lock has a WiFi gateway');
        console.error('2. Check that the gateway is powered on');
        console.error('3. Verify gateway is connected to the internet');
        console.error('4. Check lock is within range of gateway');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to lock this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock locked');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🎉 LOCK SUCCESSFUL!');
    console.log('   Lock ID:', lockId);
    console.log('   Locked at:', new Date().toISOString());
    console.log('');
    console.log('The lock should now be physically locked.');
    console.log('You may hear the lock motor engaging.');

  } catch (error) {
    console.error('❌ FAILED! Lock error');
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
testLock();
