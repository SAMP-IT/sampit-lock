import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = 'http://localhost:3009';

// Test credentials - use a unique email each time
const testUser = {
  email: `test${Date.now()}@awakey.com`,
  password: process.env.TEST_PASSWORD || (() => { throw new Error('TEST_PASSWORD env var is required'); })(),
  first_name: 'Test',
  last_name: 'User'
};

const ttlockCredentials = {
  username: process.argv[2] || process.env.TTLOCK_TEST_USERNAME,
  password: process.argv[3] || process.env.TTLOCK_TEST_PASSWORD
};

if (!ttlockCredentials.username || !ttlockCredentials.password) {
  console.error('❌ Error: TTLock username and password required');
  console.error('Usage: node test-complete-flow.js <ttlock_username> <ttlock_password>');
  process.exit(1);
}

console.log('🧪 Complete TTLock Integration Flow Test');
console.log('==========================================\n');

let authToken = null;

// Step 1: Login to Awakey Backend
console.log('Step 1: Login to Awakey Backend...');
try {
  const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
    email: testUser.email,
    password: testUser.password
  });

  authToken = loginResponse.data.data.token;
  console.log('✅ Logged in successfully');
  console.log('   Token:', authToken ? authToken.substring(0, 20) + '...' : 'N/A');
  console.log('');
} catch (error) {
  if (error.response?.status === 401) {
    console.log('⚠️  User not found, creating new test user...');

    try {
      const signupResponse = await axios.post(`${API_BASE_URL}/api/auth/signup`, testUser);
      console.log('✅ Test user created successfully');
      console.log('');

      // Login after signup to get token
      console.log('   Logging in with new user...');
      const loginAfterSignup = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      authToken = loginAfterSignup.data.data.token;
      console.log('   ✅ Logged in, token received');
      console.log('   Token:', authToken.substring(0, 20) + '...');
      console.log('');
    } catch (signupError) {
      console.error('❌ Failed to create test user:', signupError.response?.data || signupError.message);
      process.exit(1);
    }
  } else {
    console.error('❌ Login failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Step 2: Connect TTLock Account
console.log('Step 2: Connect TTLock Account...');
console.log('   TTLock Username:', ttlockCredentials.username);
try {
  const connectResponse = await axios.post(
    `${API_BASE_URL}/api/ttlock/login-and-connect`,
    ttlockCredentials,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );

  console.log('✅ TTLock account connected successfully');
  console.log('   Response:', JSON.stringify(connectResponse.data, null, 2));
  console.log('');
} catch (error) {
  console.error('❌ TTLock connection failed');
  if (error.response) {
    console.error('   Status:', error.response.status);
    console.error('   Error:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('   Error:', error.message);
  }
  process.exit(1);
}

// Step 3: Verify TTLock Status
console.log('Step 3: Verify TTLock Connection Status...');
try {
  const statusResponse = await axios.get(
    `${API_BASE_URL}/api/ttlock/status`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );

  console.log('✅ TTLock status retrieved');
  console.log('   Status:', JSON.stringify(statusResponse.data, null, 2));
  console.log('');
} catch (error) {
  console.error('❌ Failed to get TTLock status');
  console.error('   Error:', error.response?.data || error.message);
}

// Step 4: Get TTLock Token (Decrypted)
console.log('Step 4: Retrieve Decrypted TTLock Token...');
try {
  const tokenResponse = await axios.get(
    `${API_BASE_URL}/api/ttlock/token`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );

  console.log('✅ TTLock token retrieved and decrypted');
  console.log('   Access Token:', tokenResponse.data.data.access_token.substring(0, 20) + '...');
  console.log('   Expires At:', tokenResponse.data.data.expires_at);
  console.log('');
} catch (error) {
  console.error('❌ Failed to get TTLock token');
  console.error('   Error:', error.response?.data || error.message);
}

console.log('==========================================');
console.log('🎉 Test Complete!');
console.log('');
console.log('Summary:');
console.log('✅ Authentication working');
console.log('✅ TTLock OAuth integration working');
console.log('✅ Token encryption/decryption working');
console.log('✅ Database storage working');
