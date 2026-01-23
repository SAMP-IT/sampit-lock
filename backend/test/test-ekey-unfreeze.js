import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔓 Testing TTLock Unfreeze Ekey API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const keyId = process.argv[4]; // Key ID is required

if (!keyId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ekey-unfreeze.js [username] [password] <keyId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-ekey-unfreeze.js tusharvaishnavtv@gmail.com Tushar@900 246379122');
  console.log('');
  console.log('Parameters:');
  console.log('   keyId - Ekey ID to unfreeze (required)');
  console.log('');
  console.log('To get a keyId:');
  console.log('   - List all your ekeys (look for Frozen status):');
  console.log('     node test-ekey-list.js');
  console.log('   - Or get ekey for specific lock:');
  console.log('     node test-ekey-get.js [username] [password] <lockId>');
  console.log('');
  console.log('What is Unfreezing:');
  console.log('   - RE-ENABLES a frozen ekey');
  console.log('   - Restores user\'s ability to unlock the lock');
  console.log('   - Ekey status changes from "Frozen" to "Active"');
  console.log('   - Reverses the freeze operation');
  console.log('   - User regains full access');
  console.log('');
  console.log('Prerequisites:');
  console.log('   - Ekey must be in Frozen (110402) status');
  console.log('   - You must be the lock admin');
  console.log('   - Ekey must not be expired (if timed)');
  console.log('');
  console.log('What Happens When You Unfreeze:');
  console.log('   1. Ekey status changed from Frozen to Active (110401)');
  console.log('   2. User access restored');
  console.log('   3. User can now unlock the lock again');
  console.log('   4. Ekey appears active in user\'s app');
  console.log('   5. Validity period remains unchanged');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Restore access after temporary suspension');
  console.log('   2. Re-enable access after investigation completed');
  console.log('   3. Restore access after user returns from vacation');
  console.log('   4. Re-enable after payment received');
  console.log('   5. Undo accidental freeze operation');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Only lock admin can unfreeze ekeys');
  console.log('   - Ekey must be frozen first (cannot unfreeze active ekey)');
  console.log('   - If ekey was timed, check validity period is still current');
  console.log('   - User receives notification when unfrozen');
  console.log('   - Ekey can be frozen again if needed');
  console.log('');
  console.log('Validity Period Check:');
  console.log('   - If ekey was timed (not permanent):');
  console.log('     • Check if current time is within validity period');
  console.log('     • Ekey will still expire at original end date');
  console.log('     • Unfreezing does NOT extend the validity period');
  console.log('   - If ekey is expired (past endDate):');
  console.log('     • Unfreezing will not help');
  console.log('     • Need to send new ekey or modify validity period');
  console.log('');
  console.log('After Unfreezing:');
  console.log('   - To check status:');
  console.log('     node test-ekey-list.js');
  console.log('   - To freeze again if needed:');
  console.log('     node test-ekey-freeze.js [username] [password] <keyId>');
  console.log('   - User should refresh their app to see active status');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Ekey ID:', keyId);
console.log('');

async function testUnfreezeEkey() {
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

    // Step 2: Unfreeze ekey
    console.log('Step 2: Unfreezing ekey...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Unfreeze Ekey API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/unfreeze`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/unfreeze`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Unfreeze ekey failed');
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
        console.error('   You do not have permission to unfreeze this ekey.');
      } else if (response.data.errcode === -3002) {
        console.error('ℹ️  Error -3002: Ekey is not frozen');
        console.error('   This ekey is already in active state.');
        console.error('   Cannot unfreeze an ekey that is not frozen.');
        console.error('');
        console.error('Possible reasons:');
        console.error('   - Ekey was never frozen');
        console.error('   - Ekey was already unfrozen');
        console.error('   - Ekey status is Active (110401), not Frozen (110402)');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have been deleted.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can unfreeze ekeys.');
      }
      console.error('');
      console.error('To check ekey status:');
      console.error('   node test-ekey-list.js');
      return;
    }

    console.log('✅ SUCCESS! Ekey unfrozen successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🔓 UNFREEZE SUMMARY:');
    console.log('   Ekey ID:', keyId);
    console.log('   Unfrozen At:', new Date().toISOString());
    console.log('   Status: Active (110401)');
    console.log('   Access: Restored');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Ekey status changed from Frozen to Active');
    console.log('   ✅ User access restored');
    console.log('   ✅ User can now unlock the lock');
    console.log('   ✅ Ekey appears active in user\'s app');
    console.log('   ℹ️  Validity period unchanged (original dates still apply)');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Access has been RESTORED');
    console.log('   - User can now unlock the lock normally');
    console.log('   - If ekey was timed, check validity period is still current');
    console.log('   - User should refresh their app to see active status');
    console.log('   - Ekey can be frozen again if needed');
    console.log('');

    console.log('⏰ VALIDITY PERIOD:');
    console.log('   - Unfreezing does NOT change validity period');
    console.log('   - If ekey was permanent: Still permanent');
    console.log('   - If ekey was timed: Original dates still apply');
    console.log('   - Check ekey list to see validity period:');
    console.log('     node test-ekey-list.js');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify unfreeze status:');
    console.log('     node test-ekey-list.js');
    console.log('');
    console.log('   - If you need to freeze again:');
    console.log(`     node test-ekey-freeze.js ${username} [password] ${keyId}`);
    console.log('');
    console.log('   - User should:');
    console.log('     1. Refresh their TTLock app');
    console.log('     2. Check ekey is now active');
    console.log('     3. Test unlocking the lock');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Unfreeze ekey error');
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
        console.error('   The ekey may have been deleted.');
      } else if (error.response.data.errcode === -3002) {
        console.error('ℹ️  Error -3002: Ekey is not frozen');
        console.error('   This ekey is already in active state.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can unfreeze ekeys.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testUnfreezeEkey();
