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

console.log('🔐 Testing TTLock OAuth - Get Access Token');
console.log('==========================================');
console.log('Username:', username);
console.log('Client ID:', TTLOCK_CLIENT_ID);
console.log('');

// Hash password with MD5 and convert to lowercase
const hashedPassword = md5(password).toLowerCase();
console.log('🔑 Password hashed (MD5):', hashedPassword);
console.log('');

// Prepare request parameters
const params = {
  client_id: TTLOCK_CLIENT_ID,
  client_secret: TTLOCK_CLIENT_SECRET,
  username: username,
  password: hashedPassword,
  grant_type: 'password'
};

console.log('📡 Calling TTLock OAuth API...');
console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/oauth2/token`);
console.log('');

try {
  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/oauth2/token`,
    null,
    { params }
  );

  console.log('✅ SUCCESS! OAuth login successful');
  console.log('');
  console.log('📊 Response:');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('');

  if (response.data.access_token) {
    console.log('🎉 ACCESS TOKEN RECEIVED:');
    console.log('   Token:', response.data.access_token.substring(0, 20) + '...');
    console.log('   User ID:', response.data.uid);
    console.log('   Expires in:', response.data.expires_in, 'seconds');
    console.log('   Scope:', response.data.scope);
    console.log('');
    console.log('✅ You can use this access token to test other APIs!');
  }
} catch (error) {
  console.error('❌ FAILED! OAuth login error');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
  } else {
    console.error('Error message:', error.message);
  }
}
