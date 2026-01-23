import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('➕ Testing TTLock Add QR Code API');
console.log('==================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const type = process.argv[5]; // QR code type is required
const name = process.argv[6]; // QR code name (optional)
const startDate = process.argv[7]; // Start date timestamp (optional)
const endDate = process.argv[8]; // End date timestamp (optional)

if (!lockId || !type) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-add.js [username] [password] <lockId> <type> [name] [startDate] [endDate]');
  console.log('');
  console.log('Example - Permanent QR Code:');
  console.log('   node test-qr-code-add.js tusharvaishnavtv@gmail.com Tushar@900 7296935 2 "Guest Access"');
  console.log('');
  console.log('Example - Period QR Code (3 days):');
  const now = Date.now();
  const threeDaysLater = now + (3 * 24 * 60 * 60 * 1000);
  console.log(`   node test-qr-code-add.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 "3-Day Pass" ${now} ${threeDaysLater}`);
  console.log('');
  console.log('Example - Cyclic QR Code (see below for cyclicConfig):');
  console.log('   (Cyclic requires code modification for cyclicConfig array)');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId    - Lock ID (required)');
  console.log('   type      - QR code type (required): 1=period, 2=permanent, 4=cyclic');
  console.log('   name      - QR code name (optional)');
  console.log('   startDate - Start time timestamp in milliseconds (optional, for type 1)');
  console.log('   endDate   - End time timestamp in milliseconds (optional, for type 1)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('QR Code Types:');
  console.log('   1 - Period (valid for specific time period)');
  console.log('       Requires: startDate and endDate');
  console.log('       Works 24/7 within the period');
  console.log('       Example: Guest access for 3 days');
  console.log('');
  console.log('   2 - Permanent (always valid, no expiration)');
  console.log('       No time restrictions');
  console.log('       Works until manually deleted');
  console.log('       Example: Owner access');
  console.log('');
  console.log('   4 - Cyclic (valid during specific hours)');
  console.log('       Requires: cyclicConfig array (modify code)');
  console.log('       Works only during configured time periods');
  console.log('       Different hours for each day of week');
  console.log('       Example: Office hours Monday-Friday 9AM-5PM');
  console.log('');
  console.log('Cyclic Configuration Example:');
  console.log('   [');
  console.log('     { weekDay: 1, startTime: 480, endTime: 1080 },  // Monday 8AM-6PM');
  console.log('     { weekDay: 2, startTime: 480, endTime: 1080 },  // Tuesday 8AM-6PM');
  console.log('     { weekDay: 3, startTime: 480, endTime: 1080 },  // Wednesday 8AM-6PM');
  console.log('     { weekDay: 4, startTime: 480, endTime: 1080 },  // Thursday 8AM-6PM');
  console.log('     { weekDay: 5, startTime: 480, endTime: 1080 }   // Friday 8AM-6PM');
  console.log('   ]');
  console.log('');
  console.log('   weekDay: 1=Monday, 2=Tuesday, ..., 7=Sunday');
  console.log('   startTime/endTime: minutes from midnight (480 = 8AM, 1080 = 6PM)');
  console.log('');
  console.log('⚠️  Lock Requirements:');
  console.log('   - Lock must have camera/QR scanner');
  console.log('   - Only specific lock models support QR codes');
  console.log('   - If unsupported, API returns error -3009');
  console.log('   - Must be lock admin to create QR codes (error 20002)');
  console.log('');
  console.log('How QR Codes Work:');
  console.log('   1. API creates QR code and returns H5 link');
  console.log('   2. Open H5 link on phone to display QR code');
  console.log('   3. Hold phone with QR code near lock camera');
  console.log('   4. Lock scans QR code and unlocks');
  console.log('   5. Unlock event is recorded in lock history');
  console.log('');
  console.log('⚠️  IMPORTANT:');
  console.log('   - H5 link is valid for 10 minutes after creation');
  console.log('   - After 10 minutes, use the QR code list API to get link again');
  console.log('   - QR code itself remains valid according to its type and period');
  console.log('');
  console.log('Timestamp Helper:');
  console.log('   Current time: ' + Date.now());
  console.log('   1 hour later: ' + (Date.now() + (60 * 60 * 1000)));
  console.log('   1 day later: ' + (Date.now() + (24 * 60 * 60 * 1000)));
  console.log('   1 week later: ' + (Date.now() + (7 * 24 * 60 * 60 * 1000)));
  console.log('   1 month later: ' + (Date.now() + (30 * 24 * 60 * 60 * 1000)));
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Type:', getTypeText(parseInt(type)));
if (name) console.log('Name:', name);
if (startDate) console.log('Start Date:', new Date(parseInt(startDate)).toISOString());
if (endDate) console.log('End Date:', new Date(parseInt(endDate)).toISOString());
console.log('');

// Cyclic config example (uncomment and modify for type 4)
// const cyclicConfig = [
//   { weekDay: 1, startTime: 480, endTime: 1080 },  // Monday 8AM-6PM
//   { weekDay: 2, startTime: 480, endTime: 1080 },  // Tuesday 8AM-6PM
//   { weekDay: 3, startTime: 480, endTime: 1080 },  // Wednesday 8AM-6PM
//   { weekDay: 4, startTime: 480, endTime: 1080 },  // Thursday 8AM-6PM
//   { weekDay: 5, startTime: 480, endTime: 1080 }   // Friday 8AM-6PM
// ];

async function testAddQRCode() {
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

    // Step 2: Add QR code
    console.log('Step 2: Adding QR code...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      type: parseInt(type),
      date: Date.now()
    };

    // Add optional parameters
    if (name) params.name = name;
    if (startDate) params.startDate = parseInt(startDate);
    if (endDate) params.endDate = parseInt(endDate);
    // if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    console.log('📡 Calling TTLock Add QR Code API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/add`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/add`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Add QR code failed');
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
        console.error('   You do not have permission to add QR codes to this lock.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock does not support QR code function');
        console.error('   This lock model does not have QR code scanning capability.');
        console.error('   Only locks with cameras support QR codes.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can add QR codes.');
        console.error('   You need admin privileges for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! QR code added');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { qrCodeId, qrCodeNumber, link } = response.data;

    console.log('📱 QR CODE CREATED:');
    console.log('   QR Code ID:', qrCodeId);
    console.log('   QR Code Number:', qrCodeNumber);
    console.log('   Type:', getTypeText(parseInt(type)));
    if (name) console.log('   Name:', name);
    console.log('');
    console.log('🔗 H5 LINK (Valid for 10 minutes):');
    console.log('   ' + link);
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Open the H5 link on your phone (valid for 10 minutes)');
    console.log('   2. A QR code will be displayed on the phone screen');
    console.log('   3. Hold the phone with QR code near the lock camera');
    console.log('   4. The lock will scan and unlock');
    console.log('');
    console.log('⏰ IMPORTANT:');
    console.log('   - The H5 link expires in 10 minutes');
    console.log('   - After expiration, use QR code list API to get a new link');
    console.log('   - The QR code itself remains valid according to its type/period');
    console.log('');
    console.log('To view all QR codes for this lock:');
    console.log(`   node test-qr-code-list.js ${username} [password] ${lockId} 1 20`);
    console.log('');

    if (parseInt(type) === 1) {
      console.log('📅 PERIOD QR CODE:');
      if (startDate && endDate) {
        console.log('   Valid from:', new Date(parseInt(startDate)).toISOString());
        console.log('   Valid until:', new Date(parseInt(endDate)).toISOString());
        const durationMs = parseInt(endDate) - parseInt(startDate);
        const durationDays = Math.floor(durationMs / (24 * 60 * 60 * 1000));
        const durationHours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        console.log('   Duration:', durationDays, 'days', durationHours, 'hours');
      } else {
        console.log('   ⚠️  No start/end dates provided');
        console.log('   The QR code may have default validity period');
      }
    } else if (parseInt(type) === 2) {
      console.log('♾️  PERMANENT QR CODE:');
      console.log('   - No expiration date');
      console.log('   - Valid until manually deleted');
      console.log('   - Works 24/7 indefinitely');
    } else if (parseInt(type) === 4) {
      console.log('🔄 CYCLIC QR CODE:');
      console.log('   - Valid only during configured time periods');
      console.log('   - Check the cyclicConfig for specific hours');
    }

  } catch (error) {
    console.error('❌ FAILED! Add QR code error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock does not support QR code function');
        console.error('   This lock model does not have QR code capability.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can add QR codes.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

/**
 * Get QR code type text from type code
 */
function getTypeText(type) {
  const typeMap = {
    1: 'Period',
    2: 'Permanent',
    4: 'Cyclic'
  };
  return typeMap[type] || 'Unknown';
}

// Run the test
testAddQRCode();
