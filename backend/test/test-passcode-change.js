import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('✏️  Testing TTLock Change Passcode API');
console.log('=====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const passcodeId = process.argv[5]; // Passcode ID is required

if (!lockId || !passcodeId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-passcode-change.js [username] [password] <lockId> <passcodeId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-passcode-change.js tusharvaishnavtv@gmail.com Tushar@900 20749172 10236');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId     - ID of the lock (required)');
  console.log('   passcodeId - ID of the passcode to change (required)');
  console.log('');
  console.log('To get lockId:');
  console.log('   - List all your locks:');
  console.log('     node test-lock-list.js');
  console.log('');
  console.log('To get passcodeId:');
  console.log('   - When you created the passcode, you received a passcodeId');
  console.log('   - Save this ID when creating passcodes');
  console.log('');
  console.log('What this API does:');
  console.log('   - Changes an existing passcode');
  console.log('   - Can change: name, passcode value, or validity period');
  console.log('   - Only works with V4 passcode locks');
  console.log('   - Can change any combination of properties');
  console.log('');
  console.log('What can be changed:');
  console.log('   - Passcode name (keyboardPwdName)');
  console.log('   - Passcode value (newKeyboardPwd)');
  console.log('   - Start date (startDate)');
  console.log('   - End date (endDate)');
  console.log('   - Any combination of the above');
  console.log('');
  console.log('📊 CHANGE TYPES:');
  console.log('');
  console.log('   Type 1: Via phone Bluetooth (DEFAULT)');
  console.log('   - Requires SDK method call first');
  console.log('   - Use when you have physical access to lock');
  console.log('');
  console.log('   Type 2: Via WiFi Gateway');
  console.log('   - Direct cloud change, no Bluetooth needed');
  console.log('   - Use when lock is connected to WiFi gateway');
  console.log('');
  console.log('   Type 3: Via NB-IoT');
  console.log('   - Direct cloud change, no Bluetooth needed');
  console.log('   - Use when lock has NB-IoT connectivity');
  console.log('');
  console.log('Important Notes:');
  console.log('   - This script uses changeType=2 (WiFi Gateway) for direct change');
  console.log('   - Only V4 passcode locks support passcode changes');
  console.log('   - If newKeyboardPwd is provided, old passcode becomes invalid');
  console.log('   - User must be informed of the new passcode');
  console.log('   - Can change name only, validity only, or all properties');
  console.log('');
  console.log('Use Cases:');
  console.log('   - Update passcode for security after potential leak');
  console.log('   - Change passcode name for better organization');
  console.log('   - Extend or reduce validity period');
  console.log('   - Replace compromised passcode with new one');
  console.log('   - Update temporary passcode to different dates');
  console.log('');
  console.log('⚠️  This test script will only test API connectivity');
  console.log('    It will NOT actually change the passcode (no new values provided)');
  console.log('    To actually change passcode, provide newKeyboardPwd, startDate, or endDate');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Passcode ID:', passcodeId);
console.log('Change Type: 2 (WiFi Gateway - direct cloud change)');
console.log('');

async function testChangePasscode() {
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

    // Step 2: Change passcode
    console.log('Step 2: Testing change passcode API...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      keyboardPwdId: parseInt(passcodeId),
      changeType: 2, // WiFi Gateway - direct cloud change
      date: Date.now()
    };

    // Note: Not providing newKeyboardPwd, startDate, or endDate
    // This is just a connectivity test

    console.log('📡 Calling TTLock Change Passcode API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/change`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/change`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Change passcode failed');
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
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to change passcodes for this lock.');
      } else if (response.data.errcode === -3008) {
        console.error('ℹ️  Error -3008: Passcode not found');
        console.error('   The passcode ID does not exist.');
      } else if (response.data.errcode === -3010) {
        console.error('ℹ️  Error -3010: Invalid time period');
        console.error('   Check startDate and endDate values.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Change passcode API works correctly');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('✏️  CHANGE SUMMARY:');
    console.log('   Lock ID:', lockId);
    console.log('   Passcode ID:', passcodeId);
    console.log('   Change Type: 2 (WiFi Gateway)');
    console.log('   API Test: Successful');
    console.log('');

    console.log('📋 WHAT CAN BE CHANGED:');
    console.log('   - Passcode name: Add keyboardPwdName parameter');
    console.log('   - Passcode value: Add newKeyboardPwd parameter');
    console.log('   - Start date: Add startDate parameter (timestamp in ms)');
    console.log('   - End date: Add endDate parameter (timestamp in ms)');
    console.log('');

    console.log('💡 EXAMPLE CHANGES:');
    console.log('');
    console.log('   Change passcode name only:');
    console.log('   - Add: keyboardPwdName: "Guest Access"');
    console.log('');
    console.log('   Change passcode value:');
    console.log('   - Add: newKeyboardPwd: "654321"');
    console.log('   - ⚠️  Old passcode becomes invalid!');
    console.log('');
    console.log('   Extend validity period:');
    console.log('   - Add: endDate: new timestamp for later date');
    console.log('');
    console.log('   Change everything:');
    console.log('   - Add all parameters to change name, value, and dates');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Only V4 passcode locks support passcode changes');
    console.log('   - If newKeyboardPwd is provided, old passcode becomes invalid');
    console.log('   - User must be informed of the new passcode');
    console.log('   - Change type 2 allows direct cloud changes (used in this test)');
    console.log('   - Can change any combination of properties');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Change passcode error');
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
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission.');
      } else if (error.response.data.errcode === -3008) {
        console.error('ℹ️  Error -3008: Passcode not found');
        console.error('   Check passcode ID.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testChangePasscode();
