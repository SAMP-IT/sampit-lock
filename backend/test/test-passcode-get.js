import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

console.log('🔢 Testing TTLock Get Passcode API');
console.log('===================================');
console.log('');

// Get credentials from command line or use defaults
const username = process.argv[2] || 'tusharvaishnavtv@gmail.com';
const password = process.argv[3] || 'Tushar@900';
const lockId = process.argv[4]; // Lock ID is required
const passcodeType = process.argv[5]; // Passcode type is required

if (!lockId || !passcodeType) {
  console.log('⚠️  USAGE:');
  console.log('   node test-passcode-get.js [username] [password] <lockId> <passcodeType>');
  console.log('');
  console.log('Example:');
  console.log('   node test-passcode-get.js tusharvaishnavtv@gmail.com Tushar@900 20749172 2');
  console.log('');
  console.log('Parameters:');
  console.log('   lockId       - ID of the lock to create passcode for (required)');
  console.log('   passcodeType - Type of passcode (1-14) (required)');
  console.log('');
  console.log('To get lockId:');
  console.log('   - List all your locks:');
  console.log('     node test-lock-list.js');
  console.log('');
  console.log('What this API does:');
  console.log('   - Creates/retrieves a passcode for a lock');
  console.log('   - Returns the actual passcode and passcode ID');
  console.log('   - Passcode can be shared with users to unlock the lock');
  console.log('   - Different types for different use cases');
  console.log('');
  console.log('📊 PASSCODE TYPES:');
  console.log('');
  console.log('   Type 1: One-time');
  console.log('   - Valid for once within 6 hours from Start Time');
  console.log('   - Use case: Single delivery, one-time service');
  console.log('');
  console.log('   Type 2: Permanent');
  console.log('   - Must be used at least once within 24 hours after Start Time');
  console.log('   - Then remains valid permanently');
  console.log('   - Use case: Permanent resident or staff access');
  console.log('');
  console.log('   Type 3: Period');
  console.log('   - Must be used at least once within 24 hours after Start Time');
  console.log('   - Valid during specified time period');
  console.log('   - Use case: Guest access for specific dates');
  console.log('');
  console.log('   Type 4: Delete');
  console.log('   - Deletes ALL other codes');
  console.log('   - ⚠️  WARNING: Use with extreme caution!');
  console.log('   - Use case: Emergency reset of all passcodes');
  console.log('');
  console.log('   Type 5-14: Cyclic (Recurring)');
  console.log('   - Type 5: Weekend Cyclic');
  console.log('   - Type 6: Daily Cyclic');
  console.log('   - Type 7: Workday Cyclic');
  console.log('   - Type 8-14: Monday through Sunday Cyclic');
  console.log('   - Use case: Cleaning service every weekday, weekend guests');
  console.log('');
  console.log('Important Time Rules:');
  console.log('   - Valid time should be defined in HOUR (set minute and second to 0)');
  console.log('   - If validity period > 1 year, end time should be XX months later');
  console.log('   - Example: If start is 2025-01-15 14:00:00, use 14:00:00 not 14:23:45');
  console.log('');
  console.log('Passcode Version:');
  console.log('   - Latest locks use version 4');
  console.log('   - This script uses version 4 by default');
  console.log('');
  console.log('Important Notes:');
  console.log('   - Save the passcodeId for future deletion');
  console.log('   - One-time and Permanent/Period types have different activation rules');
  console.log('   - Delete type (4) removes ALL other passcodes - very dangerous!');
  console.log('   - Cyclic types are valid during specific recurring time periods');
  console.log('');
  process.exit(1);
}

console.log('Test Configuration:');
console.log('Username:', username);
console.log('Lock ID:', lockId);
console.log('Passcode Type:', passcodeType);
console.log('Passcode Version: 4 (default for latest locks)');
console.log('');

async function testGetPasscode() {
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

    // Step 2: Get passcode
    console.log('Step 2: Getting/creating passcode...');
    console.log('');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      keyboardPwdVersion: 4, // Version 4 for latest locks
      keyboardPwdType: parseInt(passcodeType),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Passcode API...');
    console.log('Endpoint:', `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/get`);
    console.log('');

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/get`,
      null,
      { params }
    );

    // Check for errors in response
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ Get passcode failed');
      console.error('');
      console.error('📊 Response:');
      console.error(JSON.stringify(response.data, null, 2));
      console.error('');

      if (response.data.errcode === -1) {
        console.error('ℹ️  Error -1: Invalid access token');
        console.error('   Please check your credentials.');
      } else if (response.data.errcode === -3) {
        console.error('ℹ️  Error -3: Invalid parameter');
        console.error('   Check that all required fields are valid.');
      } else if (response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   The lock ID does not exist.');
        console.error('   List existing locks:');
        console.error('     node test-lock-list.js');
      } else if (response.data.errcode === -2018) {
        console.error('ℹ️  Error -2018: Permission Denied');
        console.error('   You do not have permission to create passcodes for this lock.');
      } else if (response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Invalid passcode type');
        console.error('   Passcode type must be 1-14.');
      } else if (response.data.errcode === -3010) {
        console.error('ℹ️  Error -3010: Invalid time period');
        console.error('   Check startDate and endDate values.');
      }
      console.error('');
      return;
    }

    console.log('✅ SUCCESS! Passcode created successfully');
    console.log('');
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    const { keyboardPwd, keyboardPwdId } = response.data;

    // Map passcode type to description
    const passcodeTypeMap = {
      1: 'One-time (valid for once within 6 hours)',
      2: 'Permanent (must be used within 24 hours after start)',
      3: 'Period (must be used within 24 hours after start)',
      4: 'Delete (deletes all other codes)',
      5: 'Weekend Cyclic',
      6: 'Daily Cyclic',
      7: 'Workday Cyclic',
      8: 'Monday Cyclic',
      9: 'Tuesday Cyclic',
      10: 'Wednesday Cyclic',
      11: 'Thursday Cyclic',
      12: 'Friday Cyclic',
      13: 'Saturday Cyclic',
      14: 'Sunday Cyclic'
    };

    const typeDescription = passcodeTypeMap[passcodeType] || 'Unknown type';

    console.log('🔢 PASSCODE SUMMARY:');
    console.log('   ╔════════════════════════════════════════════╗');
    console.log('   ║  PASSCODE: ' + keyboardPwd.padEnd(32) + '║');
    console.log('   ╚════════════════════════════════════════════╝');
    console.log('');
    console.log('   Passcode ID:', keyboardPwdId);
    console.log('   Lock ID:', lockId);
    console.log('   Type:', passcodeType, '-', typeDescription);
    console.log('   Version: 4 (Latest)');
    console.log('   Created At:', new Date().toISOString());
    console.log('');

    console.log('📋 WHAT THIS PASSCODE DOES:');
    if (passcodeType == 1) {
      console.log('   - Valid for ONE UNLOCK only');
      console.log('   - Must be used within 6 hours');
      console.log('   - Perfect for one-time delivery or service');
    } else if (passcodeType == 2) {
      console.log('   - PERMANENT access code');
      console.log('   - Must be used at least once within 24 hours after creation');
      console.log('   - Then remains valid indefinitely');
      console.log('   - Perfect for permanent residents or staff');
    } else if (passcodeType == 3) {
      console.log('   - TIME-LIMITED access code');
      console.log('   - Must be used at least once within 24 hours after start');
      console.log('   - Valid during specified time period');
      console.log('   - Perfect for guest access for specific dates');
    } else if (passcodeType == 4) {
      console.log('   - ⚠️  WARNING: DELETE CODE ⚠️');
      console.log('   - This passcode DELETES ALL OTHER PASSCODES!');
      console.log('   - Use only in emergencies to reset all access');
      console.log('   - All users will lose passcode access');
    } else if (passcodeType >= 5 && passcodeType <= 14) {
      console.log('   - CYCLIC/RECURRING access code');
      console.log('   - Valid during specific time periods');
      console.log('   - Repeats on scheduled days');
      console.log('   - Perfect for cleaning service, maintenance, etc.');
    }
    console.log('');

    console.log('⚠️  IMPORTANT ACTIVATION RULES:');
    if (passcodeType == 1) {
      console.log('   - Valid IMMEDIATELY for 6 hours');
      console.log('   - Can only be used ONCE');
      console.log('   - After first use or 6 hours, becomes invalid');
    } else if (passcodeType == 2 || passcodeType == 3) {
      console.log('   - MUST BE USED AT LEAST ONCE WITHIN 24 HOURS');
      console.log('   - If not used within 24 hours, becomes INVALID');
      console.log('   - After first use within 24 hours, remains active');
    } else if (passcodeType == 4) {
      console.log('   - Using this passcode DELETES ALL OTHER PASSCODES');
      console.log('   - Cannot be undone');
      console.log('   - All users lose passcode access');
    }
    console.log('');

    console.log('📱 NEXT STEPS:');
    console.log('   1. Share the passcode with the user:');
    console.log(`      Passcode: ${keyboardPwd}`);
    console.log('');
    console.log('   2. Save the passcode ID for future deletion:');
    console.log(`      Passcode ID: ${keyboardPwdId}`);
    console.log('');
    console.log('   3. To delete this passcode later:');
    console.log(`      node test-passcode-delete.js ${username} [password] ${lockId} ${keyboardPwdId}`);
    console.log('');

    console.log('💡 USE CASES:');
    if (passcodeType == 1) {
      console.log('   - One-time delivery access');
      console.log('   - Single service appointment');
      console.log('   - Emergency one-time entry');
    } else if (passcodeType == 2) {
      console.log('   - Permanent resident access');
      console.log('   - Long-term staff member');
      console.log('   - Building manager or owner');
    } else if (passcodeType == 3) {
      console.log('   - Guest access for specific dates');
      console.log('   - Short-term rental');
      console.log('   - Temporary contractor access');
    } else if (passcodeType == 4) {
      console.log('   - Emergency reset of all passcodes');
      console.log('   - Security breach response');
      console.log('   - Complete access revocation');
    } else if (passcodeType >= 5 && passcodeType <= 14) {
      console.log('   - Recurring cleaning service');
      console.log('   - Scheduled maintenance access');
      console.log('   - Weekend guest access');
    }
    console.log('');

  } catch (error) {
    console.error('❌ FAILED! Get passcode error');
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
        console.error('   Check all required fields.');
      } else if (error.response.data.errcode === -2003) {
        console.error('ℹ️  Error -2003: Lock not found');
        console.error('   Check lock ID.');
      } else if (error.response.data.errcode === -3007) {
        console.error('ℹ️  Error -3007: Invalid passcode type');
        console.error('   Type must be 1-14.');
      }
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testGetPasscode();
