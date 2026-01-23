import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

// Test parameters
const startDate = parseInt(process.argv[2]) || 0; // 0 for no constraint
const endDate = parseInt(process.argv[3]) || 0; // 0 for no constraint
const pageNo = parseInt(process.argv[4]) || 1;
const pageSize = parseInt(process.argv[5]) || 20;

console.log('📋 Testing TTLock Get User List API');
console.log('===================================');
console.log('Start Date:', startDate === 0 ? 'No constraint' : new Date(startDate).toISOString());
console.log('End Date:', endDate === 0 ? 'No constraint' : new Date(endDate).toISOString());
console.log('Page:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

// Prepare request parameters
const params = {
  clientId: TTLOCK_CLIENT_ID,
  clientSecret: TTLOCK_CLIENT_SECRET,
  startDate: startDate,
  endDate: endDate,
  pageNo: pageNo,
  pageSize: pageSize,
  date: Date.now()
};

console.log('📡 Calling TTLock Get User List API...');
console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/user/list`);
console.log('');

try {
  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/list`,
    null,
    { params }
  );

  console.log('✅ SUCCESS! User list retrieved');
  console.log('');
  console.log('📊 Response:');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('');

  if (response.data.list && response.data.list.length > 0) {
    console.log('👥 USERS FOUND:');
    console.log('   Total users:', response.data.total);
    console.log('   Total pages:', response.data.pages);
    console.log('   Current page:', response.data.pageNo);
    console.log('   Page size:', response.data.pageSize);
    console.log('');
    console.log('Users on this page:');
    response.data.list.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.userid}`);
      console.log(`      Registered: ${new Date(user.regtime).toISOString()}`);
    });
  } else {
    console.log('ℹ️  No users found for the specified criteria');
  }
} catch (error) {
  console.error('❌ FAILED! Get user list error');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
  } else {
    console.error('Error message:', error.message);
  }
}
