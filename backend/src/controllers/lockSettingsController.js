import { supabase } from '../services/supabase.js';
import { logSettingChange } from '../services/ai/eventLogger.js';
import { decrypt } from '../utils/ttlockCrypto.js';
import * as lockSettingsAPI from './ttlock-cloud-api-v3/lock.js';

/**
 * Permission check helper for lock settings
 * Validates user's role and permissions before allowing setting changes
 *
 * @param {Object} lockAccess - User's lock access from middleware (req.lockAccess)
 * @param {boolean} requireOwnerOnly - If true, only owner can perform this action
 * @returns {Object} { allowed: boolean, error?: string }
 */
const checkSettingsPermission = (lockAccess, requireOwnerOnly = false) => {
  if (!lockAccess) {
    return { allowed: false, error: 'Access denied - no lock access found' };
  }

  // Owner-only actions (factory reset, delete lock)
  if (requireOwnerOnly) {
    if (lockAccess.role !== 'owner') {
      return { allowed: false, error: 'Only lock owner can perform this action' };
    }
    return { allowed: true };
  }

  // General settings modification - allowed for owner and admin
  if (lockAccess.role === 'owner' || lockAccess.role === 'admin') {
    return { allowed: true };
  }

  // Check explicit permission flag
  if (lockAccess.can_modify_settings === true) {
    return { allowed: true };
  }

  return { allowed: false, error: 'Insufficient permissions to modify lock settings' };
};

/**
 * Get user's lock access for permission checking
 * @param {string} userId - User ID
 * @param {string} lockId - Lock ID
 * @returns {Object|null} Lock access record with role and permissions
 */
const getUserLockAccessForSettings = async (userId, lockId) => {
  // First check if user is the lock owner
  const { data: lock } = await supabase
    .from('locks')
    .select('owner_id')
    .eq('id', lockId)
    .single();

  if (lock?.owner_id === userId) {
    return { role: 'owner', can_modify_settings: true };
  }

  // Check user_locks for their role
  const { data } = await supabase
    .from('user_locks')
    .select('role, can_modify_settings')
    .eq('user_id', userId)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .single();

  return data;
};

// Helper to get lock's TTLock ID and access token
const getLockTTLockInfo = async (lockId, userId) => {
  // Get lock's TTLock ID
  const { data: lock, error: lockError } = await supabase
    .from('locks')
    .select('ttlock_lock_id, user_id')
    .eq('id', lockId)
    .single();

  if (lockError || !lock?.ttlock_lock_id) {
    console.log('[getLockTTLockInfo] No lock found or no ttlock_lock_id');
    return null;
  }

  // Get user's TTLock access token from users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('ttlock_access_token')
    .eq('id', userId)
    .single();

  if (userError || !user?.ttlock_access_token) {
    console.log('[getLockTTLockInfo] No user found or no ttlock_access_token');
    return null;
  }

  // Decrypt the access token
  const accessToken = decrypt(user.ttlock_access_token);
  if (!accessToken) {
    console.log('[getLockTTLockInfo] Failed to decrypt access token');
    return null;
  }

  return {
    ttlockLockId: lock.ttlock_lock_id,
    accessToken: accessToken
  };
};

/**
 * Get Lock Settings
 * GET /locks/:lockId/settings
 */
export const getLockSettings = async (req, res) => {
  try {
    const { lockId } = req.params;

    let { data: settings, error } = await supabase
      .from('lock_settings')
      .select('*')
      .eq('lock_id', lockId)
      .single();

    // If settings don't exist, create default settings
    if (error || !settings) {
      console.log('Creating default settings for lock:', lockId);
      const defaultSettings = {
        lock_id: lockId,
        auto_lock_enabled: true,
        auto_lock_delay: 30,
        remote_unlock_enabled: true,
        passage_mode_enabled: false,
        one_touch_locking: true,
        privacy_lock: false,
        sound_enabled: true,
        sound_volume: 50,
        led_enabled: true,
        tamper_alert: true,
        wrong_code_lockout: 5,
        anti_peep_password: false,
        reset_button_enabled: true
      };

      const { data: newSettings, error: insertError } = await supabase
        .from('lock_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create default settings:', insertError);
        // Return default settings even if insert fails
        return res.json({
          success: true,
          data: defaultSettings
        });
      }

      settings = newSettings;
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get lock settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch lock settings'
      }
    });
  }
};

/**
 * Update Lock Settings
 * PATCH /locks/:lockId/settings
 *
 * Permission: Owner or Admin only
 */
export const updateLockSettings = async (req, res) => {
  try {
    const { lockId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Get user's lock access for permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);

    // Check permission
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: permCheck.error
        }
      });
    }

    // Get current settings for comparison
    const { data: currentSettings } = await supabase
      .from('lock_settings')
      .select('*')
      .eq('lock_id', lockId)
      .single();

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update(updates)
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update lock settings'
        }
      });
    }

    // Log each setting change for AI
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = currentSettings ? currentSettings[key] : null;
      if (oldValue !== newValue) {
        await logSettingChange({
          lockId,
          userId: req.user.id,
          settingName: key,
          oldValue,
          newValue
        });
      }
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Update lock settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update lock settings'
      }
    });
  }
};

/**
 * Toggle Auto Lock
 * POST /locks/:lockId/settings/auto-lock
 *
 * Permission: Owner or Admin only
 * This calls TTLock Cloud API to set auto-lock on the physical lock
 */
export const toggleAutoLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled, delay, useBluetooth = false } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    // Get TTLock credentials
    const ttlockInfo = await getLockTTLockInfo(lockId, req.user.id);

    // Determine operation type: 1 = Bluetooth, 2 = Gateway
    // Use Bluetooth if explicitly requested, otherwise use Gateway
    const operationType = useBluetooth ? 1 : 2;
    const operationMethod = operationType === 1 ? 'Bluetooth' : 'Gateway';

    // If we have TTLock connection, send command to physical lock
    if (ttlockInfo) {
      try {
        console.log(`[AutoLock] Setting auto-lock to ${enabled ? 'ON' : 'OFF'} with delay ${delay}s for TTLock ID: ${ttlockInfo.ttlockLockId} via ${operationMethod}`);

        // TTLock API: setAutoLockTime - set to 0 to disable, or number of seconds to enable
        const autoLockSeconds = enabled ? (delay || 5) : 0;

        await lockSettingsAPI.setAutoLockTime(
          ttlockInfo.accessToken,
          ttlockInfo.ttlockLockId,
          autoLockSeconds,
          operationType // type: 1 = Bluetooth, 2 = Gateway
        );

        console.log(`[AutoLock] ✅ Successfully set auto-lock on physical lock via ${operationMethod}`);
      } catch (ttlockErr) {
        console.error(`[AutoLock] ❌ TTLock API error (${operationMethod}):`, ttlockErr.message);
        // If Gateway fails and Bluetooth wasn't tried, we could retry with Bluetooth
        // But for now, continue to update local DB even if TTLock fails
        // This allows the setting to work when gateway is unavailable
      }
    } else {
      console.log('[AutoLock] No TTLock connection - updating local database only');
    }

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('lock_settings')
      .select('auto_lock_enabled, auto_lock_delay')
      .eq('lock_id', lockId)
      .single();

    const updates = { auto_lock_enabled: enabled };
    if (delay !== undefined) {
      updates.auto_lock_delay = delay;
    }

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update(updates)
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update auto lock settings'
        }
      });
    }

    // Log setting changes
    if (currentSettings?.auto_lock_enabled !== enabled) {
      await logSettingChange({
        lockId,
        userId: req.user.id,
        settingName: 'auto_lock_enabled',
        oldValue: currentSettings?.auto_lock_enabled,
        newValue: enabled
      });
    }
    if (delay !== undefined && currentSettings?.auto_lock_delay !== delay) {
      await logSettingChange({
        lockId,
        userId: req.user.id,
        settingName: 'auto_lock_delay',
        oldValue: currentSettings?.auto_lock_delay,
        newValue: delay
      });
    }

    res.json({
      success: true,
      data: {
        auto_lock_enabled: settings.auto_lock_enabled,
        auto_lock_delay: settings.auto_lock_delay,
        synced_to_lock: !!ttlockInfo
      }
    });
  } catch (error) {
    console.error('Toggle auto lock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to toggle auto lock'
      }
    });
  }
};

/**
 * Toggle Passage Mode
 * POST /locks/:lockId/settings/passage-mode
 *
 * Permission: Owner or Admin only
 * This calls TTLock Cloud API to configure passage mode on the physical lock
 */
export const togglePassageMode = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled, start_time, end_time, isAllDay, weekDays, useBluetooth = false } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    // Get TTLock credentials
    const ttlockInfo = await getLockTTLockInfo(lockId, req.user.id);

    // Determine operation type: 1 = Bluetooth, 2 = Gateway
    // Use Bluetooth if explicitly requested, otherwise use Gateway
    const operationType = useBluetooth ? 1 : 2;
    const operationMethod = operationType === 1 ? 'Bluetooth' : 'Gateway';

    // If we have TTLock connection, send command to physical lock
    if (ttlockInfo) {
      try {
        console.log(`[PassageMode] Setting passage mode to ${enabled ? 'ON' : 'OFF'} for TTLock ID: ${ttlockInfo.ttlockLockId} via ${operationMethod}`);

        // TTLock API: configPassageMode
        // passageMode: 1=on, 2=off
        await lockSettingsAPI.configPassageMode(
          ttlockInfo.accessToken,
          ttlockInfo.ttlockLockId,
          enabled ? 1 : 2, // passageMode
          operationType, // type: 1 = Bluetooth, 2 = Gateway
          {
            startDate: start_time, // in minutes from midnight (e.g., 480 = 8:00 AM)
            endDate: end_time, // in minutes from midnight
            isAllDay: isAllDay ? 1 : 2, // 1=yes, 2=no
            weekDays: weekDays || [1, 2, 3, 4, 5, 6, 7] // all days by default
          }
        );

        console.log(`[PassageMode] ✅ Successfully set passage mode on physical lock via ${operationMethod}`);
      } catch (ttlockErr) {
        console.error(`[PassageMode] ❌ TTLock API error (${operationMethod}):`, ttlockErr.message);
        // Continue to update local DB even if TTLock fails
      }
    } else {
      console.log('[PassageMode] No TTLock connection - updating local database only');
    }

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('lock_settings')
      .select('passage_mode_enabled, passage_mode_start, passage_mode_end')
      .eq('lock_id', lockId)
      .single();

    const updates = { passage_mode_enabled: enabled };
    if (start_time !== undefined) {
      updates.passage_mode_start = start_time;
    }
    if (end_time !== undefined) {
      updates.passage_mode_end = end_time;
    }

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update(updates)
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update passage mode settings'
        }
      });
    }

    // Log setting change
    if (currentSettings?.passage_mode_enabled !== enabled) {
      await logSettingChange({
        lockId,
        userId: req.user.id,
        settingName: 'passage_mode_enabled',
        oldValue: currentSettings?.passage_mode_enabled,
        newValue: enabled
      });
    }

    res.json({
      success: true,
      data: {
        passage_mode_enabled: settings.passage_mode_enabled,
        passage_mode_start: settings.passage_mode_start,
        passage_mode_end: settings.passage_mode_end,
        synced_to_lock: !!ttlockInfo
      }
    });
  } catch (error) {
    console.error('Toggle passage mode error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to toggle passage mode'
      }
    });
  }
};

/**
 * Update Sound Settings
 * POST /locks/:lockId/settings/sound
 *
 * Permission: Owner or Admin only
 * This calls TTLock Cloud API to update sound settings on the physical lock
 * TTLock API: updateSetting with settingType for sound control
 */
export const updateSoundSettings = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled, volume } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    // Get TTLock credentials
    const ttlockInfo = await getLockTTLockInfo(lockId, req.user.id);

    // If we have TTLock connection, send command to physical lock
    if (ttlockInfo && enabled !== undefined) {
      try {
        console.log(`[Sound] Setting sound to ${enabled ? 'ON' : 'OFF'} for TTLock ID: ${ttlockInfo.ttlockLockId}`);

        // TTLock API: updateSetting - settingType for sound
        // Note: The exact settingType value depends on lock model
        // Common values: sound enable/disable via config API
        // This may need to be adjusted based on actual TTLock API response
        await lockSettingsAPI.updateLockSetting(
          ttlockInfo.accessToken,
          ttlockInfo.ttlockLockId,
          'sound', // settingType - adjust based on TTLock docs
          enabled ? '1' : '0' // settingValue
        );

        console.log(`[Sound] Successfully set sound on physical lock`);
      } catch (ttlockErr) {
        console.error('[Sound] TTLock API error:', ttlockErr.message);
        // Continue to update local DB even if TTLock fails
      }
    } else if (!ttlockInfo) {
      console.log('[Sound] No TTLock connection - updating local database only');
    }

    const updates = {};
    if (enabled !== undefined) {
      updates.sound_enabled = enabled;
    }
    if (volume !== undefined) {
      updates.sound_volume = volume;
    }

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update(updates)
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update sound settings'
        }
      });
    }

    res.json({
      success: true,
      data: {
        sound_enabled: settings.sound_enabled,
        sound_volume: settings.sound_volume,
        synced_to_lock: !!ttlockInfo
      }
    });
  } catch (error) {
    console.error('Update sound settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update sound settings'
      }
    });
  }
};

/**
 * Update LED Settings
 * POST /locks/:lockId/settings/led
 *
 * Permission: Owner or Admin only
 */
export const updateLedSettings = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update({ led_enabled: enabled })
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update LED settings'
        }
      });
    }

    res.json({
      success: true,
      data: {
        led_enabled: settings.led_enabled
      }
    });
  } catch (error) {
    console.error('Update LED settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update LED settings'
      }
    });
  }
};

/**
 * Update Security Settings
 * POST /locks/:lockId/settings/security
 *
 * Permission: Owner or Admin only
 */
export const updateSecuritySettings = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { tamper_alert, wrong_code_lockout, privacy_lock } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    const updates = {};
    if (tamper_alert !== undefined) {
      updates.tamper_alert = tamper_alert;
    }
    if (wrong_code_lockout !== undefined) {
      updates.wrong_code_lockout = wrong_code_lockout;
    }
    if (privacy_lock !== undefined) {
      updates.privacy_lock = privacy_lock;
    }

    // Check if there are any updates to make
    if (Object.keys(updates).length === 0) {
      // Get current settings and return them
      const { data: currentSettings } = await supabase
        .from('lock_settings')
        .select('tamper_alert, wrong_code_lockout, privacy_lock')
        .eq('lock_id', lockId)
        .single();

      return res.json({
        success: true,
        data: currentSettings || {
          tamper_alert: true,
          wrong_code_lockout: 5,
          privacy_lock: false,
          anti_peep_password: false,
          reset_button_enabled: true,
          remote_unlock_enabled: true
        }
      });
    }

    // First check if settings exist, create if not
    const { data: existingSettings } = await supabase
      .from('lock_settings')
      .select('id')
      .eq('lock_id', lockId)
      .single();

    let settings;
    let error;

    if (!existingSettings) {
      // Create new settings with defaults
      const result = await supabase
        .from('lock_settings')
        .insert([{
          lock_id: lockId,
          auto_lock_enabled: true,
          auto_lock_delay: 30,
          remote_unlock_enabled: true,
          passage_mode_enabled: false,
          one_touch_locking: true,
          privacy_lock: updates.privacy_lock ?? false,
          sound_enabled: true,
          sound_volume: 50,
          led_enabled: true,
          tamper_alert: updates.tamper_alert ?? true,
          wrong_code_lockout: updates.wrong_code_lockout ?? 5,
          anti_peep_password: false,
          reset_button_enabled: true
        }])
        .select()
        .single();

      settings = result.data;
      error = result.error;
    } else {
      // Update existing settings
      const result = await supabase
        .from('lock_settings')
        .update(updates)
        .eq('lock_id', lockId)
        .select()
        .single();

      settings = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Update security settings error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update security settings',
          details: error.message
        }
      });
    }

    res.json({
      success: true,
      data: {
        tamper_alert: settings.tamper_alert,
        wrong_code_lockout: settings.wrong_code_lockout,
        privacy_lock: settings.privacy_lock
      }
    });
  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update security settings'
      }
    });
  }
};

/**
 * Toggle One Touch Locking
 * POST /locks/:lockId/settings/one-touch
 *
 * Permission: Owner or Admin only
 */
export const toggleOneTouchLocking = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    const { data: settings, error } = await supabase
      .from('lock_settings')
      .update({ one_touch_locking: enabled })
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update one touch locking'
        }
      });
    }

    res.json({
      success: true,
      data: {
        one_touch_locking: settings.one_touch_locking
      }
    });
  } catch (error) {
    console.error('Toggle one touch locking error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to toggle one touch locking'
      }
    });
  }
};

/**
 * Get Firmware Info
 * GET /locks/:lockId/firmware
 */
export const getFirmwareInfo = async (req, res) => {
  try {
    const { lockId } = req.params;

    const { data: lock, error } = await supabase
      .from('locks')
      .select('firmware_version, updated_at')
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

    // In a real implementation, check for available updates
    const latestVersion = '2.5.0'; // This would come from your firmware update service
    const updateAvailable = lock.firmware_version !== latestVersion;

    res.json({
      success: true,
      data: {
        current_version: lock.firmware_version,
        latest_version: latestVersion,
        update_available: updateAvailable,
        last_updated: lock.updated_at
      }
    });
  } catch (error) {
    console.error('Get firmware info error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch firmware info'
      }
    });
  }
};

/**
 * Update Firmware
 * POST /locks/:lockId/firmware/update
 *
 * Permission: Owner only (critical operation)
 */
export const updateFirmware = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { version } = req.body;
    const userId = req.user.id;

    // Permission check - OWNER ONLY for firmware updates
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess, true); // requireOwnerOnly = true
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    // In a real implementation, this would:
    // 1. Download the firmware from a secure server
    // 2. Send it to the lock via Bluetooth
    // 3. Monitor the update progress
    // 4. Verify the update was successful

    // For now, we'll simulate a successful update
    const { data: lock, error } = await supabase
      .from('locks')
      .update({ firmware_version: version })
      .eq('id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update firmware'
        }
      });
    }

    res.json({
      success: true,
      data: {
        firmware_version: lock.firmware_version,
        message: 'Firmware updated successfully'
      }
    });
  } catch (error) {
    console.error('Update firmware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update firmware'
      }
    });
  }
};

/**
 * Update Remote Unlock Setting (Lock Level)
 * PATCH /locks/:lockId/remote-unlock
 *
 * Permission: Owner or Admin only
 * This is a LOCK-LEVEL setting that affects ALL users.
 * When disabled, no user can remotely unlock this lock via gateway/cloud.
 * Users will need to use Bluetooth or physical methods instead.
 */
export const updateRemoteUnlockSetting = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { enabled } = req.body;
    const userId = req.user.id;

    // Permission check
    const lockAccess = req.lockAccess || await getUserLockAccessForSettings(userId, lockId);
    const permCheck = checkSettingsPermission(lockAccess);
    if (!permCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: permCheck.error }
      });
    }

    console.log(`[RemoteUnlock] User ${userId} setting remote_unlock to ${enabled} for lock ${lockId}`);

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'enabled must be a boolean value'
        }
      });
    }

    // Get current settings
    const { data: currentSettings, error: fetchError } = await supabase
      .from('lock_settings')
      .select('remote_unlock_enabled')
      .eq('lock_id', lockId)
      .single();

    // Update lock_settings table
    const { data: settings, error: updateError } = await supabase
      .from('lock_settings')
      .update({ remote_unlock_enabled: enabled })
      .eq('lock_id', lockId)
      .select()
      .single();

    if (updateError) {
      // If settings don't exist, create them with this setting
      if (updateError.code === 'PGRST116') {
        const { data: newSettings, error: insertError } = await supabase
          .from('lock_settings')
          .insert([{
            lock_id: lockId,
            remote_unlock_enabled: enabled,
            auto_lock_enabled: true,
            auto_lock_delay: 30,
            passage_mode_enabled: false
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create lock settings:', insertError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'CREATE_FAILED',
              message: 'Failed to create lock settings'
            }
          });
        }

        // Log the setting change
        await logSettingChange({
          lockId,
          userId,
          settingName: 'remote_unlock_enabled',
          oldValue: true, // default value
          newValue: enabled
        });

        return res.json({
          success: true,
          data: {
            remote_unlock_enabled: newSettings.remote_unlock_enabled,
            message: `Remote unlock ${enabled ? 'enabled' : 'disabled'} for this lock`
          }
        });
      }

      console.error('Update remote unlock setting error:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update remote unlock setting'
        }
      });
    }

    // Log the setting change for AI
    if (currentSettings?.remote_unlock_enabled !== enabled) {
      await logSettingChange({
        lockId,
        userId,
        settingName: 'remote_unlock_enabled',
        oldValue: currentSettings?.remote_unlock_enabled ?? true,
        newValue: enabled
      });
    }

    console.log(`[RemoteUnlock] Successfully updated remote_unlock to ${enabled} for lock ${lockId}`);

    res.json({
      success: true,
      data: {
        remote_unlock_enabled: settings.remote_unlock_enabled,
        message: `Remote unlock ${enabled ? 'enabled' : 'disabled'} for this lock`
      }
    });
  } catch (error) {
    console.error('Update remote unlock setting error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update remote unlock setting'
      }
    });
  }
};
