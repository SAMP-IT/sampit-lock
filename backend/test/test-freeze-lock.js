import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('❄️  Testing TTLock Freeze Lock API');
console.log('==================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will FREEZE the lock, making ALL unlocking methods UNUSABLE:');
console.log('  - Passcodes will not work');
console.log('  - IC cards will not work');
console.log('  - Fingerprints will not work');
console.log('  - App unlock will not work');
console.log('  - Remote unlock will not work');
console.log('');
console.log('This is a SECURITY FEATURE for emergencies (e.g., lost keys, theft).');
console.log('The lock can only be unfrozen via the app or API.');
console.log('');
console.log('USE WITH EXTREME CAUTION!');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-freeze-lock.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-freeze-lock.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API only works with locks that have WiFi gateway connectivity');
  console.log('   2. The lock must be online and connected to a gateway');
  console.log('   3. You must be the lock admin to freeze it');
  console.log('   4. After freezing, ALL unlocking methods will be disabled');
  console.log('   5. You will need to unfreeze the lock via app or API to use it again');
  console.log('');
  console.log('When to use:');
  console.log('   - Security emergency (lost keys, suspected unauthorized access)');
  console.log('   - Temporary lockdown (vacation, extended absence)');
  console.log('   - Incident response (theft attempt, break-in)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testFreezeLock() {
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

    // Step 2: Freeze the lock
    console.log('Step 2: Freezing lock...');
    console.log('');
    console.log('⚠️  FINAL WARNING: This will disable ALL unlocking methods!');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Freeze Lock API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/freeze`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/freeze`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Freeze lock failed');
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
        console.error('   Only the lock admin can freeze the lock.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to freeze this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock frozen');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('❄️  LOCK FROZEN!');
    console.log('   Lock ID:', lockId);
    console.log('   Frozen at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  ALL UNLOCKING METHODS ARE NOW DISABLED:');
    console.log('   ❌ Passcodes - DISABLED');
    console.log('   ❌ IC Cards - DISABLED');
    console.log('   ❌ Fingerprints - DISABLED');
    console.log('   ❌ App unlock - DISABLED');
    console.log('   ❌ Remote unlock - DISABLED');
    console.log('');
    console.log('To unfreeze the lock:');
    console.log('   1. Use the Sciener APP (TTLock app)');
    console.log('   2. Go to lock settings');
    console.log('   3. Unfreeze the lock');
    console.log('   OR');
    console.log('   Use the Unfreeze API (if available)');

  } catch (error) {
    console.error('❌ FAILED! Freeze lock error');
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
testFreezeLock();
