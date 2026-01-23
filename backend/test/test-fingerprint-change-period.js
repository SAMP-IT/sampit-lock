import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📅 Testing TTLock Change Fingerprint Validity Period API');
console.log('========================================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const fingerprintId = process.argv[5]; // Fingerprint ID is required
const durationDays = process.argv[6] || '365'; // Default to 1 year
const changeType = process.argv[7] || '2'; // Default to gateway (direct change)

if (!lockId || !fingerprintId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-fingerprint-change-period.js [username] [password] <lockId> <fingerprintId> [durationDays] [changeType]');
  console.log('');
  console.log('Example:');
  console.log('   node test-fingerprint-change-period.js tusharvaishnavtv@gmail.com Tushar@900 7296935 12345 365 2');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId        - Lock ID (required)');
  console.log('   fingerprintId - Fingerprint ID (required)');
  console.log('   durationDays  - Validity period in days (optional, default: 365)');
  console.log('   changeType    - Change method (optional, default: 2)');
  console.log('');
  console.log('To get lockId and fingerprintId, first run:');
  console.log('   node test-fingerprint-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API changes the validity period of a fingerprint');
  console.log('   2. Can extend or shorten the fingerprint\'s valid period');
  console.log('   3. Must be called AFTER SDK method for bluetooth (changeType=1)');
  console.log('   4. Can be called DIRECTLY for gateway (changeType=2)');
  console.log('   5. You must be the lock admin to change fingerprint periods');
  console.log('');
  console.log('Change Type Values:');
  console.log('   1 - Phone Bluetooth (must call SDK method first)');
  console.log('   2 - Gateway (can change directly via API) ← Recommended for testing');
  console.log('   3 - NB-IoT');
  console.log('');
  console.log('Common duration examples:');
  console.log('   7    - One week');
  console.log('   30   - One month');
  console.log('   90   - Three months');
  console.log('   180  - Six months');
  console.log('   365  - One year (default)');
  console.log('   730  - Two years');
  console.log('   1825 - Five years');
  console.log('');
  console.log('When to change validity period:');
  console.log('   - Extend access for continuing users');
  console.log('   - Shorten period for temporary access');
  console.log('   - Renew expired fingerprints');
  console.log('   - Adjust access duration based on usage');
  console.log('   - Set trial periods for new users');
  console.log('');
  console.log('Workflow for changing period:');
  console.log('   [Bluetooth Method - changeType=1]');
  console.log('   1. Use TTLock mobile SDK to update fingerprint');
  console.log('   2. Call this API to update cloud records');
  console.log('   3. Period change is complete');
  console.log('');
  console.log('   [Gateway Method - changeType=2]');
  console.log('   1. Call this API directly');
  console.log('   2. Gateway updates fingerprint on lock');
  console.log('   3. Cloud records are updated');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Fingerprint ID:', fingerprintId);
console.log('Duration:', durationDays, 'days');
console.log('Change Type:', changeType, '(' + getChangeTypeText(parseInt(changeType)) + ')');
console.log('');

// Helper function
function getChangeTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth - SDK required first',
    2: 'Gateway - Direct change',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}

async function testChangeFingerprintPeriod() {
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

    // Step 2: Calculate new validity period
    console.log('Step 2: Calculating new validity period...');
    console.log('');

    const now = Date.now();
    const durationMs = parseInt(durationDays) * 24 * 60 * 60 * 1000;
    const newEndDate = now + durationMs;

    console.log('Validity Period Details:');
    console.log('   Start Date: NOW (', new Date(now).toISOString(), ')');
    console.log('   Duration:', durationDays, 'days');
    console.log('   End Date:', new Date(newEndDate).toISOString());
    console.log('');

    // Step 3: Change fingerprint validity period
    console.log('Step 3: Changing fingerprint validity period...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      fingerprintId: parseInt(fingerprintId),
      startDate: now,
      endDate: newEndDate,
      changeType: parseInt(changeType),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Change Fingerprint Period API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/fingerprint/changePeriod`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/changePeriod`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Change fingerprint period failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -1023) {
        console.error('ℹ️  Error -1023: Fingerprint does not exist');
        console.error('   The fingerprint ID does not exist for this lock.');
        console.error('');
        console.error('To find valid fingerprint IDs, run:');
        console.error(`   node test-fingerprint-list.js ${username} [password] ${lockId}`);
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to change fingerprint periods for this lock.');
      } else if (response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Fingerprint not found');
        console.error('   The fingerprint ID does not exist for this lock.');
        console.error('');
        console.error('To find valid fingerprint IDs, run:');
        console.error(`   node test-fingerprint-list.js ${username} [password] ${lockId}`);
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can change fingerprint validity periods.');
      }
      console.error('');
      console.error('To find valid lock IDs and fingerprint IDs, run:');
      console.error('   node test-fingerprint-list.js');
      return;
    }

    console.log('✅ SUCCESS! Fingerprint validity period changed');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('📅 VALIDITY PERIOD UPDATED!');
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint ID:', fingerprintId);
    console.log('   Changed at:', new Date().toISOString());
    console.log('   Change Method:', getChangeTypeText(parseInt(changeType)));
    console.log('');
    console.log('New Validity Period:');
    console.log('   Valid From: ', new Date(now).toISOString());
    console.log('   Valid Until:', new Date(newEndDate).toISOString());
    console.log('   Duration:   ', durationDays, 'days');
    console.log('');
    console.log('✅ What this means:');
    console.log('   - Fingerprint validity period has been updated');
    console.log('   - Fingerprint is now valid starting from now');
    console.log(`   - Fingerprint will expire in ${durationDays} days`);
    console.log('   - Changes synced to TTLock cloud');
    console.log('');

    if (parseInt(changeType) === 1) {
      console.log('📱 Bluetooth Method Notes:');
      console.log('   - Period was changed via SDK first');
      console.log('   - Cloud update is now complete');
      console.log('   - Fingerprint should work with new period');
    } else if (parseInt(changeType) === 2) {
      console.log('🌐 Gateway Method Notes:');
      console.log('   - Period changed directly via gateway');
      console.log('   - Gateway will update the lock');
      console.log('   - May take a moment to sync');
      console.log('   - Changes are effective immediately');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify new period in fingerprint list:');
    console.log(`      node test-fingerprint-list.js ${username} [password] ${lockId}`);
    console.log('   2. Test fingerprint on physical lock');
    console.log('   3. Inform user of new validity period');
    console.log('   4. Monitor fingerprint expiration date');
    console.log('');
    console.log('Before fingerprint expires:');
    console.log('   - Renew validity period if continued access needed');
    console.log('   - Or notify user of upcoming expiration');
    console.log(`   - Fingerprint will expire on: ${new Date(newEndDate).toLocaleDateString()}`);
    console.log('');
    console.log('To extend period again:');
    console.log(`   node test-fingerprint-change-period.js ${username} [password] ${lockId} ${fingerprintId} [newDurationDays]`);

  } catch (error) {
    console.error('❌ FAILED! Change fingerprint period error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -1023) {
        console.error('ℹ️  Error -1023: Fingerprint does not exist');
        console.error('   The fingerprint ID does not exist for this lock.');
      } else if (error.response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Fingerprint not found');
        console.error('   The fingerprint ID does not exist for this lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testChangeFingerprintPeriod();
