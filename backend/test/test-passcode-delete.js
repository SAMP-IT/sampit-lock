import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete Passcode API');
console.log('======================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const passcodeId = process.argv[5]; // Passcode ID is required

if (!lockId || !passcodeId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-passcode-delete.js [username] [password] <lockId> <passcodeId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-passcode-delete.js tusharvaishnavtv@gmail.com Tushar@900 20749172 10236');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId     - ID of the lock (required)');
  console.log('   passcodeId - ID of the passcode to delete (required)');
  console.log('');
  console.log('To get lockId:');
  console.log('   - List all your locks:');
  console.log('     node test-lock-list.js');
  console.log('');
  console.log('To get passcodeId:');
  console.log('   - When you created the passcode, you received a passcodeId');
  console.log('   - Save this ID when creating passcodes for future deletion');
  console.log('');
  console.log('What this API does:');
  console.log('   - Deletes a specific passcode from a lock');
  console.log('   - User can no longer unlock with this passcode');
  console.log('   - Only works with V4 passcode locks');
  console.log('   - Deletion is PERMANENT and cannot be undone');
  console.log('');
  console.log('📊 DELETE TYPES:');
  console.log('');
  console.log('   Type 1: Delete via App via Bluetooth (DEFAULT)');
  console.log('   - Requires Bluetooth deletion first');
  console.log('   - Must delete via Bluetooth before calling this API');
  console.log('   - Use when you have physical access to lock');
  console.log('');
  console.log('   Type 2: Delete via WiFi Gateway');
  console.log('   - Direct cloud deletion, no Bluetooth needed');
  console.log('   - Use when lock is connected to WiFi gateway');
  console.log('   - Can call this API directly');
  console.log('');
  console.log('   Type 3: Delete via NB-IoT');
  console.log('   - Direct cloud deletion, no Bluetooth needed');
  console.log('   - Use when lock has NB-IoT connectivity');
  console.log('   - Can call this API directly');
  console.log('');
  console.log('Important Notes:');
  console.log('   - This script uses deleteType=2 (WiFi Gateway) for direct deletion');
  console.log('   - Deletion is PERMANENT and cannot be undone');
  console.log('   - Only V4 passcode locks support passcode deletion');
  console.log('   - User loses access immediately upon deletion');
  console.log('   - Other passcodes are NOT affected');
  console.log('');
  console.log('Use Cases:');
  console.log('   - Revoke temporary access after guest checkout');
  console.log('   - Remove service provider access after job completion');
  console.log('   - Delete compromised or leaked passcodes');
  console.log('   - Clean up expired or unused passcodes');
  console.log('   - Remove access for terminated employees');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Passcode ID:', passcodeId);
console.log('Delete Type: 2 (WiFi Gateway - direct cloud deletion)');
console.log('');

async function testDeletePasscode() {
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

    // Step 2: Delete passcode
    console.log('Step 2: Deleting passcode...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      keyboardPwdId: parseInt(passcodeId),
      deleteType: 2, // WiFi Gateway - direct cloud deletion
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Passcode API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete passcode failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that lock ID and passcode ID are valid.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
        console.error('   List existing locks:');
        console.error('     node test-lock-list.js');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete passcodes for this lock.');
      } else if (response.data.errcode === -3008) {
        console.error('ℹ️  Error -3008: Passcode not found');
        console.error('   The passcode ID does not exist.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Passcode already deleted');
        console.error('   This passcode was already deleted.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Passcode deleted successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  DELETION SUMMARY:');
    console.log('   Lock ID:', lockId);
    console.log('   Passcode ID:', passcodeId);
    console.log('   Delete Type: 2 (WiFi Gateway)');
    console.log('   Deleted At:', new Date().toISOString());
    console.log('   Status: PERMANENTLY DELETED');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Passcode has been deleted from the lock');
    console.log('   ✅ User can no longer unlock with this passcode');
    console.log('   ✅ Deletion was performed via WiFi gateway (cloud)');
    console.log('   ✅ Other passcodes are NOT affected');
    console.log('   ❌ This passcode cannot be recovered');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Passcode deletion is PERMANENT and cannot be undone');
    console.log('   - User loses access immediately upon deletion');
    console.log('   - Other passcodes are NOT affected');
    console.log('   - Only V4 passcode locks support deletion');
    console.log('   - Need to create new passcode if access needs to be restored');
    console.log('');

    console.log('📊 DELETE TYPE USED:');
    console.log('   Type 2: Delete via WiFi Gateway');
    console.log('   - Direct cloud deletion');
    console.log('   - No Bluetooth connection needed');
    console.log('   - Works when lock is connected to WiFi gateway');
    console.log('');

    console.log('💡 USE CASES:');
    console.log('   - Revoke temporary access after guest checkout');
    console.log('   - Remove service provider access after job completion');
    console.log('   - Delete compromised or leaked passcodes');
    console.log('   - Clean up expired or unused passcodes');
    console.log('   - Remove access for terminated employees or residents');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - User will no longer be able to unlock with this passcode');
    console.log('   - If access needs to be restored, create a new passcode:');
    console.log(`     node test-passcode-get.js ${username} [password] ${lockId} <passcodeType>`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Delete passcode error');
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
        console.error('   Check lock ID and passcode ID.');
      } else if (error.response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   Check lock ID.');
      } else if (error.response.data.errcode === -3008) {
        console.error('ℹ️  Error -3008: Passcode not found');
        console.error('   Check passcode ID.');
      } else if (error.response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Passcode already deleted');
        console.error('   This passcode was already deleted.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeletePasscode();
