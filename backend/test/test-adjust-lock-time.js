import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🕐 Testing TTLock Adjust Lock Time API');
console.log('======================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-adjust-lock-time.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-adjust-lock-time.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  NOTE: This API only works with locks that have WiFi gateway connectivity.');
  console.log('   The lock must be online and accessible via WiFi to adjust its time.');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testAdjustLockTime() {
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

    // Step 2: Adjust lock time
    console.log('Step 2: Adjusting lock time...');
    console.log('');

    const currentTime = Date.now();
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: currentTime
    };

    console.log('📡 Calling TTLock Adjust Lock Time API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/updateDate`);
    console.log('Setting lock time to:', new Date(currentTime).toISOString());
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/updateDate`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Lock time adjustment failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock is offline');
        console.error('   The lock is not connected to WiFi/gateway or is offline.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to adjust this lock\'s time.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock time adjusted');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { date: adjustedDate } = response.data;

    console.log('🕐 LOCK TIME ADJUSTED:');
    console.log('   Requested Time:  ', new Date(currentTime).toISOString());
    console.log('   Adjusted To:     ', new Date(adjustedDate).toISOString());
    console.log('');

    // Calculate difference
    const timeDiff = Math.abs(adjustedDate - currentTime);
    const diffSeconds = Math.floor(timeDiff / 1000);

    console.log('⏰ TIME SYNCHRONIZATION:');
    console.log('   Time difference:', diffSeconds, 'seconds');

    if (diffSeconds < 5) {
      console.log('   Status: ✅ Perfectly synchronized');
    } else if (diffSeconds < 60) {
      console.log('   Status: ✅ Well synchronized (< 1 minute)');
    } else {
      console.log('   Status: ⚠️  Some drift detected');
    }

    console.log('');
    console.log('💡 TIP: You can verify the adjustment by running:');
    console.log(`   node test-lock-time.js ${username} [password] ${lockId}`);

  } catch (error) {
    console.error('❌ FAILED! Adjust lock time error');
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
testAdjustLockTime();
