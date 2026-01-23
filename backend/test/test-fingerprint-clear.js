import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️ Testing TTLock Clear All Fingerprints API');
console.log('============================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-fingerprint-clear.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-fingerprint-clear.js tusharvaishnavtv@gmail.com Tushar@900 7296935');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  CRITICAL WARNINGS:');
  console.log('   1. This API PERMANENTLY DELETES ALL FINGERPRINTS from the lock');
  console.log('   2. ALL fingerprints CANNOT be recovered after deletion');
  console.log('   3. ALL users will LOSE fingerprint access to the lock');
  console.log('   4. This operation affects EVERY fingerprint on the lock');
  console.log('   5. You must be the lock admin to clear fingerprints');
  console.log('');
  console.log('⚠️  EXTREME CAUTION REQUIRED:');
  console.log('   - This is a DESTRUCTIVE operation');
  console.log('   - Affects ALL users with fingerprint access');
  console.log('   - Cannot be undone');
  console.log('   - Verify lock ID is correct before running');
  console.log('');
  console.log('When to clear all fingerprints:');
  console.log('   - Lock is being reassigned to new location');
  console.log('   - Complete security reset needed');
  console.log('   - All users need to re-enroll fingerprints');
  console.log('   - Lock is being decommissioned');
  console.log('   - Factory reset scenario');
  console.log('');
  console.log('⚠️  Before Clearing:');
  console.log('   - LIST all fingerprints first to see what will be deleted');
  console.log('   - Notify ALL users their fingerprints will be removed');
  console.log('   - Document which users had access');
  console.log('   - Plan for alternative access methods');
  console.log('   - Ensure you have other ways to unlock the door');
  console.log('');
  console.log('Alternative Access After Clearing:');
  console.log('   - Passcode access (if configured)');
  console.log('   - IC card access (if configured)');
  console.log('   - Physical key');
  console.log('   - Gateway unlock');
  console.log('   - eKey access via mobile app');
  console.log('');
  console.log('Workflow for clearing fingerprints:');
  console.log('   1. List all current fingerprints:');
  console.log('      node test-fingerprint-list.js [username] [password] <lockId>');
  console.log('   2. Document all users who will lose access');
  console.log('   3. Verify you have the correct lock ID');
  console.log('   4. Run this API to clear all fingerprints');
  console.log('   5. Verify all fingerprints are removed');
  console.log('   6. Re-enroll users as needed');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');

console.log('⚠️⚠️⚠️  WARNING: This will PERMANENTLY DELETE ALL FINGERPRINTS!  ⚠️⚠️⚠️');
console.log('');

async function testClearFingerprints() {
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

    // Step 1.5: List all fingerprints before clearing
    console.log('Step 1.5: Listing all fingerprints before clearing...');
    console.log('');

    const listParams = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      pageNo: 1,
      pageSize: 100,
      date: Date.now()
    };

    const listResponse = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/list`,
      null,
      { params: listParams }
    );

    if (listResponse.data.errcode && listResponse.data.errcode !== 0) {
      console.error('⚠️  Could not retrieve fingerprint list');
      console.error('Error:', listResponse.data);
    } else {
      const { list = [], total = 0 } = listResponse.data;
      console.log(`📋 Current Fingerprints on Lock: ${total}`);

      if (total > 0) {
        console.log('');
        console.log('Fingerprints that will be DELETED:');
        list.forEach((fp, index) => {
          console.log(`   ${index + 1}. ID: ${fp.fingerprintId}, Name: ${fp.fingerprintName || 'N/A'}, Number: ${fp.fingerprintNumber}`);
        });
        console.log('');
        console.log(`⚠️  ALL ${total} fingerprints will be PERMANENTLY REMOVED!`);
      } else {
        console.log('ℹ️  No fingerprints currently on this lock');
      }
    }
    console.log('');

    // Step 2: Clear all fingerprints
    console.log('Step 2: Clearing all fingerprints...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear Fingerprints API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/fingerprint/clear`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/clear`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Clear fingerprints failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist or you do not have access to it.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to clear fingerprints from this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can clear all fingerprints.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! All fingerprints cleared');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️ ALL FINGERPRINTS CLEARED!');
    console.log('   Lock ID:', lockId);
    console.log('   Cleared at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  What this means:');
    console.log('   - ALL fingerprints have been PERMANENTLY removed from the lock');
    console.log('   - NO users can unlock with fingerprints anymore');
    console.log('   - Lock fingerprint memory has been cleared');
    console.log('   - Cloud records for all fingerprints have been deleted');
    console.log('');
    console.log('🔒 Alternative Access Methods:');
    console.log('   - Use passcode (if configured)');
    console.log('   - Use IC card (if configured)');
    console.log('   - Use physical key');
    console.log('   - Use gateway unlock');
    console.log('   - Use eKey via mobile app');
    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify no fingerprints remain:');
    console.log(`      node test-fingerprint-list.js ${username} [password] ${lockId}`);
    console.log('   2. Notify all users their fingerprint access has been revoked');
    console.log('   3. Re-enroll users who need fingerprint access');
    console.log('   4. Test alternative access methods work');
    console.log('');
    console.log('To add new fingerprints:');
    console.log(`   node test-fingerprint-add.js ${username} [password] ${lockId} [fingerprintNumber] [type] [name]`);

  } catch (error) {
    console.error('❌ FAILED! Clear fingerprints error');
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
testClearFingerprints();
