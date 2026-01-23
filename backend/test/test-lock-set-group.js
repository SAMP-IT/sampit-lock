import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🏢 Testing TTLock Set Lock Group API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const groupId = process.argv[5]; // Group ID is required

if (!lockId || !groupId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-lock-set-group.js [username] [password] <lockId> <groupId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-lock-set-group.js tusharvaishnavtv@gmail.com Tushar@900 20749172 1188834');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId  - ID of the lock to assign to a group (required)');
  console.log('   groupId - ID of the group to assign the lock to (required)');
  console.log('');
  console.log('To get lockId:');
  console.log('   - List all your locks:');
  console.log('     node test-lock-list.js');
  console.log('');
  console.log('To get groupId:');
  console.log('   - List all your groups:');
  console.log('     node test-group-list.js');
  console.log('   - Or create a new group:');
  console.log('     node test-group-add.js [username] [password] "Group Name"');
  console.log('');
  console.log('What this API does:');
  console.log('   - Assigns a lock to a specific group');
  console.log('   - Moves lock from one group to another (if already grouped)');
  console.log('   - Lock can only belong to ONE group at a time');
  console.log('   - Previous group assignment is replaced');
  console.log('');
  console.log('What Happens:');
  console.log('   ✅ Lock is assigned to the specified group');
  console.log('   ✅ Lock appears when filtering by this groupId');
  console.log('   ✅ Previous group assignment (if any) is replaced');
  console.log('   ✅ Lock functionality is not affected');
  console.log('   ✅ Ekey access is not affected');
  console.log('');
  console.log('Use Cases:');
  console.log('   1. Assign newly initialized lock to a group');
  console.log('   2. Move lock from one group to another (reorganization)');
  console.log('   3. Organize locks by building/floor/property');
  console.log('   4. Group locks by access level or department');
  console.log('   5. Facilitate bulk management of related locks');
  console.log('   6. Separate locks by location for better management');
  console.log('');
  console.log('Examples:');
  console.log('   Scenario 1: Assign lock to Building A');
  console.log('   - Create group "Building A"');
  console.log('   - Use this API to assign lock to Building A groupId');
  console.log('   - Lock now appears when filtering by Building A');
  console.log('');
  console.log('   Scenario 2: Move lock from Building A to Building B');
  console.log('   - Lock is currently in Building A group');
  console.log('   - Use this API with Building B groupId');
  console.log('   - Lock removed from Building A, now in Building B');
  console.log('');
  console.log('   Scenario 3: Organize new property locks');
  console.log('   - Create group for the property');
  console.log('   - Assign all property locks to the group');
  console.log('   - All locks organized under one group');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Lock can only belong to ONE group at a time');
  console.log('   - Previous group assignment is REPLACED (not added to)');
  console.log('   - Lock functionality is NOT affected by group changes');
  console.log('   - Ekey access is NOT affected by group changes');
  console.log('   - Use filtering to view locks by group in lock list API');
  console.log('');
  console.log('After Assignment:');
  console.log('   - Filter lock list by groupId to see this lock');
  console.log('   - Use groupId for better organization and management');
  console.log('   - Change groupId anytime to move lock to different group');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Group ID:', groupId);
console.log('');

async function testSetLockGroup() {
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

    // Step 2: Set lock group
    console.log('Step 2: Assigning lock to group...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      groupId: parseInt(groupId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Set Lock Group API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/lock/setGroup`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/setGroup`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Set lock group failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that lock ID and group ID are valid.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
        console.error('   List existing locks:');
        console.error('     node test-lock-list.js');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to modify this lock.');
      } else if (response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   The group ID does not exist.');
        console.error('   List existing groups:');
        console.error('     node test-group-list.js');
        console.error('   Or create a new group:');
        console.error('     node test-group-add.js');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Lock assigned to group successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🏢 ASSIGNMENT SUMMARY:');
    console.log('   Lock ID:', lockId);
    console.log('   Group ID:', groupId);
    console.log('   Assigned At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ✅ Lock has been assigned to the specified group');
    console.log('   ✅ Lock will now appear when filtering by this groupId');
    console.log('   ✅ Previous group assignment (if any) has been replaced');
    console.log('   ✅ Lock functionality is not affected');
    console.log('   ✅ Ekey access is not affected');
    console.log('');

    console.log('📱 HOW TO USE:');
    console.log('   Filter lock list by this group:');
    console.log(`   - Add groupId=${groupId} to lock list request`);
    console.log(`   - All locks with groupId=${groupId} will be shown together`);
    console.log('');
    console.log('   Organize access:');
    console.log('   - Manage all locks in this group together');
    console.log('   - Filter by groupId for better organization');
    console.log('');
    console.log('   Reorganize:');
    console.log('   - Change groupId anytime to move lock to different group');
    console.log('   - Lock can only belong to ONE group at a time');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Lock can only belong to ONE group at a time');
    console.log('   - Previous group assignment is REPLACED (not added to)');
    console.log('   - Lock functionality is NOT affected by group changes');
    console.log('   - Ekey access is NOT affected by group changes');
    console.log('   - Use filtering to view locks by group in lock list API');
    console.log('');

    console.log('💡 USE CASES:');
    console.log('   1. Assign newly initialized lock to a group');
    console.log('   2. Move lock from one group to another (reorganization)');
    console.log('   3. Organize locks by building/floor/property');
    console.log('   4. Group locks by access level or department');
    console.log('   5. Facilitate bulk management of related locks');
    console.log('   6. Separate locks by location for better management');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - View all groups:');
    console.log('     node test-group-list.js');
    console.log('');
    console.log('   - View all locks (filter by groupId to see this lock):');
    console.log('     node test-lock-list.js');
    console.log('');
    console.log('   - Assign another lock to this group:');
    console.log(`     node test-lock-set-group.js [username] [password] <anotherLockId> ${groupId}`);
    console.log('');
    console.log('   - Move this lock to a different group:');
    console.log(`     node test-lock-set-group.js [username] [password] ${lockId} <newGroupId>`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Set lock group error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check lock ID and group ID.');
      } else if (error.response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   Check lock ID.');
      } else if (error.response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   Check group ID or create the group first.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testSetLockGroup();
