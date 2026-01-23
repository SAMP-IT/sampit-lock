import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔑 Testing TTLock Get One Ekey API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ekey-get.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-ekey-get.js tusharvaishnavtv@gmail.com Tushar@900 20749172');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What this API does:');
  console.log('   - Returns YOUR ekey for a specific lock');
  console.log('   - Shows detailed ekey information and status');
  console.log('   - Includes lock battery level and features');
  console.log('   - Returns the ekey you have for this lock (not all ekeys)');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Check your access level to a specific lock');
  console.log('   2. Verify if you have an active ekey');
  console.log('   3. Get lock battery status');
  console.log('   4. Check ekey validity period');
  console.log('   5. Retrieve super passcode (if admin)');
  console.log('');
  console.log('What Ekey is Returned:');
  console.log('   - Returns the ekey YOU have for this lock');
  console.log('   - If you are admin: returns admin ekey');
  console.log('   - If you are common user: returns common user ekey');
  console.log('   - If you have no ekey: returns error');
  console.log('');
  console.log('Difference from List API:');
  console.log('   - Get: Returns ONE ekey for ONE specific lock');
  console.log('   - List: Returns ALL ekeys for ALL locks you have access to');
  console.log('');
  console.log('Response Information:');
  console.log('   keyId          - Unique ekey identifier');
  console.log('   lockName       - Display name of the lock');
  console.log('   userType       - 110301=Admin, 110302=Common User');
  console.log('   keyStatus      - Current status of ekey');
  console.log('   noKeyPwd       - Super passcode (admin only)');
  console.log('   electricQuantity - Lock battery level (%)');
  console.log('   remoteEnable   - 1=Can unlock remotely, 2=Cannot');
  console.log('   lockData       - Lock data for SDK operations');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testGetEkey() {
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

    // Step 2: Get ekey
    console.log('Step 2: Getting ekey for lock...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Ekey API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/get`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/get`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get ekey failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that lock ID is valid.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have an ekey for this lock.');
        console.error('   This lock has not been shared with you.');
      } else if (response.data.errcode === -3005) {
        console.error('ℹ️  Error -3005: No ekey found');
        console.error('   You do not have any ekey for this lock.');
      }
      console.error('');
      console.error('To find locks you have access to:');
      console.error('   node test-ekey-list.js');
      return;
    }

    console.log('✅ SUCCESS! Ekey retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const ekey = response.data;
    const isPermanent = ekey.startDate === 0 && ekey.endDate === 0;
    const isAdmin = ekey.userType === '110301';
    const hasRemoteUnlock = ekey.remoteEnable === 1;

    console.log('🔑 EKEY DETAILS:');
    console.log('   Key ID:', ekey.keyId);
    console.log('   Lock ID:', ekey.lockId);
    console.log('   Lock Name:', ekey.lockName);
    console.log('   Lock Alias:', ekey.lockAlias || 'N/A');
    console.log('   Lock MAC:', ekey.lockMac);
    console.log('');

    console.log('👤 USER TYPE:');
    console.log('   Type:', isAdmin ? 'Admin (110301)' : 'Common User (110302)');
    console.log('   Status:', ekey.keyStatus);
    console.log('   Authorized:', ekey.keyRight === 1 ? 'Yes' : 'No');
    console.log('');

    console.log('⏰ VALIDITY PERIOD:');
    if (isPermanent) {
      console.log('   Type: Permanent (Never expires)');
      console.log('   Start Date: N/A (Always valid)');
      console.log('   End Date: N/A (Always valid)');
    } else {
      console.log('   Type: Timed (Expires after period)');
      console.log('   Start Date:', new Date(ekey.startDate).toISOString());
      console.log('   End Date:', new Date(ekey.endDate).toISOString());
      const now = Date.now();
      if (now < ekey.startDate) {
        console.log('   Status: Not yet valid (starts in future)');
      } else if (now > ekey.endDate) {
        console.log('   Status: EXPIRED');
      } else {
        console.log('   Status: Active and valid');
      }
    }
    console.log('');

    console.log('🔓 UNLOCK FEATURES:');
    console.log('   Remote Unlock:', hasRemoteUnlock ? 'Enabled (1)' : 'Disabled (2)');
    if (ekey.noKeyPwd) {
      console.log('   Super Passcode:', ekey.noKeyPwd, '(Can be entered on keypad)');
    }
    console.log('   Passcode Version:', ekey.keyboardPwdVersion);
    console.log('');

    console.log('🔋 LOCK STATUS:');
    console.log('   Battery Level:', ekey.electricQuantity + '%');
    console.log('   Lock Version:', JSON.stringify(ekey.lockVersion));
    console.log('');

    if (ekey.remarks) {
      console.log('📝 REMARKS:');
      console.log('   ', ekey.remarks);
      console.log('');
    }

    console.log('📊 TECHNICAL DETAILS:');
    console.log('   Special Value:', ekey.specialValue);
    console.log('   Key Rights:', ekey.keyRight);
    console.log('   Lock Data Length:', ekey.lockData ? ekey.lockData.length + ' bytes' : 'N/A');
    console.log('');

    console.log('📱 WHAT YOU CAN DO:');
    if (isAdmin) {
      console.log('   ✅ You are the ADMIN of this lock');
      console.log('   ✅ You can send ekeys to others');
      console.log('   ✅ You can delete this lock');
      console.log('   ✅ You have the super passcode');
      console.log('   ✅ You can manage all lock settings');
      console.log('');
      console.log('   Send ekey to others:');
      console.log(`     node test-ekey-send.js ${username} [password] ${lockId} <receiver> <keyName> 0 0`);
    } else {
      console.log('   ℹ️  You are a COMMON USER of this lock');
      console.log('   ✅ You can unlock the lock');
      if (hasRemoteUnlock) {
        console.log('   ✅ You can unlock remotely via app');
      } else {
        console.log('   ⚠️  Remote unlock is disabled for you');
      }
      console.log('   ❌ You cannot send ekeys to others');
      console.log('   ❌ You cannot delete this lock');
    }
    console.log('');

    console.log('🛠️  MANAGEMENT OPTIONS:');
    console.log('   - Delete this ekey:');
    console.log(`     node test-ekey-delete.js ${username} [password] ${ekey.keyId}`);
    console.log('');
    if (isAdmin) {
      console.log('   ⚠️  WARNING: Deleting admin ekey will delete ALL ekeys and passcodes for this lock!');
    }
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Get ekey error');
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
        console.error('   Check that lock ID is valid.');
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have an ekey for this lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testGetEkey();
