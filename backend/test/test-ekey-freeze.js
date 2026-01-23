import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('❄️  Testing TTLock Freeze Ekey API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const keyId = process.argv[4]; // Key ID is required

if (!keyId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ekey-freeze.js [username] [password] <keyId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-ekey-freeze.js tusharvaishnavtv@gmail.com Tushar@900 246379122');
  console.log('');
  console.log('Parameters:');
  console.log('   keyId - Ekey ID to freeze (required)');
  console.log('');
  console.log('To get a keyId:');
  console.log('   - List all your ekeys:');
  console.log('     node test-ekey-list.js');
  console.log('   - Or get ekey for specific lock:');
  console.log('     node test-ekey-get.js [username] [password] <lockId>');
  console.log('');
  console.log('What is Freezing:');
  console.log('   - TEMPORARILY disables an ekey');
  console.log('   - User cannot unlock the lock while frozen');
  console.log('   - Ekey status changes to "Frozen" (110402)');
  console.log('   - Can be REVERSED by unfreezing later');
  console.log('   - Alternative to permanent deletion');
  console.log('');
  console.log('Freeze vs Delete:');
  console.log('   FREEZE:');
  console.log('   ✅ Temporary - can be reversed');
  console.log('   ✅ Ekey still exists in system');
  console.log('   ✅ Can be unfrozen to restore access');
  console.log('   ✅ User sees frozen ekey in their app');
  console.log('   ℹ️  Good for temporary suspensions');
  console.log('');
  console.log('   DELETE:');
  console.log('   ❌ Permanent - cannot be undone');
  console.log('   ❌ Ekey removed from system');
  console.log('   ❌ Must send new ekey to restore access');
  console.log('   ❌ User loses ekey completely');
  console.log('   ℹ️  Good for permanent revocations');
  console.log('');
  console.log('What Happens When You Freeze:');
  console.log('   1. Ekey status changed to "Frozen" (110402)');
  console.log('   2. User can no longer unlock the lock');
  console.log('   3. Ekey still appears in user\'s app (grayed out)');
  console.log('   4. Admin can unfreeze later to restore access');
  console.log('   5. Validity period remains unchanged');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Temporarily suspend access during investigation');
  console.log('   2. Disable access during user vacation/absence');
  console.log('   3. Pause access while waiting for payment');
  console.log('   4. Test access control without permanent changes');
  console.log('   5. Quick response to security concerns');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Only lock admin can freeze ekeys');
  console.log('   - Cannot freeze admin ekey (only common user ekeys)');
  console.log('   - Frozen ekey can be unfrozen anytime');
  console.log('   - User receives notification when frozen');
  console.log('   - If ekey was timed, validity period still applies');
  console.log('');
  console.log('After Freezing:');
  console.log('   - To unfreeze:');
  console.log('     node test-ekey-unfreeze.js [username] [password] <keyId>');
  console.log('   - To check status:');
  console.log('     node test-ekey-list.js');
  console.log('   - User will see "Frozen" status in their app');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Ekey ID:', keyId);
console.log('');

async function testFreezeEkey() {
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

    // Step 2: Freeze ekey
    console.log('Step 2: Freezing ekey...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Freeze Ekey API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/freeze`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/freeze`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Freeze ekey failed');
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
        console.error('   You do not have permission to freeze this ekey.');
      } else if (response.data.errcode === -3001) {
        console.error('ℹ️  Error -3001: Ekey is already frozen');
        console.error('   This ekey is already in frozen state.');
        console.error('   To restore access, use unfreeze instead.');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have been deleted.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can freeze ekeys.');
      }
      console.error('');
      console.error('To find valid ekey IDs:');
      console.error('   node test-ekey-list.js');
      return;
    }

    console.log('✅ SUCCESS! Ekey frozen successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('❄️  FREEZE SUMMARY:');
    console.log('   Ekey ID:', keyId);
    console.log('   Frozen At:', new Date().toISOString());
    console.log('   Status: Frozen (110402)');
    console.log('   Reversible: Yes');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Ekey status changed from Active to Frozen');
    console.log('   ✅ User access temporarily disabled');
    console.log('   ✅ User can no longer unlock the lock');
    console.log('   ✅ Ekey still exists in the system');
    console.log('   ℹ️  User sees frozen status in their app');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Freeze is TEMPORARY and REVERSIBLE');
    console.log('   - User cannot unlock while ekey is frozen');
    console.log('   - Ekey still appears in user\'s app (grayed out)');
    console.log('   - Validity period (if timed) remains unchanged');
    console.log('   - Can be unfrozen anytime to restore access');
    console.log('');

    console.log('🔄 FREEZE vs DELETE:');
    console.log('   You chose FREEZE (good choice for temporary suspensions):');
    console.log('   ✅ Can be reversed anytime');
    console.log('   ✅ Ekey preserved in system');
    console.log('   ✅ Quick to restore access');
    console.log('');
    console.log('   If you need PERMANENT removal, use DELETE instead:');
    console.log('   ❌ Cannot be undone');
    console.log('   ❌ Must send new ekey to restore');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify freeze status:');
    console.log('     node test-ekey-list.js');
    console.log('');
    console.log('   - To restore access (unfreeze):');
    console.log(`     node test-ekey-unfreeze.js ${username} [password] ${keyId}`);
    console.log('');
    console.log('   - User should refresh their app to see frozen status');
    console.log('   - User will receive notification about frozen ekey');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Freeze ekey error');
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
      } else if (error.response.data.errcode === -3001) {
        console.error('ℹ️  Error -3001: Ekey is already frozen');
        console.error('   This ekey is already in frozen state.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Ekey record does not exist');
        console.error('   The ekey may have been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can freeze ekeys.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testFreezeEkey();
