import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test credentials
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔄 Testing TTLock OAuth - Refresh Access Token');
console.log('================================================');
console.log('');

// Step 1: Get initial access token
console.log('Step 1: Getting initial access token...');
console.log('Username:', username);
console.log('');

const hashedPassword = md5(password).toLowerCase();

try {
  // Get initial tokens
  const loginResponse = await axios.post(
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

  console.log('✅ Initial login successful');
  console.log('');
  console.log('Initial tokens:');
  console.log('  Access Token:', loginResponse.data.access_token.substring(0, 20) + '...');
  console.log('  Refresh Token:', loginResponse.data.refresh_token.substring(0, 20) + '...');
  console.log('  Expires in:', loginResponse.data.expires_in, 'seconds');
  console.log('');

  const refreshToken = loginResponse.data.refresh_token;

  // Step 2: Refresh the access token
  console.log('Step 2: Refreshing access token...');
  console.log('');

  const refreshResponse = await axios.post(
    `${TTLOCK_API_BASE_URL}/oauth2/token`,
    null,
    {
      params: {
        client_id: TTLOCK_CLIENT_ID,
        client_secret: TTLOCK_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }
    }
  );

  console.log('✅ SUCCESS! Token refreshed successfully');
  console.log('');
  console.log('📊 Refresh Response:');
  console.log(JSON.stringify(refreshResponse.data, null, 2));
  console.log('');

  if (refreshResponse.data.access_token) {
    console.log('🎉 NEW TOKENS RECEIVED:');
    console.log('   New Access Token:', refreshResponse.data.access_token.substring(0, 20) + '...');
    console.log('   New Refresh Token:', refreshResponse.data.refresh_token ? refreshResponse.data.refresh_token.substring(0, 20) + '...' : 'Same as before');
    console.log('   Expires in:', refreshResponse.data.expires_in, 'seconds');
    console.log('   Scope:', refreshResponse.data.scope);
    console.log('');
    console.log('✅ Access token successfully refreshed!');
  }
} catch (error) {
  console.error('❌ FAILED! Refresh token error');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
  } else {
    console.error('Error message:', error.message);
  }
}
