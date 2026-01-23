import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('✏️  Testing TTLock Rename Wireless Keypad API');
console.log('============================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const wirelessKeypadId = process.argv[4]; // Wireless keypad ID is required
const newName = process.argv[5]; // New name is required

if (!wirelessKeypadId || !newName) {
  console.log('⚠️  USAGE:');
  console.log('   node test-wireless-keypad-rename.js [username] [password] <wirelessKeypadId> <newName>');
  console.log('');
  console.log('Example:');
  console.log('   node test-wireless-keypad-rename.js tusharvaishnavtv@gmail.com Tushar@900 12345 "Front Door Keypad"');
  console.log('');
  console.log('Parameters:');
  console.log('   wirelessKeypadId - Wireless keypad ID (required)');
  console.log('   newName          - New name for the wireless keypad (required)');
  console.log('');
  console.log('To get a wirelessKeypadId:');
  console.log('   - Must first add a wireless keypad:');
  console.log('     node test-wireless-keypad-add.js');
  console.log('   - The add API returns the wirelessKeypadId');
  console.log('   - Or get from wireless keypad list API (if available)');
  console.log('');
  console.log('What is Renaming:');
  console.log('   - Changes the display name of the wireless keypad');
  console.log('   - Does not affect keypad functionality');
  console.log('   - Useful for organization and identification');
  console.log('   - Name appears in app and management interfaces');
  console.log('');
  console.log('Naming Best Practices:');
  console.log('   - Use descriptive location names');
  console.log('   - Examples: "Main Entrance", "Back Door", "Garage"');
  console.log('   - Include floor or building if multiple locations');
  console.log('   - Keep names concise but meaningful');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Initial setup - give meaningful name after adding');
  console.log('   2. Relocation - update name when moving keypad');
  console.log('   3. Reorganization - standardize naming convention');
  console.log('   4. Clarity - make it easier to identify in lists');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Wireless Keypad ID:', wirelessKeypadId);
console.log('New Name:', newName);
console.log('');

async function testRenameWirelessKeypad() {
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

    // Step 2: Rename wireless keypad
    console.log('Step 2: Renaming wireless keypad...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      wirelessKeypadId: parseInt(wirelessKeypadId),
      wirelessKeypadName: newName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Rename Wireless Keypad API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/rename`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/rename`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Rename wireless keypad failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that wireless keypad ID and name are valid.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: Wireless keypad not found');
        console.error('   The wireless keypad ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to rename this wireless keypad.');
      } else if (response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Record does not exist');
        console.error('   The wireless keypad record does not exist in the system.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can rename wireless keypads.');
      }
      console.error('');
      console.error('To get valid wireless keypad IDs:');
      console.error('   - Must first add a wireless keypad');
      console.error('   - The add API returns the wirelessKeypadId');
      return;
    }

    console.log('✅ SUCCESS! Wireless keypad renamed');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('✏️  RENAME SUMMARY:');
    console.log('   Wireless Keypad ID:', wirelessKeypadId);
    console.log('   New Name:', newName);
    console.log('   Renamed At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT CHANGED:');
    console.log('   ✅ Display name updated in cloud');
    console.log('   ✅ Name visible in mobile app');
    console.log('   ✅ Name visible in management interface');
    console.log('   ℹ️  Keypad functionality unchanged');
    console.log('   ℹ️  Keypad settings unchanged');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Name is now updated in the system');
    console.log('   - Refresh your app to see the new name');
    console.log('   - Wireless keypad continues to work normally');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Rename wireless keypad error');
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
      } else if (error.response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: Wireless keypad not found');
        console.error('   The wireless keypad may have been deleted.');
      } else if (error.response.data.errcode === -3015) {
        console.error('ℹ️  Error -3015: Record does not exist');
        console.error('   The wireless keypad record does not exist.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can rename wireless keypads.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testRenameWirelessKeypad();
