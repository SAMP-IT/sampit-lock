import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('👆 Testing TTLock Get Fingerprint List API');
console.log('==========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const pageNo = process.argv[5] || '1'; // Default to page 1
const pageSize = process.argv[6] || '20'; // Default to 20 items per page

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-fingerprint-list.js [username] [password] <lockId> [pageNo] [pageSize]');
  console.log('');
  console.log('Example:');
  console.log('   node test-fingerprint-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 20');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId   - Lock ID (required)');
  console.log('   pageNo   - Page number, starts from 1 (optional, default: 1)');
  console.log('   pageSize - Items per page, max 100 (optional, default: 20)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API returns all fingerprints associated with a lock');
  console.log('   2. Results are paginated for better performance');
  console.log('   3. Shows fingerprint type, status, validity period, and cyclic config');
  console.log('   4. Maximum page size is 100 items');
  console.log('');
  console.log('Fingerprint Types:');
  console.log('   1 - Normal (standard fingerprint access)');
  console.log('   4 - Cyclic (access valid during specific time periods)');
  console.log('');
  console.log('Fingerprint Status Values:');
  console.log('   1 - Normal (fingerprint is active and valid)');
  console.log('   2 - Invalid or Expired (fingerprint cannot be used)');
  console.log('   3 - Pending (operation in queue)');
  console.log('   4 - Adding (fingerprint being added to lock)');
  console.log('   5 - Add Failed (failed to add fingerprint)');
  console.log('   6 - Modifying (fingerprint being updated)');
  console.log('   7 - Modify Failed (failed to update fingerprint)');
  console.log('   8 - Deleting (fingerprint being removed)');
  console.log('   9 - Delete Failed (failed to remove fingerprint)');
  console.log('');
  console.log('What are Fingerprints:');
  console.log('   - Biometric authentication for unlocking doors');
  console.log('   - Can be programmed with validity periods');
  console.log('   - Managed through TTLock system');
  console.log('   - Supports normal and cyclic (time-restricted) access');
  console.log('');
  console.log('Cyclic Configuration:');
  console.log('   - Defines specific time periods when fingerprint is valid');
  console.log('   - Can set different times for each day of the week');
  console.log('   - Times specified in minutes (e.g., 480 = 8:00 AM, 1080 = 6:00 PM)');
  console.log('   - Week day: 1=Monday through 7=Sunday');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

async function testGetFingerprintList() {
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

    // Step 2: Get fingerprint list
    console.log('Step 2: Getting fingerprint list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Fingerprint List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/fingerprint/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get fingerprint list failed');
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
        console.error('   You do not have permission to view fingerprints for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Fingerprint list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [], pages = 0, total = 0 } = response.data;

    console.log('👆 FINGERPRINT LIST:');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo, 'of', pages);
    console.log('   Showing:', list.length, 'fingerprints');
    console.log('   Total Fingerprints:', total);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No fingerprints found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - No fingerprints have been added to this lock');
      console.log('   - The lock has not been configured with fingerprint access');
      console.log('');
      console.log('To add fingerprints:');
      console.log('   1. Use the Sciener APP');
      console.log('   2. Navigate to lock settings');
      console.log('   3. Add new fingerprint via biometric scanner');
      console.log('   4. Configure validity period and type');
      console.log('   5. Assign fingerprint to users as needed');
    } else {
      console.log('👆 Fingerprint Details:');
      console.log('');

      // Group fingerprints by type and status
      const normalFingerprints = list.filter(f => f.fingerprintType === 1);
      const cyclicFingerprints = list.filter(f => f.fingerprintType === 4);
      const validFingerprints = list.filter(f => f.status === 1);
      const expiredFingerprints = list.filter(f => f.status === 2);
      const pendingFingerprints = list.filter(f => [3, 4, 6, 8].includes(f.status));
      const failedFingerprints = list.filter(f => [5, 7, 9].includes(f.status));

      list.forEach((fp, index) => {
        const statusEmoji = getStatusEmoji(fp.status);
        const typeEmoji = fp.fingerprintType === 1 ? '👆' : '🔄';
        const now = Date.now();
        const isValidPeriod = fp.startDate <= now && fp.endDate >= now;

        console.log(`Fingerprint ${index + 1}: ${statusEmoji} ${typeEmoji}`);
        console.log(`   Fingerprint ID: ${fp.fingerprintId}`);
        console.log(`   Fingerprint Number: ${fp.fingerprintNumber}`);
        console.log(`   Name: ${fp.fingerprintName || 'N/A'}`);
        console.log(`   Type: ${getTypeText(fp.fingerprintType)} (${fp.fingerprintType})`);
        console.log(`   Status: ${getStatusText(fp.status)} (${fp.status})`);
        console.log(`   Valid Period:`);
        console.log(`      From: ${new Date(fp.startDate).toISOString()}`);
        console.log(`      To:   ${new Date(fp.endDate).toISOString()}`);
        console.log(`   Currently Valid: ${isValidPeriod ? 'Yes ✅' : 'No ❌'}`);
        console.log(`   Created: ${new Date(fp.createDate).toISOString()}`);
        if (fp.senderUsername) {
          console.log(`   Sender: ${fp.senderUsername}`);
        }

        // Display cyclic configuration if present
        if (fp.cyclicConfig && fp.cyclicConfig.length > 0) {
          console.log(`   Cyclic Schedule:`);
          fp.cyclicConfig.forEach((config, idx) => {
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
      console.log('📊 Fingerprint Statistics:');
      console.log(`   👆 Normal: ${normalFingerprints.length}`);
      console.log(`   🔄 Cyclic: ${cyclicFingerprints.length}`);
      console.log('');
      console.log(`   ✅ Valid: ${validFingerprints.length}`);
      console.log(`   ❌ Expired/Invalid: ${expiredFingerprints.length}`);
      console.log(`   ⏳ Pending Operations: ${pendingFingerprints.length}`);
      console.log(`   ⚠️  Failed Operations: ${failedFingerprints.length}`);
      console.log('');

      if (failedFingerprints.length > 0) {
        console.log('⚠️  Fingerprints with Failed Operations:');
        failedFingerprints.forEach(fp => {
          console.log(`   - ${fp.fingerprintName || fp.fingerprintNumber}: ${getStatusText(fp.status)}`);
        });
        console.log('');
        console.log('Action required:');
        console.log('   - Retry failed operations via Sciener APP');
        console.log('   - Check fingerprint scanner functionality');
        console.log('   - Verify lock connectivity');
      }

      if (expiredFingerprints.length > 0) {
        console.log('⚠️  Expired/Invalid Fingerprints:');
        expiredFingerprints.forEach(fp => {
          console.log(`   - ${fp.fingerprintName || fp.fingerprintNumber}`);
        });
        console.log('');
        console.log('To renew fingerprints:');
        console.log('   - Update validity period via Sciener APP');
        console.log('   - Or delete and re-add the fingerprint');
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
          console.log(`   node test-fingerprint-list.js ${username} [password] ${lockId} ${parseInt(pageNo) + 1} ${pageSize}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get fingerprint list error');
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
 * Get fingerprint type text from type code
 */
function getTypeText(type) {
  const typeMap = {
    1: 'Normal',
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
    3: 'Pending',
    4: 'Adding',
    5: 'Add Failed',
    6: 'Modifying',
    7: 'Modify Failed',
    8: 'Deleting',
    9: 'Delete Failed'
  };
  return statusMap[status] || 'Unknown';
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status) {
  const emojiMap = {
    1: '✅',
    2: '❌',
    3: '⏳',
    4: '➕',
    5: '⚠️',
    6: '✏️',
    7: '⚠️',
    8: '🗑️',
    9: '⚠️'
  };
  return emojiMap[status] || '❓';
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
testGetFingerprintList();
