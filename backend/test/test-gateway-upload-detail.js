import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📤 Testing TTLock Upload Gateway Detail API');
console.log('==========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayId = process.argv[4]; // Gateway ID is required
const modelNum = process.argv[5]; // Model number is required
const hardwareRevision = process.argv[6]; // Hardware version is required
const firmwareRevision = process.argv[7]; // Firmware version is required
const networkName = process.argv[8]; // WiFi network name is required

if (!gatewayId || !modelNum || !hardwareRevision || !firmwareRevision || !networkName) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-upload-detail.js [username] [password] <gatewayId> <modelNum> <hardwareRevision> <firmwareRevision> <networkName>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-upload-detail.js tusharvaishnavtv@gmail.com Tushar@900 123456 "G2-WiFi" "1.0" "2.5.8" "MyWiFiNetwork"');
  console.log('');
  console.log('Parameters:');
  console.log('   gatewayId         - ID of the gateway (from gateway list)');
  console.log('   modelNum          - Product model number (e.g., "G2-WiFi", "G3")');
  console.log('   hardwareRevision  - Hardware version (e.g., "1.0", "2.0")');
  console.log('   firmwareRevision  - Firmware version (e.g., "2.5.8", "3.1.2")');
  console.log('   networkName       - WiFi network name gateway is connected to');
  console.log('');
  console.log('To get a gatewayId, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. Upload detail info after gateway is successfully added via SDK');
  console.log('   2. This API updates gateway hardware/firmware information');
  console.log('   3. Helps track gateway versions and network connections');
  console.log('   4. You must be the gateway admin to upload details');
  console.log('');
  console.log('When to use:');
  console.log('   - After successfully adding a gateway via SDK');
  console.log('   - After verifying gateway initialization (isInitSuccess)');
  console.log('   - To update gateway firmware version after upgrade');
  console.log('   - To track which WiFi network gateway is using');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Gateway ID:', gatewayId);
console.log('Model Number:', modelNum);
console.log('Hardware Version:', hardwareRevision);
console.log('Firmware Version:', firmwareRevision);
console.log('Network Name:', networkName);
console.log('');

async function testUploadGatewayDetail() {
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

    // Step 2: Upload gateway detail
    console.log('Step 2: Uploading gateway detail...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: parseInt(gatewayId),
      modelNum: modelNum,
      hardwareRevision: hardwareRevision,
      firmwareRevision: firmwareRevision,
      networkName: networkName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Upload Gateway Detail API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/uploadDetail`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/uploadDetail`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Upload gateway detail failed');
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
        console.error('   You do not have permission to upload details for this gateway.');
        console.error('   Only the gateway admin can upload gateway details.');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway detail uploaded');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('📤 GATEWAY DETAIL UPLOAD COMPLETE!');
    console.log('   Gateway ID:', gatewayId);
    console.log('   Model Number:', modelNum);
    console.log('   Hardware Version:', hardwareRevision);
    console.log('   Firmware Version:', firmwareRevision);
    console.log('   WiFi Network:', networkName);
    console.log('   Uploaded at:', new Date().toISOString());
    console.log('');
    console.log('✅ What this means:');
    console.log('   - Gateway hardware/firmware information has been updated');
    console.log('   - Network connection details have been recorded');
    console.log('   - Gateway version tracking is now accurate');
    console.log('   - System can track firmware updates and network changes');
    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify gateway details in gateway list:');
    console.log(`      node test-gateway-list.js`);
    console.log('   2. Add locks to this gateway via the Sciener APP');
    console.log('   3. Test remote lock control features');
    console.log('   4. Monitor gateway connectivity and performance');
    console.log('');
    console.log('When to update again:');
    console.log('   - After firmware upgrades');
    console.log('   - When changing WiFi networks');
    console.log('   - After hardware replacements');
    console.log('   - To keep version tracking current');

  } catch (error) {
    console.error('❌ FAILED! Upload gateway detail error');
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
testUploadGatewayDetail();
