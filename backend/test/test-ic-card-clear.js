import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Clear All IC Cards API');
console.log('========================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  CRITICAL WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will PERMANENTLY DELETE ALL IC CARDS:');
console.log('  - ALL cards will be removed from the lock');
console.log('  - NO cards will unlock the door anymore');
console.log('  - Action cannot be undone');
console.log('  - All physical cards will need to be re-added');
console.log('  - All users will lose IC card access');
console.log('');
console.log('USE WITH EXTREME CAUTION!');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ic-card-clear.js [username] [password] <lockId>');
  console.log('');
  console.log('Example:');
  console.log('   node test-ic-card-clear.js tusharvaishnavtv@gmail.com Tushar@900 7296935');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId - Lock ID (required)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API removes ALL IC cards from a lock');
  console.log('   2. Must be called AFTER SDK method (bluetooth)');
  console.log('   3. Deletion is PERMANENT and cannot be undone');
  console.log('   4. ALL card holders will lose access immediately');
  console.log('   5. You must be the lock admin to clear IC cards');
  console.log('');
  console.log('When to use this API:');
  console.log('   - Decommissioning a lock completely');
  console.log('   - Starting fresh with new card system');
  console.log('   - Emergency revocation of all card access');
  console.log('   - Lock transfer to new owner/tenant');
  console.log('   - Security incident requiring all access removal');
  console.log('');
  console.log('Workflow for clearing IC cards:');
  console.log('   1. Use TTLock mobile SDK to clear cards from lock');
  console.log('   2. Call this API to clear cards from cloud');
  console.log('   3. All cards are removed from system');
  console.log('   4. Re-add cards individually as needed');
  console.log('');
  console.log('⚠️  Before clearing:');
  console.log('   - List all current cards: node test-ic-card-list.js');
  console.log('   - Confirm this is the correct lock');
  console.log('   - Notify all card holders of access removal');
  console.log('   - Plan for re-adding necessary cards');
  console.log('   - Consider deleting cards individually instead');
  console.log('   - Document all current card assignments');
  console.log('');
  console.log('Alternatives to consider:');
  console.log('   - Delete cards individually: node test-ic-card-delete.js');
  console.log('   - Modify card validity periods instead');
  console.log('   - Disable cards temporarily vs permanent removal');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('');
console.log('⚠️  CRITICAL WARNING: This will permanently delete ALL IC cards!');
console.log('');

async function testClearICCards() {
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

    // Step 1.5: List current cards before clearing (optional but recommended)
    console.log('Step 1.5: Checking current IC cards...');
    console.log('');

    try {
      const listParams = {
        clientId: TTLOCK_CLIENT_ID,
        accessToken: accessToken,
        lockId: parseInt(lockId),
        pageNo: 1,
        pageSize: 100,
        date: Date.now()
      };

      const listResponse = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/identityCard/list`,
        null,
        { params: listParams }
      );

      if (listResponse.data.list) {
        const cardCount = listResponse.data.list.length;
        console.log(`📇 Found ${cardCount} IC card(s) that will be deleted:`);
        listResponse.data.list.forEach((card, index) => {
          console.log(`   ${index + 1}. ${card.cardName || card.cardNumber} (ID: ${card.cardId})`);
        });
        console.log('');
        console.log('⚠️  ALL of these cards will be permanently removed!');
        console.log('');
      }
    } catch (listError) {
      console.log('ℹ️  Could not retrieve card list (continuing anyway)');
      console.log('');
    }

    // Step 2: Clear all IC cards
    console.log('Step 2: Clearing all IC cards...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Clear All IC Cards API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/identityCard/clear`);
    console.log('');
    console.log('Operation Details:');
    console.log('   Lock ID:', lockId);
    console.log('   Operation: DELETE ALL IC CARDS');
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/clear`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Clear IC cards failed');
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
        console.error('   You do not have permission to clear IC cards from this lock.');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can clear all IC cards.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! All IC cards cleared');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  ALL IC CARDS CLEARED SUCCESSFULLY!');
    console.log('   Lock ID:', lockId);
    console.log('   Cleared at:', new Date().toISOString());
    console.log('');
    console.log('⚠️  CRITICAL CONSEQUENCES:');
    console.log('   ❌ ALL IC cards have been permanently removed from lock');
    console.log('   ❌ NO physical cards will unlock the door anymore');
    console.log('   ❌ ALL card data removed from TTLock cloud');
    console.log('   ❌ ALL users have lost IC card access');
    console.log('   ❌ This action CANNOT be undone');
    console.log('');
    console.log('✅ What happened:');
    console.log('   - All cards removed from lock\'s memory');
    console.log('   - All card registrations deleted from cloud');
    console.log('   - Lock will reject all previously valid cards');
    console.log('   - Physical cards themselves are unchanged');
    console.log('   - Cards can be re-added individually if needed');
    console.log('');
    console.log('📋 Immediate next steps:');
    console.log('   1. Verify card list is empty:');
    console.log(`      node test-ic-card-list.js ${username} [password] ${lockId}`);
    console.log('   2. Notify all affected card holders');
    console.log('   3. Test that all cards are rejected by lock');
    console.log('   4. Plan for re-adding necessary cards');
    console.log('');
    console.log('To restore IC card access:');
    console.log('   - Cards must be re-added individually');
    console.log('   - Use: node test-ic-card-add.js');
    console.log('   - Each card will receive a new card ID');
    console.log('   - Configure new validity periods as needed');
    console.log('   - Inform users when cards are reactivated');
    console.log('');
    console.log('Alternative access methods:');
    console.log('   - Use mobile app unlock (Bluetooth)');
    console.log('   - Use passcodes if enabled');
    console.log('   - Use fingerprint if supported');
    console.log('   - Use eKeys for temporary access');
    console.log('   - Use physical key if available');

  } catch (error) {
    console.error('❌ FAILED! Clear IC cards error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   Only the lock admin can clear all IC cards.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testClearICCards();
