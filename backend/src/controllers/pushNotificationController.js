import { supabase } from '../services/supabase.js';
import expoPushService from '../services/expoPushService.js';

/**
 * Register Device Token
 * POST /api/push/register
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceToken, expoPushToken, platform, deviceName } = req.body;

    // Validate required fields
    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Expo push token is required'
        }
      });
    }

    if (!platform || !['ios', 'android'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLATFORM',
          message: 'Platform must be ios or android'
        }
      });
    }

    // Validate token format
    if (!expoPushService.isValidToken(expoPushToken)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid Expo push token format'
        }
      });
    }

    // Use expo token as device token if not provided
    const effectiveDeviceToken = deviceToken || expoPushToken;

    console.log('📱 Registering device token for user:', userId);
    console.log('   Platform:', platform);
    console.log('   Token:', expoPushToken.substring(0, 30) + '...');

    // Check if token already exists for this user
    const { data: existingToken, error: checkError } = await supabase
      .from('device_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('expo_push_token', expoPushToken)
      .single();

    if (existingToken) {
      // Update existing token
      const { data: updated, error: updateError } = await supabase
        .from('device_tokens')
        .update({
          device_token: effectiveDeviceToken,
          platform,
          device_name: deviceName || null,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingToken.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update device token:', updateError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update device token'
          }
        });
      }

      console.log('✅ Device token updated');
      return res.json({
        success: true,
        message: 'Device token updated successfully',
        data: {
          id: updated.id,
          platform: updated.platform,
          isNew: false
        }
      });
    }

    // Insert new token
    const { data: newToken, error: insertError } = await supabase
      .from('device_tokens')
      .insert([{
        user_id: userId,
        device_token: effectiveDeviceToken,
        expo_push_token: expoPushToken,
        platform,
        device_name: deviceName || null,
        is_active: true,
        last_used_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert device token:', insertError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INSERT_FAILED',
          message: 'Failed to register device token'
        }
      });
    }

    console.log('✅ Device token registered');

    res.status(201).json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        id: newToken.id,
        platform: newToken.platform,
        isNew: true
      }
    });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to register device token'
      }
    });
  }
};

/**
 * Unregister Device Token
 * DELETE /api/push/unregister
 */
export const unregisterDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Expo push token is required'
        }
      });
    }

    console.log('📱 Unregistering device token for user:', userId);

    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('expo_push_token', expoPushToken);

    if (error) {
      console.error('Failed to unregister device token:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to unregister device token'
        }
      });
    }

    console.log('✅ Device token unregistered');

    res.json({
      success: true,
      message: 'Device token unregistered successfully'
    });
  } catch (error) {
    console.error('Unregister device token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to unregister device token'
      }
    });
  }
};

/**
 * Unregister All Device Tokens (Logout from all devices)
 * DELETE /api/push/unregister-all
 */
export const unregisterAllDeviceTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📱 Unregistering all device tokens for user:', userId);

    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to unregister all device tokens:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to unregister device tokens'
        }
      });
    }

    console.log('✅ All device tokens unregistered');

    res.json({
      success: true,
      message: 'All device tokens unregistered successfully'
    });
  } catch (error) {
    console.error('Unregister all device tokens error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to unregister device tokens'
      }
    });
  }
};

/**
 * Get User's Device Tokens
 * GET /api/push/devices
 */
export const getDeviceTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('id, platform, device_name, is_active, last_used_at, created_at')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch device tokens:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch device tokens'
        }
      });
    }

    res.json({
      success: true,
      data: {
        devices: tokens || [],
        activeCount: (tokens || []).filter(t => t.is_active).length
      }
    });
  } catch (error) {
    console.error('Get device tokens error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch device tokens'
      }
    });
  }
};

/**
 * Send Test Notification
 * POST /api/push/test
 */
export const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📱 Sending test notification to user:', userId);

    const notification = {
      title: '🔔 Test Notification',
      body: 'This is a test notification from AwayKey Smart Lock',
      data: { type: 'test', timestamp: Date.now() }
    };

    const result = await expoPushService.sendToUser(userId, notification);

    if (!result.success && result.error === 'No active device tokens') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_DEVICES',
          message: 'No active devices registered. Please enable notifications in the app first.'
        }
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: result.error || 'Failed to send test notification'
        }
      });
    }

    console.log('✅ Test notification sent');

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      data: {
        sent: result.sent,
        failed: result.failed
      }
    });
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send test notification'
      }
    });
  }
};

/**
 * Get Notification Preferences
 * GET /api/push/preferences
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch notification preferences:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch notification preferences'
        }
      });
    }

    // Return default preferences if none exist
    const defaultPreferences = {
      push_enabled: true,
      email_enabled: true,
      unlock_notifications: true,
      lock_notifications: true,
      battery_warnings: true,
      tamper_alerts: true,
      failed_attempts: true,
      guest_access: true,
      offline_alerts: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '07:00:00'
    };

    res.json({
      success: true,
      data: preferences || defaultPreferences
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch notification preferences'
      }
    });
  }
};

/**
 * Update Notification Preferences
 * PATCH /api/push/preferences
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    // Allowed fields
    const allowedFields = [
      'push_enabled', 'email_enabled', 'unlock_notifications', 'lock_notifications',
      'battery_warnings', 'tamper_alerts', 'failed_attempts', 'guest_access',
      'offline_alerts', 'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'
    ];

    // Filter to only allowed fields
    const updates = {};
    for (const field of allowedFields) {
      if (preferences[field] !== undefined) {
        updates[field] = preferences[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No valid preference fields provided'
        }
      });
    }

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert([{ user_id: userId, ...updates }])
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    }

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update notification preferences'
      }
    });
  }
};

/**
 * Internal function: Send notification to lock users
 * Called by other controllers when lock events occur
 */
export const notifyLockUsers = async (lockId, eventType, lockData, actorData = null, excludeUserId = null) => {
  try {
    // Get lock info if not provided
    let lock = lockData;
    if (!lock || !lock.name) {
      const { data } = await supabase
        .from('locks')
        .select('id, name, battery_level')
        .eq('id', lockId)
        .single();
      lock = data || { id: lockId, name: 'Lock' };
    }

    // Create notification
    const notification = expoPushService.createLockNotification(eventType, lock, actorData);

    // Send to all lock users except the actor
    const result = await expoPushService.sendToLockUsers(lockId, notification, excludeUserId);

    console.log(`📱 Lock notification (${eventType}): ${result.sent} sent, ${result.failed} failed`);

    return result;
  } catch (error) {
    console.error('Notify lock users error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Internal function: Check if notification should be sent
 * Respects user's notification preferences and quiet hours
 */
export const shouldSendNotification = async (userId, eventType) => {
  try {
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no preferences, allow all notifications
    if (!preferences) {
      return true;
    }

    // Check if push notifications are enabled
    if (!preferences.push_enabled) {
      return false;
    }

    // Check event-specific preferences
    const eventPreferenceMap = {
      'unlock': 'unlock_notifications',
      'lock': 'lock_notifications',
      'battery_low': 'battery_warnings',
      'battery_critical': 'battery_warnings',
      'tamper': 'tamper_alerts',
      'failed_attempt': 'failed_attempts',
      'guest_access': 'guest_access',
      'offline': 'offline_alerts',
      'online': 'offline_alerts'
    };

    const preferenceField = eventPreferenceMap[eventType];
    if (preferenceField && preferences[preferenceField] === false) {
      return false;
    }

    // Check quiet hours
    if (preferences.quiet_hours_enabled) {
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format
      const start = preferences.quiet_hours_start;
      const end = preferences.quiet_hours_end;

      // Handle overnight quiet hours (e.g., 22:00 to 07:00)
      if (start > end) {
        // Overnight period
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      } else {
        // Same day period
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Check notification preferences error:', error);
    return true; // Default to sending if error
  }
};
