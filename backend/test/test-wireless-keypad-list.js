import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📋 Testing TTLock Get Wireless Keypads by Lock API');
console.log('==================================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-wireless-keypad-list.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-wireless-keypad-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What this API does:');
  console.log('   - Returns list of all wireless keypads for a specific lock');
  console.log('   - Shows keypad ID, serial number, name, and MAC address');
  console.log('   - Helps you manage and identify keypads');
  console.log('   - No pagination (returns all keypads for the lock)');
  console.log('');
  console.log('Response Information:');
  console.log('   wirelessKeypadId     - Unique ID for management operations');
  console.log('   wirelessKeypadNumber - Serial number (from hardware)');
  console.log('   wirelessKeypadName   - Display name for identification');
  console.log('   wirelessKeypadMac    - MAC address (Bluetooth/WiFi)');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. View all wireless keypads for a lock');
  console.log('   2. Get keypad IDs for rename/delete operations');
  console.log('   3. Verify keypad was added successfully');
  console.log('   4. Audit which keypads have access');
  console.log('   5. Organize and manage multiple keypads');
  console.log('');
  console.log('Empty List Scenarios:');
  console.log('   - No wireless keypads have been added to this lock');
  console.log('   - All keypads have been deleted');
  console.log('   - Lock does not support wireless keypads');
  console.log('');
  console.log('What to do with the results:');
  console.log('   - Use wirelessKeypadId to rename:');
  console.log('     node test-wireless-keypad-rename.js [user] [pass] <keypadId> "New Name"');
  console.log('');
  console.log('   - Use wirelessKeypadId to delete:');
  console.log('     node test-wireless-keypad-delete.js [user] [pass] <keypadId>');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testListWirelessKeypads() {
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

    // Step 2: Get wireless keypads list
    console.log('Step 2: Getting wireless keypads list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Wireless Keypads by Lock API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/listByLock`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/wirelessKeypad/listByLock`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get wireless keypads failed');
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
        console.error('   You do not have permission to view wireless keypads for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Wireless keypads list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [] } = response.data;

    console.log('⌨️  WIRELESS KEYPADS LIST:');
    console.log('   Lock ID:', lockId);
    console.log('   Total Keypads:', list.length);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No wireless keypads found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - No wireless keypads have been added to this lock');
      console.log('   - All keypads may have been deleted');
      console.log('   - Lock may not support wireless keypads');
      console.log('');
      console.log('To add a wireless keypad:');
      console.log(`   node test-wireless-keypad-add.js ${username} [password] ${lockId} [params]`);
      console.log('');
      console.log('⚠️  Note: Adding wireless keypad requires:');
      console.log('   - TTLock mobile SDK integration');
      console.log('   - Physical wireless keypad hardware');
      console.log('   - Pairing process via SDK');
    } else {
      console.log('⌨️  Keypad Details:');
      console.log('');

      list.forEach((keypad, index) => {
        console.log(`Wireless Keypad ${index + 1}:`);
        console.log(`   Keypad ID: ${keypad.wirelessKeypadId}`);
        console.log(`   Serial Number: ${keypad.wirelessKeypadNumber}`);
        console.log(`   Name: ${keypad.wirelessKeypadName}`);
        console.log(`   MAC Address: ${keypad.wirelessKeypadMac}`);
        console.log('');
      });

      console.log('📱 MANAGEMENT OPTIONS:');
      console.log('');
      console.log('To rename a keypad:');
      list.forEach((keypad, index) => {
        console.log(`   ${index + 1}. node test-wireless-keypad-rename.js ${username} [password] ${keypad.wirelessKeypadId} "New Name"`);
      });
      console.log('');
      console.log('To delete a keypad:');
      list.forEach((keypad, index) => {
        console.log(`   ${index + 1}. node test-wireless-keypad-delete.js ${username} [password] ${keypad.wirelessKeypadId}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ FAILED! Get wireless keypads error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have access to this lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testListWirelessKeypads();
