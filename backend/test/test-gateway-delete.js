import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete Gateway API');
console.log('====================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will PERMANENTLY DELETE the gateway:');
console.log('  - Gateway will be removed from your account');
console.log('  - All locks connected to this gateway will lose remote access');
console.log('  - This action cannot be undone');
console.log('');
console.log('USE WITH EXTREME CAUTION!');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const gatewayId = process.argv[4]; // Gateway ID is required

if (!gatewayId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-delete.js [username] [password] <gatewayId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-delete.js tusharvaishnavtv@gmail.com Tushar@900 123456');
  console.log('');
  console.log('To get a gatewayId, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. You must be the gateway admin to delete it');
  console.log('   2. All locks connected to this gateway will lose remote access');
  console.log('   3. This action is permanent and cannot be undone');
  console.log('   4. You will need to re-add the gateway if you want to use it again');
  console.log('');
  console.log('When to use:');
  console.log('   - Decommissioning old gateway hardware');
  console.log('   - Replacing gateway with a newer model');
  console.log('   - Removing gateway from wrong account');
  console.log('   - Gateway is permanently offline/damaged');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Gateway ID:', gatewayId);
console.log('');

async function testDeleteGateway() {
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

    // Step 2: Delete the gateway
    console.log('Step 2: Deleting gateway...');
    console.log('');
    console.log('⚠️  FINAL WARNING: This will permanently remove the gateway!');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: parseInt(gatewayId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Gateway API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete gateway failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Gateway is offline');
        console.error('   The gateway is not online, but can still be deleted.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Gateway not found');
        console.error('   The gateway ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -4037) {
        console.error('ℹ️  Error -4037: No such Gateway exists');
        console.error('   The gateway ID does not exist in the system.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not gateway admin');
        console.error('   You do not have admin access to this gateway.');
        console.error('   Only the gateway admin can delete the gateway.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete this gateway.');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway deleted');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  GATEWAY DELETED!');
    console.log('   Gateway ID:', gatewayId);
    console.log('   Deleted at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  CONSEQUENCES:');
    console.log('   ❌ Gateway has been removed from your account');
    console.log('   ❌ All locks connected to this gateway lost remote access');
    console.log('   ❌ WiFi control features are no longer available for those locks');
    console.log('');
    console.log('To restore remote access to the locks:');
    console.log('   1. Set up a new gateway (or re-add this one)');
    console.log('   2. Connect the locks to the new gateway via the Sciener APP');
    console.log('   3. Test remote control features');
    console.log('');
    console.log('The gateway hardware can be:');
    console.log('   - Factory reset and added to another account');
    console.log('   - Re-added to this account if needed');
    console.log('   - Decommissioned if no longer needed');

  } catch (error) {
    console.error('❌ FAILED! Delete gateway error');
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
testDeleteGateway();
