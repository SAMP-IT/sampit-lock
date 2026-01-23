import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📡 Testing TTLock Get Gateway List API');
console.log('======================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const pageNo = parseInt(process.argv[4]) || 1;
const pageSize = parseInt(process.argv[5]) || 20;

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
console.log('');
console.log('⚠️  USAGE:');
console.log('   node test-gateway-list.js [username] [password] [pageNo] [pageSize]');
console.log('');
console.log('Example:');
console.log('   node test-gateway-list.js tusharvaishnavtv@gmail.com Tushar@900 1 20');
console.log('');
console.log('Parameters:');
console.log('   pageNo   - Page number (default: 1)');
console.log('   pageSize - Items per page (default: 20, max: 100)');
console.log('');

async function testGatewayList() {
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

    // Step 2: Get gateway list
    console.log('Step 2: Getting gateway list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Gateway List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get gateway list failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      }
      return;
    }

    console.log('✅ SUCCESS! Gateway list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [] } = response.data;

    console.log('📡 GATEWAY LIST SUMMARY:');
    console.log('   Total Gateways:', list.length);
    console.log('   Page:', pageNo);
    console.log('   Page Size:', pageSize);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No gateways found for this account');
      console.log('');
      console.log('To use gateway features:');
      console.log('   1. Purchase a TTLock WiFi gateway (G1 or G2)');
      console.log('   2. Set up the gateway using the Sciener APP');
      console.log('   3. Connect your locks to the gateway');
      console.log('   4. Run this test again to see your gateways');
    } else {
      console.log('📡 Gateway Details:');
      console.log('');

      list.forEach((gateway, index) => {
        const onlineStatus = gateway.isOnline === 1 ? '🟢 Online' : '🔴 Offline';
        const version = gateway.gatewayVersion === 1 ? 'G1' : gateway.gatewayVersion === 2 ? 'G2' : `V${gateway.gatewayVersion}`;

        console.log(`Gateway ${index + 1}:`);
        console.log(`   Gateway ID: ${gateway.gatewayId}`);
        console.log(`   MAC Address: ${gateway.gatewayMac}`);
        console.log(`   Version: ${version}`);
        if (gateway.networkName) {
          console.log(`   Network: ${gateway.networkName}`);
        }
        console.log(`   Connected Locks: ${gateway.lockNum}`);
        console.log(`   Status: ${onlineStatus}`);
        console.log('');
      });

      // Statistics
      const onlineCount = list.filter(g => g.isOnline === 1).length;
      const offlineCount = list.filter(g => g.isOnline === 0).length;
      const totalLocks = list.reduce((sum, g) => sum + (g.lockNum || 0), 0);

      console.log('📊 Statistics:');
      console.log(`   Online Gateways: ${onlineCount}`);
      console.log(`   Offline Gateways: ${offlineCount}`);
      console.log(`   Total Locks Connected: ${totalLocks}`);
      console.log('');

      if (offlineCount > 0) {
        console.log('⚠️  Note: Some gateways are offline');
        console.log('   Offline gateways cannot be used for remote lock control.');
        console.log('   Check gateway power and internet connectivity.');
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get gateway list error');
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

// Run the test
testGatewayList();
