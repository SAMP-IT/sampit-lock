import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔄 Testing TTLock Transfer Gateway API');
console.log('======================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will PERMANENTLY TRANSFER gateway(s):');
console.log('  - Gateway(s) will be removed from your account');
console.log('  - Gateway(s) will be added to the receiver\'s account');
console.log('  - You will lose all access to the gateway(s)');
console.log('  - All locks connected to the gateway(s) will transfer ownership');
console.log('  - This action cannot be undone');
console.log('');
console.log('USE WITH EXTREME CAUTION!');
console.log('');

// Get credentials from command line
const username = process.argv[2];
const password = process.argv[3];
const receiverUsername = process.argv[4];
const gatewayIds = process.argv[5]; // Comma-separated gateway IDs

if (!username || !password || !receiverUsername || !gatewayIds) {
  console.log('⚠️  USAGE:');
  console.log('   node test-gateway-transfer.js <username> <password> <receiverUsername> <gatewayIds>');
  console.log('');
  console.log('Example:');
  console.log('   node test-gateway-transfer.js sender@email.com SenderPass receiver@email.com 123456,789012');
  console.log('');
  console.log('Parameters:');
  console.log('   username         - Your username (sender)');
  console.log('   password         - Your password');
  console.log('   receiverUsername - The receiver\'s username');
  console.log('   gatewayIds       - Comma-separated gateway IDs to transfer');
  console.log('');
  console.log('To get gateway IDs, first run:');
  console.log('   node test-gateway-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. You must be the gateway admin to transfer it');
  console.log('   2. The receiver must have a valid TTLock account');
  console.log('   3. Transfer is PERMANENT and cannot be undone');
  console.log('   4. You will lose all access to the transferred gateway(s)');
  console.log('   5. All locks connected to gateway(s) will transfer with it');
  console.log('');
  console.log('When to use:');
  console.log('   - Transferring ownership to another user');
  console.log('   - Moving gateway to a different account');
  console.log('   - Giving gateway access to new property owner');
  console.log('   - Organizational account transfers');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Sender Username:', username);
console.log('Receiver Username:', receiverUsername);
console.log('Gateway IDs:', gatewayIds);
console.log('');

async function testTransferGateway() {
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

    // Step 2: Parse gateway IDs
    const gatewayIdArray = gatewayIds.split(',').map(id => parseInt(id.trim()));

    console.log('Step 2: Preparing to transfer gateway(s)...');
    console.log('');
    console.log('⚠️  FINAL WARNING: This will permanently transfer the gateway(s)!');
    console.log('');
    console.log('Transfer Details:');
    console.log('   From:', username);
    console.log('   To:', receiverUsername);
    console.log('   Gateway IDs:', gatewayIdArray);
    console.log('   Total Gateways:', gatewayIdArray.length);
    console.log('');

    // Convert array to string format for API: "[1234,3332]"
    const gatewayIdListString = JSON.stringify(gatewayIdArray);

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      receiverUsername: receiverUsername,
      gatewayIdList: gatewayIdListString,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Transfer Gateway API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/gateway/transfer`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/transfer`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Transfer gateway failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3009) {
        console.error('ℹ️  Error -3009: Gateway not found');
        console.error('   One or more gateway IDs do not exist or you do not have access.');
      } else if (response.data.errcode === -4037) {
        console.error('ℹ️  Error -4037: No such Gateway exists');
        console.error('   One or more gateway IDs do not exist in the system.');
      } else if (response.data.errcode === -1002) {
        console.error('ℹ️  Error -1002: Invalid User Name');
        console.error('   The receiver username does not exist.');
        console.error('   The receiver must have a registered TTLock account.');
      } else if (response.data.errcode === -1003) {
        console.error('ℹ️  Error -1003: Receiver user not found');
        console.error('   The receiver username does not exist.');
        console.error('   The receiver must have a valid TTLock account.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not gateway admin');
        console.error('   You do not have admin access to one or more gateways.');
        console.error('   Only the gateway admin can transfer gateways.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to transfer these gateways.');
      }
      console.error('');
      console.error('To find valid gateway IDs, run:');
      console.error('   node test-gateway-list.js');
      return;
    }

    console.log('✅ SUCCESS! Gateway(s) transferred');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🔄 TRANSFER COMPLETE!');
    console.log('   From:', username);
    console.log('   To:', receiverUsername);
    console.log('   Gateway IDs:', gatewayIdArray);
    console.log('   Transferred at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  TRANSFER CONSEQUENCES:');
    console.log('   ❌ You NO LONGER have access to the gateway(s)');
    console.log('   ✅ Gateway(s) now belong to:', receiverUsername);
    console.log('   ✅ Receiver has full admin access to the gateway(s)');
    console.log('   ✅ All locks connected to the gateway(s) are now accessible by receiver');
    console.log('');
    console.log('What happens next:');
    console.log('   1. Gateway(s) appear in receiver\'s account');
    console.log('   2. Receiver can manage the gateway(s) and connected locks');
    console.log('   3. You lose all remote access to locks connected to these gateway(s)');
    console.log('   4. This transfer is permanent and cannot be reversed');
    console.log('');
    console.log('To verify the transfer:');
    console.log('   1. Check your gateway list (should no longer show transferred gateway(s))');
    console.log('   2. Ask receiver to check their gateway list');

  } catch (error) {
    console.error('❌ FAILED! Transfer gateway error');
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
testTransferGateway();
