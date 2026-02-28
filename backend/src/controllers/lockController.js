import { supabase } from '../services/supabase.js';
import { sendSmartNotification, logEvent, EventAction, AccessMethod } from '../services/ai/index.js';
import logger from '../utils/logger.js';

/**
 * Get All User's Locks
 * GET /locks
 */
export const getAllLocks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { role } = req.query;
    logger.request('getAllLocks', userId, null, { role });

    let query = supabase
      .from('user_locks')
      .select(`
        lock_id,
        role,
        is_active,
        can_unlock,
        can_lock,
        can_view_logs,
        can_manage_users,
        can_modify_settings,
        remote_unlock_enabled,
        can_manage_own_credentials,
        can_view_own_logs_only,
        time_restricted,
        days_of_week,
        time_restriction_start,
        time_restriction_end,
        access_valid_from,
        access_valid_until,
        locks (
          id,
          name,
          location,
          device_id,
          mac_address,
          is_online,
          battery_level,
          is_locked,
          created_at,
          updated_at,
          ttlock_data,
          ttlock_mac,
          ttlock_lock_id,
          is_bluetooth_paired,
          has_gateway
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    // Filter by role if specified
    if (role) {
      query = query.eq('role', role);
    }

    const { data: userLocks, error } = await query;

    if (error) {
      logger.warn('[LOCK] ⚠️ Supabase returned error loading locks:', { error: error.message || error, userId });
      return res.json({
        success: true,
        data: []
      });
    }

    const safeUserLocks = Array.isArray(userLocks) ? userLocks : [];

    // Transform the data to flatten the structure including permissions
    const locks = safeUserLocks.map(ul => ({
      ...ul.locks,
      user_role: ul.role,
      user_lock_active: ul.is_active,
      // Include permissions for role-based UI controls
      can_unlock: ul.can_unlock,
      can_lock: ul.can_lock,
      can_view_logs: ul.can_view_logs,
      can_manage_users: ul.can_manage_users,
      can_modify_settings: ul.can_modify_settings,
      remote_unlock_enabled: ul.remote_unlock_enabled,
      can_manage_own_credentials: ul.can_manage_own_credentials,
      can_view_own_logs_only: ul.can_view_own_logs_only,
      // Schedule and access validity
      time_restricted: ul.time_restricted,
      days_of_week: ul.days_of_week,
      time_restriction_start: ul.time_restriction_start,
      time_restriction_end: ul.time_restriction_end,
      access_valid_from: ul.access_valid_from,
      access_valid_until: ul.access_valid_until,
    }));

    logger.info(`[LOCK] ✅ Retrieved ${locks.length} locks for user ${userId}`);
    res.json({
      success: true,
      data: locks
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Get all locks error:', { error: error.message, userId: req.user?.id });
    res.json({
      success: true,
      data: []
    });
  }
};

/**
 * Get Lock Details
 * GET /locks/:lockId
 */
export const getLockDetails = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    logger.request('getLockDetails', userId, lockId, {});

    // Get lock with user's access information
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('role, can_unlock, can_lock, can_view_logs, can_manage_users, can_modify_settings, remote_unlock_enabled')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this lock'
        }
      });
    }

    // Get lock details including recovery keys (only for admins/owners)
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select(`
        id,
        name,
        location,
        device_id,
        mac_address,
        is_online,
        battery_level,
        is_locked,
        firmware_version,
        created_at,
        updated_at,
        ttlock_data,
        ttlock_mac,
        ttlock_lock_id,
        is_bluetooth_paired,
        has_gateway,
        recovery_key,
        admin_pwd,
        delete_pwd,
        no_key_pwd,
        owner:owner_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Get lock settings
    const { data: settings } = await supabase
      .from('lock_settings')
      .select('*')
      .eq('lock_id', lockId)
      .single();

    // Get recent activity (last 10 events)
    const { data: recentActivity } = await supabase
      .from('activity_logs')
      .select('id, action, timestamp, access_method, user:user_id(first_name, last_name)')
      .eq('lock_id', lockId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Get shared users count
    const { count: sharedUsersCount } = await supabase
      .from('user_locks')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .neq('user_id', lock.owner.id);

    // Only include recovery keys for admins/owners (role = admin or owner via user_locks)
    const isAdminOrOwner = userLock.role === 'owner' || userLock.role === 'admin' || lock.owner?.id === userId;
    const lockData = {
      ...lock,
      shared_users_count: sharedUsersCount || 0,
      // Strip recovery keys if not admin/owner
      ...(isAdminOrOwner ? {} : {
        recovery_key: undefined,
        admin_pwd: undefined,
        delete_pwd: undefined,
        no_key_pwd: undefined,
      })
    };

    logger.info(`[LOCK] ✅ Retrieved details for lock ${lockId} (${lock.name})`);
    res.json({
      success: true,
      data: {
        lock: lockData,
        settings,
        permissions: userLock,
        recent_activity: recentActivity || []
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Get lock details error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch lock details'
      }
    });
  }
};

/**
 * Add New Lock
 * POST /locks
 */
export const addLock = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      location,
      device_id,
      mac_address,
      // TTLock-specific fields for Bluetooth pairing
      ttlock_mac,
      ttlock_data,
      ttlock_lock_name,
      ttlock_lock_id,
      is_bluetooth_paired,
      battery_level: initialBattery,
      is_locked: initialLockState,
      // TTLock recovery keys (from SDK initialization)
      admin_pwd,
      delete_pwd,
      no_key_pwd
    } = req.body;

    // Use ttlock_mac as device_id if not provided
    // device_id is required by database, so we must generate one if not provided
    const effectiveDeviceId = device_id || (ttlock_mac ? `ttlock_bt_${ttlock_mac.replace(/:/g, '_')}` : `lock_${Date.now()}`);
    const effectiveMacAddress = mac_address || ttlock_mac;
    
    // Ensure we have a device_id (required by database)
    if (!effectiveDeviceId) {
      console.error('[LOCK] ❌ No device_id or MAC address provided');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DEVICE_ID',
          message: 'Device ID or MAC address is required to add a lock'
        }
      });
    }

    // Log incoming request for debugging
    console.log('[LOCK] Add lock request:', {
      userId,
      name,
      location,
      device_id,
      mac_address,
      ttlock_mac,
      ttlock_lock_id,
      ttlock_lock_name,
      is_bluetooth_paired,
      has_ttlock_data: !!ttlock_data,
      effectiveDeviceId,
      effectiveMacAddress,
      battery_level: initialBattery,
      is_locked: initialLockState
    });

    // Check if device already exists (by MAC address for Bluetooth locks)
    // If it exists and belongs to the current user, allow updating it
    if (ttlock_mac) {
      const { data: existingByMac, error: macCheckError } = await supabase
        .from('locks')
        .select('id, owner_id, name')
        .eq('mac_address', ttlock_mac)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when not found

      // If there's an error (other than not found), log it
      if (macCheckError) {
        console.error('[LOCK] Error checking for existing lock:', macCheckError);
        // Continue anyway - we'll try to insert and let the database handle duplicates
      }

      if (existingByMac) {
        console.log(`🔍 Found existing lock with MAC ${ttlock_mac}:`, {
          lockId: existingByMac.id,
          ownerId: existingByMac.owner_id,
          currentUserId: userId,
          belongsToUser: existingByMac.owner_id === userId
        });

        // If the lock belongs to the current user, update it instead of rejecting
        if (existingByMac.owner_id === userId) {
          console.log(`🔄 Lock with MAC ${ttlock_mac} already exists for this user. Updating existing lock...`);
          
          // Update the existing lock with new data
          const updateData = {
            name: name || existingByMac.name,
            location: location || 'Home',
            device_id: effectiveDeviceId,
            // Update TTLock-specific fields
            ttlock_mac: ttlock_mac,
            ttlock_data: ttlock_data || null,
            ttlock_lock_id: ttlock_lock_id || null,
            ttlock_lock_name: ttlock_lock_name || null,
            is_bluetooth_paired: is_bluetooth_paired || false,
            paired_at: is_bluetooth_paired ? new Date().toISOString() : null,
            battery_level: initialBattery !== undefined && initialBattery !== null ? initialBattery : 100,
            is_locked: initialLockState !== undefined ? initialLockState : true,
            // Update recovery keys if provided
            admin_pwd: admin_pwd || null,
            delete_pwd: delete_pwd || null,
            no_key_pwd: no_key_pwd || null,
            updated_at: new Date().toISOString()
          };

          const { data: updatedLock, error: updateError } = await supabase
            .from('locks')
            .update(updateData)
            .eq('id', existingByMac.id)
            .select()
            .single();

          if (updateError) {
            logger.error('[LOCK] ❌ Failed to update existing lock:', { error: updateError.message, lockId: existingByMac.id });
            return res.status(500).json({
              success: false,
              error: {
                code: 'UPDATE_FAILED',
                message: 'Failed to update existing lock',
                details: updateError.message
              }
            });
          }

          // Ensure user has access (in case it was removed)
          const { data: existingAccess } = await supabase
            .from('user_locks')
            .select('id')
            .eq('user_id', userId)
            .eq('lock_id', existingByMac.id)
            .maybeSingle();

          if (!existingAccess) {
            // Re-add access if it was removed
            await supabase
              .from('user_locks')
              .insert([{
                user_id: userId,
                lock_id: existingByMac.id,
                role: 'owner',  // Lock owner gets 'owner' role
                can_unlock: true,
                can_lock: true,
                can_view_logs: true,
                can_manage_users: true,
                can_modify_settings: true,
                remote_unlock_enabled: true,
                is_active: true
              }]);
          }

          logger.lock.add(userId, updatedLock.name, 'updated', { ttlock_mac, ttlock_lock_id, is_bluetooth_paired });
          
          return res.status(200).json({
            success: true,
            message: 'Lock updated successfully',
            data: updatedLock
          });
        } else {
          // Lock exists but belongs to another user
          // Since the user is pairing via Bluetooth, they have physical access to the lock
          // We should allow them to reassign it to their account (delete old and create new)
          console.log(`⚠️ Lock with MAC ${ttlock_mac} exists for another user (${existingByMac.owner_id}). Reassigning to current user (${userId})...`);
          
          // Delete the old lock record and all associated data
          // This is safe because the user has physical access to the lock (they're pairing it)
          const { error: deleteError } = await supabase
            .from('locks')
            .delete()
            .eq('id', existingByMac.id);

          if (deleteError) {
            console.error('[LOCK] ❌ Failed to delete old lock record:', deleteError);
            // Continue anyway - we'll try to create new record
          } else {
            console.log(`✅ Deleted old lock record ${existingByMac.id} to allow reassignment`);
          }

          // Also delete all related data for the old lock
          // Delete user_locks associations
          await supabase
            .from('user_locks')
            .delete()
            .eq('lock_id', existingByMac.id);

          // Delete lock settings
          await supabase
            .from('lock_settings')
            .delete()
            .eq('lock_id', existingByMac.id);

          // Delete any ekeys, passcodes, fingerprints, cards associated with old lock
          // (These will be cleaned up by CASCADE, but we'll do it explicitly for safety)
          await supabase
            .from('ekeys')
            .delete()
            .eq('lock_id', existingByMac.id);
          
          await supabase
            .from('passcodes')
            .delete()
            .eq('lock_id', existingByMac.id);

          // Continue to create new lock record below
          console.log(`🆕 Proceeding to create new lock record for user ${userId}`);
        }
      }
    }

    // Check if device_id already exists (only if MAC check didn't find anything)
    if (effectiveDeviceId && !ttlock_mac) {
      const { data: existingLock, error: deviceCheckError } = await supabase
        .from('locks')
        .select('id, owner_id')
        .eq('device_id', effectiveDeviceId)
        .single();

      if (existingLock) {
        // If the lock belongs to the current user, update it
        if (existingLock.owner_id === userId) {
          console.log(`🔄 Lock with device_id ${effectiveDeviceId} already exists for this user. Updating...`);
          
          const updateData = {
            name: name || 'Lock',
            location: location || 'Home',
            mac_address: effectiveMacAddress,
            battery_level: initialBattery !== undefined ? initialBattery : 100,
            is_locked: initialLockState !== undefined ? initialLockState : true,
            updated_at: new Date().toISOString()
          };

          const { data: updatedLock, error: updateError } = await supabase
            .from('locks')
            .update(updateData)
            .eq('id', existingLock.id)
            .select()
            .single();

          if (updateError) {
            return res.status(500).json({
              success: false,
              error: {
                code: 'UPDATE_FAILED',
                message: 'Failed to update existing lock'
              }
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Lock updated successfully',
            data: updatedLock
          });
        } else {
          return res.status(400).json({
            success: false,
            error: {
              code: 'DUPLICATE_DEVICE',
              message: 'This lock is already registered'
            }
          });
        }
      }
    }

    // Ensure we have a name - use lock name from TTLock or generate one
    const lockName = name || ttlock_lock_name || `Lock ${ttlock_mac ? ttlock_mac.slice(-4) : 'New'}`;
    
    console.log('[LOCK] Creating new lock with name:', lockName);
    logger.lock.add(userId, lockName, 'pending', { ttlock_mac, ttlock_lock_id, is_bluetooth_paired });

    // Atomic transaction: create lock + grant owner access + default settings
    const lockData = {
      name: lockName,
      location: location || 'Home',
      device_id: effectiveDeviceId,
      mac_address: effectiveMacAddress,
      battery_level: initialBattery !== undefined && initialBattery !== null ? initialBattery : 100,
      is_locked: initialLockState !== undefined ? String(initialLockState) : 'true',
      ttlock_mac: ttlock_mac || null,
      ttlock_data: ttlock_data || null,
      ttlock_lock_id: ttlock_lock_id ? String(ttlock_lock_id) : null,
      is_bluetooth_paired: is_bluetooth_paired ? 'true' : 'false',
      admin_pwd: admin_pwd || null,
      delete_pwd: delete_pwd || null,
      no_key_pwd: no_key_pwd || null
    };

    const { data: lock, error: rpcError } = await supabase
      .rpc('add_lock_with_access', {
        p_lock_data: lockData,
        p_user_id: userId
      });

    if (rpcError) {
      console.error('[LOCK] ❌ Transaction error:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });

      logger.error('[LOCK] ❌ Failed to create lock:', {
        error: rpcError.message || rpcError,
        code: rpcError.code,
        name,
        userId
      });

      let errorMessage = 'Failed to create lock';
      if (rpcError.code === '23505') {
        errorMessage = 'This lock is already registered';
      } else if (rpcError.code === '23503') {
        errorMessage = 'Invalid user or lock reference';
      } else if (rpcError.code === '23502') {
        errorMessage = `Missing required field`;
      } else if (rpcError.message) {
        errorMessage = rpcError.message;
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: errorMessage,
          details: rpcError.details || rpcError.message
        }
      });
    }

    logger.lock.add(userId, name, 'success', { lockId: lock.id });
    res.status(201).json({
      success: true,
      data: lock
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Add lock error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add lock'
      }
    });
  }
};

/**
 * Update Lock
 * PATCH /locks/:lockId
 */
export const updateLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const updates = req.body;
    const userId = req.user?.id;
    logger.request('updateLock', userId, lockId, updates);

    // Only allow updating specific fields
    const allowedUpdates = {};
    if (updates.name !== undefined && updates.name !== null) {
      allowedUpdates.name = updates.name;
    }
    if (updates.location !== undefined && updates.location !== null) {
      allowedUpdates.location = updates.location;
    }
    // Allow recovery_key to be updated (for SafetyBackup screen during lock setup)
    if (updates.recovery_key !== undefined) {
      allowedUpdates.recovery_key = updates.recovery_key;
    }

    // Check if there are any updates to make
    if (Object.keys(allowedUpdates).length === 0) {
      // No updates to make, just return the current lock
      const { data: lock, error } = await supabase
        .from('locks')
        .select('*')
        .eq('id', lockId)
        .single();

      if (error) {
        logger.warn('[LOCK] ⚠️ Failed to fetch lock for update:', { error: error.message, lockId });
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Lock not found'
          }
        });
      }

      return res.json({
        success: true,
        data: lock
      });
    }

    // Add updated_at timestamp
    allowedUpdates.updated_at = new Date().toISOString();

    const { data: lock, error } = await supabase
      .from('locks')
      .update(allowedUpdates)
      .eq('id', lockId)
      .select()
      .single();

    if (error) {
      logger.error('[LOCK] ❌ Failed to update lock:', { error: error.message, lockId });
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update lock',
          details: error.message
        }
      });
    }

    logger.lock.settings(lockId, allowedUpdates, true);
    res.json({
      success: true,
      data: lock
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Update lock error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update lock'
      }
    });
  }
};

/**
 * Delete Lock
 * DELETE /locks/:lockId
 */
export const deleteLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    // Get full lock details including TTLock ID for cloud deletion
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('owner_id, ttlock_lock_id, name')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    if (lock.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owner can delete this lock'
        }
      });
    }

    let deletedFromCloud = false;
    let cloudDeleteMessage = null;

    // If lock has TTLock Cloud ID, delete from TTLock Cloud first
    if (lock.ttlock_lock_id) {
      console.log(`🗑️  Deleting lock "${lock.name}" from TTLock Cloud (ID: ${lock.ttlock_lock_id})`);

      try {
        // Get user's TTLock access token
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('ttlock_access_token')
          .eq('id', userId)
          .single();

        if (user && user.ttlock_access_token) {
          // Import the deleteLockFromCloud function dynamically to avoid circular deps
          const { deleteLockFromCloud } = await import('./ttlock-cloud-api-v3/lock.js');

          // Create a mock request/response to call the cloud delete function
          const mockReq = {
            user: { id: userId },
            body: { lockId: lock.ttlock_lock_id }
          };

          let cloudResult = null;
          const mockRes = {
            status: () => ({ json: (data) => { cloudResult = data; } }),
            json: (data) => { cloudResult = data; }
          };

          await deleteLockFromCloud(mockReq, mockRes);

          if (cloudResult && cloudResult.success) {
            deletedFromCloud = true;
            cloudDeleteMessage = cloudResult.message;
            console.log('✅ Lock deleted from TTLock Cloud');
          } else {
            console.warn('⚠️ TTLock Cloud delete warning:', cloudResult?.error?.message);
            cloudDeleteMessage = cloudResult?.error?.message || 'Cloud delete failed but continuing with local delete';
          }
        } else {
          console.log('ℹ️  No TTLock account connected - skipping cloud delete');
          cloudDeleteMessage = 'No TTLock account connected - lock only removed locally';
        }
      } catch (cloudError) {
        console.error('⚠️ TTLock Cloud delete error (continuing with local delete):', cloudError.message);
        cloudDeleteMessage = `Cloud delete failed: ${cloudError.message}`;
        // Don't fail the whole delete operation if cloud delete fails
        // The user can still re-delete from TTLock app if needed
      }
    }

    // Delete lock from local database (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('locks')
      .delete()
      .eq('id', lockId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete lock from database'
        }
      });
    }

    console.log(`✅ Lock "${lock.name}" deleted from local database`);

    res.json({
      success: true,
      message: deletedFromCloud
        ? 'Lock deleted from both AwayKey and TTLock Cloud'
        : 'Lock deleted successfully',
      deleted_from_cloud: deletedFromCloud,
      cloud_message: cloudDeleteMessage
    });
  } catch (error) {
    console.error('Delete lock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete lock'
      }
    });
  }
};

/**
 * Factory Reset Lock (Clear all data but keep lock)
 * POST /locks/:lockId/factory-reset
 *
 * This clears all data from the lock (fingerprints, IC cards, passcodes, eKeys)
 * via TTLock Cloud API, then deletes related data from our database.
 * The lock record itself remains so the user can still lock/unlock.
 */
export const factoryResetLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Factory Reset requested for lock ${lockId} by user ${userId}`);

    // Get lock details
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('owner_id, ttlock_lock_id, name')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    if (lock.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owner can factory reset this lock'
        }
      });
    }

    const results = {
      fingerprints_cleared: false,
      ic_cards_cleared: false,
      ekeys_reset: false,
      database_cleared: false
    };

    // If lock has TTLock Cloud ID, clear data via TTLock API
    if (lock.ttlock_lock_id) {
      console.log(`📡 Clearing TTLock Cloud data for "${lock.name}" (ID: ${lock.ttlock_lock_id})`);

      try {
        // Get user's TTLock access token
        const { data: user } = await supabase
          .from('users')
          .select('ttlock_access_token')
          .eq('id', userId)
          .single();

        if (user && user.ttlock_access_token) {
          const { decrypt } = await import('../utils/ttlockCrypto.js');
          const accessToken = decrypt(user.ttlock_access_token);

          if (accessToken) {
            const {
              clearAllFingerprints,
              clearAllICCards,
              resetAllEKeys
            } = await import('./ttlock-cloud-api-v3/lock.js');

            // Clear fingerprints
            try {
              await clearAllFingerprints(accessToken, lock.ttlock_lock_id);
              results.fingerprints_cleared = true;
              console.log('✅ Fingerprints cleared from TTLock Cloud');
            } catch (err) {
              console.warn('⚠️ Clear fingerprints failed:', err.message);
            }

            // Clear IC cards
            try {
              await clearAllICCards(accessToken, lock.ttlock_lock_id);
              results.ic_cards_cleared = true;
              console.log('✅ IC Cards cleared from TTLock Cloud');
            } catch (err) {
              console.warn('⚠️ Clear IC cards failed:', err.message);
            }

            // Reset eKeys (except admin)
            try {
              await resetAllEKeys(accessToken, lock.ttlock_lock_id);
              results.ekeys_reset = true;
              console.log('✅ eKeys reset in TTLock Cloud');
            } catch (err) {
              console.warn('⚠️ Reset eKeys failed:', err.message);
            }
          }
        } else {
          console.log('ℹ️ No TTLock account connected - skipping cloud clear');
        }
      } catch (cloudError) {
        console.error('⚠️ TTLock Cloud clear error:', cloudError.message);
      }
    }

    // Clear related data from our database (but keep the lock record)
    console.log('🗑️ Clearing related data from database...');

    // Delete fingerprints
    const { error: fingerprintError } = await supabase
      .from('fingerprints')
      .delete()
      .eq('lock_id', lockId);
    if (fingerprintError) console.warn('⚠️ Delete fingerprints error:', fingerprintError.message);

    // Delete IC cards
    const { error: icCardError } = await supabase
      .from('ic_cards')
      .delete()
      .eq('lock_id', lockId);
    if (icCardError) console.warn('⚠️ Delete IC cards error:', icCardError.message);

    // Delete passcodes
    const { error: passcodeError } = await supabase
      .from('passcodes')
      .delete()
      .eq('lock_id', lockId);
    if (passcodeError) console.warn('⚠️ Delete passcodes error:', passcodeError.message);

    // Delete eKeys
    const { error: ekeyError } = await supabase
      .from('ekeys')
      .delete()
      .eq('lock_id', lockId);
    if (ekeyError) console.warn('⚠️ Delete eKeys error:', ekeyError.message);

    // Delete activity logs
    const { error: activityError } = await supabase
      .from('activity_logs')
      .delete()
      .eq('lock_id', lockId);
    if (activityError) console.warn('⚠️ Delete activity logs error:', activityError.message);

    // Delete user_locks for non-owners (remove shared access)
    const { error: userLocksError } = await supabase
      .from('user_locks')
      .delete()
      .eq('lock_id', lockId)
      .neq('user_id', userId); // Keep owner's access
    if (userLocksError) console.warn('⚠️ Delete user_locks error:', userLocksError.message);

    // Reset lock_settings to defaults
    const { error: settingsError } = await supabase
      .from('lock_settings')
      .update({
        auto_lock_enabled: true,
        auto_lock_delay: 30,
        passage_mode_enabled: false,
        sound_enabled: true,
        sound_volume: 50,
        anti_peep_password: false,
        reset_button_enabled: true
      })
      .eq('lock_id', lockId);
    if (settingsError) console.warn('⚠️ Reset settings error:', settingsError.message);

    // Clear Bluetooth pairing data - the lock's encryption keys are wiped during factory reset,
    // so the stored ttlock_data is no longer valid. User must re-pair via Bluetooth.
    const { error: clearPairingError } = await supabase
      .from('locks')
      .update({
        ttlock_data: null,
        is_bluetooth_paired: false,
        admin_pwd: null,
        delete_pwd: null,
        no_key_pwd: null
      })
      .eq('id', lockId);
    if (clearPairingError) console.warn('⚠️ Clear pairing data error:', clearPairingError.message);

    results.database_cleared = true;
    results.bluetooth_pairing_cleared = true;
    console.log(`✅ Factory Reset completed for lock "${lock.name}" - Bluetooth pairing cleared, re-pair required`);

    res.json({
      success: true,
      message: 'Lock factory reset completed. All data cleared. Please re-pair with the lock via Bluetooth.',
      data: {
        lock_id: lockId,
        lock_name: lock.name,
        ...results
      }
    });
  } catch (error) {
    console.error('Factory reset error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to factory reset lock'
      }
    });
  }
};

/**
 * Pair Lock via Bluetooth
 * POST /locks/:lockId/pair
 */
export const pairLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    // In a real implementation, this would:
    // 1. Initiate Bluetooth pairing with the physical lock
    // 2. Exchange encryption keys
    // 3. Verify the pairing was successful
    // 4. Update the lock status

    // For now, we'll simulate a successful pairing
    const { data: lock, error } = await supabase
      .from('locks')
      .update({ is_online: true })
      .eq('id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'PAIRING_FAILED',
          message: 'Failed to pair with lock'
        }
      });
    }

    // Log the pairing activity
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        action: 'unlocked',
        access_method: 'phone',
        location: null
      }]);

    res.json({
      success: true,
      data: {
        lock,
        message: 'Lock paired successfully'
      }
    });
  } catch (error) {
    console.error('Pair lock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to pair lock'
      }
    });
  }
};

/**
 * Lock Door
 * POST /locks/:lockId/lock
 */
export const lockDoor = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { access_method = 'remote', location } = req.body;
    logger.lock.control(lockId, 'lock', userId, access_method);

    // Check if user has lock permission with access validity fields
    const { data: access, error: accessError } = await supabase
      .from('user_locks')
      .select('can_lock, access_valid_from, access_valid_until')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !access || !access.can_lock) {
      logger.security.failedAttempt(lockId, 'lock', { userId, reason: 'No lock permission' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to lock this door'
        }
      });
    }

    // Check access date validity (expired users cannot lock either)
    const now = new Date();
    if (access.access_valid_from && new Date(access.access_valid_from) > now) {
      logger.security.failedAttempt(lockId, 'lock', { userId, reason: 'Access not yet valid' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_NOT_YET_VALID',
          message: 'Your access is not yet active'
        }
      });
    }
    if (access.access_valid_until && new Date(access.access_valid_until) < now) {
      logger.security.failedAttempt(lockId, 'lock', { userId, reason: 'Access expired' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_EXPIRED',
          message: 'Your access has expired'
        }
      });
    }

    // In a real implementation, this would send a command to the physical lock
    // For now, we'll update the database state
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .update({ is_locked: true })
      .eq('id', lockId)
      .select()
      .single();

    if (lockError) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOCK_FAILED',
          message: 'Failed to lock door'
        }
      });
    }

    // Log the activity using AI event logger
    await logEvent({
      lockId,
      userId,
      action: EventAction.LOCKED,
      accessMethod: access_method || AccessMethod.REMOTE,
      metadata: location ? { location } : {}
    });

    // Send smart notification (async, don't wait)
    sendSmartNotification({
      lockId,
      action: EventAction.LOCKED,
      userId,
      metadata: { access_method }
    }).catch(err => console.error('Notification error:', err));

    logger.lock.control(lockId, 'lock', access_method, true, { userId });
    res.json({
      success: true,
      data: {
        is_locked: lock.is_locked,
        message: 'Door locked successfully'
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Lock door error:', { error: error.message, lockId: req.params.lockId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to lock door'
      }
    });
  }
};

/**
 * Unlock Door
 * POST /locks/:lockId/unlock
 *
 * Time restriction enforcement for:
 * - scheduled: Daily time window + days of week
 * - guest_longterm: Access valid from/until dates
 */
export const unlockDoor = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { access_method = 'remote', location } = req.body;
    logger.lock.control(lockId, 'unlock', userId, access_method);

    // Check if user has unlock permission with all time restriction fields
    const { data: access, error: accessError } = await supabase
      .from('user_locks')
      .select(`
        role,
        can_unlock,
        remote_unlock_enabled,
        time_restricted,
        time_restriction_start,
        time_restriction_end,
        days_of_week,
        access_valid_from,
        access_valid_until,
        time_restrictions
      `)
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !access || !access.can_unlock) {
      logger.security.failedAttempt(lockId, 'unlock', { userId, reason: 'No unlock permission' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to unlock this door'
        }
      });
    }

    // Check if remote unlock is enabled
    if (access_method === 'remote' && !access.remote_unlock_enabled) {
      logger.security.failedAttempt(lockId, 'unlock', { userId, reason: 'Remote unlock disabled' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'REMOTE_UNLOCK_DISABLED',
          message: 'Remote unlock is not enabled for your account'
        }
      });
    }

    // ============================================================
    // TIME RESTRICTION ENFORCEMENT (New comprehensive check)
    // ============================================================
    const now = new Date();

    // Check access_valid_from (access not yet valid)
    if (access.access_valid_from) {
      const validFrom = new Date(access.access_valid_from);
      if (validFrom > now) {
        const formattedDate = validFrom.toLocaleDateString();
        logger.security.failedAttempt(lockId, 'unlock', { userId, reason: `Access starts ${formattedDate}` });
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_NOT_YET_VALID',
            message: 'Your access is not yet active',
            details: {
              valid_from: access.access_valid_from,
              message: `Access starts on ${formattedDate}`
            }
          }
        });
      }
    }

    // Check access_valid_until (access expired)
    if (access.access_valid_until) {
      const validUntil = new Date(access.access_valid_until);
      if (validUntil < now) {
        const formattedDate = validUntil.toLocaleDateString();
        logger.security.failedAttempt(lockId, 'unlock', { userId, reason: `Access expired ${formattedDate}` });
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_EXPIRED',
            message: 'Your access has expired',
            details: {
              expired_at: access.access_valid_until,
              message: `Access expired on ${formattedDate}`
            }
          }
        });
      }
    }

    // Check daily time window for restricted roles or time_restricted users
    if (access.time_restricted || access.role === 'scheduled') {
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

      // Check day of week
      const allowedDays = access.days_of_week || [0, 1, 2, 3, 4, 5, 6]; // Default: all days
      if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const allowedDayNames = allowedDays.map(d => dayNames[d]).join(', ');
        logger.security.failedAttempt(lockId, 'unlock', { userId, reason: `Day restriction: ${dayNames[currentDay]} not in allowed days` });
        return res.status(403).json({
          success: false,
          error: {
            code: 'DAY_RESTRICTION',
            message: 'Access not allowed on this day',
            details: {
              current_day: dayNames[currentDay],
              allowed_days: allowedDayNames
            }
          }
        });
      }

      // Check time window
      if (access.time_restriction_start && access.time_restriction_end) {
        const startTime = access.time_restriction_start.slice(0, 5); // HH:MM
        const endTime = access.time_restriction_end.slice(0, 5);

        if (currentTime < startTime || currentTime > endTime) {
          logger.security.failedAttempt(lockId, 'unlock', { userId, reason: `Time restriction: ${currentTime} outside ${startTime}-${endTime}` });
          return res.status(403).json({
            success: false,
            error: {
              code: 'TIME_RESTRICTION',
              message: 'Access not allowed at this time',
              details: {
                current_time: currentTime,
                allowed_window: `${startTime} - ${endTime}`,
                message: `Access allowed between ${startTime} and ${endTime}`
              }
            }
          });
        }
      }
    }

    // Legacy time_restrictions JSON field support (backwards compatibility)
    if (access.time_restrictions && access.time_restrictions.enabled) {
      const currentDay = now.getDay();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const restrictions = access.time_restrictions;

      if (restrictions.days_of_week && !restrictions.days_of_week.includes(currentDay)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TIME_RESTRICTION',
            message: 'Access not allowed on this day'
          }
        });
      }

      if (restrictions.start_time && restrictions.end_time) {
        if (currentTime < restrictions.start_time || currentTime > restrictions.end_time) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'TIME_RESTRICTION',
              message: 'Access not allowed at this time'
            }
          });
        }
      }
    }

    // In a real implementation, this would send a command to the physical lock
    // For now, we'll update the database state
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .update({ is_locked: false })
      .eq('id', lockId)
      .select()
      .single();

    if (lockError) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UNLOCK_FAILED',
          message: 'Failed to unlock door'
        }
      });
    }

    // Log the activity using AI event logger
    await logEvent({
      lockId,
      userId,
      action: EventAction.UNLOCKED,
      accessMethod: access_method || AccessMethod.REMOTE,
      metadata: location ? { location } : {}
    });

    // Send smart notification (async, don't wait)
    // Smart notifications handle all users with access, not just owner
    sendSmartNotification({
      lockId,
      action: EventAction.UNLOCKED,
      userId,
      metadata: { access_method }
    }).catch(err => console.error('Notification error:', err));

    logger.lock.control(lockId, 'unlock', access_method, true, { userId });
    res.json({
      success: true,
      data: {
        is_locked: lock.is_locked,
        message: 'Door unlocked successfully'
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Unlock door error:', { error: error.message, lockId: req.params.lockId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to unlock door'
      }
    });
  }
};

/**
 * Get Lock Status
 * GET /locks/:lockId/status
 */
export const getLockStatus = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.request('getLockStatus', userId, lockId, {});

    const { data: lock, error } = await supabase
      .from('locks')
      .select('id, is_locked, is_online, battery_level, updated_at')
      .eq('id', lockId)
      .single();

    if (error || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    logger.info(`[LOCK] ✅ Status for lock ${lockId}: ${lock.is_locked ? 'LOCKED' : 'UNLOCKED'}, battery: ${lock.battery_level}%`);
    res.json({
      success: true,
      data: lock
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Get lock status error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch lock status'
      }
    });
  }
};

/**
 * Get Battery Level
 * GET /locks/:lockId/battery
 */
export const getBatteryLevel = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.request('getBatteryLevel', userId, lockId, {});

    const { data: lock, error } = await supabase
      .from('locks')
      .select('id, battery_level, updated_at')
      .eq('id', lockId)
      .single();

    if (error || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Determine battery status
    let battery_status = 'good';
    if (lock.battery_level <= 10) {
      battery_status = 'critical';
    } else if (lock.battery_level <= 20) {
      battery_status = 'low';
    } else if (lock.battery_level <= 40) {
      battery_status = 'medium';
    }

    logger.ai.batteryPrediction(lockId, { currentLevel: lock.battery_level, health: battery_status });
    res.json({
      success: true,
      data: {
        battery_level: lock.battery_level,
        battery_status,
        last_updated: lock.updated_at
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Get battery level error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch battery level'
      }
    });
  }
};

/**
 * Log Lock Activity
 * POST /locks/:lockId/activity
 *
 * @description Log lock/unlock activity from mobile app (Bluetooth actions)
 */
export const logActivity = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { action, access_method, metadata } = req.body;

    // Validate action
    if (!action || !['locked', 'unlocked', 'paired', 'reset', 'failed'].includes(action)) {
      logger.warn('[LOCK] ⚠️ Invalid activity action:', { action, lockId, userId });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Action must be one of: locked, unlocked, paired, reset, failed'
        }
      });
    }

    logger.info(`[ACTIVITY] ${action} on lock ${lockId} by user ${userId}`, { userId, action, lockId, access_method });

    // Get current lock state before update
    const { data: currentLock } = await supabase
      .from('locks')
      .select('battery_level')
      .eq('id', lockId)
      .single();

    // Update lock state if it's a lock/unlock action
    if (action === 'locked' || action === 'unlocked') {
      const updateData = {
        is_locked: action === 'locked',
        updated_at: new Date().toISOString()
      };

      // If metadata includes battery_level, update it
      if (metadata && typeof metadata.battery_level === 'number') {
        updateData.battery_level = Math.min(100, Math.max(0, Math.round(metadata.battery_level)));
      }

      const { error: updateError } = await supabase
        .from('locks')
        .update(updateData)
        .eq('id', lockId);

      if (updateError) {
        logger.warn('[LOCK] ⚠️ Failed to update lock state:', { error: updateError.message, lockId, action });
      }

      // Log battery history if battery level changed
      if (metadata && typeof metadata.battery_level === 'number') {
        const newBatteryLevel = Math.min(100, Math.max(0, Math.round(metadata.battery_level)));
        const oldBatteryLevel = currentLock?.battery_level;

        // Only log if battery level actually changed
        if (oldBatteryLevel !== newBatteryLevel) {
          logger.info(`[LOCK] 🔋 Battery level changed from ${oldBatteryLevel}% to ${newBatteryLevel}% for lock ${lockId}`);

          const { error: batteryError } = await supabase
            .from('battery_history')
            .insert([{
              lock_id: lockId,
              battery_level: newBatteryLevel,
              recorded_at: new Date().toISOString()
            }]);

          if (batteryError) {
            logger.error('[LOCK] ❌ Failed to record battery history:', { error: batteryError.message, lockId });
          } else {
            logger.info(`[LOCK] ✅ Battery history recorded for lock ${lockId}: ${newBatteryLevel}%`);
          }
        }
      }
    }

    // Map action to EventAction
    const eventAction = action === 'locked' ? EventAction.LOCKED :
                        action === 'unlocked' ? EventAction.UNLOCKED :
                        action;

    // Log the activity using AI event logger
    const activityLog = await logEvent({
      lockId,
      userId,
      action: eventAction,
      accessMethod: access_method || AccessMethod.BLUETOOTH,
      metadata: metadata || {}
    });

    if (!activityLog) {
      logger.error('[LOCK] ❌ Failed to log activity:', { lockId, userId, action });
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOG_FAILED',
          message: 'Failed to log activity'
        }
      });
    }

    logger.info(`[LOCK] ✅ Activity logged: ${action} on lock ${lockId} by user ${userId}`);

    // Send smart notification for lock/unlock actions
    if (action === 'locked' || action === 'unlocked') {
      sendSmartNotification({
        lockId,
        action: eventAction,
        userId,
        metadata: { access_method: access_method || 'bluetooth' }
      }).catch(err => console.error('Notification error:', err));
    }

    res.json({
      success: true,
      data: {
        activity_id: activityLog.id,
        action,
        access_method: access_method || 'bluetooth',
        timestamp: activityLog.created_at
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Log activity error:', { error: error.message, lockId: req.params.lockId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to log activity'
      }
    });
  }
};

/**
 * Get Recovery Keys
 * GET /locks/:lockId/recovery-keys
 *
 * @description Get TTLock recovery keys for emergency access
 * Only accessible by lock owner (admin role)
 */
export const getRecoveryKeys = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    logger.request('getRecoveryKeys', userId, lockId, {});

    // Check if user is the owner (admin) of this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock || (userLock.role !== 'owner' && userLock.role !== 'admin')) {
      logger.security.failedAttempt(lockId, 'getRecoveryKeys', { userId, reason: 'Not lock owner or admin' });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the lock owner can view recovery keys'
        }
      });
    }

    // Get recovery keys
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('admin_pwd, delete_pwd, no_key_pwd, recovery_key, name')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Log this sensitive data access
    logger.info(`[LOCK] 🔑 Recovery keys accessed for lock ${lockId} (${lock.name}) by owner ${userId}`);

    res.json({
      success: true,
      data: {
        admin_pwd: lock.admin_pwd,
        delete_pwd: lock.delete_pwd,
        no_key_pwd: lock.no_key_pwd,
        recovery_key: lock.recovery_key,
        lock_name: lock.name,
        warning: 'Keep these codes safe. They provide emergency access to your lock.'
      }
    });
  } catch (error) {
    logger.error('[LOCK] ❌ Get recovery keys error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve recovery keys'
      }
    });
  }
};
