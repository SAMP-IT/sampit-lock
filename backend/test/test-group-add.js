import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🏢 Testing TTLock Add Group API');
console.log('================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const groupName = process.argv[4]; // Group name is required

if (!groupName) {
  console.log('⚠️  USAGE:');
  console.log('   node test-group-add.js [username] [password] <groupName>');
  console.log('');
  console.log('Example:');
  console.log('   node test-group-add.js tusharvaishnavtv@gmail.com Tushar@900 "Building A"');
  console.log('   node test-group-add.js tusharvaishnavtv@gmail.com Tushar@900 "Downtown Property"');
  console.log('');
  console.log('Parameters:');
  console.log('   groupName - Name for the group (required)');
  console.log('');
  console.log('What are Groups:');
  console.log('   - ORGANIZATIONAL TOOL for managing multiple locks');
  console.log('   - Classify locks by location, property, or category');
  console.log('   - Filter lock and ekey lists by group');
  console.log('   - Better organization of multiple properties/locations');
  console.log('');
  console.log('What this API does:');
  console.log('   - Creates a new group for organizing locks');
  console.log('   - Returns groupId to use for lock assignment');
  console.log('   - Group name must be unique per account');
  console.log('   - Empty groups can be deleted later');
  console.log('');
  console.log('How to Use Groups:');
  console.log('   1. Create groups for different locations/properties');
  console.log('   2. When initializing locks, assign them to groups');
  console.log('   3. Filter lock lists by groupId to see specific locations');
  console.log('   4. Filter ekey lists by groupId for better organization');
  console.log('');
  console.log('Use Cases:');
  console.log('   Property Management:');
  console.log('   - Create groups for each building');
  console.log('   - Create groups for each floor');
  console.log('   - Create groups for different properties');
  console.log('');
  console.log('   Hotel Management:');
  console.log('   - Group by hotel location');
  console.log('   - Group by floor or wing');
  console.log('   - Group by room type');
  console.log('');
  console.log('   Office Management:');
  console.log('   - Group by department');
  console.log('   - Group by access level');
  console.log('   - Group by building or floor');
  console.log('');
  console.log('   Vacation Rentals:');
  console.log('   - Group by city or region');
  console.log('   - Group by property type');
  console.log('   - Group by booking platform');
  console.log('');
  console.log('Benefits:');
  console.log('   ✅ Better organization of multiple locks');
  console.log('   ✅ Easier filtering and management');
  console.log('   ✅ Logical separation of locks and access');
  console.log('   ✅ Scalable for large deployments');
  console.log('   ✅ Simplified access control management');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Group names must be unique (error -3022 if duplicate)');
  console.log('   - Groups can be empty (no locks assigned)');
  console.log('   - Locks can only belong to one group at a time');
  console.log('   - Moving locks between groups requires re-initialization');
  console.log('   - Empty groups can be deleted');
  console.log('');
  console.log('After Creating Group:');
  console.log('   - Save the groupId for later use');
  console.log('   - Use groupId when initializing locks');
  console.log('   - Use groupId to filter lock and ekey lists');
  console.log('   - View all groups:');
  console.log('     node test-group-list.js');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Group Name:', groupName);
console.log('');

async function testAddGroup() {
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

    // Step 2: Add group
    console.log('Step 2: Creating group...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      name: groupName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Add Group API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/group/add`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/group/add`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Add group failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that group name is valid.');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to create groups.');
      } else if (response.data.errcode === -3022) {
        console.error('ℹ️  Error -3022: Group name already exists');
        console.error('   This group name is already in use.');
        console.error('   Choose a different name or view existing groups:');
        console.error('     node test-group-list.js');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Group created successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { groupId } = response.data;

    console.log('🏢 GROUP SUMMARY:');
    console.log('   Group ID:', groupId);
    console.log('   Group Name:', groupName);
    console.log('   Created At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT THIS GROUP IS FOR:');
    console.log('   - Organize and classify locks and ekeys');
    console.log('   - Group locks by location, property, or category');
    console.log('   - Filter lock and ekey lists for better management');
    console.log('   - Logical separation of locks and access control');
    console.log('');

    console.log('📱 HOW TO USE THIS GROUP:');
    console.log('   When initializing a lock:');
    console.log('   - Include groupId parameter in initialization request');
    console.log(`   - groupId: ${groupId}`);
    console.log('');
    console.log('   When getting lock list:');
    console.log('   - Add groupId parameter to filter by this group');
    console.log('   - Shows only locks in this group');
    console.log('');
    console.log('   When getting ekey list:');
    console.log('   - Add groupId parameter to filter by this group');
    console.log('   - Shows only ekeys for locks in this group');
    console.log('');

    console.log('💡 COMMON USE CASES:');
    console.log(`   Example 1: Building "${groupName}"`);
    console.log('   - Assign all locks in this building to this group');
    console.log('   - Filter lock list to see only this building');
    console.log('   - Manage access for entire building together');
    console.log('');
    console.log(`   Example 2: Property "${groupName}"`);
    console.log('   - Separate locks by property location');
    console.log('   - View and manage each property independently');
    console.log('   - Better organization for multiple properties');
    console.log('');

    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   - Save this groupId for later use');
    console.log('   - Group name must be unique (already validated)');
    console.log('   - Locks can only belong to one group at a time');
    console.log('   - Use this groupId when initializing locks');
    console.log('   - Empty groups can be deleted if no longer needed');
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   - View all your groups:');
    console.log('     node test-group-list.js');
    console.log('');
    console.log('   - When initializing a lock, include:');
    console.log(`     groupId: ${groupId}`);
    console.log('');
    console.log('   - Filter lock list by this group:');
    console.log(`     Add groupId=${groupId} parameter to lock list request`);
    console.log('');
    console.log('   - Filter ekey list by this group:');
    console.log(`     Add groupId=${groupId} parameter to ekey list request`);
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Add group error');
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
        console.error('   Check that group name is valid.');
      } else if (error.response.data.errcode === -3022) {
        console.error('ℹ️  Error -3022: Group name already exists');
        console.error('   Choose a different name.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testAddGroup();
