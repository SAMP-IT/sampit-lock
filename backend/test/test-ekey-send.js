import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔑 Testing TTLock Send Ekey API');
console.log('================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const receiverUsername = process.argv[5]; // Receiver username is required
const keyName = process.argv[6]; // Key name is required
const startDate = process.argv[7]; // Start date is required (0 for permanent)
const endDate = process.argv[8]; // End date is required (0 for permanent)

if (!lockId || !receiverUsername || !keyName || startDate === undefined || endDate === undefined) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ekey-send.js [username] [password] <lockId> <receiverUsername> <keyName> <startDate> <endDate>');
  console.log('');
  console.log('Examples:');
  console.log('   # Send permanent ekey:');
  console.log('   node test-ekey-send.js tusharvaishnavtv@gmail.com Tushar@900 7296935 friend@example.com "Guest Access" 0 0');
  console.log('');
  console.log('   # Send timed ekey (24 hours):');
  console.log(`   node test-ekey-send.js tusharvaishnavtv@gmail.com Tushar@900 7296935 friend@example.com "Visitor Access" ${Date.now()} ${Date.now() + 86400000}`);
  console.log('');
  console.log('Parameters:');
  console.log('   lockId           - Lock ID (required)');
  console.log('   receiverUsername - Email or phone number of receiver (required)');
  console.log('   keyName          - Name/description for the ekey (required)');
  console.log('   startDate        - Start timestamp in ms (use 0 for permanent ekey)');
  console.log('   endDate          - End timestamp in ms (use 0 for permanent ekey)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('What is an Ekey:');
  console.log('   - Electronic key that grants access to a lock');
  console.log('   - Can be permanent (no expiration) or timed (valid period)');
  console.log('   - Shared digitally via email or phone number');
  console.log('   - Receiver gets notification and can access lock via app');
  console.log('');
  console.log('Permanent Ekey (startDate=0, endDate=0):');
  console.log('   ✅ Never expires');
  console.log('   ✅ Always grants access to the lock');
  console.log('   ✅ Good for trusted users (family, long-term guests)');
  console.log('   ⚠️  Admin must manually delete to revoke access');
  console.log('');
  console.log('Timed Ekey (specific dates):');
  console.log('   ✅ Only valid during specified time period');
  console.log('   ✅ Automatically expires after end date');
  console.log('   ✅ Good for temporary access (visitors, workers)');
  console.log('   ℹ️  Can be extended by sending new ekey');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Admin CANNOT send ekey to themselves');
  console.log('   - If receiver already has ekey for this lock, it will be replaced');
  console.log('   - Receiver must have TTLock account (or use createUser=1)');
  console.log('   - Receiver gets push notification about new ekey');
  console.log('');
  console.log('Receiver Username Formats:');
  console.log('   - Email: user@example.com');
  console.log('   - Phone: Country code + number (e.g., +919876543210)');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Share permanent access with family members');
  console.log('   2. Grant temporary access to guests/visitors');
  console.log('   3. Provide time-limited access to service workers');
  console.log('   4. Create backup access keys');
  console.log('   5. Manage multi-user property access');
  console.log('');
  console.log('Time Helper:');
  console.log(`   Current time:     ${Date.now()}`);
  console.log(`   24 hours later:   ${Date.now() + 86400000}`);
  console.log(`   1 week later:     ${Date.now() + 604800000}`);
  console.log(`   30 days later:    ${Date.now() + 2592000000}`);
  console.log('');
  process.exit(1);
}

const isPermanent = startDate === '0' && endDate === '0';

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Receiver:', receiverUsername);
console.log('Key Name:', keyName);
console.log('Ekey Type:', isPermanent ? 'Permanent (Never expires)' : 'Timed (Expires after period)');
if (!isPermanent) {
  console.log('Valid From:', new Date(parseInt(startDate)).toISOString());
  console.log('Valid Until:', new Date(parseInt(endDate)).toISOString());
  const durationMs = parseInt(endDate) - parseInt(startDate);
  const durationHours = Math.floor(durationMs / 3600000);
  const durationDays = Math.floor(durationMs / 86400000);
  console.log('Duration:', durationDays > 0 ? `${durationDays} days` : `${durationHours} hours`);
}
console.log('');

async function testSendEkey() {
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

    // Step 2: Send ekey
    console.log('Step 2: Sending ekey...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      receiverUsername: receiverUsername,
      keyName: keyName,
      startDate: parseInt(startDate),
      endDate: parseInt(endDate),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Send Ekey API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/send`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/send`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Send ekey failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that all parameters are valid.');
        console.error('   - Lock ID must be a valid number');
        console.error('   - Receiver username must be valid email or phone');
        console.error('   - Dates must be valid timestamps (or 0 for permanent)');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to send ekeys for this lock.');
      } else if (response.data.errcode === -3005) {
        console.error('ℹ️  Error -3005: Cannot send ekey to admin');
        console.error('   Admin cannot send ekey to themselves.');
        console.error('   The lock admin already has full access.');
      } else if (response.data.errcode === -3019) {
        console.error('ℹ️  Error -3019: User is already lock admin');
        console.error('   The receiver is already the admin of this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can send ekeys.');
        console.error('   You need admin privileges for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Ekey sent successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { keyId } = response.data;

    console.log('🔑 EKEY DETAILS:');
    console.log('   Key ID:', keyId);
    console.log('   Lock ID:', lockId);
    console.log('   Receiver:', receiverUsername);
    console.log('   Key Name:', keyName);
    console.log('   Type:', isPermanent ? 'Permanent' : 'Timed');
    if (!isPermanent) {
      console.log('   Valid From:', new Date(parseInt(startDate)).toISOString());
      console.log('   Valid Until:', new Date(parseInt(endDate)).toISOString());
    }
    console.log('   Sent At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Ekey created in cloud server');
    console.log('   ✅ Receiver notified via email/phone');
    console.log('   ✅ Receiver can now access lock via TTLock app');
    if (isPermanent) {
      console.log('   ℹ️  Permanent access - no expiration date');
    } else {
      console.log('   ℹ️  Timed access - expires automatically');
    }
    console.log('   ⚠️  If receiver had previous ekey, it has been replaced');
    console.log('');

    console.log('📱 NEXT STEPS FOR RECEIVER:');
    console.log('   1. Check email/phone for TTLock notification');
    console.log('   2. Open TTLock app (or download if not installed)');
    console.log('   3. Login with their TTLock account');
    console.log('   4. Accept the ekey invitation');
    console.log('   5. Lock will appear in their lock list');
    console.log('   6. Tap lock to unlock remotely (if gateway connected)');
    console.log('   7. Or use Bluetooth when near the lock');
    console.log('');

    console.log('🛠️  MANAGEMENT OPTIONS:');
    console.log('   - View all ekeys for your locks:');
    console.log('     node test-ekey-list.js');
    console.log('');
    console.log('   - Freeze ekey (temporary disable):');
    console.log('     node test-ekey-freeze.js [username] [password] ' + keyId);
    console.log('');
    console.log('   - Delete ekey (permanent removal):');
    console.log('     node test-ekey-delete.js [username] [password] ' + keyId);
    console.log('');
    console.log('   - Modify ekey validity period:');
    console.log('     node test-ekey-change-period.js [username] [password] ' + keyId + ' <newStartDate> <newEndDate>');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Send ekey error');
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
        console.error('   Check that all parameters are valid.');
      } else if (error.response.data.errcode === -3005) {
        console.error('ℹ️  Error -3005: Cannot send ekey to admin');
        console.error('   Admin cannot send ekey to themselves.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can send ekeys.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testSendEkey();
