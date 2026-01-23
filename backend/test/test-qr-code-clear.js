import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Clear All QR Codes API');
console.log('=========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-clear.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-qr-code-clear.js tusharvaishnavtv@gmail.com Tushar@900 7296935');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  🚨 CRITICAL WARNING - PERMANENT DELETION 🚨');
  console.log('');
  console.log('This API will DELETE ALL QR codes from the lock:');
  console.log('   ❌ ALL QR codes will be permanently removed');
  console.log('   ❌ ALL H5 links will become invalid');
  console.log('   ❌ Cannot get data for ANY QR code');
  console.log('   ❌ CANNOT BE UNDONE');
  console.log('');
  console.log('What happens when you clear all QR codes:');
  console.log('   1. Every QR code is deleted from the cloud server');
  console.log('   2. All H5 links become invalid immediately');
  console.log('   3. Cannot retrieve any QR code data');
  console.log('   4. QR code list will be empty');
  console.log('   5. Must recreate all QR codes from scratch');
  console.log('');
  console.log('⚠️  NOTE - Already generated QR code images:');
  console.log('   - If QR code images were already generated (< 10 min ago)');
  console.log('   - Those specific QR codes are still valid until expiration');
  console.log('   - But cannot be regenerated after they expire');
  console.log('');
  console.log('When to use Clear All QR Codes:');
  console.log('   1. Security breach - revoke all access immediately');
  console.log('   2. Lock repurposing - new tenant/owner needs clean slate');
  console.log('   3. Testing - clean up all test QR codes at once');
  console.log('   4. Maintenance - reset all access codes');
  console.log('');
  console.log('Alternative (Less Destructive):');
  console.log('   - Delete individual QR codes one by one:');
  console.log('     node test-qr-code-delete.js [username] [password] <lockId> <qrCodeId>');
  console.log('');
  console.log('Permissions Required:');
  console.log('   - Must be lock admin');
  console.log('   - Cannot clear QR codes from locks you don\'t admin');
  console.log('   - Error 20002 if not admin');
  console.log('');
  console.log('⚠️  BEFORE RUNNING THIS COMMAND:');
  console.log('   1. List all QR codes first:');
  console.log(`      node test-qr-code-list.js ${username || '[username]'} [password] <lockId> 1 20`);
  console.log('   2. Confirm you want to delete ALL of them');
  console.log('   3. Make sure you have backup access (physical keys, passcodes, etc.)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');
console.log('⚠️  🚨 CRITICAL WARNING 🚨');
console.log('This will permanently delete ALL QR codes from this lock!');
console.log('');

async function testClearQRCodes() {
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

    // Step 2: Clear all QR codes
    console.log('Step 2: Clearing all QR codes...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear QR Codes API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/clear`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/clear`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Clear QR codes failed');
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
        console.error('   You do not have permission to clear QR codes from this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can clear QR codes.');
        console.error('   You need admin privileges for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! All QR codes cleared permanently');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  CLEAR SUMMARY:');
    console.log('   Lock ID:', lockId);
    console.log('   Cleared At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ ALL QR codes removed from cloud server');
    console.log('   ✅ ALL H5 links are now invalid');
    console.log('   ✅ Cannot get data for ANY QR code');
    console.log('   ✅ QR code list is now empty');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - If any QR code images were already generated (< 10 min ago)');
    console.log('   - Those specific QR codes are still valid for unlocking');
    console.log('   - But cannot be regenerated after they expire');
    console.log('   - No way to retrieve the links or data anymore');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify the QR code list is empty:');
    console.log(`     node test-qr-code-list.js ${username} [password] ${lockId} 1 20`);
    console.log('');
    console.log('   - Create new QR codes as needed:');
    console.log(`     node test-qr-code-add.js ${username} [password] ${lockId} 2 "New QR Code"`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Clear QR codes error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can clear all QR codes.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testClearQRCodes();
