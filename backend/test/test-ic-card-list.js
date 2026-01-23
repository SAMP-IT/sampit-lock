import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('📇 Testing TTLock Get IC Card List API');
console.log('=====================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const pageNo = process.argv[5] || '1'; // Default to page 1
const pageSize = process.argv[6] || '20'; // Default to 20 items per page

if (!lockId) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ic-card-list.js [username] [password] <lockId> [pageNo] [pageSize]');
  console.log('');
  console.log('Example:');
  console.log('   node test-ic-card-list.js tusharvaishnavtv@gmail.com Tushar@900 7296935 1 20');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId   - Lock ID (required)');
  console.log('   pageNo   - Page number, starts from 1 (optional, default: 1)');
  console.log('   pageSize - Items per page, max 100 (optional, default: 20)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API returns all IC cards associated with a lock');
  console.log('   2. Results are paginated for better performance');
  console.log('   3. Shows card status, validity period, and sender info');
  console.log('   4. Maximum page size is 100 items');
  console.log('');
  console.log('Card Status Values:');
  console.log('   1 - Normal (card is active and valid)');
  console.log('   2 - Invalid or Expired (card cannot be used)');
  console.log('   3 - Pending (operation in queue)');
  console.log('   4 - Adding (card being added to lock)');
  console.log('   5 - Add Failed (failed to add card)');
  console.log('   6 - Modifying (card being updated)');
  console.log('   7 - Modify Failed (failed to update card)');
  console.log('   8 - Deleting (card being removed)');
  console.log('   9 - Delete Failed (failed to remove card)');
  console.log('');
  console.log('What are IC Cards:');
  console.log('   - Physical RFID/NFC cards used to unlock doors');
  console.log('   - Can be programmed with validity periods');
  console.log('   - Managed through TTLock system');
  console.log('   - Each card has unique number and name');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Page Number:', pageNo);
console.log('Page Size:', pageSize);
console.log('');

async function testGetICCardList() {
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

    // Step 2: Get IC card list
    console.log('Step 2: Getting IC card list...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get IC Card List API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/identityCard/list`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/list`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get IC card list failed');
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
        console.error('   You do not have permission to view IC cards for this lock.');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! IC card list retrieved');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { list = [], pages = 0, total = 0 } = response.data;

    console.log('📇 IC CARD LIST:');
    console.log('   Lock ID:', lockId);
    console.log('   Page:', pageNo, 'of', pages);
    console.log('   Showing:', list.length, 'cards');
    console.log('   Total Cards:', total);
    console.log('');

    if (list.length === 0) {
      console.log('ℹ️  No IC cards found for this lock');
      console.log('');
      console.log('This means:');
      console.log('   - No IC cards have been added to this lock');
      console.log('   - The lock has not been configured with card access');
      console.log('');
      console.log('To add IC cards:');
      console.log('   1. Use the Sciener APP');
      console.log('   2. Navigate to lock settings');
      console.log('   3. Add new IC card via NFC/RFID');
      console.log('   4. Configure card validity period');
      console.log('   5. Assign card to users as needed');
    } else {
      console.log('📇 Card Details:');
      console.log('');

      // Group cards by status
      const normalCards = list.filter(c => c.status === 1);
      const expiredCards = list.filter(c => c.status === 2);
      const pendingCards = list.filter(c => [3, 4, 6, 8].includes(c.status));
      const failedCards = list.filter(c => [5, 7, 9].includes(c.status));

      list.forEach((card, index) => {
        const statusEmoji = getStatusEmoji(card.status);
        const now = Date.now();
        const isValidPeriod = card.startDate <= now && card.endDate >= now;

        console.log(`Card ${index + 1}: ${statusEmoji}`);
        console.log(`   Card ID: ${card.cardId}`);
        console.log(`   Card Number: ${card.cardNumber}`);
        console.log(`   Card Name: ${card.cardName || 'N/A'}`);
        console.log(`   Status: ${getStatusText(card.status)} (${card.status})`);
        console.log(`   Valid Period:`);
        console.log(`      From: ${new Date(card.startDate).toISOString()}`);
        console.log(`      To:   ${new Date(card.endDate).toISOString()}`);
        console.log(`   Currently Valid: ${isValidPeriod ? 'Yes ✅' : 'No ❌'}`);
        console.log(`   Created: ${new Date(card.createDate).toISOString()}`);
        if (card.senderUsername) {
          console.log(`   Sender: ${card.senderUsername}`);
        }
        console.log('');
      });

      // Summary statistics
      console.log('📊 Card Statistics:');
      console.log(`   ✅ Normal: ${normalCards.length}`);
      console.log(`   ❌ Expired/Invalid: ${expiredCards.length}`);
      console.log(`   ⏳ Pending Operations: ${pendingCards.length}`);
      console.log(`   ⚠️  Failed Operations: ${failedCards.length}`);
      console.log('');

      if (failedCards.length > 0) {
        console.log('⚠️  Cards with Failed Operations:');
        failedCards.forEach(card => {
          console.log(`   - ${card.cardName || card.cardNumber}: ${getStatusText(card.status)}`);
        });
        console.log('');
        console.log('Action required:');
        console.log('   - Retry failed operations via Sciener APP');
        console.log('   - Check card reader functionality');
        console.log('   - Verify lock connectivity');
      }

      if (expiredCards.length > 0) {
        console.log('⚠️  Expired/Invalid Cards:');
        expiredCards.forEach(card => {
          console.log(`   - ${card.cardName || card.cardNumber}`);
        });
        console.log('');
        console.log('To renew cards:');
        console.log('   - Update validity period via Sciener APP');
        console.log('   - Or delete and re-add the card');
      }

      // Pagination info
      if (pages > 1) {
        console.log('📄 Pagination:');
        console.log(`   Current Page: ${pageNo}`);
        console.log(`   Total Pages: ${pages}`);
        console.log(`   Has Next Page: ${parseInt(pageNo) < pages ? 'Yes' : 'No'}`);
        console.log(`   Has Previous Page: ${parseInt(pageNo) > 1 ? 'Yes' : 'No'}`);
        console.log('');

        if (parseInt(pageNo) < pages) {
          console.log('To view next page:');
          console.log(`   node test-ic-card-list.js ${username} [password] ${lockId} ${parseInt(pageNo) + 1} ${pageSize}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ FAILED! Get IC card list error');
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

/**
 * Get status text from status code
 */
function getStatusText(status) {
  const statusMap = {
    1: 'Normal',
    2: 'Invalid or Expired',
    3: 'Pending',
    4: 'Adding',
    5: 'Add Failed',
    6: 'Modifying',
    7: 'Modify Failed',
    8: 'Deleting',
    9: 'Delete Failed'
  };
  return statusMap[status] || 'Unknown';
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status) {
  const emojiMap = {
    1: '✅',
    2: '❌',
    3: '⏳',
    4: '➕',
    5: '⚠️',
    6: '✏️',
    7: '⚠️',
    8: '🗑️',
    9: '⚠️'
  };
  return emojiMap[status] || '❓';
}

// Run the test
testGetICCardList();
