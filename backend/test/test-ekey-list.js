import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📋 Testing TTLock Get Ekey List API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const pageNo = process.argv[4] || '1'; // Default to page 1
const pageSize = process.argv[5] || '20'; // Default to 20 items per page

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

console.log('⚠️  USAGE:');
console.log('   node test-ekey-list.js [username] [password] [pageNo] [pageSize]');
console.log('');
console.log('Examples:');
console.log('   # Get first page with 20 items:');
console.log('   node test-ekey-list.js tusharvaishnavtv@gmail.com Tushar@900 1 20');
console.log('');
console.log('   # Get first page with 100 items:');
console.log('   node test-ekey-list.js tusharvaishnavtv@gmail.com Tushar@900 1 100');
console.log('');
console.log('   # Get second page:');
console.log('   node test-ekey-list.js tusharvaishnavtv@gmail.com Tushar@900 2 20');
console.log('');
console.log('Parameters:');
console.log('   pageNo   - Page number (default: 1, starts from 1)');
console.log('   pageSize - Items per page (default: 20, max: 10000)');
console.log('');
console.log('What this API does:');
console.log('   - Returns all ekeys (electronic keys) you have received or sent');
console.log('   - Includes both admin ekeys and common user ekeys');
console.log('   - Shows lock details, validity period, and ekey status');
console.log('   - Supports pagination for large lists');
console.log('');
console.log('Ekey Types Returned:');
console.log('   1. Admin Ekeys - Full access to locks you own');
console.log('   2. Common User Ekeys - Access to locks shared with you');
console.log('');
console.log('Ekey Status Values:');
console.log('   110401 - Active (working normally)');
console.log('   110402 - Frozen (temporarily disabled)');
console.log('   110405 - Expired (past validity period)');
console.log('   110406 - Deleted (permanently removed)');
console.log('   110408 - Reset (requires re-initialization)');
console.log('');
console.log('Permanent vs Timed Ekeys:');
console.log('   - Permanent: startDate=0, endDate=0 (never expires)');
console.log('   - Timed: specific dates (expires automatically)');
console.log('');
console.log('Use Cases:');
console.log('   1. View all your lock access permissions');
console.log('   2. Check which ekeys are active/expired');
console.log('   3. Monitor lock battery levels');
console.log('   4. Find ekeys you sent to others');
console.log('   5. Identify locks with remote unlock capability');
console.log('');
console.log('Response Information:');
console.log('   keyId          - Unique ekey identifier');
console.log('   lockName       - Display name of the lock');
console.log('   lockAlias      - Alternative name/alias');
console.log('   userType       - 110301=Admin, 110302=Common User');
console.log('   keyStatus      - Current status of ekey');
console.log('   electricQuantity - Lock battery level (%)');
console.log('   remoteEnable   - 1=Can unlock remotely, 2=Cannot');
console.log('   noKeyPwd       - Has no-key password feature');
console.log('');
console.log('Pagination:');
console.log('   - If total > pageSize, request more pages');
console.log('   - Page numbers start from 1');
console.log('   - Maximum 10000 items per page');
console.log('');

async function testGetEkeyList() {
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

    // Step 2: Get ekey list
    console.log('Step 2: Getting ekey list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Ekey List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/key/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get ekey list failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that pageNo and pageSize are valid numbers.');
        console.error('   - pageNo must be >= 1');
        console.error('   - pageSize must be 1-10000');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to view ekeys.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Ekey list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [], pages = 0, pageNo: currentPage = 1, pageSize: size = 0, total = 0 } = response.data;

    console.log('🔑 EKEY LIST SUMMARY:');
    console.log('   Current Page:', currentPage);
    console.log('   Page Size:', size);
    console.log('   Total Pages:', pages);
    console.log('   Total Ekeys:', total);
    console.log('   Ekeys in This Page:', list.length);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No ekeys found');
      console.log('');
      console.log('This could mean:');
      console.log('   - You have not sent or received any ekeys');
      console.log('   - All ekeys have been deleted');
      console.log('   - This page number is beyond available data');
      console.log('');
      console.log('To send an ekey:');
      console.log(`   node test-ekey-send.js ${username} [password] <lockId> <receiver> <keyName> 0 0`);
      console.log('');
    } else {
      // Categorize ekeys
      const adminEkeys = list.filter(e => e.userType === 110301);
      const commonUserEkeys = list.filter(e => e.userType === 110302);
      const activeEkeys = list.filter(e => e.keyStatus === 110401);
      const expiredEkeys = list.filter(e => e.keyStatus === 110405);
      const frozenEkeys = list.filter(e => e.keyStatus === 110402);
      const permanentEkeys = list.filter(e => e.startDate === 0 && e.endDate === 0);
      const timedEkeys = list.filter(e => e.startDate !== 0 || e.endDate !== 0);
      const remoteUnlockEkeys = list.filter(e => e.remoteEnable === 1);

      console.log('📊 STATISTICS:');
      console.log('   Admin Ekeys:', adminEkeys.length);
      console.log('   Common User Ekeys:', commonUserEkeys.length);
      console.log('   Active Ekeys:', activeEkeys.length);
      console.log('   Expired Ekeys:', expiredEkeys.length);
      console.log('   Frozen Ekeys:', frozenEkeys.length);
      console.log('   Permanent Ekeys:', permanentEkeys.length);
      console.log('   Timed Ekeys:', timedEkeys.length);
      console.log('   Remote Unlock Enabled:', remoteUnlockEkeys.length);
      console.log('');

      console.log('🔑 DETAILED EKEY LIST:');
      console.log('');

      list.forEach((ekey, index) => {
        const isPermanent = ekey.startDate === 0 && ekey.endDate === 0;
        const isExpired = ekey.keyStatus === 110405;
        const isActive = ekey.keyStatus === 110401;
        const isFrozen = ekey.keyStatus === 110402;
        const isAdmin = ekey.userType === 110301;
        const hasRemoteUnlock = ekey.remoteEnable === 1;

        console.log(`Ekey ${index + 1}:`);
        console.log(`   Key ID: ${ekey.keyId}`);
        console.log(`   Lock Name: ${ekey.lockName}`);
        console.log(`   Lock Alias: ${ekey.lockAlias || 'N/A'}`);
        console.log(`   Lock ID: ${ekey.lockId}`);
        console.log(`   Lock MAC: ${ekey.lockMac}`);
        console.log(`   User Type: ${isAdmin ? 'Admin (110301)' : 'Common User (110302)'}`);
        console.log(`   Ekey Type: ${isPermanent ? 'Permanent' : 'Timed'}`);

        if (!isPermanent) {
          console.log(`   Valid From: ${new Date(ekey.startDate).toISOString()}`);
          console.log(`   Valid Until: ${new Date(ekey.endDate).toISOString()}`);
        }

        console.log(`   Status: ${isActive ? 'Active (110401)' : isFrozen ? 'Frozen (110402)' : isExpired ? 'Expired (110405)' : `Other (${ekey.keyStatus})`}`);
        console.log(`   Remote Unlock: ${hasRemoteUnlock ? 'Enabled (1)' : 'Disabled (2)'}`);
        console.log(`   Battery Level: ${ekey.electricQuantity}%`);
        console.log(`   Lock Version: ${ekey.lockVersion || 'N/A'}`);
        console.log(`   Has No-Key Password: ${ekey.noKeyPwd}`);
        console.log(`   Key Rights: ${ekey.keyRight}`);

        if (ekey.remarks) {
          console.log(`   Remarks: ${ekey.remarks}`);
        }

        console.log('');
      });

      console.log('📱 PAGINATION:');
      if (parseInt(currentPage) < parseInt(pages)) {
        console.log(`   ▶️  More ekeys available. Get next page:`);
        console.log(`   node test-ekey-list.js ${username} [password] ${parseInt(currentPage) + 1} ${size}`);
      } else {
        console.log('   ℹ️  This is the last page');
      }
      if (parseInt(currentPage) > 1) {
        console.log(`   ◀️  Get previous page:`);
        console.log(`   node test-ekey-list.js ${username} [password] ${parseInt(currentPage) - 1} ${size}`);
      }
      console.log('');

      console.log('🛠️  MANAGEMENT OPTIONS:');
      console.log('');
      console.log('To freeze an ekey (temporarily disable):');
      list.forEach((ekey, index) => {
        if (ekey.keyStatus === 110401) { // Only show active ekeys
          console.log(`   ${index + 1}. node test-ekey-freeze.js ${username} [password] ${ekey.keyId}`);
        }
      });
      console.log('');
      console.log('To delete an ekey (permanently):');
      list.forEach((ekey, index) => {
        console.log(`   ${index + 1}. node test-ekey-delete.js ${username} [password] ${ekey.keyId}`);
      });
      console.log('');
      console.log('To change ekey validity period:');
      list.forEach((ekey, index) => {
        if (ekey.userType === 110301) { // Only admins can change periods
          console.log(`   ${index + 1}. node test-ekey-change-period.js ${username} [password] ${ekey.keyId} <newStartDate> <newEndDate>`);
        }
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ FAILED! Get ekey list error');
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
        console.error('   Check that pageNo and pageSize are valid.');
      } else if (error.response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to view ekeys.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testGetEkeyList();
