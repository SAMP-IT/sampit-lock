import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔄 Testing TTLock Upgrade Check API');
console.log('==================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock-upgrade-check.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock-upgrade-check.js tusharvaishnavtv@gmail.com Tushar@900 7296935');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What is Upgrade Check:');
  console.log('   - Checks if firmware update is available for the lock');
  console.log('   - Compares lock\'s current firmware with latest version');
  console.log('   - Returns upgrade availability status');
  console.log('   - Provides firmware package info if upgrade available');
  console.log('');
  console.log('Upgrade Status Values:');
  console.log('   0 - No upgrade available');
  console.log('       Lock is running latest firmware version');
  console.log('       No action needed');
  console.log('');
  console.log('   1 - Upgrade available');
  console.log('       New firmware version is available');
  console.log('       Lock can be upgraded to latest version');
  console.log('       Response includes firmware package and version info');
  console.log('');
  console.log('   2 - Unknown (version info not on server)');
  console.log('       Server doesn\'t have lock\'s version information');
  console.log('       Need to call SDK to get lockData');
  console.log('       Then use Upgrade Recheck API with lockData');
  console.log('');
  console.log('When to check for upgrades:');
  console.log('   - Regular maintenance schedule');
  console.log('   - After receiving notification of new firmware');
  console.log('   - Before performing lock operations');
  console.log('   - After encountering lock issues');
  console.log('   - As part of security updates');
  console.log('');
  console.log('Upgrade Benefits:');
  console.log('   - Bug fixes and stability improvements');
  console.log('   - New features and functionality');
  console.log('   - Security patches');
  console.log('   - Performance enhancements');
  console.log('   - Compatibility with new mobile app versions');
  console.log('');
  console.log('Workflow:');
  console.log('   1. Call this Upgrade Check API');
  console.log('   2. If status = 0: No upgrade needed');
  console.log('   3. If status = 1: Upgrade available, proceed with upgrade');
  console.log('   4. If status = 2: Call SDK to get lockData, then use Upgrade Recheck API');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testUpgradeCheck() {
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

    // Step 2: Check for upgrade
    console.log('Step 2: Checking for firmware upgrade...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Upgrade Check API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/upgradeCheck`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/upgradeCheck`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Upgrade check failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to check upgrades for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Upgrade check completed');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { needUpgrade, firmwareInfo, firmwarePackage, version } = response.data;

    console.log('🔄 UPGRADE CHECK RESULT:');
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
      console.log('❓ VERSION INFO UNKNOWN');
      console.log('   - Server doesn\'t have lock\'s version information');
      console.log('   - Need to get lock data from hardware');
      console.log('');
      console.log('Next steps:');
      console.log('   1. Connect to lock via Bluetooth using TTLock SDK');
      console.log('   2. Call SDK method to get lockData');
      console.log('   3. Use Upgrade Recheck API with lockData:');
      console.log(`      node test-lock-upgrade-recheck.js ${username} [password] ${lockId} [lockData]`);
      console.log('');
      console.log('Why version is unknown:');
      console.log('   - Lock may be newly initialized');
      console.log('   - Lock hasn\'t synced with server yet');
      console.log('   - Lock model is not in server database');
      console.log('   - Need direct communication with lock hardware');
    }

    console.log('');
    console.log('Checked at:', new Date().toISOString());

  } catch (error) {
    console.error('❌ FAILED! Upgrade check error');
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

/**
 * Get upgrade status text from status code
 */
function getUpgradeStatusText(status) {
  const statusMap = {
    0: 'No upgrade available',
    1: 'Upgrade available',
    2: 'Unknown - recheck required'
  };
  return statusMap[status] || 'Unknown';
}

// Run the test
testUpgradeCheck();
