import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔍 Testing TTLock Get Lock Status API');
console.log('=====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-query-status.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-query-status.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API only works with locks that have WiFi gateway connectivity');
  console.log('   2. The lock must be online and connected to a gateway');
  console.log('   3. Returns the freeze status of the lock');
  console.log('');
  console.log('Lock Status Values:');
  console.log('   0 = Not frozen (normal operation)');
  console.log('   1 = Frozen (all unlocking methods disabled)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testQueryStatus() {
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

    // Step 2: Query lock status
    console.log('Step 2: Querying lock freeze status...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Status API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/queryStatus`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/queryStatus`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Query lock status failed');
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
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can query the lock status.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock status retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { status } = response.data;

    // Map status to human-readable format
    const statusMap = {
      0: { text: 'Not Frozen', icon: '✅', description: 'Lock is operating normally. All unlocking methods are enabled.' },
      1: { text: 'Frozen', icon: '❄️', description: 'Lock is frozen. All unlocking methods are disabled for security.' }
    };

    const statusInfo = statusMap[status] || { text: 'Unknown', icon: '❓', description: 'Status cannot be determined' };

    console.log('🔍 LOCK FREEZE STATUS:');
    console.log('   Lock ID:', lockId);
    console.log('   Status Code:', status);
    console.log(`   Status: ${statusInfo.icon} ${statusInfo.text}`);
    console.log('   Description:', statusInfo.description);
    console.log('   Queried at:', new Date().toISOString());
    console.log('');

    if (status === 0) {
      console.log('✅ The lock is NOT FROZEN');
      console.log('   All unlocking methods are enabled:');
      console.log('   ✅ Passcodes - working');
      console.log('   ✅ IC Cards - working');
      console.log('   ✅ Fingerprints - working');
      console.log('   ✅ App unlock - working');
      console.log('   ✅ Remote unlock - working');
      console.log('');
      console.log('To freeze the lock (emergency use only):');
      console.log(`   node test-freeze-lock.js ${username} [password] ${lockId}`);
    } else if (status === 1) {
      console.log('❄️  The lock is FROZEN');
      console.log('   All unlocking methods are disabled:');
      console.log('   ❌ Passcodes - disabled');
      console.log('   ❌ IC Cards - disabled');
      console.log('   ❌ Fingerprints - disabled');
      console.log('   ❌ App unlock - disabled');
      console.log('   ❌ Remote unlock - disabled');
      console.log('');
      console.log('To unfreeze the lock:');
      console.log(`   node test-unfreeze-lock.js ${username} [password] ${lockId}`);
    }

  } catch (error) {
    console.error('❌ FAILED! Get lock status error');
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
testQueryStatus();
