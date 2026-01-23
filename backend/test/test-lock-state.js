import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔍 Testing TTLock Get Lock Open State API');
console.log('==========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock-state.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock-state.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API only works with locks that have WiFi gateway connectivity');
  console.log('   2. The lock must be online and connected to a gateway');
  console.log('   3. Returns the current physical state of the lock');
  console.log('');
  console.log('Lock States:');
  console.log('   0 = Locked');
  console.log('   1 = Unlocked');
  console.log('   2 = Unknown (lock offline or state cannot be determined)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testLockState() {
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

    // Step 2: Query lock state
    console.log('Step 2: Querying lock open state...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Open State API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/queryOpenState`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/queryOpenState`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Query lock state failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock is offline');
        console.error('   The lock is not connected to WiFi/gateway or is offline.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to query this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock state retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { state } = response.data;

    // Map state to human-readable format
    const stateMap = {
      0: { text: 'Locked', icon: '🔒', color: 'green' },
      1: { text: 'Unlocked', icon: '🔓', color: 'red' },
      2: { text: 'Unknown', icon: '❓', color: 'yellow' }
    };

    const stateInfo = stateMap[state] || stateMap[2];

    console.log('🔍 LOCK STATE:');
    console.log('   Lock ID:', lockId);
    console.log('   State Code:', state);
    console.log(`   Status: ${stateInfo.icon} ${stateInfo.text}`);
    console.log('   Queried at:', new Date().toISOString());
    console.log('');

    if (state === 0) {
      console.log('✅ The lock is currently LOCKED (secure)');
    } else if (state === 1) {
      console.log('⚠️  The lock is currently UNLOCKED');
      console.log('   Consider locking it for security:');
      console.log(`   node test-lock.js ${username} [password] ${lockId}`);
    } else if (state === 2) {
      console.log('ℹ️  Lock state is UNKNOWN');
      console.log('   Possible reasons:');
      console.log('   - Lock is offline');
      console.log('   - Gateway is not connected');
      console.log('   - Lock cannot determine its state');
    }

  } catch (error) {
    console.error('❌ FAILED! Get lock state error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock is offline');
        console.error('   The lock is not connected to WiFi/gateway or is offline.');
      } else if (error.response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to query this lock.');
      } else if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testLockState();
