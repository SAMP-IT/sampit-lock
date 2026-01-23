/**
 * Smart Notifications Service
 *
 * AI-powered notification intelligence:
 * - Contextual notifications with AI-generated messages
 * - Notification batching and digests
 * - Anomaly-based alert prioritization
 * - Quiet hours and smart filtering
 */

import { supabase } from '../supabase.js';
import expoPushService from '../expoPushService.js';
import { analyzeEvent } from './anomalyDetector.js';
import { summarizeEvent } from './llmService.js';

/**
 * Notification priority levels
 */
export const NotificationPriority = {
  CRITICAL: 'critical',    // Always send immediately
  HIGH: 'high',           // Send unless in quiet hours
  NORMAL: 'normal',       // May be batched
  LOW: 'low'              // Always batched
};

/**
 * Notification types with default priorities
 */
const NOTIFICATION_CONFIG = {
  // Security events - always high priority
  tamper_detected: { priority: NotificationPriority.CRITICAL, category: 'security' },
  failed_attempt: { priority: NotificationPriority.HIGH, category: 'security' },

  // Lock events
  unlocked: { priority: NotificationPriority.NORMAL, category: 'access' },
  locked: { priority: NotificationPriority.LOW, category: 'access' },
  auto_lock: { priority: NotificationPriority.LOW, category: 'access' },

  // Battery events
  battery_critical: { priority: NotificationPriority.CRITICAL, category: 'battery' },
  battery_low: { priority: NotificationPriority.HIGH, category: 'battery' },
  battery_warning: { priority: NotificationPriority.NORMAL, category: 'battery' },

  // User events
  user_added: { priority: NotificationPriority.NORMAL, category: 'users' },
  user_removed: { priority: NotificationPriority.NORMAL, category: 'users' },

  // Status events
  offline: { priority: NotificationPriority.HIGH, category: 'status' },
  online: { priority: NotificationPriority.LOW, category: 'status' }
};

/**
 * Send a smart notification for an event
 *
 * @param {Object} params Notification parameters
 * @param {string} params.lockId Lock UUID
 * @param {string} params.action Event action type
 * @param {string} [params.userId] User who triggered the event
 * @param {Object} [params.metadata] Additional event metadata
 * @returns {Promise<Object>} Notification result
 */
export const sendSmartNotification = async ({
  lockId,
  action,
  userId = null,
  metadata = {}
}) => {
  try {
    // Get lock details
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('id, name, location, battery_level, owner_id')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      console.error('[SmartNotifications] Lock not found:', lockId);
      return { success: false, error: 'Lock not found' };
    }

    // Get user details if available
    let user = null;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('id', userId)
        .single();
      user = userData;
    }

    // Analyze event for anomalies
    const eventData = {
      lock_id: lockId,
      user_id: userId,
      action,
      metadata,
      created_at: new Date().toISOString()
    };

    const anomalyResult = await analyzeEvent(eventData);

    // Get notification config
    const config = NOTIFICATION_CONFIG[action] || {
      priority: NotificationPriority.NORMAL,
      category: 'other'
    };

    // Elevate priority if anomaly detected
    let priority = config.priority;
    if (anomalyResult.hasAnomalies && anomalyResult.anomalyScore >= 50) {
      priority = NotificationPriority.HIGH;
      if (anomalyResult.anomalyScore >= 80) {
        priority = NotificationPriority.CRITICAL;
      }
    }

    // Get users to notify
    const usersToNotify = await getUsersToNotify(lockId, action, userId);

    if (usersToNotify.length === 0) {
      console.log('[SmartNotifications] No users to notify');
      return { success: true, sent: 0, message: 'No users to notify' };
    }

    // Check if we should batch or send immediately
    const shouldBatch = await shouldBatchNotification(priority, usersToNotify);

    if (shouldBatch) {
      // Queue for batching
      await queueForBatch(lockId, action, metadata, anomalyResult, usersToNotify);
      return { success: true, batched: true, message: 'Notification queued for batch' };
    }

    // Generate smart notification content
    const notification = await generateSmartNotification({
      lock,
      user,
      action,
      metadata,
      anomalyResult
    });

    // Send to all users
    const results = await sendToUsers(usersToNotify, notification, action);

    // Log notification
    await logNotification({
      lockId,
      action,
      userId,
      recipientCount: usersToNotify.length,
      priority,
      hasAnomaly: anomalyResult.hasAnomalies,
      notification
    });

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      priority
    };

  } catch (error) {
    console.error('[SmartNotifications] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate smart notification content with AI context
 */
const generateSmartNotification = async ({
  lock,
  user,
  action,
  metadata,
  anomalyResult
}) => {
  const lockName = lock.name || 'Your lock';
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Someone' : null;

  // Build contextual message
  let title = '';
  let body = '';
  let contextHint = '';

  // Add anomaly context if present
  if (anomalyResult.hasAnomalies && anomalyResult.anomalies.length > 0) {
    const topAnomaly = anomalyResult.anomalies[0];
    if (topAnomaly.type === 'unusual_hour') {
      contextHint = ' (unusual time)';
    } else if (topAnomaly.type === 'first_time_user') {
      contextHint = ' (first time)';
    } else if (topAnomaly.type === 'rapid_events') {
      contextHint = ' (unusual activity)';
    }
  }

  switch (action) {
    case 'unlocked':
      title = '🔓 Door Unlocked' + contextHint;
      body = userName ? `${userName} unlocked ${lockName}` : `${lockName} was unlocked`;
      break;

    case 'locked':
      title = '🔒 Door Locked';
      body = userName ? `${userName} locked ${lockName}` : `${lockName} was locked`;
      break;

    case 'failed_attempt':
      title = '⚠️ Failed Unlock Attempt' + contextHint;
      body = `Failed attempt to unlock ${lockName}`;
      if (metadata.failure_reason) {
        body += ` - ${metadata.failure_reason}`;
      }
      break;

    case 'tamper_detected':
      title = '🚨 Security Alert';
      body = `Tampering detected on ${lockName}! Check immediately.`;
      break;

    case 'battery_critical':
      title = '⚠️ Critical Battery';
      body = `${lockName} battery is critically low (${lock.battery_level}%). Replace batteries now!`;
      break;

    case 'battery_low':
      title = '🔋 Low Battery';
      body = `${lockName} battery is low (${lock.battery_level}%). Plan to replace soon.`;
      break;

    case 'offline':
      title = '📡 Lock Offline';
      body = `${lockName} is offline. Check your gateway connection.`;
      break;

    case 'user_added':
      title = '👤 New User Added';
      body = `A new user was added to ${lockName}`;
      if (metadata.target_user_name) {
        body = `${metadata.target_user_name} was added to ${lockName}`;
      }
      break;

    case 'user_removed':
      title = '👤 User Removed';
      body = `A user was removed from ${lockName}`;
      break;

    default:
      title = 'Lock Event';
      body = `Activity on ${lockName}: ${action}`;
  }

  return {
    title,
    body,
    data: {
      type: action,
      lockId: lock.id,
      lockName,
      hasAnomaly: anomalyResult.hasAnomalies,
      anomalyScore: anomalyResult.anomalyScore
    },
    channelId: getChannelId(action),
    priority: 'high'
  };
};

/**
 * Get notification channel based on action type
 */
const getChannelId = (action) => {
  if (['tamper_detected', 'failed_attempt', 'battery_critical'].includes(action)) {
    return 'alerts';
  }
  if (['unlocked', 'locked', 'auto_lock'].includes(action)) {
    return 'lock-events';
  }
  return 'default';
};

/**
 * Get users to notify for an event
 */
const getUsersToNotify = async (lockId, action, excludeUserId = null) => {
  try {
    // Get all users with access to this lock
    let query = supabase
      .from('user_locks')
      .select(`
        user_id,
        users:user_id (
          id,
          email,
          notification_preferences:notification_preferences (*)
        )
      `)
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data: userLocks, error } = await query;

    if (error || !userLocks) {
      return [];
    }

    // Filter based on notification preferences
    const category = NOTIFICATION_CONFIG[action]?.category || 'other';

    return userLocks
      .filter(ul => {
        const prefs = ul.users?.notification_preferences;
        if (!prefs || !prefs.push_enabled) return false;

        // Check category-specific preferences
        switch (category) {
          case 'security':
            return prefs.tamper_alerts !== false && prefs.failed_attempts !== false;
          case 'access':
            return action === 'unlocked' ? prefs.unlock_notifications !== false : prefs.lock_notifications !== false;
          case 'battery':
            return prefs.battery_warnings !== false;
          case 'status':
            return prefs.offline_alerts !== false;
          default:
            return true;
        }
      })
      .map(ul => ul.user_id);

  } catch (error) {
    console.error('[SmartNotifications] Error getting users:', error);
    return [];
  }
};

/**
 * Check if notification should be batched
 */
const shouldBatchNotification = async (priority, userIds) => {
  // Never batch critical notifications
  if (priority === NotificationPriority.CRITICAL) {
    return false;
  }

  // Check if any user is in quiet hours
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8);

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
    .in('user_id', userIds)
    .eq('quiet_hours_enabled', true);

  if (!prefs || prefs.length === 0) {
    // No quiet hours, batch only LOW priority
    return priority === NotificationPriority.LOW;
  }

  // Check if current time is in quiet hours for any user
  const inQuietHours = prefs.some(pref => {
    const start = pref.quiet_hours_start;
    const end = pref.quiet_hours_end;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  });

  // During quiet hours, batch everything except CRITICAL
  if (inQuietHours && priority !== NotificationPriority.CRITICAL) {
    return true;
  }

  // Batch LOW priority
  return priority === NotificationPriority.LOW;
};

/**
 * Queue notification for batching
 */
const queueForBatch = async (lockId, action, metadata, anomalyResult, userIds) => {
  try {
    const { error } = await supabase
      .from('ai_processing_queue')
      .insert([{
        task_type: 'batch_notification',
        payload: JSON.stringify({
          lockId,
          action,
          metadata,
          anomalyResult,
          userIds
        }),
        priority: 0,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('[SmartNotifications] Failed to queue for batch:', error);
    }
  } catch (error) {
    console.error('[SmartNotifications] Queue error:', error);
  }
};

/**
 * Send notifications to users
 */
const sendToUsers = async (userIds, notification, action) => {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await expoPushService.sendToUser(userId, notification);
    if (result.success) {
      sent += result.sent || 1;
    } else {
      failed++;
    }
  }

  return { sent, failed };
};

/**
 * Log notification for analytics
 */
const logNotification = async ({
  lockId,
  action,
  userId,
  recipientCount,
  priority,
  hasAnomaly,
  notification
}) => {
  try {
    await supabase
      .from('ai_processing_queue')
      .insert([{
        task_type: 'notification_log',
        payload: JSON.stringify({
          lockId,
          action,
          userId,
          recipientCount,
          priority,
          hasAnomaly,
          title: notification.title,
          body: notification.body,
          timestamp: new Date().toISOString()
        }),
        priority: 0,
        status: 'completed',
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    // Don't fail on logging errors
    console.error('[SmartNotifications] Logging error:', error);
  }
};

/**
 * Send daily digest notification
 */
export const sendDailyDigest = async (userId, lockId) => {
  try {
    // Get yesterday's events
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: events, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('lock_id', lockId)
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (error || !events || events.length === 0) {
      return { success: true, message: 'No events to digest' };
    }

    // Get lock name
    const { data: lock } = await supabase
      .from('locks')
      .select('name')
      .eq('id', lockId)
      .single();

    const lockName = lock?.name || 'Your lock';

    // Summarize events
    const unlockCount = events.filter(e => e.action === 'unlocked').length;
    const lockCount = events.filter(e => e.action === 'locked').length;
    const failedCount = events.filter(e => e.action === 'failed_attempt').length;
    const uniqueUsers = new Set(events.filter(e => e.user_id).map(e => e.user_id)).size;

    let body = `Yesterday: ${unlockCount} unlocks, ${lockCount} locks`;
    if (uniqueUsers > 0) {
      body += ` by ${uniqueUsers} user${uniqueUsers > 1 ? 's' : ''}`;
    }
    if (failedCount > 0) {
      body += `. ⚠️ ${failedCount} failed attempt${failedCount > 1 ? 's' : ''}`;
    }

    const notification = {
      title: `📊 ${lockName} Daily Summary`,
      body,
      data: {
        type: 'daily_digest',
        lockId,
        lockName,
        stats: { unlockCount, lockCount, failedCount, uniqueUsers }
      },
      channelId: 'default',
      priority: 'default'
    };

    return await expoPushService.sendToUser(userId, notification);

  } catch (error) {
    console.error('[SmartNotifications] Digest error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process batched notifications (call periodically)
 */
export const processBatchedNotifications = async () => {
  try {
    // Get pending batch notifications
    const { data: pending, error } = await supabase
      .from('ai_processing_queue')
      .select('*')
      .eq('task_type', 'batch_notification')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error || !pending || pending.length === 0) {
      return { processed: 0 };
    }

    // Group by lock and user
    const grouped = {};
    for (const item of pending) {
      const payload = JSON.parse(item.payload);
      const key = `${payload.lockId}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({ ...payload, queueId: item.id });
    }

    let processed = 0;

    // Process each group
    for (const [lockId, events] of Object.entries(grouped)) {
      if (events.length === 1) {
        // Single event, send normally
        const event = events[0];
        await sendSmartNotification({
          lockId: event.lockId,
          action: event.action,
          metadata: event.metadata
        });
      } else {
        // Multiple events, send digest
        await sendBatchDigest(lockId, events);
      }

      // Mark as processed
      const queueIds = events.map(e => e.queueId);
      await supabase
        .from('ai_processing_queue')
        .update({ status: 'completed' })
        .in('id', queueIds);

      processed += events.length;
    }

    return { processed };

  } catch (error) {
    console.error('[SmartNotifications] Batch processing error:', error);
    return { processed: 0, error: error.message };
  }
};

/**
 * Send batch digest notification
 */
const sendBatchDigest = async (lockId, events) => {
  try {
    const { data: lock } = await supabase
      .from('locks')
      .select('name')
      .eq('id', lockId)
      .single();

    const lockName = lock?.name || 'Your lock';

    // Count event types
    const counts = {};
    for (const event of events) {
      counts[event.action] = (counts[event.action] || 0) + 1;
    }

    // Build summary
    const parts = [];
    if (counts.unlocked) parts.push(`${counts.unlocked} unlock${counts.unlocked > 1 ? 's' : ''}`);
    if (counts.locked) parts.push(`${counts.locked} lock${counts.locked > 1 ? 's' : ''}`);
    if (counts.failed_attempt) parts.push(`${counts.failed_attempt} failed attempt${counts.failed_attempt > 1 ? 's' : ''}`);

    const notification = {
      title: `📱 ${lockName} Activity`,
      body: parts.join(', ') || `${events.length} events`,
      data: {
        type: 'batch_digest',
        lockId,
        lockName,
        eventCount: events.length
      },
      channelId: 'lock-events',
      priority: 'default'
    };

    // Get unique users to notify
    const userIds = [...new Set(events.flatMap(e => e.userIds))];
    await sendToUsers(userIds, notification, 'batch_digest');

  } catch (error) {
    console.error('[SmartNotifications] Batch digest error:', error);
  }
};

export default {
  sendSmartNotification,
  sendDailyDigest,
  processBatchedNotifications,
  NotificationPriority
};
