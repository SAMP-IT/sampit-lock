import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔄 Testing TTLock Upgrade Recheck API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const lockData = process.argv[5]; // Lock data from SDK is required

if (!lockId || !lockData) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock-upgrade-recheck.js [username] [password] <lockId> <lockData>');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock-upgrade-recheck.js tusharvaishnavtv@gmail.com Tushar@900 7296935 "lockData_from_sdk"');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId   - Lock ID (required)');
  console.log('   lockData - Lock data from SDK (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. lockData MUST be obtained from TTLock SDK');
  console.log('   2. This API is used when Upgrade Check returns status = 2 (Unknown)');
  console.log('   3. lockData contains lock\'s hardware and firmware information');
  console.log('   4. Cannot test without actual SDK integration');
  console.log('');
  console.log('What is Upgrade Recheck:');
  console.log('   - Verifies firmware upgrade availability with lock hardware data');
  console.log('   - Used when server doesn\'t have lock\'s version info');
  console.log('   - Compares lockData with latest firmware version');
  console.log('   - Returns definitive upgrade availability (0 or 1)');
  console.log('');
  console.log('When to use Upgrade Recheck:');
  console.log('   - Upgrade Check API returns status = 2 (Unknown)');
  console.log('   - Server lacks lock\'s version information');
  console.log('   - Need to determine upgrade availability with certainty');
  console.log('   - Lock is newly initialized or rare model');
  console.log('');
  console.log('Workflow:');
  console.log('   1. Call Upgrade Check API first');
  console.log('   2. If status = 2 (Unknown):');
  console.log('      a. Connect to lock via Bluetooth using TTLock SDK');
  console.log('      b. Call SDK method to get lockData');
  console.log('      c. Use lockData with this Upgrade Recheck API');
  console.log('   3. API returns definitive upgrade status (0 or 1)');
  console.log('');
  console.log('How to get lockData:');
  console.log('   - Use TTLock mobile SDK');
  console.log('   - Connect to lock via Bluetooth');
  console.log('   - Call SDK method: getLockData() or similar');
  console.log('   - SDK returns encrypted string containing lock info');
  console.log('   - Use that string as lockData parameter');
  console.log('');
  console.log('⚠️  SDK Integration Required:');
  console.log('   - This API requires TTLock mobile SDK integration');
  console.log('   - Cannot test without actual SDK and lock hardware');
  console.log('   - lockData format is specific to SDK output');
  console.log('   - Contains encrypted lock hardware information');
  console.log('');
  console.log('Upgrade Status Values:');
  console.log('   0 - No upgrade available (lock is up to date)');
  console.log('   1 - Upgrade available (new firmware exists)');
  console.log('   2 - Should not be returned by this API');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Lock Data Length:', lockData.length, 'characters');
console.log('');

console.log('⚠️  WARNING: lockData must come from TTLock SDK');
console.log('');

async function testUpgradeRecheck() {
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

    // Step 2: Recheck for upgrade with lockData
    console.log('Step 2: Rechecking firmware upgrade with lockData...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      lockData: lockData,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Upgrade Recheck API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/upgradeRecheck`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/upgradeRecheck`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Upgrade recheck failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   The lockData format is invalid.');
        console.error('   lockData must be valid data obtained from TTLock SDK.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to check upgrades for this lock.');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Invalid lock data');
        console.error('   The lockData format is invalid.');
        console.error('   lockData must be obtained from TTLock SDK.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      console.error('');
      console.error('To get valid lockData:');
      console.error('   - Use TTLock mobile SDK');
      console.error('   - Connect to lock via Bluetooth');
      console.error('   - Call SDK method to get lockData');
      console.error('   - Use returned data with this API');
      return;
    }

    console.log('✅ SUCCESS! Upgrade recheck completed');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { needUpgrade, firmwareInfo, firmwarePackage, version } = response.data;

    console.log('🔄 UPGRADE RECHECK RESULT:');
    console.log('   Lock ID:', lockId);
    console.log('   Upgrade Status:', needUpgrade);
    console.log('   Status Text:', getUpgradeStatusText(needUpgrade));
    console.log('');

    if (needUpgrade === 0) {
      console.log('✅ NO UPGRADE NEEDED');
      console.log('   - Lock is running the latest firmware version');
      console.log('   - No action required');
      console.log('   - Lock is up to date');
    } else if (needUpgrade === 1) {
      console.log('🆕 UPGRADE AVAILABLE!');
      console.log('   - New firmware version is available');
      console.log('');
      if (version) {
        console.log('Latest Version:', version);
      }
      if (firmwareInfo) {
        console.log('Firmware Info:', firmwareInfo);
      }
      if (firmwarePackage) {
        console.log('Firmware Package:', firmwarePackage);
      }
      console.log('');
      console.log('Next steps:');
      console.log('   1. Review firmware changelog');
      console.log('   2. Schedule maintenance window');
      console.log('   3. Backup lock configuration if needed');
      console.log('   4. Proceed with firmware upgrade via SDK');
      console.log('   5. Test lock functionality after upgrade');
      console.log('');
      console.log('⚠️  Upgrade Precautions:');
      console.log('   - Ensure lock has sufficient battery');
      console.log('   - Do not interrupt upgrade process');
      console.log('   - Keep Bluetooth connection stable during upgrade');
      console.log('   - Notify users of potential brief downtime');
    } else if (needUpgrade === 2) {
      console.log('❓ UNEXPECTED STATUS');
      console.log('   - Upgrade Recheck should not return status 2');
      console.log('   - This may indicate an error in lockData');
      console.log('   - Try getting fresh lockData from SDK');
    }

    console.log('');
    console.log('Checked at:', new Date().toISOString());

  } catch (error) {
    console.error('❌ FAILED! Upgrade recheck error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   lockData must be valid data from TTLock SDK.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Invalid lock data');
        console.error('   lockData must be obtained from TTLock SDK.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

/**
 * Get upgrade status text from status code
 */
function getUpgradeStatusText(status) {
  const statusMap = {
    0: 'No upgrade available',
    1: 'Upgrade available',
    2: 'Unknown (unexpected for recheck)'
  };
  return statusMap[status] || 'Unknown';
}

// Run the test
testUpgradeRecheck();
