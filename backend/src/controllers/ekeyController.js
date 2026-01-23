import { supabase } from '../services/supabase.js';
import axios from 'axios';
import { decrypt } from '../utils/ttlockCrypto.js';
import logger from '../utils/logger.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Helper function to convert user type code to text
 */
const getUserTypeText = (userType) => {
  const types = {
    110301: 'Admin',
    110302: 'Common User'
  };
  return types[userType] || `Unknown (${userType})`;
};

/**
 * Helper function to convert key status code to text
 */
const getKeyStatusText = (keyStatus) => {
  const statuses = {
    110401: 'Active',
    110402: 'Frozen',
    110405: 'Expired',
    110406: 'Deleted',
    110408: 'Reset'
  };
  return statuses[keyStatus] || `Unknown (${keyStatus})`;
};

/**
 * Get user's TTLock access token from database
 */
const getUserAccessToken = async (userId) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('ttlock_access_token, ttlock_token_expires_at, ttlock_user_id')
    .eq('id', userId)
    .single();

  if (error || !user || !user.ttlock_access_token) {
    throw new Error('TTLock account not connected. Please connect your TTLock account first.');
  }

  const expiresAt = new Date(user.ttlock_token_expires_at);
  if (expiresAt <= new Date()) {
    throw new Error('TTLock access token expired. Please reconnect your TTLock account.');
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
    .select('device_id, ttlock_lock_id, name')
    .eq('id', lockId)
    .single();

  if (error || !lock) {
    throw new Error('Lock not found');
  }

  let ttlockLockId = lock.ttlock_lock_id;
  if (!ttlockLockId && lock.device_id && lock.device_id.startsWith('ttlock_')) {
    ttlockLockId = parseInt(lock.device_id.replace('ttlock_', ''));
  }

  if (!ttlockLockId) {
    throw new Error('Lock not linked to TTLock Cloud');
  }

  return { ttlockLockId, lockName: lock.name };
};

/**
 * Check if user has admin access to the lock
 */
const checkLockAdminAccess = async (userId, lockId) => {
  const { data: userLock, error } = await supabase
    .from('user_locks')
    .select('role')
    .eq('user_id', userId)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .single();

  if (error || !userLock) {
    throw new Error('You do not have access to this lock');
  }

  // Only admin/owner can send eKeys
  if (userLock.role !== 'admin' && userLock.role !== 'owner') {
    throw new Error('Only lock administrators can send eKeys');
  }

  return userLock.role;
};

/**
 * Check TTLock connection status
 * GET /api/ekeys/status
 */
export const getTTLockStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info(`[EKEY] 🔍 Checking TTLock status for user ${userId}`);

    const { data: user, error } = await supabase
      .from('users')
      .select('ttlock_access_token, ttlock_token_expires_at, ttlock_user_id, ttlock_email')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('[EKEY] ❌ Error fetching user:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to check TTLock status' }
      });
    }

    const isConnected = !!(user?.ttlock_access_token && user?.ttlock_user_id);
    const isExpired = user?.ttlock_token_expires_at ? new Date(user.ttlock_token_expires_at) <= new Date() : true;

    logger.info(`[EKEY] ✅ TTLock status: connected=${isConnected}, expired=${isExpired}`);

    return res.json({
      success: true,
      data: {
        isConnected,
        isExpired: isConnected ? isExpired : null,
        ttlockEmail: user?.ttlock_email || null,
        status: !isConnected ? 'not_connected' : isExpired ? 'expired' : 'connected'
      }
    });
  } catch (error) {
    logger.error('[EKEY] ❌ Status check error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Send eKey to a user
 * POST /api/locks/:lockId/ekeys
 */
export const sendEkey = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      receiverUsername,
      keyName,
      startDate,
      endDate,
      remarks,
      remoteEnable,
      createUser
    } = req.body;

    logger.info(`[EKEY] 📤 Sending eKey for lock ${lockId} to ${receiverUsername}`);

    // Validation
    if (!receiverUsername) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_RECEIVER', message: 'Recipient email or phone is required' }
      });
    }

    if (!keyName) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_KEY_NAME', message: 'eKey name is required' }
      });
    }

    // Check admin access
    try {
      await checkLockAdminAccess(userId, lockId);
    } catch (accessError) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: accessError.message }
      });
    }

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: { code: 'TTLOCK_NOT_CONNECTED', message: tokenError.message }
      });
    }

    // Get TTLock lock ID
    let ttlockLockId, lockName;
    try {
      const lockInfo = await getTTLockId(lockId);
      ttlockLockId = lockInfo.ttlockLockId;
      lockName = lockInfo.lockName;
    } catch (lockError) {
      return res.status(404).json({
        success: false,
        error: { code: 'LOCK_ERROR', message: lockError.message }
      });
    }

    // Build request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: parseInt(ttlockLockId),
      receiverUsername: receiverUsername.trim(),
      keyName: keyName.trim(),
      startDate: parseInt(startDate) || 0,
      endDate: parseInt(endDate) || 0,
      date: Date.now()
    };

    // Add optional parameters
    if (remarks) params.remarks = remarks;
    if (remoteEnable !== undefined && remoteEnable !== null) {
      params.remoteEnable = parseInt(remoteEnable);
    }
    if (createUser !== undefined && createUser !== null) {
      params.createUser = parseInt(createUser);
    }

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/send`,
      null,
      { params }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || response.data.description || 'Failed to send eKey';
      let errorCode = 'SEND_EKEY_FAILED';

      if (response.data.errcode === -1) {
        errorMessage = 'Invalid access token - please reconnect TTLock';
        errorCode = 'INVALID_TOKEN';
      } else if (response.data.errcode === -3005) {
        errorMessage = 'Cannot send eKey to yourself';
        errorCode = 'CANNOT_SEND_TO_SELF';
      } else if (response.data.errcode === -3019) {
        errorMessage = 'User is already an administrator of this lock';
        errorCode = 'ALREADY_ADMIN';
      } else if (response.data.errcode === 20002) {
        errorMessage = 'Only lock administrators can send eKeys';
        errorCode = 'NOT_LOCK_ADMIN';
      }

      logger.warn(`[EKEY] ⚠️ TTLock API error: ${errorMessage}`, { errcode: response.data.errcode });
      return res.status(400).json({
        success: false,
        error: { code: errorCode, message: errorMessage }
      });
    }

    const { keyId } = response.data;
    const isPermanent = params.startDate === 0 && params.endDate === 0;

    // Save eKey to our database
    const { data: savedEkey, error: saveError } = await supabase
      .from('ekeys')
      .insert({
        lock_id: lockId,
        sender_user_id: userId,
        ttlock_ekey_id: keyId,
        ttlock_lock_id: ttlockLockId,
        recipient_username: receiverUsername.trim(),
        ekey_name: keyName.trim(),
        ekey_type: isPermanent ? 'permanent' : 'timed',
        valid_from: isPermanent ? null : new Date(params.startDate),
        valid_until: isPermanent ? null : new Date(params.endDate),
        remote_unlock_enabled: params.remoteEnable === 1,
        status: 'active',
        remarks: remarks || null
      })
      .select()
      .single();

    if (saveError) {
      logger.warn('[EKEY] ⚠️ Failed to save eKey to database:', saveError);
      // Continue anyway - the eKey was sent successfully to TTLock
    }

    logger.info(`[EKEY] ✅ eKey sent successfully: keyId=${keyId}`);

    return res.json({
      success: true,
      message: 'eKey sent successfully',
      data: {
        keyId,
        lockId,
        lockName,
        receiverUsername: receiverUsername.trim(),
        keyName: keyName.trim(),
        isPermanent,
        startDate: isPermanent ? null : params.startDate,
        endDate: isPermanent ? null : params.endDate,
        remoteUnlockEnabled: params.remoteEnable === 1,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[EKEY] ❌ Send eKey error:', error);

    if (error.response?.data?.errcode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: error.response.data.errmsg || 'TTLock API error'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Get eKey list for a lock
 * GET /api/locks/:lockId/ekeys
 */
export const getEkeyList = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { pageNo = 1, pageSize = 100 } = req.query;

    logger.info(`[EKEY] 📋 Getting eKey list for lock ${lockId}`);

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: { code: 'TTLOCK_NOT_CONNECTED', message: tokenError.message }
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
        error: { code: 'LOCK_ERROR', message: lockError.message }
      });
    }

    // Call TTLock API
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize),
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/list`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      logger.warn('[EKEY] ⚠️ TTLock API error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_EKEYS_FAILED',
          message: response.data.errmsg || 'Failed to get eKeys'
        }
      });
    }

    const { list = [] } = response.data;

    // Filter eKeys for this specific lock
    const lockEkeys = list.filter(ekey => ekey.lockId === parseInt(ttlockLockId));

    // Process eKeys with enhanced data
    const processedEkeys = lockEkeys.map(ekey => {
      const isPermanent = ekey.startDate === 0 && ekey.endDate === 0;
      const isExpired = ekey.keyStatus === 110405;
      const isActive = ekey.keyStatus === 110401;
      const isFrozen = ekey.keyStatus === 110402;
      const isDeleted = ekey.keyStatus === 110406;
      const isAdmin = ekey.userType === 110301;

      return {
        keyId: ekey.keyId,
        lockId: ekey.lockId,
        keyName: ekey.keyName,
        username: ekey.username,
        userTypeText: getUserTypeText(ekey.userType),
        keyStatusText: getKeyStatusText(ekey.keyStatus),
        isAdmin,
        isActive,
        isFrozen,
        isExpired,
        isDeleted,
        isPermanent,
        validFrom: isPermanent ? null : new Date(ekey.startDate).toISOString(),
        validUntil: isPermanent ? null : new Date(ekey.endDate).toISOString(),
        hasRemoteUnlock: ekey.remoteEnable === 1,
        createdAt: ekey.createDate ? new Date(ekey.createDate).toISOString() : null
      };
    });

    logger.info(`[EKEY] ✅ Retrieved ${processedEkeys.length} eKeys for lock`);

    return res.json({
      success: true,
      data: {
        ekeys: processedEkeys,
        total: processedEkeys.length
      }
    });

  } catch (error) {
    logger.error('[EKEY] ❌ Get eKeys error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Delete an eKey
 * DELETE /api/ekeys/:keyId
 */
export const deleteEkey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.user.id;

    logger.info(`[EKEY] 🗑️ Deleting eKey ${keyId}`);

    // Get access token
    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: { code: 'TTLOCK_NOT_CONNECTED', message: tokenError.message }
      });
    }

    // Call TTLock API
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/delete`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      let errorMessage = response.data.errmsg || 'Failed to delete eKey';
      if (response.data.errcode === 20002) {
        errorMessage = 'Only lock administrators can delete eKeys';
      }

      return res.status(400).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: errorMessage }
      });
    }

    // Update our database
    await supabase
      .from('ekeys')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('ttlock_ekey_id', keyId);

    logger.info(`[EKEY] ✅ eKey ${keyId} deleted successfully`);

    return res.json({
      success: true,
      message: 'eKey deleted successfully'
    });

  } catch (error) {
    logger.error('[EKEY] ❌ Delete eKey error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Freeze an eKey (temporarily disable)
 * POST /api/ekeys/:keyId/freeze
 */
export const freezeEkey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.user.id;

    logger.info(`[EKEY] ❄️ Freezing eKey ${keyId}`);

    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: { code: 'TTLOCK_NOT_CONNECTED', message: tokenError.message }
      });
    }

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/freeze`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FREEZE_FAILED',
          message: response.data.errmsg || 'Failed to freeze eKey'
        }
      });
    }

    // Update our database
    await supabase
      .from('ekeys')
      .update({ status: 'frozen', updated_at: new Date().toISOString() })
      .eq('ttlock_ekey_id', keyId);

    logger.info(`[EKEY] ✅ eKey ${keyId} frozen successfully`);

    return res.json({
      success: true,
      message: 'eKey frozen successfully'
    });

  } catch (error) {
    logger.error('[EKEY] ❌ Freeze eKey error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Unfreeze an eKey (re-enable)
 * POST /api/ekeys/:keyId/unfreeze
 */
export const unfreezeEkey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.user.id;

    logger.info(`[EKEY] 🔥 Unfreezing eKey ${keyId}`);

    let accessToken;
    try {
      accessToken = await getUserAccessToken(userId);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: { code: 'TTLOCK_NOT_CONNECTED', message: tokenError.message }
      });
    }

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      keyId: parseInt(keyId),
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/unfreeze`,
      null,
      { params }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNFREEZE_FAILED',
          message: response.data.errmsg || 'Failed to unfreeze eKey'
        }
      });
    }

    // Update our database
    await supabase
      .from('ekeys')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('ttlock_ekey_id', keyId);

    logger.info(`[EKEY] ✅ eKey ${keyId} unfrozen successfully`);

    return res.json({
      success: true,
      message: 'eKey unfrozen successfully'
    });

  } catch (error) {
    logger.error('[EKEY] ❌ Unfreeze eKey error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};
