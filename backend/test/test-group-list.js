import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📋 Testing TTLock Get Group List API');
console.log('====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';

console.log('Test Configuration:');
console.log('Username:', username);
console.log('');

console.log('What this API does:');
console.log('   - Returns all groups for your account');
console.log('   - Shows group IDs and names');
console.log('   - No pagination needed (typically small list)');
console.log('   - Empty list if no groups created yet');
console.log('');

console.log('What are Groups:');
console.log('   - ORGANIZATIONAL TOOL for managing multiple locks');
console.log('   - Classify locks by location, property, or category');
console.log('   - Filter lock and ekey lists by group');
console.log('   - Better organization of multiple properties/locations');
console.log('');

console.log('How to Use Group Information:');
console.log('   1. Get the list of all your groups (this API)');
console.log('   2. Note the groupId for each group');
console.log('   3. Use groupId to filter lock lists');
console.log('   4. Use groupId to filter ekey lists');
console.log('   5. Use groupId when initializing new locks');
console.log('');

console.log('Common Scenarios:');
console.log('   Property Manager:');
console.log('   - See all buildings/properties as groups');
console.log('   - View locks for specific building');
console.log('   - Manage access per property');
console.log('');
console.log('   Hotel Manager:');
console.log('   - See all hotel locations or floors');
console.log('   - Filter locks by hotel or floor');
console.log('   - Organize room access by location');
console.log('');
console.log('   Office Manager:');
console.log('   - See all departments or buildings');
console.log('   - View locks by department');
console.log('   - Control access by organizational unit');
console.log('');

async function testGetGroupList() {
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

    // Step 2: Get group list
    console.log('Step 2: Getting group list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Group List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/group/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get group list failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check request parameters.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to view groups.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Group list retrieved successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [] } = response.data;

    console.log('📋 GROUP LIST SUMMARY:');
    console.log('   Total Groups:', list.length);
    console.log('   Has Groups:', list.length > 0 ? 'Yes' : 'No');
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  NO GROUPS FOUND');
      console.log('   - You have not created any groups yet');
      console.log('   - Groups help organize locks by location/property');
      console.log('   - Create your first group:');
      console.log('     node test-group-add.js tusharvaishnavtv@gmail.com Tushar@900 "My First Group"');
      console.log('');
      console.log('Why Use Groups:');
      console.log('   ✅ Better organization of multiple locks');
      console.log('   ✅ Easier filtering and management');
      console.log('   ✅ Logical separation by location');
      console.log('   ✅ Scalable for large deployments');
      console.log('');
    } else {
      console.log('🏢 YOUR GROUPS:');
      console.log('');

      list.forEach((group, index) => {
        console.log(`   Group ${index + 1}:`);
        console.log(`   ├─ Name: ${group.name || 'Unnamed'}`);
        console.log(`   ├─ ID: ${group.groupId}`);
        if (group.createDate) {
          console.log(`   └─ Created: ${new Date(group.createDate).toISOString()}`);
        } else {
          console.log(`   └─ Created: Unknown`);
        }
        console.log('');
      });

      console.log('📱 HOW TO USE THESE GROUPS:');
      console.log('');
      console.log('   When initializing a lock:');
      console.log('   - Include groupId parameter in initialization');
      console.log('   - Example: groupId=' + list[0].groupId);
      console.log('');
      console.log('   When getting lock list:');
      console.log('   - Add groupId parameter to filter by group');
      console.log('   - Shows only locks in that group');
      console.log('');
      console.log('   When getting ekey list:');
      console.log('   - Add groupId parameter to filter by group');
      console.log('   - Shows only ekeys for locks in that group');
      console.log('');

      console.log('💡 FILTERING EXAMPLES:');
      console.log('');
      list.forEach((group, index) => {
        console.log(`   ${group.name || 'Group ' + (index + 1)}:`);
        console.log(`   - View locks: Add groupId=${group.groupId} to lock list request`);
        console.log(`   - View ekeys: Add groupId=${group.groupId} to ekey list request`);
        console.log(`   - Assign new lock: Use groupId=${group.groupId} during initialization`);
        console.log('');
      });
    }

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Groups help organize locks by location/property');
    console.log('   - Each group has a unique groupId');
    console.log('   - Use groupId to filter lock and ekey lists');
    console.log('   - Locks can only belong to one group at a time');
    console.log('   - Empty groups can be deleted if no longer needed');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('');
    if (list.length === 0) {
      console.log('   - Create a new group:');
      console.log('     node test-group-add.js [username] [password] "Group Name"');
      console.log('');
    } else {
      console.log('   - Add more groups:');
      console.log('     node test-group-add.js [username] [password] "New Group Name"');
      console.log('');
      console.log('   - Use groupId when initializing locks');
      console.log('   - Filter lock lists by groupId');
      console.log('   - Filter ekey lists by groupId');
      console.log('');
    }

    console.log('Common Use Cases:');
    console.log('   Property Management:');
    console.log('   - Create group for each building');
    console.log('   - Create group for each property location');
    console.log('   - Filter by group to manage specific property');
    console.log('');
    console.log('   Hotel Management:');
    console.log('   - Create group for each hotel location');
    console.log('   - Create group for each floor or wing');
    console.log('   - Organize room locks by location');
    console.log('');
    console.log('   Office Management:');
    console.log('   - Create group for each department');
    console.log('   - Create group for each building or floor');
    console.log('   - Manage access by organizational unit');
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Get group list error');
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
        console.error('   Check request parameters.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testGetGroupList();
