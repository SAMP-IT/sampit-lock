import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete QR Code API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const qrCodeId = process.argv[5]; // QR Code ID is required

if (!lockId || !qrCodeId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-delete.js [username] [password] <lockId> <qrCodeId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-qr-code-delete.js tusharvaishnavtv@gmail.com Tushar@900 7296935 123456');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId   - Lock ID (required)');
  console.log('   qrCodeId - QR code ID to delete (required)');
  console.log('');
  console.log('To get lock and QR code IDs, first run:');
  console.log('   node test-lock-list.js         # Get lock IDs');
  console.log('   node test-qr-code-list.js      # Get QR code IDs for a lock');
  console.log('');
  console.log('⚠️  IMPORTANT - What happens when you delete:');
  console.log('   1. QR code is removed from cloud server permanently');
  console.log('   2. H5 link becomes invalid immediately');
  console.log('   3. Cannot get QR code data anymore');
  console.log('   4. Cannot refresh the QR code link');
  console.log('   5. QR code will NOT appear in list API results');
  console.log('');
  console.log('⚠️  NOTE - Already generated QR codes:');
  console.log('   - If a QR code image was already generated (within 10 min)');
  console.log('   - That QR code image is still valid until its expiration');
  console.log('   - Can still be used to unlock during valid period');
  console.log('   - But after 10 minutes, it cannot be regenerated');
  console.log('');
  console.log('Use Cases for Deletion:');
  console.log('   1. Revoke access permanently');
  console.log('   2. Remove expired QR codes');
  console.log('   3. Clean up test QR codes');
  console.log('   4. Security - deactivate compromised QR codes');
  console.log('');
  console.log('⚠️  CANNOT BE UNDONE:');
  console.log('   - Deletion is permanent');
  console.log('   - Must create new QR code to restore access');
  console.log('   - All QR code history is lost');
  console.log('');
  console.log('Permissions Required:');
  console.log('   - Must be lock admin');
  console.log('   - Cannot delete QR codes from locks you don\'t admin');
  console.log('   - Error 20002 if not admin');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('QR Code ID:', qrCodeId);
console.log('');
console.log('⚠️  WARNING: This will permanently delete the QR code!');
console.log('');

async function testDeleteQRCode() {
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

    // Step 2: Delete QR code
    console.log('Step 2: Deleting QR code...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      qrCodeId: parseInt(qrCodeId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete QR Code API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete QR code failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code ID does not exist.');
        console.error('   It may have already been deleted.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete QR codes from this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete QR codes.');
        console.error('   You need admin privileges for this lock.');
      }
      console.error('');
      console.error('To find valid IDs:');
      console.error('   node test-lock-list.js         # Get lock IDs');
      console.error('   node test-qr-code-list.js      # Get QR code IDs');
      return;
    }

    console.log('✅ SUCCESS! QR code deleted permanently');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  DELETION SUMMARY:');
    console.log('   Lock ID:', lockId);
    console.log('   QR Code ID:', qrCodeId);
    console.log('   Deleted At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ QR code removed from cloud server');
    console.log('   ✅ H5 link is now invalid');
    console.log('   ✅ Cannot get QR code data anymore');
    console.log('   ✅ Will not appear in list API');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - If QR code image was already generated (< 10 min ago)');
    console.log('   - That specific QR code is still valid for unlocking');
    console.log('   - But cannot be regenerated after it expires');
    console.log('   - Cannot retrieve the link or data anymore');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - If you need to restore access, create a new QR code:');
    console.log(`     node test-qr-code-add.js ${username} [password] ${lockId} 2 "New QR Code"`);
    console.log('');
    console.log('   - To verify deletion, check the QR code list:');
    console.log(`     node test-qr-code-list.js ${username} [password] ${lockId} 1 20`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Delete QR code error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code may have already been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete QR codes.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteQRCode();
