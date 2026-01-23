import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete Group API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const groupId = process.argv[4]; // Group ID is required

if (!groupId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-group-delete.js [username] [password] <groupId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-group-delete.js tusharvaishnavtv@gmail.com Tushar@900 1188834');
  console.log('');
  console.log('Parameters:');
  console.log('   groupId - ID of the group to delete (required)');
  console.log('');
  console.log('To get groupId:');
  console.log('   - List all your groups:');
  console.log('     node test-group-list.js');
  console.log('');
  console.log('⚠️  CRITICAL WARNING - READ CAREFULLY:');
  console.log('   ═══════════════════════════════════');
  console.log('');
  console.log('What this API does:');
  console.log('   - PERMANENTLY deletes a group');
  console.log('   - All locks in the group become UNGROUPED');
  console.log('   - All ekeys in the group become UNGROUPED');
  console.log('   - CANNOT be undone');
  console.log('');
  console.log('What is DELETED:');
  console.log('   ❌ The group itself (PERMANENT)');
  console.log('   ❌ Group organization structure');
  console.log('');
  console.log('What is NOT DELETED:');
  console.log('   ✅ Locks (still exist, just ungrouped)');
  console.log('   ✅ Ekeys (still exist, just ungrouped)');
  console.log('   ✅ Lock functionality (locks still work)');
  console.log('   ✅ Ekey functionality (ekeys still work)');
  console.log('   ✅ Access permissions (not affected)');
  console.log('');
  console.log('What Happens After Deletion:');
  console.log('   1. Group is permanently removed');
  console.log('   2. All locks that were in this group now have NO group');
  console.log('   3. All ekeys that were in this group now have NO group');
  console.log('   4. Locks and ekeys still work normally');
  console.log('   5. You can create a new group with the same name if needed');
  console.log('   6. Ungrouped locks can be reassigned to other groups');
  console.log('');
  console.log('Use Cases:');
  console.log('   - Remove obsolete organizational structure');
  console.log('   - Clean up unused groups');
  console.log('   - Reorganize group structure');
  console.log('   - Remove temporary project groups');
  console.log('   - Consolidate multiple groups');
  console.log('');
  console.log('Recovery Options if Accidental:');
  console.log('   1. Create a new group with the same name');
  console.log('   2. Manually reassign all affected locks using setLockGroup API');
  console.log('   3. Note: You will get a new groupId (cannot recover old one)');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Group deletion is PERMANENT and cannot be undone');
  console.log('   - Only group organization is lost, not locks or access');
  console.log('   - Consider renaming instead if you want to preserve groupId');
  console.log('   - Locks are NOT deleted, just ungrouped');
  console.log('   - Ekeys are NOT deleted, just ungrouped');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Group ID:', groupId);
console.log('');

async function testDeleteGroup() {
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

    // Step 2: Delete group
    console.log('Step 2: Deleting group...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      groupId: parseInt(groupId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Group API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/group/delete`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete group failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that group ID is valid.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to delete this group.');
      } else if (response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   The group ID does not exist or was already deleted.');
        console.error('   List existing groups:');
        console.error('     node test-group-list.js');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Group deleted successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  DELETION SUMMARY:');
    console.log('   Group ID:', groupId);
    console.log('   Deleted At:', new Date().toISOString());
    console.log('   Status: PERMANENTLY DELETED');
    console.log('');

    console.log('📋 WHAT HAPPENED:');
    console.log('   ❌ Group has been permanently deleted');
    console.log('   ❌ Group organization structure removed');
    console.log('   ℹ️  All locks that were in this group are now UNGROUPED');
    console.log('   ℹ️  All ekeys that were in this group are now UNGROUPED');
    console.log('   ✅ Locks still exist and work normally');
    console.log('   ✅ Ekeys still exist and work normally');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Group deletion is PERMANENT and cannot be undone');
    console.log('   - Locks are NOT deleted, just ungrouped');
    console.log('   - Ekeys are NOT deleted, just ungrouped');
    console.log('   - Lock functionality is NOT affected');
    console.log('   - Access permissions are NOT affected');
    console.log('   - You can create a new group with the same name if needed');
    console.log('   - Ungrouped locks can be reassigned to other groups');
    console.log('');

    console.log('🔄 IF YOU NEED TO RECOVER:');
    console.log('   1. Create a new group with desired name:');
    console.log('      node test-group-add.js [username] [password] "Group Name"');
    console.log('');
    console.log('   2. Get the new groupId from the response');
    console.log('');
    console.log('   3. Reassign each lock to the new group:');
    console.log('      node test-lock-set-group.js [username] [password] <lockId> <newGroupId>');
    console.log('');
    console.log('   Note: You will get a NEW groupId (cannot recover old one)');
    console.log('');

    console.log('💡 USE CASES FOR DELETION:');
    console.log('   - Remove obsolete organizational structure');
    console.log('   - Clean up unused groups');
    console.log('   - Reorganize group structure');
    console.log('   - Remove temporary project groups');
    console.log('   - Consolidate multiple groups');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify deletion:');
    console.log('     node test-group-list.js');
    console.log('');
    console.log('   - If you need to reorganize ungrouped locks:');
    console.log('     1. Create a new group');
    console.log('     2. Use setLockGroup API to assign locks to new group');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Delete group error');
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
        console.error('   Check group ID.');
      } else if (error.response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   The group may have been already deleted.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteGroup();
