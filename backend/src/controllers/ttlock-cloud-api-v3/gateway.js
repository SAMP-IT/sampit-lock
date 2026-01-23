import { supabase } from '../../services/supabase.js';
import axios from 'axios';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get User ID
 * POST /api/ttlock-v3/gateway/get-uid
 *
 * @description Get the user ID associated with an access token
 * @route POST /v3/user/getUid
 * @note This is a User API but included in gateway.js as requested
 */
export const getUserId = async (req, res) => {
  try {
    const { accessToken } = req.body;

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

    console.log('=d TTLock Get User ID');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      date: Date.now()
    };

    console.log('=� Calling TTLock Get User ID API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/getUid`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock get user ID error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_USER_ID_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to get user ID',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { uid } = response.data;

    if (!uid) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No user ID received from TTLock'
        }
      });
    }

    console.log(' User ID retrieved successfully');
    console.log('   User ID:', uid);

    // Return response
    res.json({
      success: true,
      message: 'User ID retrieved successfully',
      data: {
        uid
      }
    });
  } catch (error) {
    console.error('L Get user ID error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get user ID',
        details: error.message
      }
    });
  }
};

/**
 * Get Lock Time
 * POST /api/ttlock-v3/gateway/query-date
 *
 * @description Get the current time of a lock via WiFi
 * @route POST /v3/lock/queryDate
 */
export const getLockTime = async (req, res) => {
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

    console.log('🕐 TTLock Get Lock Time');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Time API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/queryDate`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get lock time error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_LOCK_TIME_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to get lock time',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { date: lockDate } = response.data;

    if (!lockDate) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No date received from lock'
        }
      });
    }

    console.log('✅ Lock time retrieved successfully');
    console.log('   Lock Time:', new Date(lockDate).toISOString());

    // Return response
    res.json({
      success: true,
      message: 'Lock time retrieved successfully',
      data: {
        date: lockDate,
        dateFormatted: new Date(lockDate).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Get lock time error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock time',
        details: error.message
      }
    });
  }
};

/**
 * Adjust Lock Time
 * POST /api/ttlock-v3/gateway/update-date
 *
 * @description Adjust/synchronize the time of a lock via WiFi
 * @route POST /v3/lock/updateDate
 */
export const adjustLockTime = async (req, res) => {
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

    console.log('🕐 TTLock Adjust Lock Time');
    console.log('   Lock ID:', lockId);

    const currentTime = Date.now();
    console.log('   Setting lock time to:', new Date(currentTime).toISOString());

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: currentTime
    };

    console.log('📡 Calling TTLock Adjust Lock Time API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/updateDate`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock adjust lock time error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'ADJUST_LOCK_TIME_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to adjust lock time',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { date: adjustedDate } = response.data;

    if (!adjustedDate) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No date received from lock after adjustment'
        }
      });
    }

    console.log('✅ Lock time adjusted successfully');
    console.log('   Adjusted Time:', new Date(adjustedDate).toISOString());

    // Return response
    res.json({
      success: true,
      message: 'Lock time adjusted successfully',
      data: {
        date: adjustedDate,
        dateFormatted: new Date(adjustedDate).toISOString(),
        requestedDate: currentTime,
        requestedDateFormatted: new Date(currentTime).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Adjust lock time error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to adjust lock time',
        details: error.message
      }
    });
  }
};

/**
 * Unlock
 * POST /api/ttlock-v3/gateway/unlock
 *
 * @description Unlock a lock via WiFi gateway
 * @route POST /v3/lock/unlock
 * @note If you get error -4043, enable "remote unlock" in Sciener APP's lock settings
 */
export const unlockViaGateway = async (req, res) => {
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

    console.log('🔓 TTLock Unlock via Gateway');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Unlock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/unlock`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock unlock error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to unlock';
      let errorCode = 'UNLOCK_FAILED';

      if (response.data.errcode === -4043) {
        errorMessage = 'Remote unlock is not enabled for this lock. Please enable "remote unlock" in Sciener APP lock settings.';
        errorCode = 'REMOTE_UNLOCK_DISABLED';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock unlocked successfully');

    // Return response
    res.json({
      success: true,
      message: 'Lock unlocked successfully via gateway',
      data: {
        lockId: lockId,
        unlockedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Unlock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to unlock lock',
        details: error.message
      }
    });
  }
};

/**
 * Lock
 * POST /api/ttlock-v3/gateway/lock
 *
 * @description Lock a lock via WiFi gateway
 * @route POST /v3/lock/lock
 */
export const lockViaGateway = async (req, res) => {
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

    console.log('🔒 TTLock Lock via Gateway');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/lock`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock lock error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to lock';
      let errorCode = 'LOCK_FAILED';

      if (response.data.errcode === -4043) {
        errorMessage = 'Remote lock is not enabled for this lock. Please enable remote control in Sciener APP lock settings.';
        errorCode = 'REMOTE_LOCK_DISABLED';
      } else if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock locked successfully');

    // Return response
    res.json({
      success: true,
      message: 'Lock locked successfully via gateway',
      data: {
        lockId: lockId,
        lockedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to lock lock',
        details: error.message
      }
    });
  }
};

/**
 * Get Lock Open State
 * POST /api/ttlock-v3/gateway/query-open-state
 *
 * @description Get the open state of a lock via WiFi gateway
 * @route POST /v3/lock/queryOpenState
 */
export const getLockOpenState = async (req, res) => {
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

    console.log('🔍 TTLock Get Lock Open State');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Open State API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/queryOpenState`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get lock open state error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get lock state';
      let errorCode = 'GET_STATE_FAILED';

      if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { state } = response.data;

    if (state === undefined) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No state received from lock'
        }
      });
    }

    // Map state to human-readable format
    const stateMap = {
      0: 'locked',
      1: 'unlocked',
      2: 'unknown'
    };

    const stateText = stateMap[state] || 'unknown';

    console.log('✅ Lock state retrieved successfully');
    console.log('   State:', state, `(${stateText})`);

    // Return response
    res.json({
      success: true,
      message: 'Lock state retrieved successfully',
      data: {
        state: state,
        stateText: stateText,
        lockId: lockId,
        queriedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Get lock open state error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock state',
        details: error.message
      }
    });
  }
};

/**
 * Freeze Lock
 * POST /api/ttlock-v3/gateway/freeze
 *
 * @description Freeze the lock via gateway. All unlocking methods will not work after it is frozen.
 * @route POST /v3/lock/freeze
 * @note This is a security feature - use with caution as it disables all unlocking methods
 */
export const freezeLock = async (req, res) => {
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

    console.log('❄️  TTLock Freeze Lock');
    console.log('   Lock ID:', lockId);
    console.log('   ⚠️  WARNING: This will disable all unlocking methods!');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Freeze Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/freeze`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock freeze lock error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to freeze lock';
      let errorCode = 'FREEZE_FAILED';

      if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only admin can freeze locks';
        errorCode = 'NOT_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock frozen successfully');
    console.log('   ⚠️  All unlocking methods are now disabled!');

    // Return response
    res.json({
      success: true,
      message: 'Lock frozen successfully. All unlocking methods are now disabled.',
      data: {
        lockId: lockId,
        frozenAt: new Date().toISOString(),
        warning: 'All unlocking methods (passcodes, cards, fingerprints, etc.) are now disabled'
      }
    });
  } catch (error) {
    console.error('❌ Freeze lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to freeze lock',
        details: error.message
      }
    });
  }
};

/**
 * Unfreeze Lock
 * POST /api/ttlock-v3/gateway/unfreeze
 *
 * @description Unfreeze a lock via gateway. This restores all unlocking methods.
 * @route POST /v3/lock/unfreeze
 * @note This reverses the freeze operation and re-enables all unlocking methods
 */
export const unfreezeLock = async (req, res) => {
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

    console.log('🔥 TTLock Unfreeze Lock');
    console.log('   Lock ID:', lockId);
    console.log('   ℹ️  This will restore all unlocking methods');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Unfreeze Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/unfreeze`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock unfreeze lock error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to unfreeze lock';
      let errorCode = 'UNFREEZE_FAILED';

      if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not lock admin - only admin can unfreeze locks';
        errorCode = 'NOT_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Lock unfrozen successfully');
    console.log('   ✅ All unlocking methods are now restored!');

    // Return response
    res.json({
      success: true,
      message: 'Lock unfrozen successfully. All unlocking methods are now restored.',
      data: {
        lockId: lockId,
        unfrozenAt: new Date().toISOString(),
        info: 'All unlocking methods (passcodes, cards, fingerprints, etc.) are now enabled'
      }
    });
  } catch (error) {
    console.error('❌ Unfreeze lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to unfreeze lock',
        details: error.message
      }
    });
  }
};

/**
 * Get Lock Status
 * POST /api/ttlock-v3/gateway/query-status
 *
 * @description Get the status of a lock via gateway, frozen or not
 * @route POST /v3/lock/queryStatus
 * @note Returns 0 for not frozen, 1 for frozen
 */
export const getLockStatus = async (req, res) => {
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

    console.log('🔍 TTLock Get Lock Status');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Lock Status API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/queryStatus`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get lock status error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get lock status';
      let errorCode = 'GET_STATUS_FAILED';

      if (response.data.errcode === -2003) {
        errorMessage = 'Lock is offline or not connected to gateway';
        errorCode = 'LOCK_OFFLINE';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { status } = response.data;

    if (status === undefined) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No status received from lock'
        }
      });
    }

    // Map status to human-readable format
    const statusMap = {
      0: 'not_frozen',
      1: 'frozen'
    };

    const statusText = statusMap[status] || 'unknown';

    console.log('✅ Lock status retrieved successfully');
    console.log('   Status:', status, `(${statusText})`);

    // Return response
    res.json({
      success: true,
      message: 'Lock status retrieved successfully',
      data: {
        status: status,
        statusText: statusText,
        isFrozen: status === 1,
        lockId: lockId,
        queriedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Get lock status error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock status',
        details: error.message
      }
    });
  }
};

/**
 * Get Gateway List
 * POST /api/ttlock-v3/gateway/list
 *
 * @description Get the gateway list of an account with pagination
 * @route POST /v3/gateway/list
 * @note Returns information about gateways including online status and lock count
 */
export const getGatewayList = async (req, res) => {
  try {
    const { accessToken, pageNo = 1, pageSize = 20 } = req.body;

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

    // Validate pageNo and pageSize
    if (pageNo < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE_NUMBER',
          message: 'Page number must be greater than 0'
        }
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE_SIZE',
          message: 'Page size must be between 1 and 100'
        }
      });
    }

    console.log('📡 TTLock Get Gateway List');
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

    console.log('📡 Calling TTLock Get Gateway List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/list`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get gateway list error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get gateway list';
      let errorCode = 'GET_GATEWAY_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list = [] } = response.data;

    console.log('✅ Gateway list retrieved successfully');
    console.log('   Total gateways:', list.length);

    // Enhance gateway data with user-friendly status
    const enhancedList = list.map(gateway => ({
      ...gateway,
      isOnlineText: gateway.isOnline === 1 ? 'online' : 'offline',
      gatewayVersionText: gateway.gatewayVersion === 1 ? 'G1' : gateway.gatewayVersion === 2 ? 'G2' : `V${gateway.gatewayVersion}`
    }));

    // Return response
    res.json({
      success: true,
      message: 'Gateway list retrieved successfully',
      data: {
        list: enhancedList,
        pageNo: pageNo,
        pageSize: pageSize,
        total: list.length
      }
    });
  } catch (error) {
    console.error('❌ Get gateway list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get gateway list',
        details: error.message
      }
    });
  }
};

/**
 * Get Gateway List by Lock
 * POST /api/ttlock-v3/gateway/list-by-lock
 *
 * @description Get the gateway list of a specific lock
 * @route POST /v3/gateway/listByLock
 * @note Returns gateways connected to a specific lock with RSSI signal strength
 */
export const getGatewayListByLock = async (req, res) => {
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

    console.log('📡 TTLock Get Gateway List by Lock');
    console.log('   Lock ID:', lockId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: lockId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Gateway List by Lock API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/listByLock`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get gateway list by lock error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get gateway list for lock';
      let errorCode = 'GET_GATEWAY_LIST_BY_LOCK_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Lock not found or access denied';
        errorCode = 'LOCK_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this lock';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list = [] } = response.data;

    console.log('✅ Gateway list retrieved successfully');
    console.log('   Total gateways for lock:', list.length);

    // Enhance gateway data with signal strength interpretation
    const enhancedList = list.map(gateway => {
      let signalStrength = 'unknown';
      let signalQuality = 'unknown';

      if (gateway.rssi !== undefined) {
        if (gateway.rssi > -75) {
          signalStrength = 'strong';
          signalQuality = 'excellent';
        } else if (gateway.rssi > -85) {
          signalStrength = 'medium';
          signalQuality = 'good';
        } else {
          signalStrength = 'weak';
          signalQuality = 'poor';
        }
      }

      return {
        ...gateway,
        signalStrength: signalStrength,
        signalQuality: signalQuality,
        rssiUpdateDateFormatted: gateway.rssiUpdateDate ? new Date(gateway.rssiUpdateDate).toISOString() : null
      };
    });

    // Return response
    res.json({
      success: true,
      message: 'Gateway list for lock retrieved successfully',
      data: {
        list: enhancedList,
        lockId: lockId,
        total: list.length
      }
    });
  } catch (error) {
    console.error('❌ Get gateway list by lock error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get gateway list for lock',
        details: error.message
      }
    });
  }
};

/**
 * Delete Gateway
 * POST /api/ttlock-v3/gateway/delete
 *
 * @description Delete a gateway from the account
 * @route POST /v3/gateway/delete
 * @note This will remove the gateway and disconnect all associated locks
 */
export const deleteGateway = async (req, res) => {
  try {
    const { accessToken, gatewayId } = req.body;

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

    if (!gatewayId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_ID',
          message: 'Gateway ID is required'
        }
      });
    }

    console.log('🗑️  TTLock Delete Gateway');
    console.log('   Gateway ID:', gatewayId);
    console.log('   ⚠️  WARNING: This will remove the gateway and disconnect all locks!');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: gatewayId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete Gateway API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/delete`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete gateway error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to delete gateway';
      let errorCode = 'DELETE_GATEWAY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found or access denied';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not gateway admin - only admin can delete gateways';
        errorCode = 'NOT_ADMIN';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Gateway deleted successfully');
    console.log('   ⚠️  All locks connected to this gateway have been disconnected!');

    // Return response
    res.json({
      success: true,
      message: 'Gateway deleted successfully',
      data: {
        gatewayId: gatewayId,
        deletedAt: new Date().toISOString(),
        warning: 'All locks connected to this gateway have been disconnected from remote access'
      }
    });
  } catch (error) {
    console.error('❌ Delete gateway error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete gateway',
        details: error.message
      }
    });
  }
};

/**
 * Transfer Gateway
 * POST /api/ttlock-v3/gateway/transfer
 *
 * @description Transfer gateway(s) to another user. This is a permanent transfer.
 * @route POST /v3/gateway/transfer
 * @note Selected gateway(s) will be permanently transferred to the receiver
 */
export const transferGateway = async (req, res) => {
  try {
    const { accessToken, receiverUsername, gatewayIdList } = req.body;

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

    if (!receiverUsername) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RECEIVER_USERNAME',
          message: 'Receiver username is required'
        }
      });
    }

    if (!gatewayIdList || !Array.isArray(gatewayIdList) || gatewayIdList.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GATEWAY_ID_LIST',
          message: 'Gateway ID list must be a non-empty array'
        }
      });
    }

    console.log('🔄 TTLock Transfer Gateway');
    console.log('   Receiver:', receiverUsername);
    console.log('   Gateway IDs:', gatewayIdList);
    console.log('   ⚠️  WARNING: This will permanently transfer the gateway(s)!');

    // Convert array to string format required by API: "[1234,3332]"
    const gatewayIdListString = JSON.stringify(gatewayIdList);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      receiverUsername: receiverUsername,
      gatewayIdList: gatewayIdListString,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Transfer Gateway API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/transfer`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock transfer gateway error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to transfer gateway';
      let errorCode = 'TRANSFER_GATEWAY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found or access denied';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Not gateway admin - only admin can transfer gateways';
        errorCode = 'NOT_ADMIN';
      } else if (response.data.errcode === -1002) {
        errorMessage = 'Invalid User Name - receiver does not exist';
        errorCode = 'RECEIVER_NOT_FOUND';
      } else if (response.data.errcode === -1003) {
        errorMessage = 'Receiver user not found';
        errorCode = 'RECEIVER_NOT_FOUND';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Gateway(s) transferred successfully');
    console.log('   ⚠️  Gateway(s) now belong to:', receiverUsername);

    // Return response
    res.json({
      success: true,
      message: 'Gateway(s) transferred successfully',
      data: {
        gatewayIdList: gatewayIdList,
        receiverUsername: receiverUsername,
        transferredAt: new Date().toISOString(),
        warning: 'Gateway(s) have been permanently transferred and you no longer have access to them'
      }
    });
  } catch (error) {
    console.error('❌ Transfer gateway error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to transfer gateway',
        details: error.message
      }
    });
  }
};

/**
 * Get Gateway Lock List
 * POST /api/ttlock-v3/gateway/list-lock
 *
 * @description Get the lock list of a specific gateway
 * @route POST /v3/gateway/listLock
 * @note Returns locks connected to a gateway with signal strength information
 */
export const getGatewayLockList = async (req, res) => {
  try {
    const { accessToken, gatewayId } = req.body;

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

    if (!gatewayId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_ID',
          message: 'Gateway ID is required'
        }
      });
    }

    console.log('📡 TTLock Get Gateway Lock List');
    console.log('   Gateway ID:', gatewayId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: gatewayId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get Gateway Lock List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/listLock`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get gateway lock list error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to get lock list for gateway';
      let errorCode = 'GET_GATEWAY_LOCK_LIST_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found or access denied';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list = [] } = response.data;

    console.log('✅ Gateway lock list retrieved successfully');
    console.log('   Total locks for gateway:', list.length);

    // Enhance lock data with signal strength interpretation
    const enhancedList = list.map(lock => {
      let signalStrength = 'unknown';
      let signalQuality = 'unknown';

      if (lock.rssi !== undefined) {
        if (lock.rssi > -75) {
          signalStrength = 'strong';
          signalQuality = 'excellent';
        } else if (lock.rssi > -85) {
          signalStrength = 'medium';
          signalQuality = 'good';
        } else {
          signalStrength = 'weak';
          signalQuality = 'poor';
        }
      }

      return {
        ...lock,
        signalStrength: signalStrength,
        signalQuality: signalQuality,
        updateDateFormatted: lock.updateDate ? new Date(lock.updateDate).toISOString() : null
      };
    });

    // Return response
    res.json({
      success: true,
      message: 'Gateway lock list retrieved successfully',
      data: {
        list: enhancedList,
        gatewayId: gatewayId,
        total: list.length
      }
    });
  } catch (error) {
    console.error('❌ Get gateway lock list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get lock list for gateway',
        details: error.message
      }
    });
  }
};

/**
 * Query Gateway Init Status
 * POST /api/ttlock-v3/gateway/is-init-success
 *
 * @description Check if gateway was successfully initialized after SDK add (within 3 minutes)
 * @route POST /v3/gateway/isInitSuccess
 * @note Call this within 3 minutes after adding gateway via SDK
 */
export const queryGatewayInitStatus = async (req, res) => {
  try {
    const { accessToken, gatewayNetMac } = req.body;

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

    if (!gatewayNetMac) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_NET_MAC',
          message: 'Gateway network MAC address is required'
        }
      });
    }

    console.log('🔍 TTLock Query Gateway Init Status');
    console.log('   Gateway MAC:', gatewayNetMac);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayNetMac: gatewayNetMac,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Query Gateway Init Status API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/isInitSuccess`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock query gateway init status error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to query gateway init status';
      let errorCode = 'QUERY_INIT_STATUS_FAILED';

      if (response.data.errcode === 1) {
        errorMessage = 'Gateway initialization failed or not found';
        errorCode = 'INIT_FAILED';
      } else if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found - initialization may still be in progress';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'Gateway initialization not complete or failed';
        errorCode = 'INIT_NOT_COMPLETE';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { gatewayId } = response.data;

    if (!gatewayId) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'No gateway ID received - initialization may not be complete'
        }
      });
    }

    console.log('✅ Gateway initialization successful');
    console.log('   Gateway ID:', gatewayId);

    // Return response
    res.json({
      success: true,
      message: 'Gateway initialized successfully',
      data: {
        gatewayId: gatewayId,
        gatewayNetMac: gatewayNetMac,
        checkedAt: new Date().toISOString(),
        info: 'Gateway has been successfully added and initialized'
      }
    });
  } catch (error) {
    console.error('❌ Query gateway init status error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to query gateway init status',
        details: error.message
      }
    });
  }
};

/**
 * Upload Gateway Detail
 * POST /api/ttlock-v3/gateway/upload-detail
 *
 * @description Upload firmware and network info after gateway is successfully added
 * @route POST /v3/gateway/uploadDetail
 * @note Should be called after gateway is added successfully
 */
export const uploadGatewayDetail = async (req, res) => {
  try {
    const { accessToken, gatewayId, modelNum, hardwareRevision, firmwareRevision, networkName } = req.body;

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

    if (!gatewayId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_ID',
          message: 'Gateway ID is required'
        }
      });
    }

    if (!modelNum) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MODEL_NUM',
          message: 'Product model number is required'
        }
      });
    }

    if (!hardwareRevision) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HARDWARE_REVISION',
          message: 'Hardware revision is required'
        }
      });
    }

    if (!firmwareRevision) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIRMWARE_REVISION',
          message: 'Firmware revision is required'
        }
      });
    }

    if (!networkName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NETWORK_NAME',
          message: 'Network name is required'
        }
      });
    }

    console.log('📤 TTLock Upload Gateway Detail');
    console.log('   Gateway ID:', gatewayId);
    console.log('   Model:', modelNum);
    console.log('   Hardware:', hardwareRevision);
    console.log('   Firmware:', firmwareRevision);
    console.log('   Network:', networkName);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: gatewayId,
      modelNum: modelNum,
      hardwareRevision: hardwareRevision,
      firmwareRevision: firmwareRevision,
      networkName: networkName,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Upload Gateway Detail API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/uploadDetail`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock upload gateway detail error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to upload gateway detail';
      let errorCode = 'UPLOAD_DETAIL_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Gateway detail uploaded successfully');

    // Return response
    res.json({
      success: true,
      message: 'Gateway detail uploaded successfully',
      data: {
        gatewayId: gatewayId,
        modelNum: modelNum,
        hardwareRevision: hardwareRevision,
        firmwareRevision: firmwareRevision,
        networkName: networkName,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Upload gateway detail error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to upload gateway detail',
        details: error.message
      }
    });
  }
};

/**
 * Check Gateway Upgrade
 * Check if there is any upgrade available for a G2 gateway
 * Endpoint: POST /v3/gateway/upgradeCheck
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.gatewayId - Gateway ID
 * @returns {Object} Response with upgrade availability and firmware info
 */
export const checkGatewayUpgrade = async (req, res) => {
  try {
    const { accessToken, gatewayId } = req.body;

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

    if (!gatewayId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_ID',
          message: 'Gateway ID is required'
        }
      });
    }

    console.log('🔍 TTLock Check Gateway Upgrade');
    console.log('   Gateway ID:', gatewayId);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: gatewayId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Check Gateway Upgrade API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/upgradeCheck`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock check gateway upgrade error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to check gateway upgrade';
      let errorCode = 'UPGRADE_CHECK_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { needUpgrade, firmwareInfo } = response.data;

    // Interpret upgrade status
    let upgradeStatus = 'Unknown';
    let upgradeRecommendation = '';

    if (needUpgrade === 0) {
      upgradeStatus = 'No upgrade available';
      upgradeRecommendation = 'Gateway firmware is up to date';
    } else if (needUpgrade === 1) {
      upgradeStatus = 'Upgrade available';
      upgradeRecommendation = 'A firmware upgrade is available for this gateway';
    } else if (needUpgrade === 2) {
      upgradeStatus = 'Unknown';
      upgradeRecommendation = 'Unable to determine upgrade availability';
    }

    console.log('✅ Gateway upgrade check completed');
    console.log('   Upgrade Status:', upgradeStatus);
    if (firmwareInfo) {
      console.log('   Firmware Info:', firmwareInfo);
    }

    // Return response
    res.json({
      success: true,
      message: 'Gateway upgrade check completed',
      data: {
        gatewayId: gatewayId,
        needUpgrade: needUpgrade,
        upgradeStatus: upgradeStatus,
        upgradeRecommendation: upgradeRecommendation,
        firmwareInfo: firmwareInfo || null,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Check gateway upgrade error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to check gateway upgrade',
        details: error.message
      }
    });
  }
};

/**
 * Set Gateway Into Upgrade Mode
 * Set gateway into upgrade mode remotely
 * When in upgrade mode, gateway can't accept commands
 * Endpoint: POST /v3/gateway/setUpgradeMode
 *
 * @param {Object} req - Express request object
 * @param {string} req.body.accessToken - Access token
 * @param {number} req.body.gatewayId - Gateway ID
 * @returns {Object} Response confirming upgrade mode activation
 */
export const setGatewayUpgradeMode = async (req, res) => {
  try {
    const { accessToken, gatewayId } = req.body;

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

    if (!gatewayId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GATEWAY_ID',
          message: 'Gateway ID is required'
        }
      });
    }

    console.log('⚙️  TTLock Set Gateway Upgrade Mode');
    console.log('   Gateway ID:', gatewayId);
    console.log('   ⚠️  Gateway will enter upgrade mode and cannot accept commands');

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      gatewayId: gatewayId,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Set Gateway Upgrade Mode API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/gateway/setUpgradeMode`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock set gateway upgrade mode error:', response.data);

      // Special handling for common errors
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to set gateway upgrade mode';
      let errorCode = 'SET_UPGRADE_MODE_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3009) {
        errorMessage = 'Gateway not found';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -4037) {
        errorMessage = 'No such Gateway exists';
        errorCode = 'GATEWAY_NOT_FOUND';
      } else if (response.data.errcode === -2018) {
        errorMessage = 'Permission denied - you do not have access to this gateway';
        errorCode = 'PERMISSION_DENIED';
      } else if (response.data.errcode === -3010) {
        errorMessage = 'Gateway is offline';
        errorCode = 'GATEWAY_OFFLINE';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Gateway upgrade mode activated successfully');
    console.log('   Gateway is now in upgrade mode');
    console.log('   Gateway cannot accept commands during upgrade');

    // Return response
    res.json({
      success: true,
      message: 'Gateway upgrade mode activated successfully',
      data: {
        gatewayId: gatewayId,
        upgradeMode: true,
        activatedAt: new Date().toISOString(),
        warning: 'Gateway cannot accept commands while in upgrade mode'
      }
    });
  } catch (error) {
    console.error('❌ Set gateway upgrade mode error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to set gateway upgrade mode',
        details: error.message
      }
    });
  }
};
