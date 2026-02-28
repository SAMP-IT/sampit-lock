import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Generate a random test username (only letters and numbers allowed)
const randomNum = Math.floor(Math.random() * 100000);
const username = process.argv[2] || `testuser${randomNum}`;
const password = process.argv[3] || process.env.TEST_PASSWORD || (() => { throw new Error('TEST_PASSWORD env var or CLI arg required'); })();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📝 Testing TTLock User Register API');
console.log('====================================');
console.log('Username:', username);
console.log('Password:', password);
console.log('');

// Hash password with MD5 and convert to lowercase
const hashedPassword = md5(password).toLowerCase();
console.log('🔑 Password hashed (MD5):', hashedPassword);
console.log('');

// Prepare request parameters
const params = {
  clientId: TTLOCK_CLIENT_ID,
  clientSecret: TTLOCK_CLIENT_SECRET,
  username: username,
  password: hashedPassword,
  date: Date.now()
};

console.log('📡 Calling TTLock User Register API...');
console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/user/register`);
console.log('');

try {
  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/register`,
    null,
    { params }
  );

  console.log('✅ SUCCESS! User registered successfully');
  console.log('');
  console.log('📊 Response:');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('');

  if (response.data.username) {
    console.log('🎉 USER REGISTERED:');
    console.log('   Username:', response.data.username);
    console.log('');
    console.log('✅ You can now use this username and password to login!');
    console.log('');
    console.log('Next step: Test login with:');
    console.log(`   node test-oauth-token.js ${response.data.username} ${password}`);
  }
} catch (error) {
  console.error('❌ FAILED! User registration error');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
    console.error('');

    // Check for common errors
    if (error.response.data.errcode === -3019) {
      console.error('ℹ️  Username already exists. Try with a different username.');
    }
  } else {
    console.error('Error message:', error.message);
  }
}
