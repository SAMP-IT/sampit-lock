import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('⚙️  Testing TTLock Set Gateway Upgrade Mode API');
console.log('==============================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will put gateway into UPGRADE MODE:');
console.log('  - Gateway CANNOT accept any commands during upgrade mode');
console.log('  - All lock control operations will be unavailable');
console.log('  - Gateway must complete upgrade process before normal operation');
console.log('  - Do NOT use unless performing actual firmware upgrade');
console.log('');
console.log('USE WITH EXTREME CAUTION!');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayId = process.argv[4]; // Gateway ID is required

if (!gatewayId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-set-upgrade-mode.js [username] [password] <gatewayId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-set-upgrade-mode.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a gatewayId, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API sets gateway into upgrade mode remotely');
  console.log('   2. Gateway CANNOT accept commands while in upgrade mode');
  console.log('   3. Use ONLY when performing actual firmware upgrade');
  console.log('   4. Gateway must be online and connected to WiFi');
  console.log('   5. You must be the gateway admin to set upgrade mode');
  console.log('');
  console.log('What happens in upgrade mode:');
  console.log('   ❌ Lock/unlock commands will not work');
  console.log('   ❌ Gateway status queries will be limited');
  console.log('   ❌ Remote access to locks unavailable');
  console.log('   ❌ All gateway operations suspended');
  console.log('   ✅ Gateway ready to receive firmware update');
  console.log('');
  console.log('When to use:');
  console.log('   - After checking upgrade availability (upgrade-check API)');
  console.log('   - Before starting firmware upgrade process');
  console.log('   - When instructed by Sciener APP during upgrade');
  console.log('   - As part of scheduled maintenance upgrade');
  console.log('');
  console.log('When NOT to use:');
  console.log('   - During normal gateway operation');
  console.log('   - Without available firmware upgrade');
  console.log('   - During peak usage hours');
  console.log('   - Without planning for downtime');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Gateway ID:', gatewayId);
console.log('');
console.log('⚠️  WARNING: Gateway will enter upgrade mode and stop accepting commands!');
console.log('');

async function testSetGatewayUpgradeMode() {
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

    // Step 2: Set gateway upgrade mode
    console.log('Step 2: Setting gateway into upgrade mode...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: parseInt(gatewayId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Set Gateway Upgrade Mode API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/setUpgradeMode`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/setUpgradeMode`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Set gateway upgrade mode failed');
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
        console.error('   You do not have permission to set upgrade mode for this gateway.');
        console.error('   Only the gateway admin can activate upgrade mode.');
      } else if (response.data.errcode === -3010) {
        console.error('ℹ️  Error -3010: Gateway is offline');
        console.error('   The gateway is not connected to the network.');
        console.error('');
        console.error('Troubleshooting:');
        console.error('   - Check gateway power connection');
        console.error('   - Verify WiFi connectivity');
        console.error('   - Ensure gateway is online in Sciener APP');
        console.error('   - Wait for gateway to reconnect');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway upgrade mode activated');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('⚙️  GATEWAY IN UPGRADE MODE!');
    console.log('   Gateway ID:', gatewayId);
    console.log('   Mode: UPGRADE MODE ACTIVE');
    console.log('   Activated at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  CRITICAL RESTRICTIONS:');
    console.log('   ❌ Gateway CANNOT accept lock/unlock commands');
    console.log('   ❌ Remote access to locks UNAVAILABLE');
    console.log('   ❌ Gateway status queries LIMITED');
    console.log('   ❌ All normal operations SUSPENDED');
    console.log('');
    console.log('✅ What you CAN do:');
    console.log('   ✅ Proceed with firmware upgrade');
    console.log('   ✅ Upload new firmware to gateway');
    console.log('   ✅ Monitor upgrade progress');
    console.log('');
    console.log('📋 Next steps for firmware upgrade:');
    console.log('   1. Gateway is now ready to receive firmware');
    console.log('   2. Use Sciener APP to upload firmware');
    console.log('   3. Monitor upgrade progress closely');
    console.log('   4. DO NOT power off gateway during upgrade');
    console.log('   5. Wait for upgrade to complete');
    console.log('   6. Gateway will automatically restart');
    console.log('   7. Verify gateway returns to normal operation');
    console.log('   8. Test lock control after upgrade completes');
    console.log('');
    console.log('⚠️  Important during upgrade:');
    console.log('   - Ensure stable power supply');
    console.log('   - Maintain WiFi connection');
    console.log('   - Do not interrupt upgrade process');
    console.log('   - Allow sufficient time for completion');
    console.log('   - Monitor via Sciener APP');
    console.log('');
    console.log('If upgrade fails or takes too long:');
    console.log('   1. Check gateway power and WiFi');
    console.log('   2. Consult Sciener support documentation');
    console.log('   3. May need to reset gateway');
    console.log('   4. Contact Sciener technical support if needed');
    console.log('');
    console.log('To verify upgrade completion:');
    console.log('   - Check gateway status in Sciener APP');
    console.log('   - Run: node test-gateway-list.js');
    console.log('   - Test lock control functionality');
    console.log('   - Verify firmware version updated');

  } catch (error) {
    console.error('❌ FAILED! Set gateway upgrade mode error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3010) {
        console.error('ℹ️  Error -3010: Gateway is offline');
        console.error('   The gateway must be online to enter upgrade mode.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testSetGatewayUpgradeMode();
