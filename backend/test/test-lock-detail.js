import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔍 Testing TTLock Get Lock Details API');
console.log('======================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock-detail.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock-detail.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testLockDetail() {
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

    // Step 2: Get lock details
    console.log('Step 2: Getting lock details...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Detail API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/detail`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/detail`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Lock detail request failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock details retrieved');
    console.log('');
    console.log('📊 Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const lock = response.data;

    console.log('🔐 LOCK DETAILS:');
    console.log('');
    console.log('Basic Information:');
    console.log('   Lock ID:', lock.lockId);
    console.log('   Lock Name:', lock.lockName);
    console.log('   Lock Alias:', lock.lockAlias || 'N/A');
    console.log('   Lock MAC:', lock.lockMac);
    console.log('   Initialized:', new Date(lock.date).toISOString());
    console.log('');

    console.log('Hardware Information:');
    console.log('   Model Number:', lock.modelNum || 'N/A');
    console.log('   Hardware Version:', lock.hardwareRevision || 'N/A');
    console.log('   Firmware Version:', lock.firmwareRevision || 'N/A');
    console.log('   Battery:', lock.electricQuantity + '%');
    console.log('');

    console.log('Security Information:');
    console.log('   Lock Key:', lock.lockKey ? lock.lockKey.substring(0, 20) + '...' : 'N/A');
    console.log('   AES Key:', lock.aesKeyStr ? lock.aesKeyStr.substring(0, 20) + '...' : 'N/A');
    console.log('   Admin Password:', lock.adminPwd || 'N/A');
    console.log('   Super Passcode (noKeyPwd):', lock.noKeyPwd || 'N/A');
    console.log('   Lock Flag Position:', lock.lockFlagPos);
    console.log('   Keyboard Password Version:', lock.keyboardPwdVersion);
    console.log('');

    console.log('Advanced Information:');
    console.log('   Special Value:', lock.specialValue);
    console.log('   Timezone Offset:', lock.timezoneRawOffset ? `${lock.timezoneRawOffset}ms` : 'N/A');

    if (lock.lockVersion) {
      console.log('   Lock Version:');
      console.log('      Protocol Type:', lock.lockVersion.protocolType);
      console.log('      Protocol Version:', lock.lockVersion.protocolVersion);
      console.log('      Scene:', lock.lockVersion.scene);
      console.log('      Group ID:', lock.lockVersion.groupId);
      console.log('      Org ID:', lock.lockVersion.orgId);
    }

  } catch (error) {
    console.error('❌ FAILED! Get lock detail error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
        console.error('');
        console.error('To find valid lock IDs, run:');
        console.error('   node test-lock-list.js');
      } else if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testLockDetail();
