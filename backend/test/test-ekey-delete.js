import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete Ekey API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const keyId = process.argv[4]; // Key ID is required

if (!keyId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ekey-delete.js [username] [password] <keyId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-ekey-delete.js tusharvaishnavtv@gmail.com Tushar@900 246379122');
  console.log('');
  console.log('Parameters:');
  console.log('   keyId - Ekey ID to delete (required)');
  console.log('');
  console.log('To get a keyId:');
  console.log('   - List all your ekeys:');
  console.log('     node test-ekey-list.js');
  console.log('   - Or get ekey for specific lock:');
  console.log('     node test-ekey-get.js [username] [password] <lockId>');
  console.log('');
  console.log('⚠️  CRITICAL WARNING - ADMIN EKEY DELETION:');
  console.log('   ═══════════════════════════════════════════');
  console.log('   When you delete an ADMIN EKEY:');
  console.log('   ❌ ALL ekeys for the lock are deleted');
  console.log('   ❌ ALL passcodes for the lock are deleted');
  console.log('   ❌ ALL users lose access to the lock');
  console.log('   ❌ Cannot be undone');
  console.log('   ⚠️  Physical lock may need to be reset!');
  console.log('');
  console.log('When you delete a COMMON USER EKEY:');
  console.log('   ✅ Only that specific ekey is deleted');
  console.log('   ✅ Other users retain their access');
  console.log('   ✅ Admin ekey remains intact');
  console.log('   ℹ️  User loses access to the lock');
  console.log('');
  console.log('What happens when you delete:');
  console.log('   1. Ekey removed from cloud server permanently');
  console.log('   2. User can no longer unlock the lock');
  console.log('   3. Ekey disappears from user\'s app');
  console.log('   4. Lock access is revoked immediately');
  console.log('');
  console.log('Before Deleting:');
  console.log('   ✓ Verify this is the correct ekey to delete');
  console.log('   ✓ Check if it\'s an admin or common user ekey');
  console.log('   ✓ Ensure you have alternative access methods');
  console.log('   ✓ Consider freezing instead of deleting');
  console.log('');
  console.log('Use Cases for Deletion:');
  console.log('   1. Remove access for terminated users');
  console.log('   2. Clean up expired temporary access');
  console.log('   3. Revoke compromised ekeys (security)');
  console.log('   4. Delete duplicate ekeys');
  console.log('   5. Decommission old locks (admin ekey)');
  console.log('');
  console.log('Alternatives to Deletion:');
  console.log('   - Freeze ekey (temporary disable):');
  console.log('     node test-ekey-freeze.js [user] [pass] <keyId>');
  console.log('   - Change validity period (shorten access):');
  console.log('     node test-ekey-change-period.js [user] [pass] <keyId> <start> <end>');
  console.log('');
  console.log('How to Identify Ekey Type:');
  console.log('   - Run: node test-ekey-list.js');
  console.log('   - Check userType field:');
  console.log('     • 110301 = Admin ekey (DELETE WITH EXTREME CAUTION)');
  console.log('     • 110302 = Common user ekey (Safe to delete)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Ekey ID:', keyId);
console.log('');
console.log('⚠️  WARNING: This will permanently delete the ekey!');
console.log('');

async function testDeleteEkey() {
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

    // Step 2: Delete ekey
    console.log('Step 2: Deleting ekey...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Ekey API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete ekey failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that ekey ID is valid.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: Ekey not found');
        console.error('   The ekey ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete this ekey.');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have already been deleted.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete ekeys.');
      }
      console.error('');
      console.error('To find valid ekey IDs:');
      console.error('   node test-ekey-list.js');
      return;
    }

    console.log('✅ SUCCESS! Ekey deleted permanently');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  DELETION SUMMARY:');
    console.log('   Ekey ID:', keyId);
    console.log('   Deleted At:', new Date().toISOString());
    console.log('   Status: Permanently deleted');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Ekey removed from cloud server');
    console.log('   ✅ User can no longer unlock the lock');
    console.log('   ✅ Ekey removed from user\'s app');
    console.log('   ✅ Access revoked immediately');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Deletion is permanent and cannot be undone');
    console.log('   - If this was an admin ekey:');
    console.log('     ❌ ALL ekeys for the lock have been deleted');
    console.log('     ❌ ALL passcodes for the lock have been deleted');
    console.log('     ❌ ALL users lost access to the lock');
    console.log('     ⚠️  Physical lock may need factory reset');
    console.log('   - If this was a common user ekey:');
    console.log('     ✅ Only this specific ekey was deleted');
    console.log('     ✅ Other users still have access');
    console.log('     ✅ Admin ekey remains intact');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify deletion by listing ekeys:');
    console.log('     node test-ekey-list.js');
    console.log('');
    console.log('   - If user needs access again:');
    console.log('     1. Admin can send new ekey:');
    console.log('        node test-ekey-send.js [user] [pass] <lockId> <receiver> <keyName> 0 0');
    console.log('');
    console.log('   - If admin ekey was deleted:');
    console.log('     1. Lock must be re-initialized via SDK');
    console.log('     2. May require physical access to lock');
    console.log('     3. Contact TTLock support if needed');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Delete ekey error');
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
        console.error('   Check that ekey ID is valid.');
      } else if (error.response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: Ekey not found');
        console.error('   The ekey may have already been deleted.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have already been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete ekeys.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteEkey();
