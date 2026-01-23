import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('➕ Testing TTLock Add Fingerprint API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const fingerprintNumber = process.argv[5]; // Fingerprint number is required
const fingerprintType = process.argv[6] || '1'; // Default to normal type
const fingerprintName = process.argv[7]; // Optional

if (!lockId || !fingerprintNumber) {
  console.log('⚠️  USAGE:');
  console.log('   node test-fingerprint-add.js [username] [password] <lockId> <fingerprintNumber> [type] [name]');
  console.log('');
  console.log('Example (Normal):');
  console.log('   node test-fingerprint-add.js tusharvaishnavtv@gmail.com Tushar@900 7296935 "FP12345" 1 "Office Access"');
  console.log('');
  console.log('Example (Cyclic):');
  console.log('   node test-fingerprint-add.js tusharvaishnavtv@gmail.com Tushar@900 7296935 "FP12346" 4 "Work Hours Only"');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId            - Lock ID (required)');
  console.log('   fingerprintNumber - Fingerprint code from SDK (required)');
  console.log('   type              - 1=normal, 4=cyclic (optional, default: 1)');
  console.log('   name              - Fingerprint name (optional)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API registers a fingerprint in TTLock cloud');
  console.log('   2. Must be called AFTER adding fingerprint via SDK/lock hardware');
  console.log('   3. Fingerprint number is obtained from SDK after scanning');
  console.log('   4. You must be the lock admin to add fingerprints');
  console.log('');
  console.log('Fingerprint Types:');
  console.log('   1 - Normal (always valid within period)');
  console.log('   4 - Cyclic (valid during specific time periods each week)');
  console.log('');
  console.log('What is a Fingerprint:');
  console.log('   - Biometric authentication method');
  console.log('   - Scanned using lock\'s fingerprint sensor');
  console.log('   - Stores unique fingerprint template');
  console.log('   - Can have validity period (start/end dates)');
  console.log('   - Managed through TTLock system');
  console.log('');
  console.log('Workflow for adding fingerprint:');
  console.log('   1. Use TTLock mobile SDK or lock hardware to scan fingerprint');
  console.log('   2. SDK returns fingerprint number (unique identifier)');
  console.log('   3. Call this API to register fingerprint in cloud');
  console.log('   4. Set validity period and type');
  console.log('   5. For cyclic type, configure time restrictions');
  console.log('');
  console.log('Normal Type:');
  console.log('   - Fingerprint works 24/7 within validity period');
  console.log('   - No time restrictions');
  console.log('   - Best for permanent access');
  console.log('');
  console.log('Cyclic Type:');
  console.log('   - Fingerprint only works during configured hours');
  console.log('   - Can set different hours for each day of week');
  console.log('   - Example: Monday-Friday 8:00-18:00');
  console.log('   - Best for work hours, business hours, etc.');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Fingerprint Number:', fingerprintNumber);
console.log('Type:', fingerprintType, '(' + getTypeText(parseInt(fingerprintType)) + ')');
if (fingerprintName) console.log('Name:', fingerprintName);
console.log('');

// Helper function
function getTypeText(type) {
  const typeMap = {
    1: 'Normal - Always valid',
    4: 'Cyclic - Time restricted'
  };
  return typeMap[type] || 'Unknown';
}

async function testAddFingerprint() {
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

    // Step 2: Add fingerprint
    console.log('Step 2: Adding fingerprint...');
    console.log('');

    // Set validity period: valid for 1 year from now
    const now = Date.now();
    const oneYearLater = now + (365 * 24 * 60 * 60 * 1000);

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      fingerprintNumber: fingerprintNumber,
      fingerprintType: parseInt(fingerprintType),
      startDate: now,
      endDate: oneYearLater,
      date: Date.now()
    };

    // Add optional fingerprint name
    if (fingerprintName) {
      params.fingerprintName = fingerprintName;
    }

    // Add cyclic configuration if type is cyclic
    if (parseInt(fingerprintType) === 4) {
      // Example: Monday to Friday, 8:00 AM to 6:00 PM
      const cyclicConfig = [
        { weekDay: 1, startTime: 480, endTime: 1080 },  // Monday
        { weekDay: 2, startTime: 480, endTime: 1080 },  // Tuesday
        { weekDay: 3, startTime: 480, endTime: 1080 },  // Wednesday
        { weekDay: 4, startTime: 480, endTime: 1080 },  // Thursday
        { weekDay: 5, startTime: 480, endTime: 1080 }   // Friday
      ];
      params.cyclicConfig = JSON.stringify(cyclicConfig);
      console.log('Cyclic Schedule: Monday-Friday, 8:00 AM - 6:00 PM');
      console.log('');
    }

    console.log('📡 Calling TTLock Add Fingerprint API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/fingerprint/add`);
    console.log('');
    console.log('Fingerprint Details:');
    console.log('   Number:', fingerprintNumber);
    if (fingerprintName) console.log('   Name:', fingerprintName);
    console.log('   Type:', getTypeText(parseInt(fingerprintType)));
    console.log('   Valid From:', new Date(now).toISOString());
    console.log('   Valid Until:', new Date(oneYearLater).toISOString());
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/add`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Add fingerprint failed');
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
        console.error('   You do not have permission to add fingerprints to this lock.');
      } else if (response.data.errcode === -3006) {
        console.error('ℹ️  Error -3006: Fingerprint number already exists');
        console.error('   This fingerprint number is already registered to the lock.');
        console.error('');
        console.error('To resolve:');
        console.error('   - Use a different fingerprint number');
        console.error('   - Or delete the existing fingerprint first');
        console.error('   - Check existing fingerprints with: node test-fingerprint-list.js');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can add fingerprints.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Fingerprint added');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { fingerprintId } = response.data;

    console.log('➕ FINGERPRINT ADDED SUCCESSFULLY!');
    console.log('   Fingerprint ID:', fingerprintId);
    console.log('   Lock ID:', lockId);
    console.log('   Fingerprint Number:', fingerprintNumber);
    if (fingerprintName) console.log('   Name:', fingerprintName);
    console.log('   Type:', getTypeText(parseInt(fingerprintType)));
    console.log('   Valid Period: 1 year');
    console.log('   Added at:', new Date().toISOString());
    console.log('');
    console.log('✅ What this means:');
    console.log('   - Fingerprint has been registered to the lock');
    console.log('   - Fingerprint can be used to unlock the door');
    console.log('   - Fingerprint is valid for 1 year from now');
    console.log('   - Fingerprint info stored in TTLock cloud');
    console.log('');

    if (parseInt(fingerprintType) === 1) {
      console.log('👆 Normal Type Notes:');
      console.log('   - Fingerprint works 24/7 within validity period');
      console.log('   - No time restrictions');
      console.log('   - Can be used anytime before expiration');
    } else if (parseInt(fingerprintType) === 4) {
      console.log('🔄 Cyclic Type Notes:');
      console.log('   - Fingerprint only works during configured hours');
      console.log('   - Configured: Monday-Friday, 8:00 AM - 6:00 PM');
      console.log('   - Will NOT work outside these hours');
      console.log('   - Will NOT work on weekends');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Test the fingerprint on the physical lock');
    console.log('   2. Verify fingerprint appears in list:');
    console.log(`      node test-fingerprint-list.js ${username} [password] ${lockId}`);
    console.log('   3. Monitor fingerprint status (should show as "Normal")');
    console.log('   4. Update fingerprint details if needed');
    console.log('');
    console.log('To manage this fingerprint:');
    console.log('   - View in Sciener APP under lock settings');
    console.log('   - Modify validity period as needed');
    console.log('   - Delete fingerprint when no longer needed');
    console.log('   - Share fingerprint access with other users');

  } catch (error) {
    console.error('❌ FAILED! Add fingerprint error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3006) {
        console.error('ℹ️  Error -3006: Fingerprint number already exists');
        console.error('   This fingerprint is already registered to the lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testAddFingerprint();
