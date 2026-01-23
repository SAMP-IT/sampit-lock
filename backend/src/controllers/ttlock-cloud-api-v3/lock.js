import { supabase } from '../../services/supabase.js';
import axios from 'axios';
import { decrypt } from '../../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

// =====================================================
// HELPER FUNCTIONS (can be imported and called directly)
// =====================================================

/**
 * Set Auto Lock Time
 * Helper function to call TTLock v3/lock/setAutoLockTime API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @param {number} seconds - Auto lock delay in seconds (0 to disable)
 * @param {number} type - Operation type: 1=Bluetooth, 2=Gateway
 * @returns {Promise<Object>} API response
 */
export const setAutoLockTime = async (accessToken, lockId, seconds, type = 2) => {
  console.log(`[TTLock API] setAutoLockTime - lockId: ${lockId}, seconds: ${seconds}, type: ${type}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    seconds: parseInt(seconds),
    type: type,
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/setAutoLockTime`,
    null,
    { params }
  );

  console.log(`[TTLock API] setAutoLockTime response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to set auto lock time');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Configure Passage Mode
 * Helper function to call TTLock v3/lock/configPassageMode API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @param {number} passageMode - 1=enable, 2=disable
 * @param {number} type - Operation type: 1=Bluetooth, 2=Gateway
 * @param {Object} options - Optional parameters
 * @param {number} options.startDate - Start time in minutes from midnight (e.g., 480 = 8:00 AM)
 * @param {number} options.endDate - End time in minutes from midnight
 * @param {number} options.isAllDay - 1=all day, 2=time period
 * @param {Array<number>} options.weekDays - Array of weekdays [1-7], 1=Monday, 7=Sunday
 * @returns {Promise<Object>} API response
 */
export const configPassageMode = async (accessToken, lockId, passageMode, type = 2, options = {}) => {
  console.log(`[TTLock API] configPassageMode - lockId: ${lockId}, passageMode: ${passageMode}, type: ${type}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    passageMode: passageMode,
    type: type,
    date: Date.now()
  };

  // Add optional time period parameters
  if (options.startDate !== undefined) {
    params.startDate = options.startDate;
  }
  if (options.endDate !== undefined) {
    params.endDate = options.endDate;
  }
  if (options.isAllDay !== undefined) {
    params.isAllDay = options.isAllDay;
  }
  if (options.weekDays && Array.isArray(options.weekDays)) {
    params.weekDays = JSON.stringify(options.weekDays);
  }

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/configPassageMode`,
    null,
    { params }
  );

  console.log(`[TTLock API] configPassageMode response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to configure passage mode');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Update Lock Setting
 * Helper function to call TTLock v3/lock/updateSetting API
 * Used for various lock settings like sound, LED, etc.
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @param {number} settingType - Setting type (see TTLock docs)
 * @param {string} settingValue - Setting value
 * @returns {Promise<Object>} API response
 */
export const updateLockSetting = async (accessToken, lockId, settingType, settingValue) => {
  console.log(`[TTLock API] updateLockSetting - lockId: ${lockId}, type: ${settingType}, value: ${settingValue}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    settingType: settingType,
    settingValue: settingValue,
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/updateSetting`,
    null,
    { params }
  );

  console.log(`[TTLock API] updateLockSetting response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to update lock setting');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Query Lock Open State
 * Helper function to call TTLock v3/lock/queryOpenState API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} API response with state: 0=locked, 1=unlocked, 2=unknown
 */
export const queryOpenState = async (accessToken, lockId) => {
  console.log(`[TTLock API] queryOpenState - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/queryOpenState`,
    null,
    { params }
  );

  console.log(`[TTLock API] queryOpenState response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to query lock state');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Clear All Fingerprints
 * Helper function to call TTLock v3/fingerprint/clear API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} API response
 */
export const clearAllFingerprints = async (accessToken, lockId) => {
  console.log(`[TTLock API] clearAllFingerprints - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/fingerprint/clear`,
    null,
    { params }
  );

  console.log(`[TTLock API] clearAllFingerprints response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to clear fingerprints');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Clear All IC Cards
 * Helper function to call TTLock v3/identityCard/clear API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} API response
 */
export const clearAllICCards = async (accessToken, lockId) => {
  console.log(`[TTLock API] clearAllICCards - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/identityCard/clear`,
    null,
    { params }
  );

  console.log(`[TTLock API] clearAllICCards response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to clear IC cards');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Reset All eKeys (except admin)
 * Helper function to call TTLock v3/lock/resetKey API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} API response
 */
export const resetAllEKeys = async (accessToken, lockId) => {
  console.log(`[TTLock API] resetAllEKeys - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/resetKey`,
    null,
    { params }
  );

  console.log(`[TTLock API] resetAllEKeys response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to reset eKeys');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Delete Lock from TTLock Cloud
 * Helper function to call TTLock v3/lock/delete API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} API response
 */
export const deleteLockFromCloudHelper = async (accessToken, lockId) => {
  console.log(`[TTLock API] deleteLockFromCloud - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/delete`,
    null,
    { params }
  );

  console.log(`[TTLock API] deleteLockFromCloud response:`, response.data);

  if (response.data.errcode && response.data.errcode !== 0) {
    // errcode 10003 = Lock does not exist or no permission - treat as success
    if (response.data.errcode === 10003) {
      console.log('[TTLock API] Lock already deleted or not found in cloud');
      return { already_deleted: true };
    }
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to delete lock from cloud');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

/**
 * Get Lock Detail
 * Helper function to call TTLock v3/lock/detail API
 *
 * @param {string} accessToken - TTLock access token
 * @param {number} lockId - TTLock lock ID
 * @returns {Promise<Object>} Lock details including battery level
 */
export const getLockDetailHelper = async (accessToken, lockId) => {
  console.log(`[TTLock API] getLockDetail - lockId: ${lockId}`);

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: accessToken,
    lockId: parseInt(lockId),
    date: Date.now()
  };

  const response = await axios.post(
    `${TTLOCK_API_BASE_URL}/v3/lock/detail`,
    null,
    { params }
  );

  console.log(`[TTLock API] getLockDetail response received`);

  if (response.data.errcode && response.data.errcode !== 0) {
    const error = new Error(response.data.errmsg || response.data.description || 'Failed to get lock detail');
    error.ttlockErrcode = response.data.errcode;
    throw error;
  }

  return response.data;
};

// =====================================================
// ROUTE HANDLERS (Express middleware)
// =====================================================

/**
 * Lock Initialize
 * POST /api/ttlock-v3/lock/initialize
 *
 * @description Initialize a lock after adding it via SDK. Creates admin ekey for current user.
 * @route POST /v3/lock/initialize
 * @note If lock is already added via Sciener's APP, no need to call this - use lock/list instead
 */
export const initializeLock = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockData, lockAlias, nbInitSuccess } = req.body;

    // Validate required fields
    if (!lockData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_DATA',
          message: 'Lock data is required (generated by SDK)'
        }
      });
    }

    // Get user's TTLock access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_access_token) {
      console.log('No TTLock access token available');
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_NOT_CONNECTED',
          message: 'TTLock account not connected. Please connect your TTLock account first.'
        }
      });
    }

    // Decrypt the access token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      console.error('Failed to decrypt access token');
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_DECRYPT_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    console.log('= TTLock Lock Initialize');
    console.log('   Lock Alias:', lockAlias || 'Not provided');
    console.log('   NB-IoT Init Success:', nbInitSuccess !== undefined ? nbInitSuccess : 'N/A');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockData: lockData,
      date: Date.now()
    };

    // Add optional parameters
    if (lockAlias) {
      params.lockAlias = lockAlias;
    }

    if (nbInitSuccess !== undefined) {
      params.nbInitSuccess = nbInitSuccess;
    }

    console.log('=� Calling TTLock Lock Initialize API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/initialize`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock lock initialize error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'LOCK_INIT_FAILED',
          message: response.data.errmsg || response.data.description || 'Lock initialization failed',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { lockId, keyId } = response.data;

    if (!lockId || !keyId) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No lockId or keyId received from TTLock'
        }
      });
    }

    console.log(' Lock initialized successfully');
    console.log('   Lock ID:', lockId);
    console.log('   Admin Key ID:', keyId);

    // Save to Supabase (userId already defined at top of function)
    let savedLock = null;

    if (userId) {
      console.log('=� Saving lock to Supabase...');

      const { data: lock, error: supabaseError } = await supabase
        .from('locks')
        .insert({
          user_id: userId,
          ttlock_lock_id: lockId,
          ttlock_admin_key_id: keyId,
          location: lockAlias || null,  // Store lock alias in location field until migration is run
          is_nb_iot: nbInitSuccess !== undefined,
          created_at: new Date().toISOString()
        })
        .select('id, ttlock_lock_id, ttlock_admin_key_id, location')
        .single();

      if (supabaseError) {
        console.error('�  Warning: Failed to save lock to Supabase:', supabaseError);
      } else {
        console.log(' Lock saved to Supabase');
        savedLock = lock;
      }
    }

    // Return response
    res.json({
      success: true,
      message: 'Lock initialized successfully',
      data: {
        lockId,
        keyId,
        ...(savedLock && {
          supabase_lock: {
            id: savedLock.id,
            ttlock_lock_id: savedLock.ttlock_lock_id,
            ttlock_admin_key_id: savedLock.ttlock_admin_key_id,
            lock_alias: savedLock.location  // Use location field until lock_alias migration is run
          }
        })
      }
    });
  } catch (error) {
    console.error('L Initialize lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to initialize lock',
        details: error.message
      }
    });
  }
};

/**
 * Get Lock List
 * POST /api/ttlock-v3/lock/list
 *
 * @description Get the lock list of an account with pagination
 * @route POST /v3/lock/list
 */
export const getLockList = async (req, res) => {
  try {
    const {
      accessToken,
      lockAlias,
      type = 1,
      groupId,
      pageNo = 1,
      pageSize = 20
    } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    // Validate pageSize
    if (pageSize > 10000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE_SIZE',
          message: 'Page size cannot exceed 10000'
        }
      });
    }

    console.log('🔒 TTLock Get Lock List');
    console.log('   Lock Alias Filter:', lockAlias || 'None');
    console.log('   Device Type:', type === 1 ? 'Lock' : type === 2 ? 'Lift Controller' : type);
    console.log('   Group ID:', groupId || 'None');
    console.log('   Page:', pageNo);
    console.log('   Page Size:', pageSize);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    // Add optional parameters
    if (lockAlias) {
      params.lockAlias = lockAlias;
    }

    if (type !== undefined) {
      params.type = type;
    }

    if (groupId) {
      params.groupId = groupId;
    }

    console.log('📡 Calling TTLock Get Lock List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/list`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get lock list error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_LOCK_LIST_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to get lock list',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list, pageNo: resPageNo, pageSize: resPageSize, pages, total } = response.data;

    console.log('✅ Lock list retrieved successfully');
    console.log('   Total locks:', total || (list ? list.length : 0));
    if (pages !== undefined) {
      console.log('   Total pages:', pages);
      console.log('   Current page:', resPageNo);
    }

    // Return response
    res.json({
      success: true,
      message: 'Lock list retrieved successfully',
      data: {
        list: list || [],
        ...(pages !== undefined && {
          pagination: {
            pageNo: resPageNo,
            pageSize: resPageSize,
            pages: pages,
            total: total
          }
        })
      }
    });
  } catch (error) {
    console.error('❌ Get lock list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock list',
        details: error.message
      }
    });
  }
};

/**
 * Get Lock Details
 * POST /api/ttlock-v3/lock/detail
 *
 * @description Get detailed information about a specific lock
 * @route POST /v3/lock/detail
 */
export const getLockDetail = async (req, res) => {
  try {
    const { accessToken, lockId } = req.body;

    // Validate required fields
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    console.log('🔍 TTLock Get Lock Details');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Detail API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/detail`,
      null,
      { params }
    );

    console.log('📊 Response received');

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get lock detail error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_LOCK_DETAIL_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to get lock details',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const lockDetails = response.data;

    console.log('✅ Lock details retrieved successfully');
    console.log('   Lock Name:', lockDetails.lockName);
    console.log('   Lock Alias:', lockDetails.lockAlias || 'N/A');
    console.log('   Battery:', lockDetails.electricQuantity + '%');

    // Return response
    res.json({
      success: true,
      message: 'Lock details retrieved successfully',
      data: {
        lockId: lockDetails.lockId,
        lockName: lockDetails.lockName,
        lockAlias: lockDetails.lockAlias,
        lockMac: lockDetails.lockMac,
        lockKey: lockDetails.lockKey,
        lockFlagPos: lockDetails.lockFlagPos,
        adminPwd: lockDetails.adminPwd,
        noKeyPwd: lockDetails.noKeyPwd,
        deletePwd: lockDetails.deletePwd,
        aesKeyStr: lockDetails.aesKeyStr,
        lockVersion: lockDetails.lockVersion,
        keyboardPwdVersion: lockDetails.keyboardPwdVersion,
        electricQuantity: lockDetails.electricQuantity,
        specialValue: lockDetails.specialValue,
        timezoneRawOffset: lockDetails.timezoneRawOffset,
        modelNum: lockDetails.modelNum,
        hardwareRevision: lockDetails.hardwareRevision,
        firmwareRevision: lockDetails.firmwareRevision,
        date: lockDetails.date
      }
    });
  } catch (error) {
    console.error('❌ Get lock detail error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock details',
        details: error.message
      }
    });
  }
};

/**
 * Delete Lock from TTLock Cloud
 * POST /api/ttlock-v3/lock/delete
 *
 * @description Delete a lock from TTLock Cloud. All ekeys and passcodes will be deleted.
 * @route POST /v3/lock/delete
 * @note This should only be invoked after removing the lock through the SDK
 */
/**
 * Update Lock Config (Includes Door Direction, Anti-Peep Password, etc.)
 * POST /api/ttlock-v3/lock/config
 *
 * @description Update lock configuration settings via TTLock API
 * @route POST /v3/lock/updateSetting
 * @note This uses the TTLock v3/lock/updateSetting endpoint
 */
export const updateLockConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockId, settingType, settingValue } = req.body;

    // Validate required fields
    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    if (settingType === undefined || settingValue === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SETTING',
          message: 'Setting type and value are required'
        }
      });
    }

    // Get user's TTLock access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_access_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Decrypt the access token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_DECRYPT_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    console.log('⚙️  TTLock Update Lock Config');
    console.log('   Lock ID:', lockId);
    console.log('   Setting Type:', settingType);
    console.log('   Setting Value:', settingValue);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      settingType: settingType,
      settingValue: settingValue,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Update Lock Setting API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/updateSetting`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock update lock config error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_CONFIG_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to update lock config',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock config updated successfully');

    // Return response
    res.json({
      success: true,
      message: 'Lock config updated successfully',
      data: {
        lockId: lockId,
        settingType: settingType,
        settingValue: settingValue
      }
    });
  } catch (error) {
    console.error('❌ Update lock config error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to update lock config',
        details: error.message
      }
    });
  }
};

/**
 * Set Lock Time (Calibrate Lock Clock)
 * POST /api/ttlock-v3/lock/time
 *
 * @description Sync lock time with server time via Gateway
 * @route POST /v3/lock/updateDate
 */
export const setLockTime = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockId } = req.body;

    // Validate required fields
    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    // Get user's TTLock access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_access_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Decrypt the access token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_DECRYPT_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    console.log('🕐 TTLock Set Lock Time');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Update Date API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/updateDate`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock set lock time error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'SET_TIME_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to set lock time',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock time synced successfully');

    // Return response
    res.json({
      success: true,
      message: 'Lock time synced successfully',
      data: {
        lockId: lockId,
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Set lock time error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to set lock time',
        details: error.message
      }
    });
  }
};

/**
 * Reset Lock eKeys via Cloud (NOT Factory Reset)
 * POST /api/ttlock-v3/lock/reset
 *
 * @description Reset all common ekeys for a lock (admin ekey remains)
 * @route POST /v3/lock/resetKey
 * @note Factory reset is ONLY available via Bluetooth SDK - TTLock API does not support remote factory reset
 *
 * IMPORTANT: TTLock v3 API does NOT have a remote factory reset endpoint.
 * Factory reset MUST be done via Bluetooth (SDK's resetLock method) or physically on the lock.
 * This endpoint resets all ekeys instead, which invalidates all shared access.
 */
export const resetLock = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockId, resetType = 'ekeys' } = req.body;

    // Validate required fields
    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'Lock ID is required'
        }
      });
    }

    // Get user's TTLock access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_access_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Decrypt the access token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_DECRYPT_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    console.log('🔄 TTLock Reset Lock Access');
    console.log('   Lock ID:', lockId);
    console.log('   Reset Type:', resetType);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    // Determine which API to call based on resetType
    let apiEndpoint;
    let resetDescription;

    switch (resetType) {
      case 'passcodes':
        // Reset all keyboard passcodes
        apiEndpoint = '/v3/lock/resetKeyboardPwd';
        resetDescription = 'All passcodes have been reset';
        break;
      case 'ekeys':
      default:
        // Reset all common ekeys (admin ekey remains)
        apiEndpoint = '/v3/lock/resetKey';
        resetDescription = 'All common ekeys have been invalidated (admin access preserved)';
        break;
    }

    console.log('📡 Calling TTLock API:', apiEndpoint);

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}${apiEndpoint}`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock reset error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESET_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to reset lock access',
          ttlock_errcode: response.data.errcode,
          note: 'For full factory reset, use Bluetooth reset on the mobile app or physical reset button on the lock'
        }
      });
    }

    console.log('✅ Lock access reset successfully');

    // Return response
    res.json({
      success: true,
      message: resetDescription,
      data: {
        lockId: lockId,
        resetType: resetType,
        resetAt: new Date().toISOString(),
        note: 'For full factory reset, use Bluetooth or physical reset button'
      }
    });
  } catch (error) {
    console.error('❌ Reset lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to reset lock access',
        details: error.message,
        note: 'TTLock API does not support remote factory reset. Use Bluetooth or physical reset button.'
      }
    });
  }
};

export const deleteLockFromCloud = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lockId } = req.body;

    // Validate required fields
    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'TTLock Lock ID is required'
        }
      });
    }

    // Get user's TTLock access token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_access_token) {
      console.log('No TTLock access token available - skipping cloud delete');
      return res.json({
        success: true,
        message: 'No TTLock account connected - lock not deleted from cloud',
        skipped: true
      });
    }

    // Decrypt the access token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      console.error('Failed to decrypt access token');
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_DECRYPT_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    console.log('🗑️  TTLock Delete Lock from Cloud');
    console.log('   TTLock Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(lockId),
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/delete`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete lock error:', response.data);

      // Some error codes might indicate the lock is already deleted
      // errcode 10003 = Lock does not exist or no permission
      if (response.data.errcode === 10003) {
        console.log('⚠️  Lock may already be deleted from TTLock Cloud');
        return res.json({
          success: true,
          message: 'Lock already deleted from TTLock Cloud or not found',
          already_deleted: true
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_FROM_CLOUD_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to delete lock from TTLock Cloud',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock deleted from TTLock Cloud successfully');

    // Return response
    res.json({
      success: true,
      message: 'Lock deleted from TTLock Cloud successfully',
      data: {
        lockId: lockId,
        deleted_from_cloud: true
      }
    });
  } catch (error) {
    console.error('❌ Delete lock from cloud error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete lock from TTLock Cloud',
        details: error.message
      }
    });
  }
};
