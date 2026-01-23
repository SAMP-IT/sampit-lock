import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📱 Testing TTLock Get QR Code List API');
console.log('=====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const pageNo = process.argv[5] || '1'; // Default to page 1
const pageSize = process.argv[6] || '20'; // Default to 20 items per page

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-list.js [username] [password] <lockId> [pageNo] [pageSize]');
  console.log('');
  console.log('Example:');
  console.log('   node test-qr-code-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 20');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId   - Lock ID (required)');
  console.log('   pageNo   - Page number, starts from 1 (optional, default: 1)');
  console.log('   pageSize - Items per page, max 100 (optional, default: 20)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What are QR Codes:');
  console.log('   - Digital unlock codes displayed as QR codes');
  console.log('   - Can be scanned by lock\'s camera to unlock');
  console.log('   - Contactless access method');
  console.log('   - Shareable via link or QR image');
  console.log('   - Time-based validity periods');
  console.log('');
  console.log('QR Code Types:');
  console.log('   1 - Period (valid for specific time period)');
  console.log('       Has start date and end date');
  console.log('       Works 24/7 within the period');
  console.log('       Example: Guest access for 3 days');
  console.log('');
  console.log('   2 - Permanent (always valid, no expiration)');
  console.log('       No time restrictions');
  console.log('       Works until manually deleted');
  console.log('       Example: Owner access');
  console.log('');
  console.log('   4 - Cyclic (valid during specific hours)');
  console.log('       Works only during configured time periods');
  console.log('       Different hours for each day of week');
  console.log('       Example: Office hours Monday-Friday 9AM-5PM');
  console.log('');
  console.log('QR Code Status Values:');
  console.log('   1 - Normal (active and valid)');
  console.log('   2 - Invalid or Expired');
  console.log('   3 - Pending (being created)');
  console.log('');
  console.log('How QR Codes Work:');
  console.log('   1. Create QR code via API (gets H5 link)');
  console.log('   2. Open link to display QR code on phone');
  console.log('   3. Hold phone with QR code near lock camera');
  console.log('   4. Lock scans QR code and unlocks');
  console.log('   5. Unlock event is recorded in lock history');
  console.log('');
  console.log('⚠️  Lock Requirements:');
  console.log('   - Lock must have camera/QR scanner');
  console.log('   - Only specific lock models support QR codes');
  console.log('   - If unsupported, API returns error -3009');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

async function testGetQRCodeList() {
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

    // Step 2: Get QR code list
    console.log('Step 2: Getting QR code list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get QR Code List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get QR code list failed');
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
        console.error('   You do not have permission to view QR codes for this lock.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock does not support QR code function');
        console.error('   This lock model does not have QR code scanning capability.');
        console.error('   Only locks with cameras support QR codes.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! QR code list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [], pages = 0, total = 0 } = response.data;

    console.log('📱 QR CODE LIST:');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo, 'of', pages);
    console.log('   Showing:', list.length, 'QR codes');
    console.log('   Total QR Codes:', total);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No QR codes found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - No QR codes have been created for this lock');
      console.log('   - Lock may not support QR code function');
      console.log('');
      console.log('To add QR codes:');
      console.log(`   node test-qr-code-add.js ${username} [password] ${lockId} [type] [name]`);
    } else {
      console.log('📱 QR Code Details:');
      console.log('');

      // Group QR codes by type and status
      const periodCodes = list.filter(qr => qr.type === 1);
      const permanentCodes = list.filter(qr => qr.type === 2);
      const cyclicCodes = list.filter(qr => qr.type === 4);
      const normalCodes = list.filter(qr => qr.status === 1);
      const expiredCodes = list.filter(qr => qr.status === 2);

      list.forEach((qrCode, index) => {
        const statusEmoji = qrCode.status === 1 ? '✅' : qrCode.status === 2 ? '❌' : '⏳';
        const typeEmoji = qrCode.type === 1 ? '📅' : qrCode.type === 2 ? '♾️' : '🔄';

        console.log(`QR Code ${index + 1}: ${statusEmoji} ${typeEmoji}`);
        console.log(`   QR Code ID: ${qrCode.qrCodeId}`);
        console.log(`   QR Code Number: ${qrCode.qrCodeNumber}`);
        console.log(`   Name: ${qrCode.name || 'N/A'}`);
        console.log(`   Type: ${getTypeText(qrCode.type)} (${qrCode.type})`);
        console.log(`   Status: ${getStatusText(qrCode.status)} (${qrCode.status})`);
        console.log(`   Created: ${new Date(qrCode.createDate).toISOString()}`);
        if (qrCode.creator) {
          console.log(`   Creator: ${qrCode.creator}`);
        }

        if (qrCode.type !== 2) { // Not permanent
          console.log(`   Valid Period:`);
          console.log(`      From: ${new Date(qrCode.startDate).toISOString()}`);
          console.log(`      To:   ${new Date(qrCode.endDate).toISOString()}`);
        }

        // Display cyclic configuration if present
        if (qrCode.cyclicConfig && qrCode.cyclicConfig.length > 0) {
          console.log(`   Cyclic Schedule:`);
          qrCode.cyclicConfig.forEach((config, idx) => {
            const startHours = Math.floor(config.startTime / 60);
            const startMins = config.startTime % 60;
            const endHours = Math.floor(config.endTime / 60);
            const endMins = config.endTime % 60;
            const dayName = getDayName(config.weekDay);

            console.log(`      ${idx + 1}. ${dayName}: ${startHours}:${String(startMins).padStart(2, '0')} - ${endHours}:${String(endMins).padStart(2, '0')}`);
          });
        }
        console.log('');
      });

      // Summary statistics
      console.log('📊 QR Code Statistics:');
      console.log(`   📅 Period: ${periodCodes.length}`);
      console.log(`   ♾️  Permanent: ${permanentCodes.length}`);
      console.log(`   🔄 Cyclic: ${cyclicCodes.length}`);
      console.log('');
      console.log(`   ✅ Normal: ${normalCodes.length}`);
      console.log(`   ❌ Expired/Invalid: ${expiredCodes.length}`);
      console.log('');

      // Pagination info
      if (pages > 1) {
        console.log('📄 Pagination:');
        console.log(`   Current Page: ${pageNo}`);
        console.log(`   Total Pages: ${pages}`);
        console.log(`   Has Next Page: ${parseInt(pageNo) < pages ? 'Yes' : 'No'}`);
        console.log(`   Has Previous Page: ${parseInt(pageNo) > 1 ? 'Yes' : 'No'}`);
        console.log('');

        if (parseInt(pageNo) < pages) {
          console.log('To view next page:');
          console.log(`   node test-qr-code-list.js ${username} [password] ${lockId} ${parseInt(pageNo) + 1} ${pageSize}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get QR code list error');
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

/**
 * Get status text from status code
 */
function getStatusText(status) {
  const statusMap = {
    1: 'Normal',
    2: 'Invalid or Expired',
    3: 'Pending'
  };
  return statusMap[status] || 'Unknown';
}

/**
 * Get day name from week day number
 */
function getDayName(weekDay) {
  const dayMap = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday'
  };
  return dayMap[weekDay] || 'Unknown';
}

// Run the test
testGetQRCodeList();
