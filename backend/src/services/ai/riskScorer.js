/**
 * Risk Scorer Service
 *
 * Calculates overall security risk score for locks.
 * Factors:
 * - Failed access attempts
 * - Unusual activity events
 * - Battery level
 * - Stale user access
 * - Unresolved alerts
 * - Time since last review
 */

import { supabase } from '../supabase.js';

// Risk factor weights (out of 100 total)
const RISK_WEIGHTS = {
  FAILED_ATTEMPTS: 20,      // 0-20 points
  UNUSUAL_ACCESS: 25,       // 0-25 points
  BATTERY_LEVEL: 15,        // 0-15 points
  STALE_USERS: 15,         // 0-15 points
  OPEN_ALERTS: 15,          // 0-15 points
  TIME_SINCE_CHECK: 10      // 0-10 points
};

// Risk level thresholds
const RISK_LEVELS = {
  LOW: { max: 30, label: 'low', color: '#22c55e' },
  MEDIUM: { max: 70, label: 'medium', color: '#f59e0b' },
  HIGH: { max: 100, label: 'high', color: '#ef4444' }
};

/**
 * Calculate risk score for a lock
 * @param {string} lockId Lock UUID
 * @returns {Object} Risk score with breakdown
 */
export const calculateRiskScore = async (lockId) => {
  const factors = {
    failed_attempts: 0,
    unusual_access: 0,
    battery_level: 0,
    stale_users: 0,
    open_alerts: 0,
    time_since_check: 0
  };

  const recommendations = [];

  // 1. Failed Attempts (last 24 hours)
  factors.failed_attempts = await calculateFailedAttemptsFactor(lockId);
  if (factors.failed_attempts > 10) {
    recommendations.push({
      priority: 'high',
      message: 'Review recent failed access attempts',
      action: 'view_failed_attempts'
    });
  }

  // 2. Unusual Access Events (from AI insights)
  factors.unusual_access = await calculateUnusualAccessFactor(lockId);
  if (factors.unusual_access > 15) {
    recommendations.push({
      priority: 'medium',
      message: 'Review unusual activity alerts',
      action: 'view_insights'
    });
  }

  // 3. Battery Level
  factors.battery_level = await calculateBatteryFactor(lockId);
  if (factors.battery_level > 10) {
    recommendations.push({
      priority: factors.battery_level > 12 ? 'high' : 'medium',
      message: 'Replace lock batteries soon',
      action: 'view_battery'
    });
  }

  // 4. Stale Users (inactive 30+ days)
  factors.stale_users = await calculateStaleUsersFactor(lockId);
  if (factors.stale_users > 5) {
    recommendations.push({
      priority: 'low',
      message: 'Review users who haven\'t accessed recently',
      action: 'view_users'
    });
  }

  // 5. Open Alerts
  factors.open_alerts = await calculateOpenAlertsFactor(lockId);
  if (factors.open_alerts > 5) {
    recommendations.push({
      priority: 'medium',
      message: 'Address pending security alerts',
      action: 'view_insights'
    });
  }

  // 6. Time Since Last Activity Check
  factors.time_since_check = await calculateTimeSinceCheckFactor(lockId);

  // Calculate overall score
  const overallScore = Math.min(
    Object.values(factors).reduce((sum, val) => sum + val, 0),
    100
  );

  // Determine risk level
  let riskLevel;
  if (overallScore <= RISK_LEVELS.LOW.max) {
    riskLevel = RISK_LEVELS.LOW.label;
  } else if (overallScore <= RISK_LEVELS.MEDIUM.max) {
    riskLevel = RISK_LEVELS.MEDIUM.label;
  } else {
    riskLevel = RISK_LEVELS.HIGH.label;
  }

  // Add default recommendation if score is good
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'info',
      message: 'Your lock security looks good!',
      action: null
    });
  }

  // Sort recommendations by priority
  const priorityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Build result
  const result = {
    lock_id: lockId,
    overall_score: overallScore,
    risk_level: riskLevel,
    factor_breakdown: factors,
    recommendations,
    calculated_at: new Date().toISOString()
  };

  // Store the score
  await supabase.from('lock_risk_scores').insert([result]);

  return result;
};

/**
 * Calculate failed attempts factor
 */
async function calculateFailedAttemptsFactor(lockId) {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const { count } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('action', 'failed_attempt')
    .gte('created_at', yesterday.toISOString());

  // 0-4 attempts = 0 points, 5+ = 5 points each, max 20
  const failedCount = count || 0;
  if (failedCount < 5) return 0;
  return Math.min((failedCount - 4) * 5, RISK_WEIGHTS.FAILED_ATTEMPTS);
}

/**
 * Calculate unusual access factor
 */
async function calculateUnusualAccessFactor(lockId) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count } = await supabase
    .from('ai_insights')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('insight_type', 'anomaly')
    .eq('is_dismissed', false)
    .gte('created_at', weekAgo.toISOString());

  // Each undismissed anomaly = 5 points, max 25
  return Math.min((count || 0) * 5, RISK_WEIGHTS.UNUSUAL_ACCESS);
}

/**
 * Calculate battery factor
 */
async function calculateBatteryFactor(lockId) {
  const { data: lock } = await supabase
    .from('locks')
    .select('battery_level')
    .eq('id', lockId)
    .single();

  if (!lock) return 0;

  const battery = lock.battery_level;

  if (battery <= 10) return RISK_WEIGHTS.BATTERY_LEVEL; // 15 points - critical
  if (battery <= 20) return 12; // Near critical
  if (battery <= 30) return 8; // Low
  if (battery <= 40) return 4; // Getting low
  return 0; // Good
}

/**
 * Calculate stale users factor
 */
async function calculateStaleUsersFactor(lockId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all users with access
  const { data: userLocks } = await supabase
    .from('user_locks')
    .select('user_id')
    .eq('lock_id', lockId)
    .eq('is_active', true);

  if (!userLocks || userLocks.length === 0) return 0;

  let staleCount = 0;

  for (const ul of userLocks) {
    // Check if user has accessed in last 30 days
    const { count } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('user_id', ul.user_id)
      .in('action', ['locked', 'unlocked'])
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!count || count === 0) {
      staleCount++;
    }
  }

  // Each stale user = 3 points, max 15
  return Math.min(staleCount * 3, RISK_WEIGHTS.STALE_USERS);
}

/**
 * Calculate open alerts factor
 */
async function calculateOpenAlertsFactor(lockId) {
  const { count } = await supabase
    .from('ai_insights')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', lockId)
    .eq('is_read', false)
    .eq('is_dismissed', false);

  // Each unread alert = 3 points, max 15
  return Math.min((count || 0) * 3, RISK_WEIGHTS.OPEN_ALERTS);
}

/**
 * Calculate time since last check factor
 */
async function calculateTimeSinceCheckFactor(lockId) {
  const { data: lastActivity } = await supabase
    .from('activity_logs')
    .select('created_at')
    .eq('lock_id', lockId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastActivity) return RISK_WEIGHTS.TIME_SINCE_CHECK; // No activity = max points

  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 0-7 days = 0, 7-14 days = 5, 14+ days = 10
  if (daysSinceActivity <= 7) return 0;
  if (daysSinceActivity <= 14) return 5;
  return RISK_WEIGHTS.TIME_SINCE_CHECK;
}

/**
 * Get risk score history for a lock
 */
export const getRiskHistory = async (lockId, days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: history } = await supabase
    .from('lock_risk_scores')
    .select('overall_score, risk_level, calculated_at')
    .eq('lock_id', lockId)
    .gte('calculated_at', since.toISOString())
    .order('calculated_at', { ascending: true });

  return history || [];
};

/**
 * Get risk summary across all locks for a user
 */
export const getUserRiskSummary = async (userId) => {
  // Get all user's locks
  const { data: userLocks } = await supabase
    .from('user_locks')
    .select('lock_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!userLocks || userLocks.length === 0) {
    return {
      total_locks: 0,
      high_risk: 0,
      medium_risk: 0,
      low_risk: 0,
      average_score: 0
    };
  }

  const lockIds = userLocks.map(ul => ul.lock_id);

  // Get latest scores for each lock
  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  let totalScore = 0;

  for (const lockId of lockIds) {
    const { data: score } = await supabase
      .from('lock_risk_scores')
      .select('overall_score, risk_level')
      .eq('lock_id', lockId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (score) {
      totalScore += score.overall_score;
      if (score.risk_level === 'high') highRisk++;
      else if (score.risk_level === 'medium') mediumRisk++;
      else lowRisk++;
    }
  }

  return {
    total_locks: lockIds.length,
    high_risk: highRisk,
    medium_risk: mediumRisk,
    low_risk: lowRisk,
    average_score: Math.round(totalScore / lockIds.length) || 0
  };
};

/**
 * Recalculate risk scores for all locks (cron job)
 */
export const recalculateAllScores = async () => {
  const { data: locks } = await supabase
    .from('locks')
    .select('id');

  if (!locks) return { updated: 0 };

  let updated = 0;
  for (const lock of locks) {
    try {
      await calculateRiskScore(lock.id);
      updated++;
    } catch (error) {
      console.error(`Failed to calculate risk for lock ${lock.id}:`, error);
    }
  }

  return { updated };
};

export default {
  calculateRiskScore,
  getRiskHistory,
  getUserRiskSummary,
  recalculateAllScores,
  RISK_LEVELS
};
