import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🗑️  Testing TTLock Delete IC Card API');
console.log('====================================');
console.log('');
console.log('⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️');
console.log('');
console.log('This API will PERMANENTLY DELETE an IC card:');
console.log('  - Card will be removed from the lock');
console.log('  - Card will no longer unlock the door');
console.log('  - Action cannot be undone');
console.log('  - Physical card will need to be re-added if needed again');
console.log('');
console.log('USE WITH CAUTION!');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const cardId = process.argv[5]; // Card ID is required
const deleteType = process.argv[6] || '2'; // Default to gateway (direct delete)

if (!lockId || !cardId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ic-card-delete.js [username] [password] <lockId> <cardId> [deleteType]');
  console.log('');
  console.log('Example:');
  console.log('   node test-ic-card-delete.js tusharvaishnavtv@gmail.com Tushar@900 7296935 24242 2');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId     - Lock ID (required)');
  console.log('   cardId     - IC card ID to delete (required)');
  console.log('   deleteType - Delete method (optional, default: 2)');
  console.log('');
  console.log('To get lockId and cardId, first run:');
  console.log('   node test-ic-card-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API deletes an IC card from a lock');
  console.log('   2. Must be called AFTER SDK method for bluetooth (deleteType=1)');
  console.log('   3. Can be called DIRECTLY for gateway (deleteType=2)');
  console.log('   4. Deletion is PERMANENT and cannot be undone');
  console.log('   5. You must be the lock admin to delete IC cards');
  console.log('');
  console.log('Delete Type Values:');
  console.log('   1 - Phone Bluetooth (must call SDK method first)');
  console.log('   2 - Gateway (can delete directly via API) ← Recommended for testing');
  console.log('   3 - NB-IoT');
  console.log('');
  console.log('Workflow for deleting IC card:');
  console.log('   [Bluetooth Method - deleteType=1]');
  console.log('   1. Use TTLock mobile SDK to delete card from lock');
  console.log('   2. Call this API to remove card from cloud');
  console.log('   3. Card is fully deleted');
  console.log('');
  console.log('   [Gateway Method - deleteType=2]');
  console.log('   1. Call this API directly');
  console.log('   2. Gateway handles card deletion from lock');
  console.log('   3. Card is removed from cloud and lock');
  console.log('');
  console.log('⚠️  Before deleting:');
  console.log('   - Confirm card ID is correct');
  console.log('   - Verify this is the card you want to delete');
  console.log('   - Ensure card holder is aware of deletion');
  console.log('   - Consider disabling instead of deleting if temporary');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Card ID:', cardId);
console.log('Delete Type:', deleteType, '(' + getDeleteTypeText(parseInt(deleteType)) + ')');
console.log('');
console.log('⚠️  WARNING: This will permanently delete the IC card!');
console.log('');

// Helper function
function getDeleteTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth - SDK required first',
    2: 'Gateway - Direct delete',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}

async function testDeleteICCard() {
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

    // Step 2: Delete IC card
    console.log('Step 2: Deleting IC card...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      cardId: parseInt(cardId),
      deleteType: parseInt(deleteType),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete IC Card API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/identityCard/delete`);
    console.log('');
    console.log('Deletion Details:');
    console.log('   Lock ID:', lockId);
    console.log('   Card ID:', cardId);
    console.log('   Delete Method:', getDeleteTypeText(parseInt(deleteType)));
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/delete`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Delete IC card failed');
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
        console.error('   You do not have permission to delete IC cards from this lock.');
      } else if (response.data.errcode === -3005) {
        console.error('ℹ️  Error -3005: Card not found');
        console.error('   The card ID does not exist for this lock.');
        console.error('');
        console.error('To find valid card IDs, run:');
        console.error(`   node test-ic-card-list.js ${username} [password] ${lockId}`);
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can delete IC cards.');
      }
      console.error('');
      console.error('To find valid lock IDs and card IDs, run:');
      console.error('   node test-ic-card-list.js');
      return;
    }

    console.log('✅ SUCCESS! IC card deleted');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    console.log('🗑️  IC CARD DELETED SUCCESSFULLY!');
    console.log('   Lock ID:', lockId);
    console.log('   Card ID:', cardId);
    console.log('   Deleted at:', new Date().toISOString());
    console.log('   Delete Method:', getDeleteTypeText(parseInt(deleteType)));
    console.log('');
    console.log('⚠️  DELETION CONSEQUENCES:');
    console.log('   ❌ Card has been permanently removed from lock');
    console.log('   ❌ Physical card will NO LONGER unlock the door');
    console.log('   ❌ Card data removed from TTLock cloud');
    console.log('   ❌ This action CANNOT be undone');
    console.log('');
    console.log('✅ What happened:');
    console.log('   - Card removed from lock\'s memory');
    console.log('   - Card registration deleted from cloud');
    console.log('   - Card will be rejected if presented to lock');
    console.log('   - Physical card itself is unchanged (can be re-added)');
    console.log('');

    if (parseInt(deleteType) === 1) {
      console.log('📱 Bluetooth Method Notes:');
      console.log('   - Card was deleted via SDK first');
      console.log('   - Cloud deletion is now complete');
      console.log('   - Card is fully removed from system');
    } else if (parseInt(deleteType) === 2) {
      console.log('🌐 Gateway Method Notes:');
      console.log('   - Card deleted directly via gateway');
      console.log('   - Gateway removed card from lock');
      console.log('   - Cloud deletion is complete');
      console.log('   - Changes should be immediate');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Verify card list no longer shows this card:');
    console.log(`      node test-ic-card-list.js ${username} [password] ${lockId}`);
    console.log('   2. Test that physical card no longer works on lock');
    console.log('   3. Inform card holder that card is deactivated');
    console.log('');
    console.log('To re-add this card:');
    console.log('   - Card must be added again from scratch');
    console.log('   - Use: node test-ic-card-add.js');
    console.log('   - Will get a new card ID');
    console.log('   - Can set new validity period');

  } catch (error) {
    console.error('❌ FAILED! Delete IC card error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3005) {
        console.error('ℹ️  Error -3005: Card not found');
        console.error('   The card ID does not exist for this lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testDeleteICCard();
