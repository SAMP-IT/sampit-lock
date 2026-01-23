import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('✏️  Testing TTLock Update QR Code API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const qrCodeId = process.argv[4]; // QR Code ID is required
const newName = process.argv[5]; // New name (optional but for demo purposes)

if (!qrCodeId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-update.js [username] [password] <qrCodeId> [newName]');
  console.log('');
  console.log('Example - Update name only:');
  console.log('   node test-qr-code-update.js tusharvaishnavtv@gmail.com Tushar@900 123456 "Updated Guest Access"');
  console.log('');
  console.log('Example - Update validity period (modify code):');
  console.log('   See code comments for updating startDate and endDate');
  console.log('');
  console.log('Example - Update cyclic schedule (modify code):');
  console.log('   See code comments for updating cyclicConfig');
  console.log('');
  console.log('Parameters:');
  console.log('   qrCodeId - QR code ID (required)');
  console.log('   newName  - New QR code name (optional)');
  console.log('');
  console.log('To get a qrCodeId, first run:');
  console.log('   node test-qr-code-list.js');
  console.log('');
  console.log('What can be updated:');
  console.log('   ✅ name - Change the QR code display name');
  console.log('   ✅ startDate - Change when QR code becomes valid');
  console.log('   ✅ endDate - Change when QR code expires');
  console.log('   ✅ cyclicConfig - Change time-based access schedule');
  console.log('   ❌ type - CANNOT change type (period/permanent/cyclic)');
  console.log('');
  console.log('⚠️  IMPORTANT - QR Code Type Cannot Change:');
  console.log('   - If QR code is Period (type=1), it stays Period');
  console.log('   - If QR code is Permanent (type=2), it stays Permanent');
  console.log('   - If QR code is Cyclic (type=4), it stays Cyclic');
  console.log('   - To change type, must delete and create new QR code');
  console.log('');
  console.log('Update Examples:');
  console.log('');
  console.log('1. Update Name Only:');
  console.log('   node test-qr-code-update.js [user] [pass] 123456 "VIP Guest"');
  console.log('');
  console.log('2. Extend Validity Period (modify code):');
  console.log('   const now = Date.now();');
  console.log('   const oneMonthLater = now + (30 * 24 * 60 * 60 * 1000);');
  console.log('   // Add to params: startDate: now, endDate: oneMonthLater');
  console.log('');
  console.log('3. Update Cyclic Schedule (modify code):');
  console.log('   const cyclicConfig = [');
  console.log('     { weekDay: 1, startTime: 540, endTime: 1020 },  // Mon 9AM-5PM');
  console.log('     { weekDay: 2, startTime: 540, endTime: 1020 }   // Tue 9AM-5PM');
  console.log('   ];');
  console.log('   // Add to params: cyclicConfig: cyclicConfig');
  console.log('');
  console.log('Timestamp Helper:');
  console.log('   Current time: ' + Date.now());
  console.log('   1 day later: ' + (Date.now() + (24 * 60 * 60 * 1000)));
  console.log('   1 week later: ' + (Date.now() + (7 * 24 * 60 * 60 * 1000)));
  console.log('   1 month later: ' + (Date.now() + (30 * 24 * 60 * 60 * 1000)));
  console.log('');
  console.log('Cyclic Time Helper:');
  console.log('   Times are in minutes from midnight');
  console.log('   8:00 AM = 480 minutes (8 * 60)');
  console.log('   12:00 PM = 720 minutes (12 * 60)');
  console.log('   5:00 PM = 1020 minutes (17 * 60)');
  console.log('   6:00 PM = 1080 minutes (18 * 60)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('QR Code ID:', qrCodeId);
if (newName) console.log('New Name:', newName);
console.log('');

// Uncomment and modify these to update validity period
// const startDate = Date.now();
// const endDate = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days later

// Uncomment and modify this to update cyclic schedule
// const cyclicConfig = [
//   { weekDay: 1, startTime: 480, endTime: 1080 },  // Monday 8AM-6PM
//   { weekDay: 2, startTime: 480, endTime: 1080 },  // Tuesday 8AM-6PM
//   { weekDay: 3, startTime: 480, endTime: 1080 },  // Wednesday 8AM-6PM
//   { weekDay: 4, startTime: 480, endTime: 1080 },  // Thursday 8AM-6PM
//   { weekDay: 5, startTime: 480, endTime: 1080 }   // Friday 8AM-6PM
// ];

async function testUpdateQRCode() {
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

    // Step 2: Update QR code
    console.log('Step 2: Updating QR code...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      qrCodeId: parseInt(qrCodeId),
      date: Date.now()
    };

    // Add optional update fields
    if (newName) params.name = newName;
    // if (startDate) params.startDate = startDate;
    // if (endDate) params.endDate = endDate;
    // if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    console.log('📡 Calling TTLock Update QR Code API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/update`);
    console.log('');
    console.log('Update fields:');
    if (params.name) console.log('   name:', params.name);
    if (params.startDate) console.log('   startDate:', new Date(params.startDate).toISOString());
    if (params.endDate) console.log('   endDate:', new Date(params.endDate).toISOString());
    if (params.cyclicConfig) console.log('   cyclicConfig: [provided]');
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/update`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Update QR code failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that QR code ID and update values are valid.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to update this QR code.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can update QR codes.');
      }
      console.error('');
      console.error('To find valid QR code IDs, run:');
      console.error('   node test-qr-code-list.js');
      return;
    }

    console.log('✅ SUCCESS! QR code updated');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('✏️  UPDATE SUMMARY:');
    console.log('   QR Code ID:', qrCodeId);
    console.log('   Updated At:', new Date().toISOString());
    console.log('');

    console.log('📋 FIELDS UPDATED:');
    if (params.name) console.log('   ✅ Name:', params.name);
    if (params.startDate) console.log('   ✅ Start Date:', new Date(params.startDate).toISOString());
    if (params.endDate) console.log('   ✅ End Date:', new Date(params.endDate).toISOString());
    if (params.cyclicConfig) console.log('   ✅ Cyclic Config: Updated');
    console.log('');

    console.log('⚠️  REMEMBER:');
    console.log('   - QR code type cannot be changed');
    console.log('   - To change type, delete and create new QR code');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - View the updated QR code data:');
    console.log(`     node test-qr-code-get-data.js ${username} [password] ${qrCodeId}`);
    console.log('');
    console.log('   - Verify in the QR code list:');
    console.log('     node test-qr-code-list.js [username] [password] <lockId> 1 20');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Update QR code error');
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
        console.error('   Check that all update values are valid.');
      } else if (error.response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code may have been deleted.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can update QR codes.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testUpdateQRCode();
