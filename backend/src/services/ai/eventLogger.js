/**
 * AI Event Logger Service
 *
 * Centralized logging service for all events that will be used by AI features.
 * This ensures consistent event logging across all controllers.
 */

import { supabase } from '../supabase.js';

// Event action types (matches lock_action enum in database)
export const EventAction = {
  // Lock actions
  LOCKED: 'locked',
  UNLOCKED: 'unlocked',
  FAILED_ATTEMPT: 'failed_attempt',
  AUTO_LOCK: 'auto_lock',
  PASSAGE_MODE: 'passage_mode',

  // Battery events
  BATTERY_WARNING: 'battery_warning',
  BATTERY_LOW: 'battery_low',
  BATTERY_CRITICAL: 'battery_critical',

  // Status events
  OFFLINE: 'offline',
  TAMPER_DETECTED: 'tamper_detected',

  // User management
  USER_ADDED: 'user_added',
  USER_REMOVED: 'user_removed',
  PERMISSION_CHANGED: 'permission_changed',

  // Access methods
  FINGERPRINT_ENROLLED: 'fingerprint_enrolled',
  FINGERPRINT_DELETED: 'fingerprint_deleted',
  CARD_ASSIGNED: 'card_assigned',
  CARD_REMOVED: 'card_removed',
  PASSCODE_CREATED: 'passcode_created',
  PASSCODE_DELETED: 'passcode_deleted',
  PASSCODE_USED: 'passcode_used',

  // Settings
  SETTING_CHANGED: 'setting_changed',
  MODE_CHANGED: 'mode_changed',

  // Auth events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  SIGNUP: 'signup',
  LOGOUT: 'logout',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_COMPLETE: 'password_reset_complete',
  EMAIL_VERIFIED: 'email_verified',
  PROFILE_UPDATED: 'profile_updated',
  ACCOUNT_DELETED: 'account_deleted',
  TOKEN_REFRESHED: 'token_refreshed'
};

// Access method types
export const AccessMethod = {
  FINGERPRINT: 'fingerprint',
  PIN: 'pin',
  PHONE: 'phone',
  CARD: 'card',
  REMOTE: 'remote',
  AUTO: 'auto',
  BLUETOOTH: 'bluetooth',
  GATEWAY: 'gateway'
};

/**
 * Log an event to activity_logs table
 *
 * @param {Object} params Event parameters
 * @param {string} params.lockId Lock UUID
 * @param {string} [params.userId] User UUID (optional for system events)
 * @param {string} params.action Event action (from EventAction)
 * @param {string} [params.accessMethod] Access method used
 * @param {boolean} [params.success=true] Whether the action was successful
 * @param {string} [params.failureReason] Reason for failure if not successful
 * @param {Object} [params.metadata] Additional event metadata
 * @param {string|Date} [params.createdAt] Optional event timestamp
 * @returns {Promise<Object>} Created activity log entry
 */
export const logEvent = async ({
  lockId,
  userId = null,
  action,
  accessMethod = null,
  success = true,
  failureReason = null,
  metadata = {},
  createdAt = null
}) => {
  try {
    const createdAtValue = createdAt ? new Date(createdAt) : new Date();
    const createdAtIso = Number.isNaN(createdAtValue.getTime())
      ? new Date().toISOString()
      : createdAtValue.toISOString();

    // Base event data without ai_processed (column may not exist in DB)
    const eventData = {
      lock_id: lockId,
      user_id: userId,
      action,
      access_method: accessMethod,
      success,
      failure_reason: failureReason,
      metadata: JSON.stringify(metadata),
      created_at: createdAtIso
    };

    // First try with ai_processed column
    let result = await supabase
      .from('activity_logs')
      .insert([{ ...eventData, ai_processed: false }])
      .select()
      .single();

    // If ai_processed column doesn't exist, try without it
    if (result.error && result.error.message?.includes('ai_processed')) {
      console.log('[EventLogger] ai_processed column not found, inserting without it');
      result = await supabase
        .from('activity_logs')
        .insert([eventData])
        .select()
        .single();
    }

    if (result.error) {
      console.error('[EventLogger] Failed to log event:', result.error);
      return null;
    }

    const activityLog = result.data;
    console.log(`[EventLogger] Logged ${action} event for lock ${lockId}`);

    // Queue for AI processing if it's a significant event (only if tables exist)
    if (shouldQueueForAI(action)) {
      await queueForAIProcessing(activityLog.id, action);
    }

    return activityLog;
  } catch (error) {
    console.error('[EventLogger] Error logging event:', error);
    return null;
  }
};

/**
 * Log a user management event
 */
export const logUserEvent = async ({
  lockId,
  actorUserId,
  targetUserId,
  action,
  details = {}
}) => {
  return logEvent({
    lockId,
    userId: actorUserId,
    action,
    metadata: {
      target_user_id: targetUserId,
      ...details
    }
  });
};

/**
 * Log a setting change event
 */
export const logSettingChange = async ({
  lockId,
  userId,
  settingName,
  oldValue,
  newValue
}) => {
  return logEvent({
    lockId,
    userId,
    action: EventAction.SETTING_CHANGED,
    metadata: {
      setting: settingName,
      old_value: oldValue,
      new_value: newValue
    }
  });
};

/**
 * Log a battery level change and track history
 */
export const logBatteryLevel = async ({
  lockId,
  batteryLevel,
  previousLevel = null
}) => {
  try {
    // Record in battery_history table
    const { error: historyError } = await supabase
      .from('battery_history')
      .insert([{
        lock_id: lockId,
        battery_level: batteryLevel,
        recorded_at: new Date().toISOString()
      }]);

    if (historyError) {
      console.error('[EventLogger] Failed to record battery history:', historyError);
    }

    // Log event if battery is low or critical
    if (batteryLevel <= 20 && (previousLevel === null || previousLevel > 20)) {
      const action = batteryLevel <= 10 ? EventAction.BATTERY_CRITICAL : EventAction.BATTERY_LOW;

      await logEvent({
        lockId,
        action,
        metadata: {
          battery_level: batteryLevel,
          previous_level: previousLevel
        }
      });
    }

    return true;
  } catch (error) {
    console.error('[EventLogger] Error logging battery level:', error);
    return false;
  }
};

/**
 * Log a failed access attempt
 */
export const logFailedAttempt = async ({
  lockId,
  userId = null,
  accessMethod,
  reason
}) => {
  return logEvent({
    lockId,
    userId,
    action: EventAction.FAILED_ATTEMPT,
    accessMethod,
    success: false,
    failureReason: reason,
    metadata: {
      attempt_time: new Date().toISOString()
    }
  });
};

/**
 * Log access method changes (fingerprint, card, passcode)
 */
export const logAccessMethodEvent = async ({
  lockId,
  userId,
  methodType,
  eventType, // 'created', 'deleted', 'used'
  targetUserId = null,
  details = {}
}) => {
  let action;

  switch (methodType) {
    case 'fingerprint':
      action = eventType === 'deleted' ? EventAction.FINGERPRINT_DELETED : EventAction.FINGERPRINT_ENROLLED;
      break;
    case 'card':
      action = eventType === 'deleted' ? EventAction.CARD_REMOVED : EventAction.CARD_ASSIGNED;
      break;
    case 'passcode':
      if (eventType === 'deleted') {
        action = EventAction.PASSCODE_DELETED;
      } else if (eventType === 'used') {
        action = EventAction.PASSCODE_USED;
      } else {
        action = EventAction.PASSCODE_CREATED;
      }
      break;
    default:
      action = EventAction.SETTING_CHANGED;
  }

  return logEvent({
    lockId,
    userId,
    action,
    accessMethod: methodType,
    metadata: {
      target_user_id: targetUserId,
      event_type: eventType,
      ...details
    }
  });
};

/**
 * Log home mode change
 */
export const logModeChange = async ({
  userId,
  previousMode,
  newMode,
  lockIds = []
}) => {
  // Log for each affected lock
  for (const lockId of lockIds) {
    await logEvent({
      lockId,
      userId,
      action: EventAction.MODE_CHANGED,
      metadata: {
        previous_mode: previousMode,
        new_mode: newMode
      }
    });
  }

  return true;
};

/**
 * Log an authentication/security event (no lock context)
 *
 * @param {Object} params
 * @param {string} params.userId - User UUID (null for failed login by unknown user)
 * @param {string} params.action - EventAction auth constant
 * @param {boolean} [params.success=true]
 * @param {string} [params.failureReason]
 * @param {string} [params.ipAddress] - Request IP for audit trail
 * @param {Object} [params.metadata] - Extra details (email, user-agent, etc.)
 */
export const logAuthEvent = async ({
  userId = null,
  action,
  success = true,
  failureReason = null,
  ipAddress = null,
  metadata = {}
}) => {
  try {
    const eventData = {
      lock_id: null,
      user_id: userId,
      action,
      access_method: null,
      success,
      failure_reason: failureReason,
      ip_address: ipAddress,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };

    let result = await supabase
      .from('activity_logs')
      .insert([{ ...eventData, ai_processed: false }])
      .select()
      .single();

    if (result.error && result.error.message?.includes('ai_processed')) {
      result = await supabase
        .from('activity_logs')
        .insert([eventData])
        .select()
        .single();
    }

    if (result.error) {
      console.error('[EventLogger] Failed to log auth event:', result.error);
      return null;
    }

    console.log(`[EventLogger] Logged auth event: ${action} for user ${userId || 'unknown'}`);
    return result.data;
  } catch (error) {
    console.error('[EventLogger] Error logging auth event:', error);
    return null;
  }
};

/**
 * Check if event should be queued for AI processing
 */
const shouldQueueForAI = (action) => {
  // Events that need AI analysis
  const aiRelevantEvents = [
    EventAction.UNLOCKED,
    EventAction.LOCKED,
    EventAction.FAILED_ATTEMPT,
    EventAction.TAMPER_DETECTED,
    EventAction.BATTERY_LOW,
    EventAction.BATTERY_CRITICAL,
    EventAction.USER_ADDED,
    EventAction.USER_REMOVED
  ];

  return aiRelevantEvents.includes(action);
};

/**
 * Queue event for AI processing
 */
const queueForAIProcessing = async (eventId, action) => {
  try {
    // Determine processing priority
    let priority = 0;
    if (action === EventAction.FAILED_ATTEMPT || action === EventAction.TAMPER_DETECTED) {
      priority = 10; // High priority for security events
    } else if (action === EventAction.BATTERY_CRITICAL) {
      priority = 5; // Medium priority for critical battery
    }

    const { error } = await supabase
      .from('ai_processing_queue')
      .insert([{
        task_type: 'analyze_event',
        payload: JSON.stringify({ event_id: eventId, action }),
        priority,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);

    if (error) {
      // Silently fail if ai_processing_queue table doesn't exist
      if (!error.message?.includes('relation') && !error.code?.includes('42P01')) {
        console.error('[EventLogger] Failed to queue AI processing:', error);
      }
    }
  } catch (error) {
    // Silently ignore errors for optional AI features
    console.log('[EventLogger] AI processing queue not available:', error.message);
  }
};

/**
 * Get recent events for a lock (for AI analysis)
 */
export const getRecentEvents = async (lockId, hours = 24) => {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data: events, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('lock_id', lockId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[EventLogger] Failed to get recent events:', error);
    return [];
  }

  return events || [];
};

/**
 * Get failed attempts count for a lock in a time window
 */
export const getFailedAttemptsCount = async (lockId, minutes = 5) => {
  const since = new Date();
  since.setMinutes(since.getMinutes() - minutes);

  const { count, error } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('action', EventAction.FAILED_ATTEMPT)
    .gte('created_at', since.toISOString());

  if (error) {
    console.error('[EventLogger] Failed to get failed attempts count:', error);
    return 0;
  }

  return count || 0;
};

export default {
  logEvent,
  logUserEvent,
  logAuthEvent,
  logSettingChange,
  logBatteryLevel,
  logFailedAttempt,
  logAccessMethodEvent,
  logModeChange,
  getRecentEvents,
  getFailedAttemptsCount,
  EventAction,
  AccessMethod
};
