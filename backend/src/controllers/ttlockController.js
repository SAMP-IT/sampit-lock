import { supabase } from '../services/supabase.js';
import axios from 'axios';
import logger from '../utils/logger.js';
import { sendSmartNotification, logEvent, EventAction, AccessMethod } from '../services/ai/index.js';
import { decrypt } from '../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

// NOTE: connectTTLockAccount removed - TTLock account is now connected during login/register
// Users authenticate directly with TTLock credentials, no separate "connect" step needed

/**
 * Get TTLock Status
 * GET /api/ttlock/status
 *
 * @description Get connection status and token validity
 */
export const getTTLockStatus = async (req, res) => {
  console.log('🟢 [DEBUG] getTTLockStatus - FUNCTION CALLED');
  console.log('🟢 [DEBUG] req.user exists?', !!req.user);
  console.log('🟢 [DEBUG] req.user.id:', req.user?.id);

  try {
    const userId = req.user.id;
    console.log('🟢 [DEBUG] userId extracted:', userId);
    logger.ttlock.apiCall('status', 'GET', null, { userId });

    // Get user's TTLock connection info
    const { data: user, error } = await supabase
      .from('users')
      .select('ttlock_user_id, ttlock_username, ttlock_connected_at, ttlock_token_expires_at')
      .eq('id', userId)
      .single();

    console.log('🟢 [DEBUG] Database query result - error:', error);
    console.log('🟢 [DEBUG] Database query result - user:', user);

    if (error) {
      logger.error(`[TTLOCK] ❌ Database error fetching TTLock status for user ${userId}:`, error);
      console.log('🔴 [DEBUG] Returning 500 due to database error');
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch TTLock status'
        }
      });
    }

    // Check if connected
    const isConnected = !!user.ttlock_user_id;

    // Check if token is expired
    let tokenValid = false;
    if (user.ttlock_token_expires_at) {
      const expiresAt = new Date(user.ttlock_token_expires_at);
      tokenValid = expiresAt > new Date();
    }

    logger.info(`[TTLOCK] ✅ Status check for user ${userId}: connected=${isConnected}, tokenValid=${tokenValid}`);
    res.json({
      success: true,
      data: {
        connected: isConnected,
        tokenValid,
        ttlock_user_id: user.ttlock_user_id,
        ttlock_username: user.ttlock_username,
        connected_at: user.ttlock_connected_at,
        token_expires_at: user.ttlock_token_expires_at,
        needs_refresh: isConnected && !tokenValid
      }
    });
  } catch (error) {
    logger.error('[TTLOCK] ❌ Get TTLock status error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get TTLock status',
        details: error.message
      }
    });
  }
};

/**
 * Get TTLock Token
 * GET /api/ttlock/token
 *
 * @description Get decrypted access token for frontend use
 */
export const getTTLockToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's encrypted token
    const { data: user, error } = await supabase
      .from('users')
      .select('ttlock_access_token, ttlock_token_expires_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
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
          code: 'NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Check if token is expired
    const expiresAt = new Date(user.ttlock_token_expires_at);
    const isExpired = expiresAt <= new Date();

    if (isExpired) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh the token.',
          expires_at: user.ttlock_token_expires_at
        }
      });
    }

    // Decrypt token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        expires_at: user.ttlock_token_expires_at
      }
    });
  } catch (error) {
    console.error('Get TTLock token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get TTLock token',
        details: error.message
      }
    });
  }
};

// NOTE: disconnectTTLockAccount removed - Since TTLock IS the auth method,
// disconnecting doesn't make sense. User would need to logout entirely.

/**
 * Import Locks from TTLock Cloud
 * POST /api/ttlock/import-locks
 *
 * @description Fetch locks from TTLock Cloud and import them into our database
 */
export const importLocks = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📥 Importing locks from TTLock Cloud for user:', userId);

    // Get user's TTLock access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token, ttlock_token_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.ttlock_access_token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Check token expiration
    const expiresAt = new Date(user.ttlock_token_expires_at);
    if (expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please reconnect TTLock account.'
        }
      });
    }

    // Decrypt token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    // Fetch locks from TTLock Cloud API
    console.log('📡 Fetching locks from TTLock Cloud API...');

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      pageNo: 1,
      pageSize: 100, // Get up to 100 locks in first page
      date: Date.now()
    };

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/lock/list`,
      null,
      { params }
    );

    // Check for TTLock API errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock API error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_ERROR',
          message: response.data.errmsg || response.data.description || 'Failed to fetch locks from TTLock',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list: ttlockLocks } = response.data;

    if (!ttlockLocks || ttlockLocks.length === 0) {
      console.log('ℹ️ No locks found in TTLock account');
      return res.json({
        success: true,
        data: {
          imported: 0,
          message: 'No locks found in your TTLock account'
        }
      });
    }

    console.log(`📦 Found ${ttlockLocks.length} locks in TTLock Cloud`);

    // Import each lock into our database
    let importedCount = 0;
    let skippedCount = 0;

    for (const ttlock of ttlockLocks) {
      try {
        // Check if lock already exists (by device_id which contains TTLock ID)
        const { data: existingLock } = await supabase
          .from('locks')
          .select('id')
          .eq('device_id', `ttlock_${ttlock.lockId}`)
          .single();

        if (existingLock) {
          console.log(`⏭️ Lock ${ttlock.lockAlias} already exists, skipping`);
          skippedCount++;
          continue;
        }

        // Fetch detailed lock info to get Bluetooth keys (lockKey, aesKeyStr, etc.)
        console.log(`📡 Fetching details for lock ${ttlock.lockAlias}...`);
        let lockDetails = null;
        try {
          const detailParams = {
            clientId: TTLOCK_CLIENT_ID,
            accessToken: accessToken,
            lockId: ttlock.lockId,
            date: Date.now()
          };

          const detailResponse = await axios.post(
            `${TTLOCK_API_BASE_URL}/v3/lock/detail`,
            null,
            { params: detailParams }
          );

          if (!detailResponse.data.errcode || detailResponse.data.errcode === 0) {
            lockDetails = detailResponse.data;
            console.log(`   ✅ Got lock details with Bluetooth keys`);
          }
        } catch (detailError) {
          console.warn(`   ⚠️ Could not fetch lock details: ${detailError.message}`);
        }

        // Construct lockData for Bluetooth control (if we have the keys)
        let ttlockData = null;
        if (lockDetails && lockDetails.lockKey && lockDetails.aesKeyStr) {
          // Construct the lockData JSON that TTLock SDK expects
          ttlockData = JSON.stringify({
            lockId: ttlock.lockId,
            lockMac: lockDetails.lockMac || ttlock.lockMac,
            lockKey: lockDetails.lockKey,
            aesKeyStr: lockDetails.aesKeyStr,
            lockFlagPos: lockDetails.lockFlagPos || 0,
            adminPwd: lockDetails.adminPwd,
            noKeyPwd: lockDetails.noKeyPwd,
            deletePwd: lockDetails.deletePwd,
            lockVersion: lockDetails.lockVersion,
            electricQuantity: lockDetails.electricQuantity || ttlock.electricQuantity,
            specialValue: lockDetails.specialValue,
            timezoneRawOffset: lockDetails.timezoneRawOffset,
            modelNum: lockDetails.modelNum,
            hardwareRevision: lockDetails.hardwareRevision,
            firmwareRevision: lockDetails.firmwareRevision
          });
          console.log(`   ✅ Constructed lockData for Bluetooth control`);
        }

        // Create lock in our database with TTLock Bluetooth data
        const { data: newLock, error: lockError} = await supabase
          .from('locks')
          .insert([{
            name: ttlock.lockAlias || `Lock ${ttlock.lockId}`,
            location: ttlock.location || 'Unknown',
            device_id: `ttlock_${ttlock.lockId}`, // Prefix with ttlock_ to avoid conflicts
            mac_address: lockDetails?.lockMac || ttlock.lockMac || null,
            owner_id: userId,
            is_online: ttlock.hasGateway === 1,
            battery_level: lockDetails?.electricQuantity || ttlock.electricQuantity || 100,
            is_locked: true, // Default to locked
            firmware_version: lockDetails?.firmwareRevision || null,
            // TTLock-specific fields for Bluetooth control
            ttlock_mac: lockDetails?.lockMac || ttlock.lockMac || null,
            ttlock_data: ttlockData,
            ttlock_lock_id: ttlock.lockId,
            is_bluetooth_paired: !!ttlockData, // Paired if we have lockData
            has_gateway: ttlock.hasGateway === 1
          }])
          .select()
          .single();

        if (lockError) {
          console.error(`❌ Failed to import lock ${ttlock.lockAlias}:`, lockError);
          continue;
        }

        // Grant owner full access
        const { error: accessError } = await supabase
          .from('user_locks')
          .insert([{
            user_id: userId,
            lock_id: newLock.id,
            role: 'admin',
            can_unlock: true,
            can_lock: true,
            can_view_logs: true,
            can_manage_users: true,
            can_modify_settings: true,
            remote_unlock_enabled: true,
            is_active: true
          }]);

        if (accessError) {
          console.error(`❌ Failed to grant access for lock ${ttlock.lockAlias}:`, accessError);
          // Delete the lock since we couldn't grant access
          await supabase.from('locks').delete().eq('id', newLock.id);
          continue;
        }

        // Create default lock settings
        await supabase
          .from('lock_settings')
          .insert([{
            lock_id: newLock.id,
            auto_lock_enabled: true,
            auto_lock_delay: 30,
            passage_mode_enabled: false,
            one_touch_locking: true,
            privacy_lock: false,
            sound_enabled: true,
            sound_volume: 50,
            led_enabled: true,
            tamper_alert: true,
            wrong_code_lockout: 5
          }]);

        console.log(`✅ Imported lock: ${ttlock.lockAlias}`);
        importedCount++;

      } catch (lockImportError) {
        console.error(`❌ Error importing lock ${ttlock.lockAlias}:`, lockImportError);
      }
    }

    console.log(`✅ Import complete: ${importedCount} imported, ${skippedCount} skipped`);

    res.json({
      success: true,
      data: {
        imported: importedCount,
        skipped: skippedCount,
        total: ttlockLocks.length,
        message: `Successfully imported ${importedCount} lock(s)`
      }
    });

  } catch (error) {
    console.error('❌ Import locks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to import locks',
        details: error.message
      }
    });
  }
};

/**
 * Sync Lock Bluetooth Data
 * POST /api/ttlock/sync-lock-data
 *
 * @description Fetch Bluetooth keys from TTLock Cloud and update existing locks
 * This allows locks imported before the fix to get their Bluetooth control data
 */
export const syncLockBluetoothData = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('🔄 Syncing Bluetooth data for user locks:', userId);

    // Get user's TTLock access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token, ttlock_token_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.ttlock_access_token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Check token expiration
    const expiresAt = new Date(user.ttlock_token_expires_at);
    if (expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please reconnect TTLock account.'
        }
      });
    }

    // Decrypt token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    // Get all user's locks that are missing Bluetooth data
    const { data: userLocks, error: locksError } = await supabase
      .from('user_locks')
      .select(`
        lock_id,
        locks (
          id,
          name,
          device_id,
          ttlock_data,
          ttlock_lock_id
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (locksError || !userLocks) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_LOCKS_FAILED',
          message: 'Failed to fetch user locks'
        }
      });
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const ul of userLocks) {
      const lock = ul.locks;

      // Skip if lock already has Bluetooth data
      if (lock.ttlock_data) {
        console.log(`⏭️ Lock ${lock.name} already has Bluetooth data`);
        skippedCount++;
        continue;
      }

      // Extract TTLock ID from device_id (format: ttlock_XXXXX)
      let ttlockId = lock.ttlock_lock_id;
      if (!ttlockId && lock.device_id && lock.device_id.startsWith('ttlock_')) {
        ttlockId = parseInt(lock.device_id.replace('ttlock_', ''));
      }

      if (!ttlockId) {
        console.log(`⏭️ Lock ${lock.name} is not a TTLock device`);
        skippedCount++;
        continue;
      }

      // Fetch lock details from TTLock Cloud
      console.log(`📡 Fetching Bluetooth data for ${lock.name}...`);
      try {
        const detailParams = {
          clientId: TTLOCK_CLIENT_ID,
          accessToken: accessToken,
          lockId: ttlockId,
          date: Date.now()
        };

        const detailResponse = await axios.post(
          `${TTLOCK_API_BASE_URL}/v3/lock/detail`,
          null,
          { params: detailParams }
        );

        if (detailResponse.data.errcode && detailResponse.data.errcode !== 0) {
          console.warn(`   ⚠️ TTLock API error: ${detailResponse.data.errmsg}`);
          continue;
        }

        const lockDetails = detailResponse.data;

        // Construct lockData for Bluetooth control
        if (lockDetails.lockKey && lockDetails.aesKeyStr) {
          const ttlockData = JSON.stringify({
            lockId: ttlockId,
            lockMac: lockDetails.lockMac,
            lockKey: lockDetails.lockKey,
            aesKeyStr: lockDetails.aesKeyStr,
            lockFlagPos: lockDetails.lockFlagPos || 0,
            adminPwd: lockDetails.adminPwd,
            noKeyPwd: lockDetails.noKeyPwd,
            deletePwd: lockDetails.deletePwd,
            lockVersion: lockDetails.lockVersion,
            electricQuantity: lockDetails.electricQuantity,
            specialValue: lockDetails.specialValue,
            timezoneRawOffset: lockDetails.timezoneRawOffset,
            modelNum: lockDetails.modelNum,
            hardwareRevision: lockDetails.hardwareRevision,
            firmwareRevision: lockDetails.firmwareRevision
          });

          // Update lock in database
          const { error: updateError } = await supabase
            .from('locks')
            .update({
              ttlock_mac: lockDetails.lockMac,
              ttlock_data: ttlockData,
              ttlock_lock_id: ttlockId,
              is_bluetooth_paired: true,
              has_gateway: lockDetails.hasGateway === 1,
              battery_level: lockDetails.electricQuantity,
              firmware_version: lockDetails.firmwareRevision
            })
            .eq('id', lock.id);

          if (updateError) {
            console.error(`   ❌ Failed to update lock: ${updateError.message}`);
          } else {
            console.log(`   ✅ Updated Bluetooth data for ${lock.name}`);
            updatedCount++;
          }
        } else {
          console.warn(`   ⚠️ No Bluetooth keys available for ${lock.name}`);
        }
      } catch (detailError) {
        console.warn(`   ⚠️ Could not fetch lock details: ${detailError.message}`);
      }
    }

    console.log(`✅ Sync complete: ${updatedCount} updated, ${skippedCount} skipped`);

    res.json({
      success: true,
      data: {
        updated: updatedCount,
        skipped: skippedCount,
        total: userLocks.length,
        message: updatedCount > 0
          ? `Successfully synced Bluetooth data for ${updatedCount} lock(s)`
          : 'All locks already have Bluetooth data'
      }
    });

  } catch (error) {
    console.error('❌ Sync lock data error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to sync lock data',
        details: error.message
      }
    });
  }
};

/**
 * Control Lock (Hybrid: Cloud API with Bluetooth fallback)
 * POST /api/ttlock/lock/:lockId/control
 *
 * @description Hybrid lock control that tries Cloud API first, falls back to Bluetooth
 */
export const controlLock = async (req, res) => {
  try {
    const { lockId } = req.params; // This is our internal database lock ID
    const { action } = req.body; // 'lock' or 'unlock'
    const userId = req.user.id;

    logger.lock.control(lockId, action, userId, 'ttlock_cloud');

    // Validate action
    if (!action || !['lock', 'unlock'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Action must be "lock" or "unlock"'
        }
      });
    }

    // Get the lock from database to get the TTLock lock ID
    const { data: lockRecord, error: lockError } = await supabase
      .from('locks')
      .select('id, device_id, name, has_gateway')
      .eq('id', lockId)
      .single();

    if (lockError || !lockRecord) {
      logger.warn('[TTLOCK] ⚠️ Lock not found:', { lockId, error: lockError?.message });
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Extract TTLock lock ID from device_id (format: "ttlock_12345")
    let ttlockLockId = null;
    if (lockRecord.device_id && lockRecord.device_id.startsWith('ttlock_')) {
      ttlockLockId = lockRecord.device_id.replace('ttlock_', '');
    }

    if (!ttlockLockId) {
      logger.warn('[TTLOCK] ⚠️ No TTLock ID found for lock:', { lockId });
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_TTLOCK_ID',
          message: 'This lock is not linked to TTLock cloud. Please use Bluetooth control.',
          bluetooth_required: true
        }
      });
    }

    logger.info(`[TTLOCK] 🔐 Controlling lock "${lockRecord.name}" (TTLock ID: ${ttlockLockId}) - Action: ${action}`);

    // Get user's access token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_access_token, ttlock_token_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.ttlock_access_token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Check token expiration
    const expiresAt = new Date(user.ttlock_token_expires_at);
    if (expiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please refresh token.'
        }
      });
    }

    // Decrypt token
    const accessToken = decrypt(user.ttlock_access_token);

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt access token'
        }
      });
    }

    // Try TTLock Cloud API (via gateway)
    logger.ttlock.apiCall(action === 'unlock' ? '/v3/lock/unlock' : '/v3/lock/lock', 'POST', null, { ttlockLockId, action });

    const endpoint = action === 'unlock'
      ? `${TTLOCK_API_BASE_URL}/v3/lock/unlock`
      : `${TTLOCK_API_BASE_URL}/v3/lock/lock`;

    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken: accessToken,
      lockId: parseInt(ttlockLockId), // Use TTLock cloud lock ID, not internal database ID
      date: Date.now()
    };

    try {
      const response = await axios.post(endpoint, null, { params });

      // Check for TTLock API errors
      if (response.data.errcode && response.data.errcode !== 0) {
        logger.error('[TTLOCK] ❌ TTLock API error:', { errcode: response.data.errcode, errmsg: response.data.errmsg, lockId, action });

        // Handle specific error codes
        if (response.data.errcode === -2007) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_GATEWAY',
              message: 'Lock not paired with gateway. Gateway required for remote control.',
              ttlock_errcode: response.data.errcode
            }
          });
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'TTLOCK_ERROR',
            message: response.data.errmsg || response.data.description || 'Lock control failed',
            ttlock_errcode: response.data.errcode
          }
        });
      }

      logger.lock.unlock(lockId, userId, true, { method: 'cloud_api', ttlockLockId });
      logger.info(`[TTLOCK] ✅ Lock ${action} successful via Cloud API for lock ${lockId}`);

      const eventAction = action === 'unlock' ? EventAction.UNLOCKED : EventAction.LOCKED;
      const eventMetadata = {
        method: 'cloud_api',
        gateway: true,
        ttlock_lock_id: ttlockLockId
      };

      await logEvent({
        lockId,
        userId,
        action: eventAction,
        accessMethod: AccessMethod.REMOTE,
        metadata: eventMetadata
      });

      sendSmartNotification({
        lockId,
        action: eventAction,
        userId,
        metadata: eventMetadata
      }).catch(err => console.error('Notification error:', err));

      return res.json({
        success: true,
        message: `Lock ${action}ed successfully`,
        data: {
          lock_id: lockId,
          action,
          method: 'cloud_api',
          timestamp: new Date().toISOString()
        }
      });

    } catch (apiError) {
      logger.error('[TTLOCK] ❌ TTLock Cloud API error:', { error: apiError.response?.data || apiError.message, lockId, action });

      // If Cloud API fails, suggest Bluetooth
      return res.status(500).json({
        success: false,
        error: {
          code: 'CLOUD_API_FAILED',
          message: 'Cloud API control failed. Please try Bluetooth control via mobile app.',
          details: apiError.response?.data?.errmsg || apiError.message,
          fallback: 'bluetooth'
        }
      });
    }

  } catch (error) {
    logger.error('[TTLOCK] ❌ Control lock error:', { error: error.message, lockId: req.params.lockId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to control lock',
        details: error.message
      }
    });
  }
};
