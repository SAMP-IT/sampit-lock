import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📋 Testing TTLock Get Unlock Records API');
console.log('========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const pageNo = process.argv[5] || '1'; // Default to page 1
const pageSize = process.argv[6] || '20'; // Default to 20 items per page
const startDate = process.argv[7]; // Optional start date (timestamp)
const endDate = process.argv[8]; // Optional end date (timestamp)

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-unlock-record-list.js [username] [password] <lockId> [pageNo] [pageSize] [startDate] [endDate]');
  console.log('');
  console.log('Example (All records):');
  console.log('   node test-unlock-record-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 20');
  console.log('');
  console.log('Example (With date filter):');
  console.log('   node test-unlock-record-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 20 1609459200000 1640995199000');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId    - Lock ID (required)');
  console.log('   pageNo    - Page number, starts from 1 (optional, default: 1)');
  console.log('   pageSize  - Items per page, max 100 (optional, default: 20)');
  console.log('   startDate - Start time in milliseconds (optional, 0 for no constraint)');
  console.log('   endDate   - End time in milliseconds (optional, 0 for no constraint)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What are Unlock Records:');
  console.log('   - Historical log of all unlock/lock events');
  console.log('   - Shows who unlocked the lock and when');
  console.log('   - Shows unlock method (app, passcode, IC card, fingerprint, etc.)');
  console.log('   - Includes failed unlock attempts');
  console.log('   - Security alerts (tamper, invalid passcode attempts)');
  console.log('');
  console.log('Record Types:');
  console.log('   Unlock Methods:');
  console.log('   - 1: App unlock (mobile app)');
  console.log('   - 3, 12: Gateway unlock (remote)');
  console.log('   - 4: Passcode unlock');
  console.log('   - 7: IC card unlock');
  console.log('   - 8: Fingerprint unlock');
  console.log('   - 10: Mechanical key unlock');
  console.log('');
  console.log('   Lock Events:');
  console.log('   - 33: Lock by fingerprint');
  console.log('   - 34: Lock by passcode');
  console.log('   - 35: Lock by IC card');
  console.log('   - 36: Lock by mechanical key');
  console.log('   - 45: Auto lock');
  console.log('');
  console.log('   Door Events:');
  console.log('   - 30: Door magnet close');
  console.log('   - 31: Door magnet open');
  console.log('   - 32: Open from inside');
  console.log('');
  console.log('   Security Alerts:');
  console.log('   - 29: Unexpected unlock');
  console.log('   - 44: Tamper alert');
  console.log('   - 48: Invalid passcode used several times');
  console.log('');
  console.log('Date Filter Examples:');
  console.log('   Last 24 hours: startDate = now - 86400000');
  console.log('   Last 7 days:   startDate = now - 604800000');
  console.log('   Last 30 days:  startDate = now - 2592000000');
  console.log('   Custom range:  specify both startDate and endDate');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
if (startDate) {
  console.log('Start Date:', new Date(parseInt(startDate)).toISOString());
}
if (endDate) {
  console.log('End Date:', new Date(parseInt(endDate)).toISOString());
}
console.log('');

async function testGetUnlockRecords() {
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

    // Step 2: Get unlock records
    console.log('Step 2: Getting unlock records...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    // Add optional date filters
    if (startDate) params.startDate = parseInt(startDate);
    if (endDate) params.endDate = parseInt(endDate);

    console.log('📡 Calling TTLock Get Unlock Records API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lockRecord/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lockRecord/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get unlock records failed');
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
        console.error('   You do not have permission to view unlock records for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Unlock records retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [], pages = 0, total = 0 } = response.data;

    console.log('📋 UNLOCK RECORDS:');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo, 'of', pages);
    console.log('   Showing:', list.length, 'records');
    console.log('   Total Records:', total);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No unlock records found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - Lock has not been unlocked yet');
      console.log('   - No unlock history available');
      if (startDate || endDate) {
        console.log('   - No records in the specified date range');
        console.log('   - Try expanding the date range');
      }
    } else {
      console.log('📋 Unlock Record Details:');
      console.log('');

      // Group records by type and result
      const successfulUnlocks = list.filter(r => r.success === 1);
      const failedUnlocks = list.filter(r => r.success === 0);
      const securityAlerts = list.filter(r => r.recordType === 29 || r.recordType === 44 || r.recordType === 48);

      list.forEach((record, index) => {
        const statusEmoji = record.success === 1 ? '✅' : '❌';
        const typeEmoji = getRecordTypeEmoji(record.recordType);

        console.log(`Record ${index + 1}: ${statusEmoji} ${typeEmoji}`);
        console.log(`   Type: ${getRecordTypeText(record.recordType)} (${record.recordType})`);
        console.log(`   Result: ${record.success === 1 ? 'Success' : 'Failed'}`);
        if (record.username) {
          console.log(`   User: ${record.username}`);
        }
        if (record.keyboardPwd) {
          console.log(`   Credential: ${record.keyboardPwd}`);
        }
        console.log(`   Lock Time: ${new Date(record.lockDate).toISOString()}`);
        console.log(`   Server Time: ${new Date(record.serverDate).toISOString()}`);
        console.log('');
      });

      // Summary statistics
      console.log('📊 Record Statistics:');
      console.log(`   ✅ Successful: ${successfulUnlocks.length}`);
      console.log(`   ❌ Failed: ${failedUnlocks.length}`);
      console.log(`   ⚠️  Security Alerts: ${securityAlerts.length}`);
      console.log('');

      // Method breakdown
      const methodCounts = {};
      list.forEach(record => {
        const method = getRecordTypeText(record.recordType);
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      });

      console.log('🔑 Unlock Methods Used:');
      Object.entries(methodCounts).forEach(([method, count]) => {
        console.log(`   - ${method}: ${count}`);
      });
      console.log('');

      if (securityAlerts.length > 0) {
        console.log('⚠️  Security Alerts:');
        securityAlerts.forEach(record => {
          console.log(`   - ${getRecordTypeText(record.recordType)} at ${new Date(record.lockDate).toISOString()}`);
        });
        console.log('');
        console.log('Action required:');
        console.log('   - Review security alerts');
        console.log('   - Check for unauthorized access attempts');
        console.log('   - Update passcodes if needed');
        console.log('   - Check lock physical security');
      }

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
          console.log(`   node test-unlock-record-list.js ${username} [password] ${lockId} ${parseInt(pageNo) + 1} ${pageSize}${startDate ? ' ' + startDate : ''}${endDate ? ' ' + endDate : ''}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get unlock records error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

/**
 * Get record type text from type code
 */
function getRecordTypeText(type) {
  const typeMap = {
    1: 'App unlock',
    2: 'Touch parking lock',
    3: 'Gateway unlock',
    4: 'Passcode unlock',
    5: 'Parking lock raise',
    6: 'Parking lock lower',
    7: 'IC card unlock',
    8: 'Fingerprint unlock',
    9: 'Wristband unlock',
    10: 'Mechanical key unlock',
    11: 'Bluetooth lock',
    12: 'Gateway unlock',
    29: 'Unexpected unlock',
    30: 'Door magnet close',
    31: 'Door magnet open',
    32: 'Open from inside',
    33: 'Lock by fingerprint',
    34: 'Lock by passcode',
    35: 'Lock by IC card',
    36: 'Lock by mechanical key',
    37: 'Remote control',
    44: 'Tamper alert',
    45: 'Auto lock',
    46: 'Unlock by unlock key',
    47: 'Lock by lock key',
    48: 'Use INVALID passcode several times'
  };
  return typeMap[type] || 'Unknown';
}

/**
 * Get emoji for record type
 */
function getRecordTypeEmoji(type) {
  const emojiMap = {
    1: '📱',  // App
    3: '🌐',  // Gateway
    4: '🔢',  // Passcode
    7: '💳',  // IC Card
    8: '👆',  // Fingerprint
    10: '🔑', // Key
    12: '🌐', // Gateway
    29: '⚠️',  // Unexpected
    44: '🚨', // Tamper
    48: '⚠️'   // Invalid passcode
  };
  return emojiMap[type] || '🔓';
}

// Run the test
testGetUnlockRecords();
