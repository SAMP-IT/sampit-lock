import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('👤 Testing TTLock Get User ID API');
console.log('==================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Client ID:', TTLOCK_CLIENT_ID);
console.log('');

async function testGetUserId() {
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
    const uidFromToken = tokenResponse.data.uid;

    if (!accessToken) {
      console.error('❌ No access token received');
      console.error('OAuth Response:', tokenResponse.data);
      return;
    }

    console.log('✅ Access token obtained');
    console.log('   Token:', accessToken.substring(0, 20) + '...');
    console.log('   User ID from OAuth:', uidFromToken);
    console.log('');

    // Step 2: Get user ID using the Get User ID API
    console.log('Step 2: Getting user ID using Get User ID API...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get User ID API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/user/getUid`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/getUid`,
      null,
      { params }
    );

    console.log('✅ SUCCESS! User ID retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { uid } = response.data;

    console.log('🎉 USER ID RETRIEVED:');
    console.log('   User ID:', uid);
    console.log('');

    // Verify consistency
    if (uid === uidFromToken) {
      console.log('✅ Verification: User IDs match!');
      console.log('   OAuth returned UID:', uidFromToken);
      console.log('   Get User ID API returned UID:', uid);
    } else {
      console.log('⚠️  Warning: User IDs do not match');
      console.log('   OAuth returned UID:', uidFromToken);
      console.log('   Get User ID API returned UID:', uid);
    }

  } catch (error) {
    console.error('❌ FAILED! Get user ID error');
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
testGetUserId();
