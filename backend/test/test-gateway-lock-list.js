import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📡 Testing TTLock Get Gateway Lock List API');
console.log('===========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayId = process.argv[4]; // Gateway ID is required

if (!gatewayId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-lock-list.js [username] [password] <gatewayId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-lock-list.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a gatewayId, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API returns locks connected to a specific gateway');
  console.log('   2. Shows lock details including name, MAC, and signal strength');
  console.log('   3. Helps monitor which locks are connected to the gateway');
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
console.log('Gateway ID:', gatewayId);
console.log('');

async function testGatewayLockList() {
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

    // Step 2: Get lock list for gateway
    console.log('Step 2: Getting lock list for gateway...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: parseInt(gatewayId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Gateway Lock List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/listLock`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/listLock`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get gateway lock list failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Gateway not found');
        console.error('   The gateway ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -4037) {
        console.error('ℹ️  Error -4037: No such Gateway exists');
        console.error('   The gateway ID does not exist in the system.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to access this gateway.');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Lock list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [] } = response.data;

    console.log('📡 LOCK LIST FOR GATEWAY:');
    console.log('   Gateway ID:', gatewayId);
    console.log('   Total Locks:', list.length);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No locks connected to this gateway');
      console.log('');
      console.log('This means:');
      console.log('   - The gateway has no locks paired to it');
      console.log('   - Remote control features are not available');
      console.log('');
      console.log('To connect locks to this gateway:');
      console.log('   1. Use the Sciener APP');
      console.log('   2. Go to gateway settings');
      console.log('   3. Add locks to the gateway');
      console.log('   4. Ensure locks are within range of the gateway');
    } else {
      console.log('📡 Lock Details:');
      console.log('');

      list.forEach((lock, index) => {
        // Determine signal strength
        let signalIcon = '📶';
        let signalDescription = 'Unknown';

        if (lock.rssi !== undefined) {
          if (lock.rssi > -75) {
            signalIcon = '📶 🟢';
            signalDescription = 'Strong (Excellent)';
          } else if (lock.rssi > -85) {
            signalIcon = '📶 🟡';
            signalDescription = 'Medium (Good)';
          } else {
            signalIcon = '📶 🔴';
            signalDescription = 'Weak (Poor)';
          }
        }

        console.log(`Lock ${index + 1}:`);
        console.log(`   Lock ID: ${lock.lockId}`);
        console.log(`   Lock Name: ${lock.lockName || 'N/A'}`);
        if (lock.lockAlias) {
          console.log(`   Lock Alias: ${lock.lockAlias}`);
        }
        console.log(`   MAC Address: ${lock.lockMac || 'N/A'}`);
        console.log(`   Signal Strength: ${signalIcon} ${signalDescription}`);
        console.log(`   RSSI: ${lock.rssi} dBm`);
        if (lock.updateDate) {
          console.log(`   Last Updated: ${new Date(lock.updateDate).toISOString()}`);
        }
        console.log('');
      });

      // Find locks with weak signal
      const weakSignals = list.filter(l => l.rssi !== undefined && l.rssi < -85);
      if (weakSignals.length > 0) {
        console.log('⚠️  Signal Strength Warnings:');
        console.log(`   ${weakSignals.length} lock(s) have weak signal strength:`);
        weakSignals.forEach(lock => {
          console.log(`   - ${lock.lockName || 'Lock ' + lock.lockId}: ${lock.rssi} dBm`);
        });
        console.log('');
        console.log('To improve signal:');
        console.log('   - Move gateway closer to the locks');
        console.log('   - Remove obstacles between gateway and locks');
        console.log('   - Ensure gateway has stable power and WiFi');
        console.log('   - Consider adding another gateway for better coverage');
      }

      // Summary statistics
      const strongSignals = list.filter(l => l.rssi !== undefined && l.rssi > -75).length;
      const mediumSignals = list.filter(l => l.rssi !== undefined && l.rssi > -85 && l.rssi <= -75).length;

      console.log('📊 Signal Strength Summary:');
      console.log(`   Strong signals: ${strongSignals}`);
      console.log(`   Medium signals: ${mediumSignals}`);
      console.log(`   Weak signals: ${weakSignals.length}`);
      console.log('');

      if (strongSignals + mediumSignals === list.length) {
        console.log('✅ All locks have good signal strength');
        console.log('   Remote control should work reliably');
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get gateway lock list error');
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
testGatewayLockList();
