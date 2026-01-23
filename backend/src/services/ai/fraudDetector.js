/**
 * Fraud/Misuse Detection Service
 *
 * Detects suspicious patterns that may indicate:
 * - Unauthorized access attempts
 * - Account compromise
 * - Physical tampering
 * - Access credential sharing
 */

import { supabase } from '../supabase.js';
import { sendSmartNotification } from './smartNotifications.js';

/**
 * Alert severity levels
 */
export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Alert types
 */
export const AlertType = {
  BRUTE_FORCE: 'brute_force',
  UNUSUAL_ACCESS: 'unusual_access',
  CONCURRENT_ACCESS: 'concurrent_access',
  CREDENTIAL_SHARING: 'credential_sharing',
  TAMPER_ALERT: 'tamper_alert',
  DORMANT_REACTIVATION: 'dormant_reactivation',
  GEOGRAPHIC_ANOMALY: 'geographic_anomaly',
  RAPID_PERMISSION_CHANGES: 'rapid_permission_changes'
};

/**
 * Detection thresholds
 */
const THRESHOLDS = {
  FAILED_ATTEMPTS_5MIN: 5,         // Failed attempts in 5 minutes
  FAILED_ATTEMPTS_1HOUR: 10,       // Failed attempts in 1 hour
  CONCURRENT_ACCESS_WINDOW: 5,     // Minutes between accesses from different methods
  UNUSUAL_HOUR_START: 23,          // 11 PM
  UNUSUAL_HOUR_END: 5,             // 5 AM
  DORMANT_DAYS: 30,                // Days of inactivity before reactivation alert
  RAPID_CHANGES_WINDOW: 60,        // Minutes for permission change detection
  RAPID_CHANGES_COUNT: 3           // Number of changes to trigger alert
};

/**
 * Analyze a lock event for fraud indicators
 *
 * @param {Object} event The event to analyze
 * @returns {Promise<Object>} Fraud analysis result
 */
export const analyzeForFraud = async (event) => {
  try {
    const alerts = [];
    const { lock_id: lockId, user_id: userId, action, access_method, created_at } = event;

    // Check for brute force attempts
    if (action === 'failed_attempt') {
      const bruteForceAlert = await checkBruteForce(lockId);
      if (bruteForceAlert) alerts.push(bruteForceAlert);
    }

    // Check for unusual access patterns
    if (action === 'unlocked') {
      // Check unusual hours
      const unusualHourAlert = checkUnusualHours(created_at, lockId);
      if (unusualHourAlert) alerts.push(unusualHourAlert);

      // Check for concurrent access anomalies
      const concurrentAlert = await checkConcurrentAccess(lockId, userId, access_method);
      if (concurrentAlert) alerts.push(concurrentAlert);

      // Check for dormant user reactivation
      if (userId) {
        const dormantAlert = await checkDormantReactivation(lockId, userId);
        if (dormantAlert) alerts.push(dormantAlert);
      }
    }

    // Check for rapid permission changes
    if (['user_added', 'user_removed', 'permission_changed'].includes(action)) {
      const permissionAlert = await checkRapidPermissionChanges(lockId);
      if (permissionAlert) alerts.push(permissionAlert);
    }

    // Store alerts
    for (const alert of alerts) {
      await storeAlert(lockId, alert);

      // Send notification for high severity alerts
      if (alert.severity === AlertSeverity.CRITICAL) {
        await sendSmartNotification({
          lockId,
          action: 'fraud_alert',
          metadata: {
            alert_type: alert.type,
            severity: alert.severity,
            description: alert.description
          }
        });
      }
    }

    return {
      has_alerts: alerts.length > 0,
      alerts,
      analyzed_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('[FraudDetector] Analysis error:', error);
    return { has_alerts: false, alerts: [], error: error.message };
  }
};

/**
 * Check for brute force attack patterns
 */
const checkBruteForce = async (lockId) => {
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  // Count failed attempts in the last 5 minutes
  const { count: recentCount } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('action', 'failed_attempt')
    .gte('created_at', fiveMinutesAgo.toISOString());

  if (recentCount >= THRESHOLDS.FAILED_ATTEMPTS_5MIN) {
    return {
      type: AlertType.BRUTE_FORCE,
      severity: AlertSeverity.CRITICAL,
      description: `${recentCount} failed access attempts in the last 5 minutes`,
      details: {
        failed_count: recentCount,
        window_minutes: 5
      }
    };
  }

  // Count failed attempts in the last hour
  const { count: hourlyCount } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('action', 'failed_attempt')
    .gte('created_at', oneHourAgo.toISOString());

  if (hourlyCount >= THRESHOLDS.FAILED_ATTEMPTS_1HOUR) {
    return {
      type: AlertType.BRUTE_FORCE,
      severity: AlertSeverity.WARNING,
      description: `${hourlyCount} failed access attempts in the last hour`,
      details: {
        failed_count: hourlyCount,
        window_minutes: 60
      }
    };
  }

  return null;
};

/**
 * Check for access during unusual hours
 */
const checkUnusualHours = (timestamp, lockId) => {
  const eventTime = new Date(timestamp);
  const hour = eventTime.getHours();

  // Check if access is during unusual hours (11 PM - 5 AM)
  if (hour >= THRESHOLDS.UNUSUAL_HOUR_START || hour < THRESHOLDS.UNUSUAL_HOUR_END) {
    return {
      type: AlertType.UNUSUAL_ACCESS,
      severity: AlertSeverity.INFO,
      description: `Access occurred during unusual hours (${hour}:00)`,
      details: {
        hour,
        threshold_start: THRESHOLDS.UNUSUAL_HOUR_START,
        threshold_end: THRESHOLDS.UNUSUAL_HOUR_END
      }
    };
  }

  return null;
};

/**
 * Check for concurrent access from different methods
 */
const checkConcurrentAccess = async (lockId, userId, accessMethod) => {
  const windowMinutes = THRESHOLDS.CONCURRENT_ACCESS_WINDOW;
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  // Get recent unlock events
  const { data: recentUnlocks } = await supabase
    .from('activity_logs')
    .select('user_id, access_method, created_at')
    .eq('lock_id', lockId)
    .eq('action', 'unlocked')
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (!recentUnlocks || recentUnlocks.length < 2) return null;

  // Check for same user with different access methods in short window
  const userMethods = new Set();
  for (const unlock of recentUnlocks) {
    if (unlock.user_id === userId && unlock.access_method) {
      userMethods.add(unlock.access_method);
    }
  }

  if (userMethods.size > 1) {
    return {
      type: AlertType.CONCURRENT_ACCESS,
      severity: AlertSeverity.WARNING,
      description: 'Multiple access methods used within short timeframe',
      details: {
        methods: Array.from(userMethods),
        window_minutes: windowMinutes
      }
    };
  }

  // Check for different users accessing in very short window
  const uniqueUsers = new Set(recentUnlocks.map(u => u.user_id).filter(Boolean));
  if (uniqueUsers.size > 1) {
    const timeDiff = new Date(recentUnlocks[0].created_at) - new Date(recentUnlocks[1].created_at);
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff < 2) {
      return {
        type: AlertType.CREDENTIAL_SHARING,
        severity: AlertSeverity.INFO,
        description: 'Multiple users accessed lock within 2 minutes',
        details: {
          user_count: uniqueUsers.size,
          minutes_apart: Math.round(minutesDiff * 10) / 10
        }
      };
    }
  }

  return null;
};

/**
 * Check for dormant user reactivation
 */
const checkDormantReactivation = async (lockId, userId) => {
  const dormantThreshold = new Date();
  dormantThreshold.setDate(dormantThreshold.getDate() - THRESHOLDS.DORMANT_DAYS);

  // Get last activity for this user on this lock
  const { data: lastActivity } = await supabase
    .from('activity_logs')
    .select('created_at')
    .eq('lock_id', lockId)
    .eq('user_id', userId)
    .eq('action', 'unlocked')
    .lt('created_at', dormantThreshold.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  // Check if user had activity before dormant period but not during
  if (lastActivity && lastActivity.length > 0) {
    const { count: recentCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('user_id', userId)
      .eq('action', 'unlocked')
      .gte('created_at', dormantThreshold.toISOString());

    if (recentCount === 0) {
      return {
        type: AlertType.DORMANT_REACTIVATION,
        severity: AlertSeverity.INFO,
        description: `User accessing lock after ${THRESHOLDS.DORMANT_DAYS}+ days of inactivity`,
        details: {
          last_access: lastActivity[0].created_at,
          dormant_days: THRESHOLDS.DORMANT_DAYS
        }
      };
    }
  }

  return null;
};

/**
 * Check for rapid permission changes
 */
const checkRapidPermissionChanges = async (lockId) => {
  const windowMinutes = THRESHOLDS.RAPID_CHANGES_WINDOW;
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  const { count: changeCount } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .in('action', ['user_added', 'user_removed', 'permission_changed'])
    .gte('created_at', windowStart.toISOString());

  if (changeCount >= THRESHOLDS.RAPID_CHANGES_COUNT) {
    return {
      type: AlertType.RAPID_PERMISSION_CHANGES,
      severity: AlertSeverity.WARNING,
      description: `${changeCount} permission changes in the last ${windowMinutes} minutes`,
      details: {
        change_count: changeCount,
        window_minutes: windowMinutes
      }
    };
  }

  return null;
};

/**
 * Store a fraud alert
 */
const storeAlert = async (lockId, alert) => {
  try {
    await supabase
      .from('ai_insights')
      .insert([{
        lock_id: lockId,
        insight_type: 'anomaly',
        severity: alert.severity,
        title: `Security Alert: ${alert.type.replace(/_/g, ' ')}`,
        description: alert.description,
        metadata: alert.details || {},
        is_read: false,
        is_dismissed: false,
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('[FraudDetector] Failed to store alert:', error);
  }
};

/**
 * Get fraud alerts for a lock
 */
export const getFraudAlerts = async (lockId, days = 7) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: alerts, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('lock_id', lockId)
      .eq('insight_type', 'anomaly')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { alerts: [], error: error.message };
    }

    // Group alerts by type
    const alertsByType = {};
    for (const alert of alerts || []) {
      const type = alert.title.replace('Security Alert: ', '');
      if (!alertsByType[type]) {
        alertsByType[type] = [];
      }
      alertsByType[type].push(alert);
    }

    return {
      alerts: alerts || [],
      alerts_by_type: alertsByType,
      total_count: alerts?.length || 0,
      period_days: days
    };

  } catch (error) {
    console.error('[FraudDetector] Get alerts error:', error);
    return { alerts: [], error: error.message };
  }
};

/**
 * Get fraud summary for a lock
 */
export const getFraudSummary = async (lockId) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Count alerts by severity
    const { data: alerts } = await supabase
      .from('ai_insights')
      .select('severity')
      .eq('lock_id', lockId)
      .eq('insight_type', 'anomaly')
      .gte('created_at', sevenDaysAgo.toISOString());

    const severityCounts = {
      critical: 0,
      warning: 0,
      info: 0
    };

    for (const alert of alerts || []) {
      if (severityCounts[alert.severity] !== undefined) {
        severityCounts[alert.severity]++;
      }
    }

    // Get failed attempts count
    const { count: failedCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('action', 'failed_attempt')
      .gte('created_at', sevenDaysAgo.toISOString());

    return {
      alerts_by_severity: severityCounts,
      total_alerts: (alerts?.length || 0),
      failed_attempts: failedCount || 0,
      security_status: getSeverityStatus(severityCounts),
      period_days: 7
    };

  } catch (error) {
    console.error('[FraudDetector] Get summary error:', error);
    return { error: error.message };
  }
};

/**
 * Determine overall security status
 */
const getSeverityStatus = (counts) => {
  if (counts.critical > 0) return 'critical';
  if (counts.warning > 2) return 'warning';
  if (counts.info > 5) return 'attention';
  return 'good';
};

export default {
  analyzeForFraud,
  getFraudAlerts,
  getFraudSummary,
  AlertType,
  AlertSeverity
};
