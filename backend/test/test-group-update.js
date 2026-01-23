import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('✏️  Testing TTLock Update Group API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const groupId = process.argv[4]; // Group ID is required
const newName = process.argv[5]; // New name is required

if (!groupId || !newName) {
  console.log('⚠️  USAGE:');
  console.log('   node test-group-update.js [username] [password] <groupId> <newName>');
  console.log('');
  console.log('Example:');
  console.log('   node test-group-update.js tusharvaishnavtv@gmail.com Tushar@900 1188834 "Building A - Updated"');
  console.log('');
  console.log('Parameters:');
  console.log('   groupId - ID of the group to update (required)');
  console.log('   newName - New name for the group (required)');
  console.log('');
  console.log('To get groupId:');
  console.log('   - List all your groups:');
  console.log('     node test-group-list.js');
  console.log('');
  console.log('What this API does:');
  console.log('   - Updates the name of an existing group');
  console.log('   - GroupId remains the same');
  console.log('   - All lock and ekey assignments remain intact');
  console.log('   - New name must be unique (not used by another group)');
  console.log('');
  console.log('What Changes:');
  console.log('   ✅ Group name updated to new value');
  console.log('   ✅ Users see new name immediately');
  console.log('');
  console.log('What Stays the Same:');
  console.log('   ✅ Group ID remains unchanged');
  console.log('   ✅ All locks in group remain assigned');
  console.log('   ✅ All ekeys in group remain assigned');
  console.log('   ✅ Group configuration preserved');
  console.log('   ✅ No need to reassign anything');
  console.log('');
  console.log('Use Cases:');
  console.log('   - Rename for better organization');
  console.log('   - Correct typos in group name');
  console.log('   - Update naming convention');
  console.log('   - Rebrand location or property names');
  console.log('   - Standardize group naming across organization');
  console.log('');
  console.log('Important Notes:');
  console.log('   - New name must be unique (error -3022 if duplicate)');
  console.log('   - GroupId stays the same for filtering and assignments');
  console.log('   - All locks and ekeys remain in the group');
  console.log('   - No impact on lock or ekey functionality');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Group ID:', groupId);
console.log('New Name:', newName);
console.log('');

async function testUpdateGroup() {
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

    // Step 2: Update group
    console.log('Step 2: Updating group name...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      groupId: parseInt(groupId),
      name: newName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Update Group API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/group/update`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/update`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Update group failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that group ID and new name are valid.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to update this group.');
      } else if (response.data.errcode === -3022) {
        console.error('ℹ️  Error -3022: Group name already exists');
        console.error('   This name is already used by another group.');
        console.error('   Choose a different name or view existing groups:');
        console.error('     node test-group-list.js');
      } else if (response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   The group ID does not exist.');
        console.error('   List existing groups:');
        console.error('     node test-group-list.js');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Group name updated successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('✏️  UPDATE SUMMARY:');
    console.log('   Group ID:', groupId);
    console.log('   New Name:', newName);
    console.log('   Updated At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT CHANGED:');
    console.log('   ✅ Group name updated to:', newName);
    console.log('   ✅ Users see new name immediately');
    console.log('');

    console.log('📋 WHAT STAYED THE SAME:');
    console.log('   ✅ Group ID:', groupId, '(unchanged)');
    console.log('   ✅ All locks in this group remain assigned');
    console.log('   ✅ All ekeys in this group remain assigned');
    console.log('   ✅ Group configuration preserved');
    console.log('   ✅ No need to reassign locks or ekeys');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Only the group name has changed');
    console.log('   - GroupId remains the same for filtering and assignments');
    console.log('   - All locks and ekeys remain in the group');
    console.log('   - No impact on lock or ekey functionality');
    console.log('   - Users see the new name immediately');
    console.log('');

    console.log('💡 USE CASES:');
    console.log('   - Rename group for better organization');
    console.log('   - Correct typos in group name');
    console.log('   - Update naming convention');
    console.log('   - Rebrand location or property names');
    console.log('   - Standardize group naming across organization');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - Verify the updated name:');
    console.log('     node test-group-list.js');
    console.log('');
    console.log('   - Continue using the same groupId for filtering:');
    console.log(`     groupId=${groupId}`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Update group error');
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
        console.error('   Check group ID and new name.');
      } else if (error.response.data.errcode === -3022) {
        console.error('ℹ️  Error -3022: Group name already exists');
        console.error('   Choose a different name.');
      } else if (error.response.data.errcode === -3023) {
        console.error('ℹ️  Error -3023: Group does not exist');
        console.error('   Check group ID.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testUpdateGroup();
