import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🧪 Testing TTLock Delete User API');
console.log('==================================');
console.log('');

// Step 1: Register a test user to delete
const randomNum = Math.floor(Math.random() * 100000);
const username = `testdelete${randomNum}`;
const password = process.env.TEST_PASSWORD || (() => { throw new Error('TEST_PASSWORD env var is required'); })();
const hashedPassword = md5(password).toLowerCase();

console.log('Step 1: Creating a test user to delete...');
console.log('Username:', username);
console.log('');

try {
  // Register the user
  const registerResponse = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/register`,
    null,
    {
      params: {
        clientId: TTLOCK_CLIENT_ID,
        clientSecret: TTLOCK_CLIENT_SECRET,
        username: username,
        password: hashedPassword,
        date: Date.now()
      }
    }
  );

  console.log('✅ Test user created successfully');
  console.log('   Registered Username:', registerResponse.data.username);
  console.log('');

  const registeredUsername = registerResponse.data.username;

  // Step 2: Delete the user
  console.log('Step 2: Deleting the test user...');
  console.log('Username to delete:', registeredUsername);
  console.log('');

  const deleteParams = {
    clientId: TTLOCK_CLIENT_ID,
    clientSecret: TTLOCK_CLIENT_SECRET,
    username: registeredUsername,
    date: Date.now()
  };

  console.log('📡 Calling TTLock Delete User API...');
  console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/user/delete`);
  console.log('');

  const deleteResponse = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/delete`,
    null,
    { params: deleteParams }
  );

  console.log('✅ SUCCESS! User deleted successfully');
  console.log('');
  console.log('📊 Response:');
  console.log(JSON.stringify(deleteResponse.data, null, 2));
  console.log('');
  console.log('🎉 USER DELETED:');
  console.log('   Username:', registeredUsername);
  console.log('');

  // Step 3: Verify deletion by trying to get user list
  console.log('Step 3: Verifying deletion...');
  const listResponse = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/list`,
    null,
    {
      params: {
        clientId: TTLOCK_CLIENT_ID,
        clientSecret: TTLOCK_CLIENT_SECRET,
        startDate: 0,
        endDate: 0,
        pageNo: 1,
        pageSize: 100,
        date: Date.now()
      }
    }
  );

  const userExists = listResponse.data.list.some(user => user.userid === registeredUsername);

  if (!userExists) {
    console.log('✅ Verification successful: User no longer exists in the list');
  } else {
    console.log('⚠️  Warning: User still appears in the list');
  }

} catch (error) {
  console.error('❌ FAILED! Error during test');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
    console.error('');

    // Check for common errors
    if (error.response.data.errcode === -1003) {
      console.error('ℹ️  User does not exist.');
    }
  } else {
    console.error('Error message:', error.message);
  }
}
