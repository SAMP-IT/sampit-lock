import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔥 Testing TTLock Unfreeze Lock API');
console.log('===================================');
console.log('');
console.log('ℹ️  This API will UNFREEZE the lock, restoring all unlocking methods:');
console.log('  - Passcodes will work again');
console.log('  - IC cards will work again');
console.log('  - Fingerprints will work again');
console.log('  - App unlock will work again');
console.log('  - Remote unlock will work again');
console.log('');
console.log('This API reverses the freeze operation.');
console.log('Use this to restore normal lock operation after a freeze.');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-unfreeze-lock.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-unfreeze-lock.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API only works with locks that have WiFi gateway connectivity');
  console.log('   2. The lock must be online and connected to a gateway');
  console.log('   3. You must be the lock admin to unfreeze it');
  console.log('   4. After unfreezing, ALL unlocking methods will be restored');
  console.log('   5. The lock must have been previously frozen');
  console.log('');
  console.log('When to use:');
  console.log('   - After resolving a security emergency');
  console.log('   - Returning from vacation or extended absence');
  console.log('   - After clearing an incident response');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testUnfreezeLock() {
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

    // Step 2: Unfreeze the lock
    console.log('Step 2: Unfreezing lock...');
    console.log('');
    console.log('ℹ️  This will restore all unlocking methods');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Unfreeze Lock API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/unfreeze`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/unfreeze`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Unfreeze lock failed');
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
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can unfreeze the lock.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to unfreeze this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock unfrozen');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🔥 LOCK UNFROZEN!');
    console.log('   Lock ID:', lockId);
    console.log('   Unfrozen at:', new Date().toISOString());
    console.log('');
    console.log('✅ ALL UNLOCKING METHODS ARE NOW RESTORED:');
    console.log('   ✅ Passcodes - ENABLED');
    console.log('   ✅ IC Cards - ENABLED');
    console.log('   ✅ Fingerprints - ENABLED');
    console.log('   ✅ App unlock - ENABLED');
    console.log('   ✅ Remote unlock - ENABLED');
    console.log('');
    console.log('The lock is now operating normally.');
    console.log('All unlocking methods should work as expected.');

  } catch (error) {
    console.error('❌ FAILED! Unfreeze lock error');
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
testUnfreezeLock();
