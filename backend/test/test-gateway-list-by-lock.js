import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📡 Testing TTLock Get Gateway List by Lock API');
console.log('===============================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-list-by-lock.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-list-by-lock.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API returns gateways connected to a specific lock');
  console.log('   2. Shows RSSI signal strength between gateway and lock');
  console.log('   3. Helps identify the best gateway for lock communication');
  console.log('');
  console.log('Signal Strength Reference:');
  console.log('   > -75 dBm  = Strong (Excellent)');
  console.log('   -75 to -85 = Medium (Good)');
  console.log('   < -85 dBm  = Weak (Poor)');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

async function testGatewayListByLock() {
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

    // Step 2: Get gateway list for lock
    console.log('Step 2: Getting gateway list for lock...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Gateway List by Lock API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/listByLock`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/listByLock`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get gateway list by lock failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to access this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [] } = response.data;

    console.log('📡 GATEWAY LIST FOR LOCK:');
    console.log('   Lock ID:', lockId);
    console.log('   Total Gateways:', list.length);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No gateways found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - The lock is not connected to any gateway');
      console.log('   - Remote control features are not available');
      console.log('');
      console.log('To connect this lock to a gateway:');
      console.log('   1. Purchase a TTLock WiFi gateway (G1 or G2)');
      console.log('   2. Set up the gateway using the Sciener APP');
      console.log('   3. Add this lock to the gateway in the app');
      console.log('   4. Ensure both are within range of each other');
    } else {
      console.log('📡 Gateway Details:');
      console.log('');

      list.forEach((gateway, index) => {
        // Determine signal strength
        let signalIcon = '📶';
        let signalDescription = 'Unknown';

        if (gateway.rssi !== undefined) {
          if (gateway.rssi > -75) {
            signalIcon = '📶 🟢';
            signalDescription = 'Strong (Excellent)';
          } else if (gateway.rssi > -85) {
            signalIcon = '📶 🟡';
            signalDescription = 'Medium (Good)';
          } else {
            signalIcon = '📶 🔴';
            signalDescription = 'Weak (Poor)';
          }
        }

        console.log(`Gateway ${index + 1}:`);
        console.log(`   Gateway ID: ${gateway.gatewayId}`);
        console.log(`   MAC Address: ${gateway.gatewayMac}`);
        console.log(`   Signal Strength: ${signalIcon} ${signalDescription}`);
        console.log(`   RSSI: ${gateway.rssi} dBm`);
        if (gateway.rssiUpdateDate) {
          console.log(`   Last Updated: ${new Date(gateway.rssiUpdateDate).toISOString()}`);
        }
        console.log('');
      });

      // Find best gateway
      const bestGateway = list.reduce((best, current) => {
        if (!best || (current.rssi !== undefined && current.rssi > best.rssi)) {
          return current;
        }
        return best;
      }, null);

      if (bestGateway) {
        console.log('🏆 BEST GATEWAY FOR THIS LOCK:');
        console.log(`   Gateway ID: ${bestGateway.gatewayId}`);
        console.log(`   MAC Address: ${bestGateway.gatewayMac}`);
        console.log(`   RSSI: ${bestGateway.rssi} dBm`);
        console.log('');
        console.log('This gateway has the strongest signal and should be used for remote control.');
      }

      // Signal strength recommendations
      const weakSignals = list.filter(g => g.rssi !== undefined && g.rssi < -85);
      if (weakSignals.length > 0) {
        console.log('⚠️  Signal Strength Recommendations:');
        console.log(`   ${weakSignals.length} gateway(s) have weak signal strength.`);
        console.log('');
        console.log('To improve signal:');
        console.log('   - Move gateway closer to lock');
        console.log('   - Remove obstacles between gateway and lock');
        console.log('   - Ensure gateway has good WiFi connectivity');
        console.log('   - Consider adding another gateway if needed');
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get gateway list by lock error');
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
testGatewayListByLock();
