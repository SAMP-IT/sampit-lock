import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔍 Testing TTLock Gateway Upgrade Check API');
console.log('==========================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayId = process.argv[4]; // Gateway ID is required

if (!gatewayId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-upgrade-check.js [username] [password] <gatewayId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-upgrade-check.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a gatewayId, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API checks if firmware upgrade is available for G2 gateway');
  console.log('   2. Upgrade availability is based on modelNum, hardwareRevision, firmwareRevision');
  console.log('   3. Returns upgrade status: 0=No, 1=Yes, 2=Unknown');
  console.log('   4. May include firmware information if upgrade is available');
  console.log('');
  console.log('Upgrade Status Values:');
  console.log('   0 - No upgrade available (firmware is up to date)');
  console.log('   1 - Upgrade available (new firmware version exists)');
  console.log('   2 - Unknown (unable to determine upgrade status)');
  console.log('');
  console.log('When to use:');
  console.log('   - Before performing firmware upgrades');
  console.log('   - During routine maintenance checks');
  console.log('   - To verify gateway is running latest firmware');
  console.log('   - After adding or configuring a gateway');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Gateway ID:', gatewayId);
console.log('');

async function testGatewayUpgradeCheck() {
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

    // Step 2: Check gateway upgrade
    console.log('Step 2: Checking gateway upgrade availability...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: parseInt(gatewayId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Gateway Upgrade Check API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/upgradeCheck`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/upgradeCheck`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Gateway upgrade check failed');
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
        console.error('   You do not have permission to check upgrades for this gateway.');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway upgrade check completed');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { needUpgrade, firmwareInfo } = response.data;

    // Display upgrade status with visual indicators
    console.log('🔍 GATEWAY UPGRADE STATUS:');
    console.log('   Gateway ID:', gatewayId);
    console.log('');

    if (needUpgrade === 0) {
      console.log('✅ NO UPGRADE AVAILABLE');
      console.log('   Status: Firmware is up to date');
      console.log('   Recommendation: No action needed');
      console.log('');
      console.log('What this means:');
      console.log('   - Gateway is running the latest firmware version');
      console.log('   - No firmware updates are currently available');
      console.log('   - Gateway should continue operating normally');
      console.log('   - Check again periodically for future updates');
    } else if (needUpgrade === 1) {
      console.log('🔄 UPGRADE AVAILABLE!');
      console.log('   Status: New firmware version is available');
      console.log('   Recommendation: Consider upgrading to latest version');
      console.log('');
      if (firmwareInfo) {
        console.log('📋 Firmware Information:');
        console.log('   ', firmwareInfo);
        console.log('');
      }
      console.log('What this means:');
      console.log('   - A newer firmware version has been released');
      console.log('   - Upgrading may provide new features or bug fixes');
      console.log('   - Review release notes before upgrading');
      console.log('   - Plan upgrade during maintenance window');
      console.log('');
      console.log('⚠️  Before upgrading:');
      console.log('   1. Review firmware release notes and changes');
      console.log('   2. Ensure gateway has stable power and network');
      console.log('   3. Backup current configuration if possible');
      console.log('   4. Plan for potential brief downtime');
      console.log('   5. Test with one gateway before upgrading all');
      console.log('');
      console.log('To upgrade:');
      console.log('   - Use the Sciener APP gateway settings');
      console.log('   - Follow the firmware upgrade process');
      console.log('   - Monitor gateway during upgrade');
      console.log('   - Verify functionality after upgrade completes');
    } else if (needUpgrade === 2) {
      console.log('❓ UPGRADE STATUS UNKNOWN');
      console.log('   Status: Unable to determine upgrade availability');
      console.log('   Recommendation: Check gateway connection and try again');
      console.log('');
      console.log('What this means:');
      console.log('   - Gateway upgrade status could not be determined');
      console.log('   - Gateway may be offline or unreachable');
      console.log('   - Network connectivity issues may exist');
      console.log('   - Gateway information may be incomplete');
      console.log('');
      console.log('Troubleshooting steps:');
      console.log('   1. Verify gateway is online and powered');
      console.log('   2. Check gateway WiFi connection');
      console.log('   3. Ensure gateway details were uploaded (upload-detail API)');
      console.log('   4. Wait a moment and try again');
      console.log('   5. Check gateway in Sciener APP');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Review current gateway configuration');
    console.log('   2. Check all gateways with: node test-gateway-list.js');
    console.log('   3. View gateway details in Sciener APP');
    console.log('   4. Plan maintenance schedule if upgrade available');

  } catch (error) {
    console.error('❌ FAILED! Gateway upgrade check error');
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
testGatewayUpgradeCheck();
