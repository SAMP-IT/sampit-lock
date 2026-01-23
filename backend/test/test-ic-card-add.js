import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('➕ Testing TTLock Add IC Card API');
console.log('=================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const cardNumber = process.argv[5]; // Card number is required
const cardName = process.argv[6]; // Optional
const addType = process.argv[7] || '2'; // Default to gateway (direct add)

if (!lockId || !cardNumber) {
  console.log('⚠️  USAGE:');
  console.log('   node test-ic-card-add.js [username] [password] <lockId> <cardNumber> [cardName] [addType]');
  console.log('');
  console.log('Example:');
  console.log('   node test-ic-card-add.js tusharvaishnavtv@gmail.com Tushar@900 7296935 "1234567890" "Office Card" 2');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId     - Lock ID (required)');
  console.log('   cardNumber - IC card number (required)');
  console.log('   cardName   - IC card name (optional)');
  console.log('   addType    - Adding method (optional, default: 2)');
  console.log('');
  console.log('To get a lockId, first run:');
  console.log('   node test-lock-list.js');
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   1. This API adds an IC card to a lock');
  console.log('   2. Must be called AFTER SDK method for bluetooth (addType=1)');
  console.log('   3. Can be called DIRECTLY for gateway (addType=2)');
  console.log('   4. Card number must be unique for the lock');
  console.log('   5. You must be the lock admin to add IC cards');
  console.log('');
  console.log('Add Type Values:');
  console.log('   1 - Phone Bluetooth (must call SDK method first)');
  console.log('   2 - Gateway (can add directly via API) ← Recommended for testing');
  console.log('   3 - NB-IoT');
  console.log('');
  console.log('What is an IC Card:');
  console.log('   - Physical RFID/NFC card used to unlock doors');
  console.log('   - Stores unique card number');
  console.log('   - Can have validity period (start/end dates)');
  console.log('   - Managed through TTLock system');
  console.log('');
  console.log('Workflow for adding IC card:');
  console.log('   [Bluetooth Method - addType=1]');
  console.log('   1. Use TTLock mobile SDK to scan/add physical card');
  console.log('   2. SDK returns card number');
  console.log('   3. Call this API to register card in cloud');
  console.log('');
  console.log('   [Gateway Method - addType=2]');
  console.log('   1. Call this API directly with card number');
  console.log('   2. Gateway handles card programming');
  console.log('   3. Card is registered in cloud immediately');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Card Number:', cardNumber);
if (cardName) console.log('Card Name:', cardName);
console.log('Add Type:', addType, '(' + getAddTypeText(parseInt(addType)) + ')');
console.log('');

// Helper function
function getAddTypeText(type) {
  const typeMap = {
    1: 'Phone Bluetooth - SDK required first',
    2: 'Gateway - Direct add',
    3: 'NB-IoT'
  };
  return typeMap[type] || 'Unknown';
}

async function testAddICCard() {
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

    // Step 2: Add IC card
    console.log('Step 2: Adding IC card...');
    console.log('');

    // Set validity period: valid for 1 year from now
    const now = Date.now();
    const oneYearLater = now + (365 * 24 * 60 * 60 * 1000);

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      cardNumber: cardNumber,
      startDate: now,
      endDate: oneYearLater,
      addType: parseInt(addType),
      date: Date.now()
    };

    // Add optional card name
    if (cardName) {
      params.cardName = cardName;
    }

    console.log('📡 Calling TTLock Add IC Card API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/identityCard/addForReversedCardNumber`);
    console.log('');
    console.log('Card Details:');
    console.log('   Card Number:', cardNumber);
    if (cardName) console.log('   Card Name:', cardName);
    console.log('   Valid From:', new Date(now).toISOString());
    console.log('   Valid Until:', new Date(oneYearLater).toISOString());
    console.log('   Add Method:', getAddTypeText(parseInt(addType)));
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/identityCard/addForReversedCardNumber`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Add IC card failed');
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
        console.error('   You do not have permission to add IC cards to this lock.');
      } else if (response.data.errcode === -3006) {
        console.error('ℹ️  Error -3006: Card number already exists');
        console.error('   This card number is already registered to the lock.');
        console.error('');
        console.error('To resolve:');
        console.error('   - Use a different card number');
        console.error('   - Or delete the existing card first');
        console.error('   - Check existing cards with: node test-ic-card-list.js');
      } else if (response.data.errcode === 20002) {
        console.error('ℹ️  Error 20002: Not lock admin');
        console.error('   You do not have admin access to this lock.');
        console.error('   Only the lock admin can add IC cards.');
      } else if (response.data.errcode === 90000) {
        console.error('ℹ️  Error 90000: Internal server error');
        console.error('');
        console.error('Possible reasons:');
        console.error('   - Lock does not support IC card feature');
        console.error('   - Card number format is invalid');
        console.error('   - Lock is not properly configured for IC cards');
        console.error('   - Gateway is not connected or offline');
        console.error('');
        console.error('To resolve:');
        console.error('   - Verify lock supports IC card feature');
        console.error('   - Check card number format (should be numeric)');
        console.error('   - Ensure lock has IC card reader hardware');
        console.error('   - For gateway method, verify gateway is online');
        console.error('   - Try using Sciener APP to add card manually');
      }
      console.error('');
      console.error('To find valid lock IDs, run:');
      console.error('   node test-lock-list.js');
      return;
    }

    console.log('✅ SUCCESS! IC card added');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { cardId } = response.data;

    console.log('➕ IC CARD ADDED SUCCESSFULLY!');
    console.log('   Card ID:', cardId);
    console.log('   Lock ID:', lockId);
    console.log('   Card Number:', cardNumber);
    if (cardName) console.log('   Card Name:', cardName);
    console.log('   Valid Period: 1 year');
    console.log('   Added at:', new Date().toISOString());
    console.log('   Add Method:', getAddTypeText(parseInt(addType)));
    console.log('');
    console.log('✅ What this means:');
    console.log('   - IC card has been registered to the lock');
    console.log('   - Card can be used to unlock the door');
    console.log('   - Card is valid for 1 year from now');
    console.log('   - Card info stored in TTLock cloud');
    console.log('');

    if (parseInt(addType) === 1) {
      console.log('📱 Bluetooth Method Notes:');
      console.log('   - Card was added via SDK first');
      console.log('   - Cloud registration is now complete');
      console.log('   - Card should work immediately');
    } else if (parseInt(addType) === 2) {
      console.log('🌐 Gateway Method Notes:');
      console.log('   - Card added directly via gateway');
      console.log('   - Gateway will program the card');
      console.log('   - May take a moment to sync with lock');
    }

    console.log('');
    console.log('Next steps:');
    console.log('   1. Test the card on the physical lock');
    console.log('   2. Verify card appears in card list:');
    console.log(`      node test-ic-card-list.js ${username} [password] ${lockId}`);
    console.log('   3. Monitor card status (should show as "Normal")');
    console.log('   4. Update card details if needed');
    console.log('');
    console.log('To manage this card:');
    console.log('   - View in Sciener APP under lock settings');
    console.log('   - Modify validity period as needed');
    console.log('   - Delete card when no longer needed');
    console.log('   - Share card access with other users');

  } catch (error) {
    console.error('❌ FAILED! Add IC card error');
    console.error('');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('');

      // Check for common errors
      if (error.response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (error.response.data.errcode === -3006) {
        console.error('ℹ️  Error -3006: Card number already exists');
        console.error('   This card is already registered to the lock.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testAddICCard();
