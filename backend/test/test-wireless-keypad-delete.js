import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete Wireless Keypad API');
console.log('============================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const wirelessKeypadId = process.argv[4]; // Wireless keypad ID is required

if (!wirelessKeypadId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-wireless-keypad-delete.js [username] [password] <wirelessKeypadId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-wireless-keypad-delete.js tusharvaishnavtv@gmail.com Tushar@900 12345');
  console.log('');
  console.log('Parameters:');
  console.log('   wirelessKeypadId - Wireless keypad ID to delete (required)');
  console.log('');
  console.log('To get a wirelessKeypadId:');
  console.log('   - List all wireless keypads for a lock:');
  console.log('     node test-wireless-keypad-list.js [username] [password] <lockId>');
  console.log('   - Or from the add wireless keypad response');
  console.log('');
  console.log('⚠️  IMPORTANT - Permanent Deletion:');
  console.log('   This will PERMANENTLY delete the wireless keypad');
  console.log('   Cannot be undone');
  console.log('   The physical keypad will no longer work with the lock');
  console.log('');
  console.log('What happens when you delete:');
  console.log('   1. Wireless keypad removed from cloud server');
  console.log('   2. Keypad can no longer unlock the lock');
  console.log('   3. Must re-pair keypad if you want to use it again');
  console.log('   4. All keypad settings and configurations are lost');
  console.log('');
  console.log('Before Deleting:');
  console.log('   - Ensure you have other access methods (keys, passcodes, phone)');
  console.log('   - Verify this is the correct keypad to delete');
  console.log('   - Consider renaming instead of deleting if organizing');
  console.log('');
  console.log('Use Cases for Deletion:');
  console.log('   1. Keypad is broken or malfunctioning');
  console.log('   2. Keypad is lost or stolen (security concern)');
  console.log('   3. Upgrading to new keypad model');
  console.log('   4. No longer need wireless keypad access');
  console.log('   5. Lock is being decommissioned');
  console.log('');
  console.log('Alternatives to Deletion:');
  console.log('   - Rename for better organization:');
  console.log('     node test-wireless-keypad-rename.js [user] [pass] <keypadId> "New Name"');
  console.log('   - Keep as backup access method');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Wireless Keypad ID:', wirelessKeypadId);
console.log('');
console.log('⚠️  WARNING: This will permanently delete the wireless keypad!');
console.log('');

async function testDeleteWirelessKeypad() {
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

    // Step 2: Delete wireless keypad
    console.log('Step 2: Deleting wireless keypad...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      wirelessKeypadId: parseInt(wirelessKeypadId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Wireless Keypad API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete wireless keypad failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that wireless keypad ID is valid.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: Wireless keypad not found');
        console.error('   The wireless keypad ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete this wireless keypad.');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Record does not exist');
        console.error('   The wireless keypad record does not exist.');
        console.error('   It may have already been deleted.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete wireless keypads.');
      }
      console.error('');
      console.error('To find valid wireless keypad IDs:');
      console.error('   node test-wireless-keypad-list.js');
      return;
    }

    console.log('✅ SUCCESS! Wireless keypad deleted permanently');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  DELETION SUMMARY:');
    console.log('   Wireless Keypad ID:', wirelessKeypadId);
    console.log('   Deleted At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Wireless keypad removed from cloud server');
    console.log('   ✅ Keypad can no longer unlock the lock');
    console.log('   ✅ Keypad settings and configurations deleted');
    console.log('   ⚠️  Physical keypad still exists but is unpaired');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Deletion is permanent and cannot be undone');
    console.log('   - The physical keypad device still exists');
    console.log('   - To use this keypad again, must re-pair via SDK');
    console.log('   - All previous settings will be lost');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify deletion by listing wireless keypads:');
    console.log('     node test-wireless-keypad-list.js [username] [password] <lockId>');
    console.log('');
    console.log('   - If you need wireless keypad access again:');
    console.log('     1. Use TTLock SDK to re-pair the physical keypad');
    console.log('     2. Call add wireless keypad API with new parameters');
    console.log('');
    console.log('   - Ensure you have alternative access methods:');
    console.log('     - Physical keys');
    console.log('     - Passcodes');
    console.log('     - Mobile app unlock');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Delete wireless keypad error');
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
        console.error('   Check that wireless keypad ID is valid.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Record does not exist');
        console.error('   The wireless keypad may have already been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can delete wireless keypads.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteWirelessKeypad();
