import { supabase } from '../services/supabase.js';
import axios from 'axios';
import { decrypt } from '../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Passcode Types (TTLock Cloud API)
 * 1 = One-time (valid once within 6 hours from start time)
 * 2 = Permanent (must be used at least once within 24 hours)
 * 3 = Period/Timed (valid during specified period)
 * 4 = Delete (deletes all other codes - DANGEROUS)
 * 5 = Weekend Cyclic
 * 6 = Daily Cyclic
 * 7 = Workday Cyclic
 * 8-14 = Day-specific Cyclic (Mon-Sun)
 */
const PASSCODE_TYPES = {
  ONE_TIME: 1,
  PERMANENT: 2,
  TIMED: 3,
  DELETE: 4,
  WEEKEND_CYCLIC: 5,
  DAILY_CYCLIC: 6,
  WORKDAY_CYCLIC: 7
};

/**
 * Get user's TTLock access token
 */
const getUserAccessToken = async (userId) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('ttlock_access_token, ttlock_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !user || !user.ttlock_access_token) {
    throw new Error('TTLock account not connected');
  }

  const expiresAt = new Date(user.ttlock_token_expires_at);
  if (expiresAt <= new Date()) {
    throw new Error('Access token expired');
  }

  const accessToken = decrypt(user.ttlock_access_token);
  if (!accessToken) {
    throw new Error('Failed to decrypt access token');
  }

  return accessToken;
};

/**
 * Get TTLock lock ID from our database lock ID
 */
const getTTLockId = async (lockId) => {
  const { data: lock, error } = await supabase
    .from('locks')
    .select('device_id, ttlock_lock_id, has_gateway, ttlock_data, ttlock_mac, mac_address')
    .eq('id', lockId)
    .single();

  if (error || !lock) {
    console.error(`[getTTLockId] Lock not found:`, { lockId, error: error?.message });
    throw new Error('Lock not found');
  }

  console.log(`[getTTLockId] Lock data:`, {
    lockId,
    device_id: lock.device_id,
    ttlock_lock_id: lock.ttlock_lock_id,
    has_ttlock_data: !!lock.ttlock_data,
    ttlock_mac: lock.ttlock_mac,
    mac_address: lock.mac_address
  });

  let ttlockLockId = lock.ttlock_lock_id;
  
  // Try to extract from device_id (format: "ttlock_12345" or "ttlock_bt_XX:XX:XX:XX:XX:XX")
  if (!ttlockLockId && lock.device_id) {
    if (lock.device_id.startsWith('ttlock_')) {
      const parts = lock.device_id.replace('ttlock_', '').split('_');
      // If format is "ttlock_12345", extract the number
      if (parts[0] && !isNaN(parseInt(parts[0]))) {
        ttlockLockId = parseInt(parts[0]);
        console.log(`📋 Extracted TTLock lock ID ${ttlockLockId} from device_id: ${lock.device_id}`);
      }
    }
  }
  
  // Try to extract from ttlock_data (Bluetooth pairing data)
  if (!ttlockLockId && lock.ttlock_data) {
    try {
      const lockData = typeof lock.ttlock_data === 'string' 
        ? JSON.parse(lock.ttlock_data) 
        : lock.ttlock_data;
      
      console.log(`[getTTLockId] Parsed lockData:`, {
        hasLockId: !!lockData?.lockId,
        lockId: lockData?.lockId,
        keys: Object.keys(lockData || {})
      });
      
      if (lockData && lockData.lockId) {
        ttlockLockId = parseInt(lockData.lockId);
        console.log(`📋 Extracted TTLock lock ID ${ttlockLockId} from Bluetooth lockData`);
      }
    } catch (e) {
      console.warn('[getTTLockId] Failed to parse ttlock_data:', e.message);
      // Try to see if it's a string representation of a number
      if (typeof lock.ttlock_data === 'string' && !isNaN(parseInt(lock.ttlock_data))) {
        ttlockLockId = parseInt(lock.ttlock_data);
        console.log(`📋 Extracted TTLock lock ID ${ttlockLockId} from ttlock_data string`);
      }
    }
  }

  // If we found the lock ID from lockData but it's not stored in ttlock_lock_id, update it
  if (ttlockLockId && !lock.ttlock_lock_id) {
    console.log(`[getTTLockId] 🔄 Updating lock record with TTLock lock ID ${ttlockLockId}...`);
    try {
      await supabase
        .from('locks')
        .update({ ttlock_lock_id: ttlockLockId })
        .eq('id', lockId);
      console.log(`[getTTLockId] ✅ Lock record updated with TTLock lock ID`);
    } catch (updateError) {
      console.warn(`[getTTLockId] ⚠️ Failed to update lock record:`, updateError.message);
      // Continue anyway - we have the lock ID to use
    }
  }

  // If still no lock ID, check if we can query TTLock API by MAC address
  // (This would require additional API call, but let's log what we have first)
  if (!ttlockLockId) {
    console.error(`[getTTLockId] ❌ No TTLock lock ID found for lock ${lockId}`, {
      device_id: lock.device_id,
      ttlock_lock_id: lock.ttlock_lock_id,
      has_ttlock_data: !!lock.ttlock_data,
      ttlock_mac: lock.ttlock_mac,
      mac_address: lock.mac_address
    });
    throw new Error('Lock not linked to TTLock Cloud. Please ensure the lock is properly paired and has a TTLock lock ID. The lock may need to be re-paired or synced with TTLock Cloud. If you can control the lock via Bluetooth, try syncing the lock data from Settings.');
  }

  console.log(`[getTTLockId] ✅ Found TTLock lock ID: ${ttlockLockId} for lock ${lockId}`);
  return { ttlockLockId, hasGateway: lock.has_gateway || false };
};

/**
 * Create Passcode via TTLock Cloud API
 * POST /api/locks/:lockId/passcodes/cloud
 *
 * Supports one-time, permanent, and timed passcodes
 * Requires lock to be connected to a gateway for remote creation
 */
export const createCloudPasscode = async (req, res) => {
  try {
    const { lockId } = req.params;
    const {
      passcode,
      type = 'one_time',  // 'one_time', 'permanent', 'timed'
      name,
      startDate,  // Optional: timestamp in ms
      endDate,    // Required for 'timed' type
      validHours, // Alternative to endDate for 'timed' type
      useBluetooth = false // If true, passcode will be synced via Bluetooth (addType=1) instead of gateway (addType=2)
    } = req.body;
    const userId = req.user.id;

    console.log(`🔑 Creating Cloud passcode for lock ${lockId}, type: ${type}`);

    // Validate passcode format (4-9 digits)
    if (!passcode || !/^\d{4,9}$/.test(passcode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSCODE',
          message: 'Passcode must be 4-9 digits'
        }
      });
    }

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: tokenError.message
        }
      });
    }

    // Get TTLock lock ID
    let ttlockLockId, hasGateway;
    try {
      const lockInfo = await getTTLockId(lockId);
      ttlockLockId = lockInfo.ttlockLockId;
      hasGateway = lockInfo.hasGateway;
    } catch (lockError) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_ERROR',
          message: lockError.message
        }
      });
    }

    // Note: Gateway is NOT required for one-time passcodes
    // One-time passcodes can be generated via API and then synced via Bluetooth (addType=1)
    // Gateway is only needed for remote cloud sync (addType=2)
    // For one-time passcodes without gateway, we generate the passcode and return it for Bluetooth sync

    // Determine passcode type and dates
    let keyboardPwdType;
    let start = startDate || Date.now();
    let end;

    switch (type) {
      case 'one_time':
        keyboardPwdType = PASSCODE_TYPES.ONE_TIME;
        // One-time codes are valid for 6 hours from start
        // IMPORTANT: According to TTLock API docs, valid time should be defined in HOUR
        // with minute and second set to 0. Round start time to nearest hour.
        const startDateObj = new Date(start);
        startDateObj.setMinutes(0);
        startDateObj.setSeconds(0);
        startDateObj.setMilliseconds(0);
        start = startDateObj.getTime();
        
        // End time is 6 hours later, also rounded to hour
        end = start + (6 * 60 * 60 * 1000);
        const endDateObj = new Date(end);
        endDateObj.setMinutes(0);
        endDateObj.setSeconds(0);
        endDateObj.setMilliseconds(0);
        end = endDateObj.getTime();
        break;

      case 'permanent':
        keyboardPwdType = PASSCODE_TYPES.PERMANENT;
        // Permanent codes need an end date far in the future
        end = start + (10 * 365 * 24 * 60 * 60 * 1000); // 10 years
        break;

      case 'timed':
        keyboardPwdType = PASSCODE_TYPES.TIMED;
        if (endDate) {
          end = endDate;
        } else if (validHours) {
          end = start + (validHours * 60 * 60 * 1000);
        } else {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_END_DATE',
              message: 'Timed passcode requires endDate or validHours'
            }
          });
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Type must be one_time, permanent, or timed'
          }
        });
    }

    // Call TTLock Cloud API to create passcode
    let response;
    let generatedPasscode = passcode;

    if (type === 'one_time') {
      // For TRUE one-time passcodes, use /v3/keyboardPwd/get endpoint
      // This endpoint GENERATES a passcode with type 1 (one-time)
      console.log(`📡 Calling TTLock API: keyboardPwd/get (one-time) for lock ${ttlockLockId}`);

      const params = {
        clientId: TTLOCK_CLIENT_ID,
        accessToken: accessToken,
        lockId: ttlockLockId,
        keyboardPwdVersion: 4,  // V4 passcode version
        keyboardPwdType: 1,     // 1 = One-time passcode (valid for once within 6 hours)
        keyboardPwdName: name || 'One-time code',
        startDate: start,       // Start time (rounded to hour)
        endDate: end,           // End time (6 hours later, rounded to hour)
        date: Date.now()
      };

      console.log(`📋 One-time passcode parameters:`, {
        lockId: ttlockLockId,
        keyboardPwdType: 1,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        durationHours: (end - start) / (60 * 60 * 1000)
      });

      // TTLock API expects form-urlencoded or query params
      // Using query params (same format as other TTLock API calls)
      console.log(`📤 Sending request to TTLock API with params:`, {
        lockId: ttlockLockId,
        keyboardPwdType: 1,
        keyboardPwdVersion: 4,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString()
      });

      response = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/get`,
        null,
        { params }
      );

      console.log(`📥 TTLock API response:`, {
        errcode: response.data?.errcode,
        errmsg: response.data?.errmsg,
        keyboardPwd: response.data?.keyboardPwd ? '***' : null,
        keyboardPwdId: response.data?.keyboardPwdId
      });

      // Check for errors first
      if (response.data.errcode && response.data.errcode !== 0) {
        console.error(`❌ TTLock API error creating one-time passcode:`, {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg
        });
        throw new Error(response.data.errmsg || `TTLock API error: ${response.data.errcode}`);
      }

      // The API generates the passcode - extract it from response
      if (response.data && response.data.keyboardPwd) {
        generatedPasscode = response.data.keyboardPwd;
        const keyboardPwdId = response.data.keyboardPwdId;
        console.log(`✅ TTLock generated one-time passcode: ${generatedPasscode}, ID: ${keyboardPwdId}`);
        console.log(`ℹ️  This passcode (type 1) will work ONLY ONCE within 6 hours from ${new Date(start).toISOString()}`);
      } else {
        console.error(`❌ TTLock API did not return passcode in response:`, response.data);
        throw new Error('TTLock API did not return a passcode');
      }
    } else {
      // For custom passcodes (permanent/timed), use /v3/keyboardPwd/add endpoint
      console.log(`📡 Calling TTLock API: keyboardPwd/add for lock ${ttlockLockId}`);

        // Determine addType: 1 = Bluetooth, 2 = Gateway
        // If useBluetooth is true OR no gateway, use Bluetooth (addType=1)
        // Otherwise, use Gateway (addType=2) for remote sync
        const addType = (useBluetooth || !hasGateway) ? 1 : 2;
        
        console.log(`📋 Using addType: ${addType} (${addType === 1 ? 'Bluetooth' : 'Gateway'})`);

        const params = {
          clientId: TTLOCK_CLIENT_ID,
          accessToken: accessToken,
          lockId: ttlockLockId,
          keyboardPwd: passcode,
          keyboardPwdName: name || `${type} code`,
          startDate: start,
          endDate: end,
          addType: addType,  // 1 = Bluetooth, 2 = Gateway
          date: Date.now()
        };

      response = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/add`,
        null,
        { params }
      );

      // Check for errors for non-one-time passcodes
      if (response.data.errcode && response.data.errcode !== 0) {
        console.error('❌ TTLock API error:', response.data);

        let errorMessage = response.data.errmsg || response.data.description || 'Failed to create passcode';

        // Handle specific error codes
        switch (response.data.errcode) {
          case -3:
            errorMessage = 'Lock not connected to gateway or gateway offline';
            break;
          case -2019:
            errorMessage = 'Passcode already exists on this lock';
            break;
          case -2007:
            errorMessage = 'Lock not paired with gateway';
            break;
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'TTLOCK_ERROR',
            message: errorMessage,
            ttlock_errcode: response.data.errcode
          }
        });
      }
    }

    // For one-time passcodes, errors are already handled above
    // This check is only for non-one-time passcodes (already handled in else block)
    // But we keep it here as a safety net
    if (type !== 'one_time' && response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock API error:', response.data);

      let errorMessage = response.data.errmsg || response.data.description || 'Failed to create passcode';

      // Handle specific error codes
      switch (response.data.errcode) {
        case -3:
          errorMessage = 'Lock not connected to gateway or gateway offline';
          break;
        case -2019:
          errorMessage = 'Passcode already exists on this lock';
          break;
        case -2007:
          errorMessage = 'Lock not paired with gateway';
          break;
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_ERROR',
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const keyboardPwdId = response.data.keyboardPwdId;
    
    if (!keyboardPwdId) {
      console.warn('⚠️ TTLock API did not return passcode ID');
    }
    
    console.log(`✅ Passcode created successfully, ID: ${keyboardPwdId}, Code: ${generatedPasscode}`);
    
    if (type === 'one_time') {
      console.log(`🔐 IMPORTANT: One-time passcode (type 1) created successfully.`);
      console.log(`   - This passcode will work ONLY ONCE within 6 hours`);
      console.log(`   - Start time: ${new Date(start).toISOString()}`);
      console.log(`   - End time: ${new Date(end).toISOString()}`);
      console.log(`   - After first successful unlock, it will be automatically invalidated by TTLock`);
    }

    // Store passcode in our database for tracking
    const { data: savedPasscode, error: saveError } = await supabase
      .from('passcodes')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        passcode: generatedPasscode,  // Use generated passcode for one-time codes
        name: name || `${type} code`,
        type: type,
        ttlock_pwd_id: keyboardPwdId,
        start_date: new Date(start).toISOString(),
        end_date: new Date(end).toISOString(),
        is_active: true,
        created_via: 'cloud_api'
      }])
      .select()
      .single();

    if (saveError) {
      console.warn('⚠️ Failed to save passcode to database:', saveError);
      // Don't fail - passcode was created on lock
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        action: 'passcode_created',
        access_method: 'cloud_api',
        metadata: {
          passcode_type: type,
          ttlock_pwd_id: keyboardPwdId,
          created_via: useBluetooth || !hasGateway ? 'bluetooth' : 'gateway',
          sync_method: useBluetooth || !hasGateway ? 'bluetooth' : 'gateway'
        }
      }]);

    // Calculate expiration info for one-time codes
    let expirationInfo = null;
    if (type === 'one_time') {
      const now = new Date();
      const expiry = new Date(end);
      const diff = expiry - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      expirationInfo = {
        expires_in_hours: hours,
        expires_in_minutes: minutes,
        expires_in_text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        is_one_time: true
      };
    }

    res.status(201).json({
      success: true,
      data: {
        id: savedPasscode?.id,
        passcode: generatedPasscode,  // Return the actual passcode (generated for one-time)
        type: type,
        name: name || `${type} code`,
        start_date: new Date(start).toISOString(),
        end_date: new Date(end).toISOString(),
        ttlock_pwd_id: keyboardPwdId,
        created_via: 'cloud_api',
        expiration_info: expirationInfo,
        message: type === 'one_time'
          ? 'One-time code created. This code works ONLY ONCE within 6 hours from start time. After first use, it will be automatically invalidated.'
          : type === 'permanent'
          ? 'Permanent code created. Must be used once within 24 hours to activate.'
          : `Timed code created. Valid until ${new Date(end).toLocaleString()}.`
      }
    });

  } catch (error) {
    console.error('❌ Create cloud passcode error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create passcode',
        details: error.message
      }
    });
  }
};

/**
 * Get Passcodes from TTLock Cloud
 * GET /api/locks/:lockId/passcodes/cloud
 */
export const getCloudPasscodes = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    console.log(`📋 Getting Cloud passcodes for lock ${lockId}`);

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: tokenError.message
        }
      });
    }

    // Get TTLock lock ID
    let ttlockLockId;
    try {
      const lockInfo = await getTTLockId(lockId);
      ttlockLockId = lockInfo.ttlockLockId;
    } catch (lockError) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_ERROR',
          message: lockError.message
        }
      });
    }

    // Call TTLock API to get passcodes
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: ttlockLockId,
      pageNo: 1,
      pageSize: 100,
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/listKeyboardPwd`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock API error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_ERROR',
          message: response.data.errmsg || 'Failed to fetch passcodes',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const passcodes = response.data.list || [];

    // Map passcode types to readable names
    const typeNames = {
      1: 'one_time',
      2: 'permanent',
      3: 'timed',
      4: 'delete',
      5: 'weekend_cyclic',
      6: 'daily_cyclic',
      7: 'workday_cyclic'
    };

    const mappedPasscodes = passcodes.map(pwd => ({
      id: pwd.keyboardPwdId,
      passcode: pwd.keyboardPwd,
      name: pwd.keyboardPwdName,
      type: typeNames[pwd.keyboardPwdType] || `type_${pwd.keyboardPwdType}`,
      start_date: pwd.startDate ? new Date(pwd.startDate).toISOString() : null,
      end_date: pwd.endDate ? new Date(pwd.endDate).toISOString() : null,
      is_expired: pwd.endDate && pwd.endDate < Date.now(),
      send_date: pwd.sendDate ? new Date(pwd.sendDate).toISOString() : null
    }));

    res.json({
      success: true,
      data: mappedPasscodes
    });

  } catch (error) {
    console.error('❌ Get cloud passcodes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch passcodes',
        details: error.message
      }
    });
  }
};

/**
 * Delete Passcode via TTLock Cloud
 * DELETE /api/locks/:lockId/passcodes/cloud/:passcodeId
 */
export const deleteCloudPasscode = async (req, res) => {
  try {
    const { lockId, passcodeId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Deleting Cloud passcode ${passcodeId} from lock ${lockId}`);

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: tokenError.message
        }
      });
    }

    // Get TTLock lock ID
    let ttlockLockId;
    try {
      const lockInfo = await getTTLockId(lockId);
      ttlockLockId = lockInfo.ttlockLockId;
    } catch (lockError) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_ERROR',
          message: lockError.message
        }
      });
    }

    // Call TTLock API to delete passcode
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: ttlockLockId,
      keyboardPwdId: passcodeId,
      deleteType: 2,  // 2 = Gateway
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/keyboardPwd/delete`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock API error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_ERROR',
          message: response.data.errmsg || 'Failed to delete passcode',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log(`✅ Passcode ${passcodeId} deleted successfully`);

    // Delete from our database
    await supabase
      .from('passcodes')
      .delete()
      .eq('ttlock_pwd_id', passcodeId);

    // Log activity
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        action: 'passcode_deleted',
        access_method: 'cloud_api',
        metadata: {
          ttlock_pwd_id: passcodeId,
          deleted_via: 'gateway'
        }
      }]);

    res.json({
      success: true,
      message: 'Passcode deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete cloud passcode error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete passcode',
        details: error.message
      }
    });
  }
};
