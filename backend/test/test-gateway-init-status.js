import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔍 Testing TTLock Query Gateway Init Status API');
console.log('=================================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayNetMac = process.argv[4]; // Gateway network MAC is required

if (!gatewayNetMac) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-init-status.js [username] [password] <gatewayNetMac>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-init-status.js tusharvaishnavtv@gmail.com Tushar@900 52:A6:D8:B2:C1:00');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API checks if gateway initialization was successful');
  console.log('   2. Must be called within 3 minutes after adding gateway via SDK');
  console.log('   3. The gatewayNetMac is obtained when adding gateway via SDK');
  console.log('   4. Returns the gateway ID if initialization was successful');
  console.log('');
  console.log('What is gatewayNetMac?');
  console.log('   - The MAC address of the gateway');
  console.log('   - Format: XX:XX:XX:XX:XX:XX (e.g., 52:A6:D8:B2:C1:00)');
  console.log('   - Obtained from the SDK when adding a gateway');
  console.log('');
  console.log('When to use:');
  console.log('   - After adding a gateway via TTLock SDK');
  console.log('   - To verify gateway was successfully initialized');
  console.log('   - Within 3 minutes of SDK add operation');
  console.log('   - Before attempting to use the gateway');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Gateway Network MAC:', gatewayNetMac);
console.log('');
console.log('⚠️  NOTE: This should be called within 3 minutes of adding gateway via SDK');
console.log('');

async function testGatewayInitStatus() {
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

    // Step 2: Query gateway init status
    console.log('Step 2: Querying gateway initialization status...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayNetMac: gatewayNetMac,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Query Gateway Init Status API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/isInitSuccess`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/isInitSuccess`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Query gateway init status failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === 1) {
        console.error('ℹ️  Error 1: Failed or means no');
        console.error('');
        console.error('Possible reasons:');
        console.error('   - Gateway has not been added via SDK yet');
        console.error('   - Gateway MAC address is incorrect');
        console.error('   - 3 minute window has expired');
        console.error('   - Initialization failed');
      } else if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Gateway not found');
        console.error('   Initialization may still be in progress.');
        console.error('   Wait a moment and try again (within 3 minute window).');
      } else if (response.data.errcode === -4037) {
        console.error('ℹ️  Error -4037: Gateway initialization not complete or failed');
        console.error('');
        console.error('Possible reasons:');
        console.error('   - Gateway is still initializing (wait and retry)');
        console.error('   - 3 minute window has expired');
        console.error('   - Initialization failed');
        console.error('   - Gateway MAC address is incorrect');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to query this gateway.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Gateway initialization status retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { gatewayId } = response.data;

    console.log('🎉 GATEWAY INITIALIZATION SUCCESSFUL!');
    console.log('   Gateway Network MAC:', gatewayNetMac);
    console.log('   Gateway ID:', gatewayId);
    console.log('   Checked at:', new Date().toISOString());
    console.log('');
    console.log('✅ What this means:');
    console.log('   - Gateway has been successfully added to your account');
    console.log('   - Gateway ID can now be used for other operations');
    console.log('   - You can start connecting locks to this gateway');
    console.log('   - Remote control features are available');
    console.log('');
    console.log('Next steps:');
    console.log('   1. Add locks to this gateway via the Sciener APP');
    console.log('   2. Configure gateway settings as needed');
    console.log('   3. Test remote unlock/lock features');
    console.log('   4. View gateway in your gateway list:');
    console.log(`      node test-gateway-list.js`);
    console.log('');
    console.log('To see locks connected to this gateway:');
    console.log(`   node test-gateway-lock-list.js ${username} [password] ${gatewayId}`);

  } catch (error) {
    console.error('❌ FAILED! Query gateway init status error');
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
testGatewayInitStatus();
