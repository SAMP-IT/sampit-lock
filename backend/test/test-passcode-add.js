import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('➕ Testing TTLock Add Passcode API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const customPasscode = process.argv[5]; // Custom passcode is required

if (!lockId || !customPasscode) {
  console.log('⚠️  USAGE:');
  console.log('   node test-passcode-add.js [username] [password] <lockId> <customPasscode>');
  console.log('');
  console.log('Example:');
  console.log('   node test-passcode-add.js tusharvaishnavtv@gmail.com Tushar@900 20749172 123456');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId         - ID of the lock (required)');
  console.log('   customPasscode - Your custom passcode (required)');
  console.log('');
  console.log('To get lockId:');
  console.log('   - List all your locks:');
  console.log('     node test-lock-list.js');
  console.log('');
  console.log('What this API does:');
  console.log('   - Adds a CUSTOM passcode to a lock');
  console.log('   - YOU specify the exact passcode (not system-generated)');
  console.log('   - Only works with V4 passcode locks');
  console.log('   - Requires start date and end date');
  console.log('');
  console.log('📊 GET vs ADD PASSCODE:');
  console.log('');
  console.log('   GET PASSCODE (node test-passcode-get.js):');
  console.log('   - System generates RANDOM passcode');
  console.log('   - No control over passcode value');
  console.log('   - Supports 14 passcode types');
  console.log('   - Quick passcode generation');
  console.log('');
  console.log('   ADD PASSCODE (this script):');
  console.log('   - YOU specify EXACT passcode');
  console.log('   - Full control over passcode value');
  console.log('   - Period-based only (start and end dates)');
  console.log('   - Memorable or specific passcode needed');
  console.log('');
  console.log('📊 ADD TYPES:');
  console.log('');
  console.log('   Type 1: Via phone Bluetooth (DEFAULT)');
  console.log('   - Requires SDK method call first');
  console.log('   - Use when you have physical access to lock');
  console.log('');
  console.log('   Type 2: Via WiFi Gateway');
  console.log('   - Direct cloud addition, no Bluetooth needed');
  console.log('   - Use when lock is connected to WiFi gateway');
  console.log('');
  console.log('   Type 3: Via NB-IoT');
  console.log('   - Direct cloud addition, no Bluetooth needed');
  console.log('   - Use when lock has NB-IoT connectivity');
  console.log('');
  console.log('Important Notes:');
  console.log('   - This script uses addType=2 (WiFi Gateway) for direct addition');
  console.log('   - Only V4 passcode locks support custom passcode addition');
  console.log('   - Passcode must meet lock requirements (length, format)');
  console.log('   - Start date and end date are REQUIRED');
  console.log('   - Passcode cannot already exist on the lock');
  console.log('');
  console.log('Use Cases:');
  console.log('   - Add memorable passcode for elderly users');
  console.log('   - Create easy-to-remember family passcode');
  console.log('   - Set specific passcode required by organization');
  console.log('   - Add temporary passcode with exact code needed');
  console.log('   - Provide branded or themed passcode (e.g., 2025 for year)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Custom Passcode:', customPasscode);
console.log('Add Type: 2 (WiFi Gateway - direct cloud addition)');
console.log('');

// Set validity period: Start now, end in 30 days
const startDate = Date.now();
const endDate = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from now

console.log('Validity Period:');
console.log('Start Date:', new Date(startDate).toISOString());
console.log('End Date:', new Date(endDate).toISOString());
console.log('Duration: 30 days');
console.log('');

async function testAddPasscode() {
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

    // Step 2: Add custom passcode
    console.log('Step 2: Adding custom passcode...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      keyboardPwd: customPasscode,
      keyboardPwdName: 'Custom Test Passcode',
      startDate: startDate,
      endDate: endDate,
      addType: 2, // WiFi Gateway - direct cloud addition
      date: Date.now()
    };

    console.log('📡 Calling TTLock Add Passcode API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/add`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/add`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Add passcode failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that all required fields are valid.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to add passcodes for this lock.');
      } else if (response.data.errcode === -3010) {
        console.error('ℹ️  Error -3010: Invalid time period');
        console.error('   Check startDate and endDate values.');
      } else if (response.data.errcode === -3011) {
        console.error('ℹ️  Error -3011: Passcode already exists');
        console.error('   This passcode is already added to the lock.');
        console.error('   Choose a different passcode.');
      } else if (response.data.errcode === -3012) {
        console.error('ℹ️  Error -3012: Invalid passcode format');
        console.error('   Passcode does not meet lock requirements.');
        console.error('   Check passcode length and format.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Custom passcode added successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { keyboardPwdId } = response.data;

    console.log('➕ ADD SUMMARY:');
    console.log('   ╔════════════════════════════════════════════╗');
    console.log('   ║  PASSCODE: ' + customPasscode.padEnd(32) + '║');
    console.log('   ╚════════════════════════════════════════════╝');
    console.log('');
    console.log('   Passcode ID:', keyboardPwdId);
    console.log('   Lock ID:', lockId);
    console.log('   Name: Custom Test Passcode');
    console.log('   Add Type: 2 (WiFi Gateway)');
    console.log('   Created At:', new Date().toISOString());
    console.log('');

    console.log('📅 VALIDITY PERIOD:');
    console.log('   Start:', new Date(startDate).toISOString());
    console.log('   End:', new Date(endDate).toISOString());
    console.log('   Duration: 30 days');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Custom passcode added to the lock');
    console.log('   ✅ User can unlock with this specific passcode');
    console.log('   ✅ Passcode is active for 30 days');
    console.log('   ✅ Addition performed via WiFi gateway (cloud)');
    console.log('');

    console.log('📊 GET vs ADD COMPARISON:');
    console.log('');
    console.log('   You used ADD (this script):');
    console.log('   ✅ You specified exact passcode:', customPasscode);
    console.log('   ✅ Full control over passcode value');
    console.log('   ✅ Memorable or specific code');
    console.log('');
    console.log('   If you used GET instead:');
    console.log('   ℹ️  System would generate random passcode');
    console.log('   ℹ️  No control over value');
    console.log('   ℹ️  Supports 14 passcode types');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Only V4 passcode locks support custom passcode addition');
    console.log('   - You specified the exact passcode:', customPasscode);
    console.log('   - Passcode is valid for 30 days from now');
    console.log('   - Save passcodeId for future management:', keyboardPwdId);
    console.log('   - User can start using this passcode immediately');
    console.log('');

    console.log('💡 USE CASES:');
    console.log('   ✅ Memorable passcode for elderly users');
    console.log('   ✅ Easy-to-remember family passcode');
    console.log('   ✅ Specific passcode required by organization');
    console.log('   ✅ Temporary passcode with exact code needed');
    console.log('   ✅ Branded or themed passcode');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   1. Share the passcode with the user:');
    console.log(`      Passcode: ${customPasscode}`);
    console.log('');
    console.log('   2. Save the passcode ID for future management:');
    console.log(`      Passcode ID: ${keyboardPwdId}`);
    console.log('');
    console.log('   3. To delete this passcode later:');
    console.log(`      node test-passcode-delete.js ${username} [password] ${lockId} ${keyboardPwdId}`);
    console.log('');
    console.log('   4. To change this passcode:');
    console.log(`      node test-passcode-change.js ${username} [password] ${lockId} ${keyboardPwdId}`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Add passcode error');
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
        console.error('   Check all required fields.');
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission.');
      } else if (error.response.data.errcode === -3011) {
        console.error('ℹ️  Error -3011: Passcode already exists');
        console.error('   Choose a different passcode.');
      } else if (error.response.data.errcode === -3012) {
        console.error('ℹ️  Error -3012: Invalid passcode format');
        console.error('   Check passcode length and format.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testAddPasscode();
