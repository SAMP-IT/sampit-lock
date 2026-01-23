import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️ Testing TTLock Delete Fingerprint API');
console.log('=========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const fingerprintId = process.argv[5]; // Fingerprint ID is required
const deleteType = process.argv[6] || '2'; // Default to gateway (direct delete)

if (!lockId || !fingerprintId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-fingerprint-delete.js [username] [password] <lockId> <fingerprintId> [deleteType]');
  console.log('');
  console.log('Example:');
  console.log('   node test-fingerprint-delete.js tusharvaishnavtv@gmail.com Tushar@900 7296935 12345 2');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId        - Lock ID (required)');
  console.log('   fingerprintId - Fingerprint ID to delete (required)');
  console.log('   deleteType    - Delete method (optional, default: 2)');
  console.log('');
  console.log('To get lockId and fingerprintId, first run:');
  console.log('   node test-fingerprint-list.js');
  console.log('');
  console.log('⚠️  CRITICAL WARNINGS:');
  console.log('   1. This API PERMANENTLY DELETES a fingerprint from the lock');
  console.log('   2. The fingerprint CANNOT be recovered after deletion');
  console.log('   3. User will NO LONGER have fingerprint access to the lock');
  console.log('   4. You must be the lock admin to delete fingerprints');
  console.log('');
  console.log('Delete Type Values:');
  console.log('   1 - Phone Bluetooth (must call SDK method first)');
  console.log('   2 - Gateway (can delete directly via API) ← Recommended for testing');
  console.log('   3 - NB-IoT');
  console.log('');
  console.log('When to delete fingerprints:');
  console.log('   - User no longer needs access');
  console.log('   - Fingerprint quality is poor and needs re-enrollment');
  console.log('   - Security: user access should be revoked');
  console.log('   - Managing fingerprint capacity on the lock');
  console.log('   - Replacing old fingerprint with new one');
  console.log('');
  console.log('⚠️  Before Deletion:');
  console.log('   - Confirm with the user that fingerprint should be deleted');
  console.log('   - Verify you have the correct fingerprint ID');
  console.log('   - Consider revoking instead if temporary suspension needed');
  console.log('   - Backup fingerprint details if needed for records');
  console.log('');
  console.log('Workflow for deleting fingerprint:');
  console.log('   [Bluetooth Method - deleteType=1]');
  console.log('   1. Use TTLock mobile SDK to delete from lock hardware');
  console.log('   2. Call this API to delete from cloud');
  console.log('   3. Deletion is complete');
  console.log('');
  console.log('   [Gateway Method - deleteType=2]');
  console.log('   1. Call this API directly');
  console.log('   2. Gateway deletes fingerprint from lock');
  console.log('   3. Cloud records are removed');
  console.log('');
  console.log('After Deletion:');
  console.log('   - Fingerprint will no longer work on the lock');
  console.log('   - User cannot use that fingerprint to unlock');
  console.log('   - If user needs access again, must re-enroll fingerprint');
  console.log('   - New enrollment will generate new fingerprint ID');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Fingerprint ID:', fingerprintId);
console.log('Delete Type:', deleteType, '(' + getDeleteTypeText(parseInt(deleteType)) + ')');
console.log('');

console.log('⚠️  WARNING: This will PERMANENTLY DELETE the fingerprint!');
console.log('');

// Helper function
function getDeleteTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth - SDK required first',
    2: 'Gateway - Direct delete',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}

async function testDeleteFingerprint() {
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

    // Step 2: Delete fingerprint
    console.log('Step 2: Deleting fingerprint...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      fingerprintId: parseInt(fingerprintId),
      deleteType: parseInt(deleteType),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Fingerprint API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/fingerprint/delete`);
    console.log('');
    console.log('Fingerprint to delete:');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint ID:', fingerprintId);
    console.log('   Delete Method:', getDeleteTypeText(parseInt(deleteType)));
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete fingerprint failed');
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
        console.error('   You do not have permission to delete fingerprints from this lock.');
      } else if (response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Fingerprint not found');
        console.error('   The fingerprint ID does not exist for this lock.');
        console.error('');
        console.error('To find valid fingerprint IDs, run:');
        console.error(`   node test-fingerprint-list.js ${username} [password] ${lockId}`);
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can delete fingerprints.');
      }
      console.error('');
      console.error('To find valid lock IDs and fingerprint IDs, run:');
      console.error('   node test-fingerprint-list.js');
      return;
    }

    console.log('✅ SUCCESS! Fingerprint deleted');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️ FINGERPRINT DELETED SUCCESSFULLY!');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint ID:', fingerprintId);
    console.log('   Delete Method:', getDeleteTypeText(parseInt(deleteType)));
    console.log('   Deleted at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  What this means:');
    console.log('   - Fingerprint has been PERMANENTLY removed from the lock');
    console.log('   - This fingerprint can NO LONGER unlock the door');
    console.log('   - User will need to re-enroll fingerprint if access is needed again');
    console.log('   - Cloud records for this fingerprint have been deleted');
    console.log('');

    if (parseInt(deleteType) === 1) {
      console.log('📱 Bluetooth Method Notes:');
      console.log('   - Fingerprint was deleted via SDK first');
      console.log('   - Cloud deletion is now complete');
      console.log('   - Lock hardware has been updated');
    } else if (parseInt(deleteType) === 2) {
      console.log('🌐 Gateway Method Notes:');
      console.log('   - Fingerprint deleted directly via gateway');
      console.log('   - Gateway has updated the lock');
      console.log('   - Changes are effective immediately');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify fingerprint no longer appears in list:');
    console.log(`      node test-fingerprint-list.js ${username} [password] ${lockId}`);
    console.log('   2. Inform user that fingerprint access has been revoked');
    console.log('   3. If needed, add new fingerprint for user');
    console.log('');
    console.log('To add a new fingerprint:');
    console.log(`   node test-fingerprint-add.js ${username} [password] ${lockId} [fingerprintNumber] [type] [name]`);

  } catch (error) {
    console.error('❌ FAILED! Delete fingerprint error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Fingerprint not found');
        console.error('   The fingerprint ID does not exist for this lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteFingerprint();
