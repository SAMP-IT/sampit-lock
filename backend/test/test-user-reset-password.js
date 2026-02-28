import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test credentials from command line or env vars (no hardcoded defaults)
const username = process.argv[2] || process.env.TTLOCK_TEST_USERNAME;
const newPassword = process.argv[3] || process.env.TEST_PASSWORD;
if (!username || !newPassword) {
  console.error('❌ Error: Username and new password required');
  console.error('Usage: node test-user-reset-password.js <username> <new_password>');
  console.error('Or set TTLOCK_TEST_USERNAME and TEST_PASSWORD env vars');
  process.exit(1);
}

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔄 Testing TTLock User Reset Password API');
console.log('==========================================');
console.log('Username:', username);
console.log('New Password:', newPassword);
console.log('');

// Hash password with MD5 and convert to lowercase
const hashedPassword = md5(newPassword).toLowerCase();
console.log('🔑 New password hashed (MD5):', hashedPassword);
console.log('');

// Prepare request parameters
const params = {
  clientId: TTLOCK_CLIENT_ID,
  clientSecret: TTLOCK_CLIENT_SECRET,
  username: username,
  password: hashedPassword,
  date: Date.now()
};

console.log('📡 Calling TTLock Reset Password API...');
console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/user/resetPassword`);
console.log('');

try {
  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/user/resetPassword`,
    null,
    { params }
  );

  console.log('✅ SUCCESS! Password reset successfully');
  console.log('');
  console.log('📊 Response:');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('');
  console.log('🎉 PASSWORD RESET COMPLETE');
  console.log('   Username:', username);
  console.log('   New Password:', newPassword);
  console.log('');
  console.log('✅ You can now login with the new password!');
  console.log('');
  console.log('Next step: Test login with new password:');
  console.log(`   node test-oauth-token.js ${username} ${newPassword}`);
} catch (error) {
  console.error('❌ FAILED! Password reset error');
  console.error('');
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
    console.error('');

    // Check for common errors
    if (error.response.data.errcode === -1003) {
      console.error('ℹ️  User does not exist. Check the username.');
    }
  } else {
    console.error('Error message:', error.message);
  }
}
