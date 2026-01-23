import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📊 Testing TTLock Get QR Code Data API');
console.log('======================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const qrCodeId = process.argv[4]; // QR Code ID is required

if (!qrCodeId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-qr-code-get-data.js [username] [password] <qrCodeId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-qr-code-get-data.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('Parameters:');
  console.log('   qrCodeId - QR code ID (required)');
  console.log('');
  console.log('To get a qrCodeId, first run:');
  console.log('   node test-qr-code-list.js');
  console.log('');
  console.log('What is QR Code Data API:');
  console.log('   - Returns detailed information about a specific QR code');
  console.log('   - Includes qrCodeContent for generating QR code images');
  console.log('   - qrCodeContent is only available if QR code is in valid period');
  console.log('   - Can be used to create custom QR code images');
  console.log('');
  console.log('QR Code Content:');
  console.log('   - String data that can be encoded into a QR code image');
  console.log('   - Use JavaScript libraries like qrcode.js or qrcodejs2');
  console.log('   - Display the generated QR code on phone screen');
  console.log('   - Hold phone near lock camera to unlock');
  console.log('');
  console.log('Generating QR Code Image (JavaScript):');
  console.log('   // Using qrcode.js library');
  console.log('   import QRCode from \'qrcode\';');
  console.log('   ');
  console.log('   const qrCodeContent = response.data.qrCodeContent;');
  console.log('   QRCode.toDataURL(qrCodeContent, function (err, url) {');
  console.log('     // url contains base64 image data');
  console.log('     // Display this image in an <img> tag');
  console.log('     document.getElementById(\'qrcode\').src = url;');
  console.log('   });');
  console.log('');
  console.log('When qrCodeContent is NOT available:');
  console.log('   - QR code is not in valid period (expired or pending)');
  console.log('   - QR code status is not "Normal" (status !== 1)');
  console.log('   - Need to use H5 link from add/list API instead');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Create custom QR code UI in your app');
  console.log('   2. Generate QR codes offline after fetching data');
  console.log('   3. Display QR codes in different sizes/styles');
  console.log('   4. Embed QR codes in printed materials');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('QR Code ID:', qrCodeId);
console.log('');

async function testGetQRCodeData() {
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

    // Step 2: Get QR code data
    console.log('Step 2: Getting QR code data...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      qrCodeId: parseInt(qrCodeId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get QR Code Data API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/qrCode/getData`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/qrCode/getData`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get QR code data failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   The QR code ID format is invalid or does not exist.');
      } else if (response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code ID does not exist.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to view this QR code.');
      }
      console.error('');
      console.error('To find valid QR code IDs, run:');
      console.error('   node test-qr-code-list.js');
      return;
    }

    console.log('✅ SUCCESS! QR code data retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { lockAlias, type, qrCodeNumber, qrCodeContent, name, startDate, endDate, cyclicConfig, status } = response.data;

    console.log('📱 QR CODE DATA:');
    console.log('   QR Code ID:', qrCodeId);
    console.log('   QR Code Number:', qrCodeNumber);
    console.log('   Lock Alias:', lockAlias || 'N/A');
    console.log('   Name:', name || 'N/A');
    console.log('   Type:', getTypeText(type), `(${type})`);
    console.log('   Status:', getStatusText(status), `(${status})`);
    console.log('');

    if (qrCodeContent) {
      console.log('🔐 QR CODE CONTENT (Available):');
      console.log('   Length:', qrCodeContent.length, 'characters');
      console.log('   Content:', qrCodeContent);
      console.log('');
      console.log('✅ You can use this content to generate a QR code image!');
      console.log('');
      console.log('JavaScript Example:');
      console.log('   import QRCode from \'qrcode\';');
      console.log('   ');
      console.log(`   const content = "${qrCodeContent}";`);
      console.log('   QRCode.toDataURL(content, (err, url) => {');
      console.log('     console.log(url); // base64 image data');
      console.log('   });');
      console.log('');
    } else {
      console.log('❌ QR CODE CONTENT (Not Available)');
      console.log('   Reason: QR code is not in valid period');
      console.log('');
      console.log('Possible causes:');
      console.log('   - QR code has expired (check endDate)');
      console.log('   - QR code is pending (status = 3)');
      console.log('   - QR code is invalid (status = 2)');
      console.log('   - Current time is outside cyclic periods');
      console.log('');
      console.log('To use this QR code:');
      console.log('   - Use the H5 link from add/list API instead');
      console.log('   - Check and fix the validity period');
      console.log('   - Ensure QR code status is Normal (1)');
      console.log('');
    }

    if (type !== 2) { // Not permanent
      console.log('📅 VALIDITY PERIOD:');
      console.log('   From:', new Date(startDate).toISOString());
      console.log('   To:  ', new Date(endDate).toISOString());
      const now = Date.now();
      const isActive = now >= startDate && now <= endDate;
      console.log('   Currently Active:', isActive ? 'Yes ✅' : 'No ❌');
      if (!isActive) {
        if (now < startDate) {
          const hoursUntilStart = Math.floor((startDate - now) / (60 * 60 * 1000));
          console.log(`   Starts in: ${hoursUntilStart} hours`);
        } else {
          const hoursExpired = Math.floor((now - endDate) / (60 * 60 * 1000));
          console.log(`   Expired: ${hoursExpired} hours ago`);
        }
      }
      console.log('');
    } else {
      console.log('♾️  PERMANENT QR CODE:');
      console.log('   No expiration date');
      console.log('   Valid indefinitely');
      console.log('');
    }

    if (cyclicConfig && cyclicConfig.length > 0) {
      console.log('🔄 CYCLIC SCHEDULE:');
      cyclicConfig.forEach((config, idx) => {
        const startHours = Math.floor(config.startTime / 60);
        const startMins = config.startTime % 60;
        const endHours = Math.floor(config.endTime / 60);
        const endMins = config.endTime % 60;
        const dayName = getDayName(config.weekDay);

        console.log(`   ${idx + 1}. ${dayName}: ${startHours}:${String(startMins).padStart(2, '0')} - ${endHours}:${String(endMins).padStart(2, '0')}`);
      });
      console.log('');

      // Check if current time matches cyclic schedule
      const now = new Date();
      const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const todaySchedule = cyclicConfig.find(c => c.weekDay === currentDay);
      if (todaySchedule) {
        const isInSchedule = currentMinutes >= todaySchedule.startTime && currentMinutes <= todaySchedule.endTime;
        console.log('   Current Time Status:', isInSchedule ? 'Within Schedule ✅' : 'Outside Schedule ❌');
      } else {
        console.log('   Current Time Status: No schedule for today ❌');
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ FAILED! Get QR code data error');
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
        console.error('   The QR code ID format is invalid or does not exist.');
      } else if (error.response.data.errcode === -1009) {
        console.error('ℹ️  Error -1009: QR code not found');
        console.error('   The QR code ID does not exist.');
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
testGetQRCodeData();
