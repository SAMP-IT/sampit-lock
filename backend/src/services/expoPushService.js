import { Expo } from 'expo-server-sdk';
import { supabase } from './supabase.js';

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Expo Push Notification Service
 * Handles sending push notifications to mobile devices
 */
class ExpoPushService {
  constructor() {
    this.expo = expo;
  }

  /**
   * Validate Expo push token
   * @param {string} token - Expo push token
   * @returns {boolean} True if valid
   */
  isValidToken(token) {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Send push notification to a single device
   * @param {string} expoPushToken - Expo push token
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Send result
   */
  async sendToDevice(expoPushToken, notification) {
    if (!this.isValidToken(expoPushToken)) {
      console.error('Invalid Expo push token:', expoPushToken);
      return { success: false, error: 'Invalid push token' };
    }

    const message = {
      to: expoPushToken,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: notification.priority || 'high',
      channelId: notification.channelId || 'default',
    };

    // Add badge for iOS
    if (notification.badge !== undefined) {
      message.badge = notification.badge;
    }

    try {
      const tickets = await this.expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'ok') {
        console.log('✅ Push notification sent successfully');
        return { success: true, ticketId: ticket.id };
      } else {
        console.error('❌ Push notification failed:', ticket.message);
        return { success: false, error: ticket.message, details: ticket.details };
      }
    } catch (error) {
      console.error('❌ Push notification error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple devices
   * @param {string[]} expoPushTokens - Array of Expo push tokens
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Send results
   */
  async sendToMultipleDevices(expoPushTokens, notification) {
    // Filter valid tokens
    const validTokens = expoPushTokens.filter(token => this.isValidToken(token));

    if (validTokens.length === 0) {
      console.warn('No valid Expo push tokens provided');
      return { success: false, error: 'No valid tokens', sent: 0, failed: expoPushTokens.length };
    }

    // Create messages
    const messages = validTokens.map(token => ({
      to: token,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: notification.priority || 'high',
      channelId: notification.channelId || 'default',
    }));

    try {
      // Chunk messages (Expo recommends max 100 per batch)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      // Count successes and failures
      const successes = tickets.filter(t => t.status === 'ok').length;
      const failures = tickets.filter(t => t.status === 'error').length;

      console.log(`📱 Push notifications: ${successes} sent, ${failures} failed`);

      return {
        success: failures === 0,
        sent: successes,
        failed: failures + (expoPushTokens.length - validTokens.length),
        tickets,
      };
    } catch (error) {
      console.error('❌ Batch push notification error:', error.message);
      return { success: false, error: error.message, sent: 0, failed: expoPushTokens.length };
    }
  }

  /**
   * Send push notification to all devices of a user
   * @param {string} userId - User ID
   * @param {object} notification - Notification data
   * @returns {Promise<object>} Send results
   */
  async sendToUser(userId, notification) {
    try {
      // Get user's active device tokens
      const { data: tokens, error } = await supabase
        .from('device_tokens')
        .select('expo_push_token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Failed to fetch device tokens:', error.message);
        return { success: false, error: 'Failed to fetch device tokens' };
      }

      if (!tokens || tokens.length === 0) {
        console.log('No active device tokens for user:', userId);
        return { success: false, error: 'No active device tokens', sent: 0 };
      }

      const expoPushTokens = tokens.map(t => t.expo_push_token);
      return await this.sendToMultipleDevices(expoPushTokens, notification);
    } catch (error) {
      console.error('Send to user error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to all users with access to a lock
   * @param {string} lockId - Lock ID
   * @param {object} notification - Notification data
   * @param {string} excludeUserId - User ID to exclude (optional)
   * @returns {Promise<object>} Send results
   */
  async sendToLockUsers(lockId, notification, excludeUserId = null) {
    try {
      // Get all users with access to this lock
      let query = supabase
        .from('user_locks')
        .select('user_id')
        .eq('lock_id', lockId)
        .eq('is_active', true);

      if (excludeUserId) {
        query = query.neq('user_id', excludeUserId);
      }

      const { data: userLocks, error: userError } = await query;

      if (userError) {
        console.error('Failed to fetch lock users:', userError.message);
        return { success: false, error: 'Failed to fetch lock users' };
      }

      if (!userLocks || userLocks.length === 0) {
        console.log('No users to notify for lock:', lockId);
        return { success: true, sent: 0, message: 'No users to notify' };
      }

      const userIds = userLocks.map(ul => ul.user_id);

      // Get device tokens for all users
      const { data: tokens, error: tokenError } = await supabase
        .from('device_tokens')
        .select('expo_push_token, user_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (tokenError) {
        console.error('Failed to fetch device tokens:', tokenError.message);
        return { success: false, error: 'Failed to fetch device tokens' };
      }

      if (!tokens || tokens.length === 0) {
        console.log('No active device tokens for lock users');
        return { success: true, sent: 0, message: 'No active device tokens' };
      }

      const expoPushTokens = tokens.map(t => t.expo_push_token);
      return await this.sendToMultipleDevices(expoPushTokens, notification);
    } catch (error) {
      console.error('Send to lock users error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create notification payload for lock events
   * @param {string} eventType - Event type (unlock, lock, battery_low, tamper, etc.)
   * @param {object} lockData - Lock data
   * @param {object} userData - User data (optional)
   * @returns {object} Notification payload
   */
  createLockNotification(eventType, lockData, userData = null) {
    const lockName = lockData.name || 'Your lock';
    const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : null;

    const notifications = {
      unlock: {
        title: '🔓 Door Unlocked',
        body: userName ? `${userName} unlocked ${lockName}` : `${lockName} was unlocked`,
        data: { type: 'unlock', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      lock: {
        title: '🔒 Door Locked',
        body: userName ? `${userName} locked ${lockName}` : `${lockName} was locked`,
        data: { type: 'lock', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      battery_low: {
        title: '🔋 Low Battery Warning',
        body: `${lockName} battery is low (${lockData.battery_level || 'unknown'}%)`,
        data: { type: 'battery_low', lockId: lockData.id, lockName, batteryLevel: lockData.battery_level },
        channelId: 'alerts',
        priority: 'high',
      },
      battery_critical: {
        title: '⚠️ Critical Battery Alert',
        body: `${lockName} battery is critically low! Replace batteries soon.`,
        data: { type: 'battery_critical', lockId: lockData.id, lockName, batteryLevel: lockData.battery_level },
        channelId: 'alerts',
        priority: 'high',
      },
      tamper: {
        title: '🚨 Tamper Alert',
        body: `Suspicious activity detected on ${lockName}`,
        data: { type: 'tamper', lockId: lockData.id, lockName },
        channelId: 'alerts',
        priority: 'high',
      },
      failed_attempt: {
        title: '⚠️ Failed Unlock Attempt',
        body: `Failed unlock attempt on ${lockName}`,
        data: { type: 'failed_attempt', lockId: lockData.id, lockName },
        channelId: 'alerts',
      },
      offline: {
        title: '📡 Lock Offline',
        body: `${lockName} is offline. Check gateway connection.`,
        data: { type: 'offline', lockId: lockData.id, lockName },
        channelId: 'alerts',
      },
      online: {
        title: '✅ Lock Online',
        body: `${lockName} is back online`,
        data: { type: 'online', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      guest_access: {
        title: '👤 Guest Access',
        body: userName ? `${userName} accessed ${lockName}` : `Guest accessed ${lockName}`,
        data: { type: 'guest_access', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      passcode_used: {
        title: '🔢 Passcode Used',
        body: `Passcode was used to unlock ${lockName}`,
        data: { type: 'passcode_used', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      fingerprint_used: {
        title: '👆 Fingerprint Unlock',
        body: `Fingerprint was used to unlock ${lockName}`,
        data: { type: 'fingerprint_used', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
      card_used: {
        title: '💳 Card Unlock',
        body: `IC card was used to unlock ${lockName}`,
        data: { type: 'card_used', lockId: lockData.id, lockName },
        channelId: 'lock-events',
      },
    };

    return notifications[eventType] || {
      title: 'Lock Event',
      body: `Event on ${lockName}: ${eventType}`,
      data: { type: eventType, lockId: lockData.id, lockName },
      channelId: 'lock-events',
    };
  }

  /**
   * Check notification receipts (for debugging delivery issues)
   * @param {string[]} ticketIds - Array of ticket IDs from sendPushNotificationsAsync
   * @returns {Promise<object>} Receipt results
   */
  async checkReceipts(ticketIds) {
    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
      const receipts = [];

      for (const chunk of receiptIdChunks) {
        const receiptChunk = await this.expo.getPushNotificationReceiptsAsync(chunk);
        receipts.push(receiptChunk);
      }

      return { success: true, receipts };
    } catch (error) {
      console.error('Check receipts error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new ExpoPushService();
export { ExpoPushService };
