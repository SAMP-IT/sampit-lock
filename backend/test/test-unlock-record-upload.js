import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📤 Testing TTLock Upload Records API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const records = process.argv[5]; // Records data is required (from SDK)

if (!lockId || !records) {
  console.log('⚠️  USAGE:');
  console.log('   node test-unlock-record-upload.js [username] [password] <lockId> <records>');
  console.log('');
  console.log('Example:');
  console.log('   node test-unlock-record-upload.js tusharvaishnavtv@gmail.com Tushar@900 7296935 "records_data_from_sdk"');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId  - Lock ID (required)');
  console.log('   records - Records data from SDK (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API uploads records stored in the lock hardware');
  console.log('   2. Records must be read from lock via TTLock SDK first');
  console.log('   3. Records parameter is obtained from SDK method');
  console.log('   4. This syncs offline lock records to cloud');
  console.log('   5. You must be the lock admin to upload records');
  console.log('');
  console.log('What are Lock Records:');
  console.log('   - Lock stores unlock/lock events in internal memory');
  console.log('   - Records accumulate when lock is offline (no gateway)');
  console.log('   - SDK can read these records from lock via Bluetooth');
  console.log('   - This API uploads those records to cloud for persistence');
  console.log('');
  console.log('When to upload records:');
  console.log('   - Lock has been offline for a period');
  console.log('   - Want to sync offline records to cloud');
  console.log('   - Need complete historical record in cloud');
  console.log('   - Lock memory is getting full');
  console.log('   - Regular maintenance/sync operation');
  console.log('');
  console.log('Workflow for uploading records:');
  console.log('   1. Connect to lock via Bluetooth using TTLock mobile SDK');
  console.log('   2. Call SDK method to read records from lock');
  console.log('   3. SDK returns records data (encrypted string)');
  console.log('   4. Call this API with the records data');
  console.log('   5. Cloud stores the records');
  console.log('   6. Records become available via GET unlock records API');
  console.log('');
  console.log('⚠️  SDK Integration Required:');
  console.log('   - This API requires TTLock mobile SDK integration');
  console.log('   - Cannot test without actual SDK and lock hardware');
  console.log('   - Records format is specific to SDK output');
  console.log('   - Records contain encrypted unlock event data');
  console.log('');
  console.log('After Upload:');
  console.log('   - Records appear in cloud dashboard');
  console.log('   - Available via GET unlock records API');
  console.log('   - Can be filtered by date range');
  console.log('   - Provides complete audit trail');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Records Length:', records.length, 'characters');
console.log('');

console.log('⚠️  NOTE: Records data must come from TTLock SDK');
console.log('');

async function testUploadRecords() {
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

    // Step 2: Upload records
    console.log('Step 2: Uploading records...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      records: records,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Upload Records API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lockRecord/upload`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lockRecord/upload`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Upload records failed');
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
        console.error('   You do not have permission to upload records for this lock.');
      } else if (response.data.errcode === -3014) {
        console.error('ℹ️  Error -3014: Invalid records format');
        console.error('   The records data format is invalid.');
        console.error('   Records must be obtained from TTLock SDK.');
      } else if (response.data.errcode === 80002) {
        console.error('ℹ️  Error 80002: Invalid JSON format');
        console.error('   The records data format is invalid.');
        console.error('   Records must be valid JSON obtained from TTLock SDK.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      console.error('');
      console.error('To get valid records data:');
      console.error('   - Use TTLock mobile SDK');
      console.error('   - Connect to lock via Bluetooth');
      console.error('   - Call SDK method to read records');
      console.error('   - Use returned data with this API');
      return;
    }

    console.log('✅ SUCCESS! Records uploaded');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('📤 RECORDS UPLOADED SUCCESSFULLY!');
    console.log('   Lock ID:', lockId);
    console.log('   Records Length:', records.length, 'characters');
    console.log('   Uploaded at:', new Date().toISOString());
    console.log('');
    console.log('✅ What this means:');
    console.log('   - Lock records have been synced to cloud');
    console.log('   - Records are now available in cloud dashboard');
    console.log('   - Can query records via GET unlock records API');
    console.log('   - Complete audit trail is maintained');
    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify records appear in unlock record list:');
    console.log(`      node test-unlock-record-list.js ${username} [password] ${lockId}`);
    console.log('   2. Check cloud dashboard for record details');
    console.log('   3. Use records for audit and security analysis');
    console.log('');
    console.log('To view uploaded records:');
    console.log(`   node test-unlock-record-list.js ${username} [password] ${lockId} 1 20`);

  } catch (error) {
    console.error('❌ FAILED! Upload records error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3014) {
        console.error('ℹ️  Error -3014: Invalid records format');
        console.error('   Records must be obtained from TTLock SDK.');
      } else if (error.response.data.errcode === 80002) {
        console.error('ℹ️  Error 80002: Invalid JSON format');
        console.error('   Records must be valid JSON obtained from TTLock SDK.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testUploadRecords();
