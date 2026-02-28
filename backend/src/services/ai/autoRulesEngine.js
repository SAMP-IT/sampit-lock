/**
 * Auto Access Rules Engine
 *
 * Learns from user behavior and auto-generates access rules:
 * - Auto-lock suggestions
 * - Time-based access patterns
 * - Auto-disable inactive users
 * - Seasonal pattern detection
 */

import { supabase } from '../supabase.js';

/**
 * Rule types
 */
export const RuleType = {
  AUTO_LOCK: 'auto_lock',
  TIME_RESTRICTION: 'time_restriction',
  AUTO_DISABLE: 'auto_disable',
  SEASONAL_ACCESS: 'seasonal_access',
  USAGE_BASED: 'usage_based'
};

/**
 * Rule status
 */
export const RuleStatus = {
  SUGGESTED: 'suggested',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

/**
 * Analyze patterns and generate rule suggestions
 *
 * @param {string} lockId Lock UUID
 * @returns {Promise<Object>} Rule suggestions
 */
export const generateRuleSuggestions = async (lockId) => {
  try {
    const suggestions = [];

    // Analyze auto-lock patterns
    const autoLockSuggestion = await analyzeAutoLockPatterns(lockId);
    if (autoLockSuggestion) suggestions.push(autoLockSuggestion);

    // Analyze access time patterns
    const timePatternSuggestions = await analyzeAccessTimePatterns(lockId);
    suggestions.push(...timePatternSuggestions);

    // Analyze inactive users
    const inactiveSuggestions = await analyzeInactiveUsers(lockId);
    suggestions.push(...inactiveSuggestions);

    // Analyze seasonal patterns
    const seasonalSuggestions = await analyzeSeasonalPatterns(lockId);
    suggestions.push(...seasonalSuggestions);

    // Analyze per-user usage frequency
    const usageSuggestions = await analyzeUsageFrequency(lockId);
    suggestions.push(...usageSuggestions);

    // Check for existing active or dismissed rules to avoid duplicates
    const { data: existingRules } = await supabase
      .from('notification_rules')
      .select('rule_type, conditions, status, is_active')
      .eq('lock_id', lockId)
      .or('is_active.eq.true,status.eq.dismissed');

    // Filter out suggestions that already have active or dismissed rules
    const filteredSuggestions = suggestions.filter(s => {
      return !existingRules?.some(r =>
        r.rule_type === s.type &&
        JSON.stringify(r.conditions) === JSON.stringify(s.conditions)
      );
    });

    return {
      suggestions: filteredSuggestions,
      total: filteredSuggestions.length,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('[AutoRulesEngine] Error generating suggestions:', error);
    return { suggestions: [], error: error.message };
  }
};

/**
 * Analyze auto-lock patterns
 */
const analyzeAutoLockPatterns = async (lockId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get unlock events followed by manual locks
  const { data: unlocks } = await supabase
    .from('activity_logs')
    .select('id, created_at')
    .eq('lock_id', lockId)
    .eq('action', 'unlocked')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  const { data: locks } = await supabase
    .from('activity_logs')
    .select('id, created_at')
    .eq('lock_id', lockId)
    .eq('action', 'locked')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!unlocks || !locks || unlocks.length < 10) return null;

  // Calculate time between unlock and next lock
  const lockDelays = [];
  let lockIndex = 0;

  for (const unlock of unlocks) {
    const unlockTime = new Date(unlock.created_at);

    // Find next lock after this unlock
    while (lockIndex < locks.length &&
           new Date(locks[lockIndex].created_at) <= unlockTime) {
      lockIndex++;
    }

    if (lockIndex < locks.length) {
      const lockTime = new Date(locks[lockIndex].created_at);
      const delaySeconds = (lockTime - unlockTime) / 1000;

      // Only consider delays under 10 minutes
      if (delaySeconds > 0 && delaySeconds < 600) {
        lockDelays.push(delaySeconds);
      }
    }
  }

  if (lockDelays.length < 5) return null;

  // Calculate median delay
  lockDelays.sort((a, b) => a - b);
  const medianDelay = lockDelays[Math.floor(lockDelays.length / 2)];
  const suggestedDelay = Math.round(medianDelay / 10) * 10; // Round to nearest 10 seconds

  // Only suggest if there's a clear pattern (low variance)
  const avgDelay = lockDelays.reduce((a, b) => a + b, 0) / lockDelays.length;
  const variance = lockDelays.reduce((sum, d) => sum + Math.pow(d - avgDelay, 2), 0) / lockDelays.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avgDelay;

  if (cv > 0.5) return null; // Too much variance

  return {
    type: RuleType.AUTO_LOCK,
    priority: 'medium',
    title: 'Auto-Lock Suggestion',
    description: `Based on your usage patterns, consider enabling auto-lock after ${suggestedDelay} seconds.`,
    conditions: {
      delay_seconds: suggestedDelay
    },
    confidence: Math.round((1 - cv) * 100),
    based_on: {
      sample_size: lockDelays.length,
      median_delay: medianDelay,
      period_days: 30
    }
  };
};

/**
 * Analyze access time patterns
 */
const analyzeAccessTimePatterns = async (lockId) => {
  const suggestions = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all users with access
  const { data: userLocks } = await supabase
    .from('user_locks')
    .select(`
      user_id,
      role,
      time_restrictions,
      users:user_id (first_name, last_name)
    `)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .neq('role', 'owner');

  if (!userLocks) return suggestions;

  for (const userLock of userLocks) {
    // Skip if already has time restrictions
    if (userLock.time_restrictions?.enabled) continue;

    // Get user's access patterns
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('lock_id', lockId)
      .eq('user_id', userLock.user_id)
      .eq('action', 'unlocked')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!activities || activities.length < 10) continue;

    // Analyze hour distribution
    const hourCounts = {};
    const dayCounts = {};

    for (const activity of activities) {
      const date = new Date(activity.created_at);
      const hour = date.getHours();
      const day = date.getDay();

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    // Find peak hours (80% of activity)
    const totalActivities = activities.length;
    const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);

    let accumulatedPercentage = 0;
    const peakHours = [];

    for (const [hour, count] of sortedHours) {
      peakHours.push(parseInt(hour));
      accumulatedPercentage += (count / totalActivities) * 100;
      if (accumulatedPercentage >= 80) break;
    }

    // Only suggest if pattern is clear (usage concentrated in few hours)
    if (peakHours.length <= 6) {
      peakHours.sort((a, b) => a - b);
      const startHour = Math.max(0, peakHours[0] - 1);
      const endHour = Math.min(23, peakHours[peakHours.length - 1] + 1);

      const userName = userLock.users ?
        `${userLock.users.first_name || ''} ${userLock.users.last_name || ''}`.trim() :
        'User';

      suggestions.push({
        type: RuleType.TIME_RESTRICTION,
        priority: 'low',
        title: `Time Restriction for ${userName}`,
        description: `${userName} typically accesses between ${startHour}:00-${endHour}:00. Consider adding time restrictions.`,
        conditions: {
          user_id: userLock.user_id,
          start_hour: startHour,
          end_hour: endHour,
          days: Object.keys(dayCounts).map(d => parseInt(d))
        },
        confidence: Math.round((1 - (peakHours.length / 12)) * 100),
        based_on: {
          sample_size: activities.length,
          peak_hours: peakHours,
          period_days: 30
        }
      });
    }
  }

  return suggestions;
};

/**
 * Analyze inactive users for auto-disable suggestions
 */
const analyzeInactiveUsers = async (lockId) => {
  const suggestions = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all users with access
  const { data: userLocks } = await supabase
    .from('user_locks')
    .select(`
      user_id,
      role,
      created_at,
      users:user_id (first_name, last_name)
    `)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .neq('role', 'owner')
    .neq('role', 'admin');

  if (!userLocks) return suggestions;

  for (const userLock of userLocks) {
    // Check last activity
    const { data: lastActivity } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('lock_id', lockId)
      .eq('user_id', userLock.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastActivityDate = lastActivity?.[0]?.created_at;

    // Check if no activity in 30 days
    if (!lastActivityDate || new Date(lastActivityDate) < thirtyDaysAgo) {
      // But only if they've been added more than 14 days ago
      const daysSinceAdded = (Date.now() - new Date(userLock.created_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceAdded > 14) {
        const userName = userLock.users ?
          `${userLock.users.first_name || ''} ${userLock.users.last_name || ''}`.trim() :
          'User';

        const daysSinceActivity = lastActivityDate ?
          Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)) :
          Math.floor(daysSinceAdded);

        suggestions.push({
          type: RuleType.AUTO_DISABLE,
          priority: 'medium',
          title: `Disable Inactive User: ${userName}`,
          description: `${userName} hasn't accessed the lock in ${daysSinceActivity} days. Consider disabling their access.`,
          conditions: {
            user_id: userLock.user_id,
            inactive_days: daysSinceActivity
          },
          confidence: Math.min(90, 50 + daysSinceActivity),
          based_on: {
            last_activity: lastActivityDate,
            days_inactive: daysSinceActivity
          }
        });
      }
    }
  }

  return suggestions;
};

/**
 * Create a rule from a suggestion
 */
export const createRuleFromSuggestion = async (lockId, suggestion, userId) => {
  try {
    const { data: rule, error } = await supabase
      .from('notification_rules')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        rule_type: suggestion.type,
        name: suggestion.title,
        conditions: JSON.stringify(suggestion.conditions),
        actions: JSON.stringify(getDefaultActions(suggestion.type)),
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, rule };

  } catch (error) {
    console.error('[AutoRulesEngine] Create rule error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get default actions for rule type
 */
const getDefaultActions = (ruleType) => {
  switch (ruleType) {
    case RuleType.AUTO_LOCK:
      return [{ action: 'lock_after_delay' }];
    case RuleType.TIME_RESTRICTION:
      return [{ action: 'restrict_access' }];
    case RuleType.AUTO_DISABLE:
      return [{ action: 'disable_user' }];
    case RuleType.SEASONAL_ACCESS:
      return [{ action: 'adjust_schedule' }];
    case RuleType.USAGE_BASED:
      return [{ action: 'adjust_role' }];
    default:
      return [{ action: 'notify' }];
  }
};

/**
 * Get active rules for a lock
 */
export const getActiveRules = async (lockId) => {
  try {
    const { data: rules, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { rules: [], error: error.message };
    }

    return {
      rules: (rules || []).map(r => ({
        ...r,
        conditions: JSON.parse(r.conditions || '{}'),
        actions: JSON.parse(r.actions || '[]')
      })),
      total: rules?.length || 0
    };

  } catch (error) {
    console.error('[AutoRulesEngine] Get rules error:', error);
    return { rules: [], error: error.message };
  }
};

/**
 * Toggle rule status (scoped to user's rules only)
 */
export const toggleRule = async (ruleId, isActive, userId) => {
  try {
    const { data: rule, error } = await supabase
      .from('notification_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, rule };

  } catch (error) {
    console.error('[AutoRulesEngine] Toggle rule error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a rule (scoped to user's rules only)
 */
export const deleteRule = async (ruleId, userId) => {
  try {
    const { error } = await supabase
      .from('notification_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('[AutoRulesEngine] Delete rule error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Dismiss a rule suggestion so it won't reappear
 */
export const dismissSuggestion = async (lockId, suggestion, userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_rules')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        rule_type: suggestion.type,
        name: suggestion.title || 'Dismissed suggestion',
        conditions: JSON.stringify(suggestion.conditions),
        actions: JSON.stringify([]),
        is_active: false,
        status: 'dismissed',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, dismissed: data };
  } catch (error) {
    console.error('[AutoRulesEngine] Dismiss suggestion error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Analyze seasonal access patterns (month-over-month differences)
 */
const analyzeSeasonalPatterns = async (lockId) => {
  const suggestions = [];

  // Need at least 3 months of data
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: activities } = await supabase
    .from('activity_logs')
    .select('created_at, user_id')
    .eq('lock_id', lockId)
    .eq('action', 'unlocked')
    .gte('created_at', threeMonthsAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!activities || activities.length < 30) return suggestions;

  // Group by month
  const monthCounts = {};
  for (const activity of activities) {
    const date = new Date(activity.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthCounts[monthKey]) monthCounts[monthKey] = { total: 0, uniqueUsers: new Set() };
    monthCounts[monthKey].total++;
    monthCounts[monthKey].uniqueUsers.add(activity.user_id);
  }

  const months = Object.keys(monthCounts).sort();
  if (months.length < 2) return suggestions;

  // Compare most recent month to prior average
  const recentMonth = months[months.length - 1];
  const priorMonths = months.slice(0, -1);
  const priorAvg = priorMonths.reduce((sum, m) => sum + monthCounts[m].total, 0) / priorMonths.length;
  const recentCount = monthCounts[recentMonth].total;

  const ratio = recentCount / (priorAvg || 1);

  // Significant seasonal variation (>50% increase or decrease)
  if (ratio > 1.5 || ratio < 0.5) {
    const trend = ratio > 1 ? 'higher' : 'lower';
    const percentage = Math.round(Math.abs(ratio - 1) * 100);
    const recentMonthName = new Date(recentMonth + '-01').toLocaleString('default', { month: 'long' });

    suggestions.push({
      type: RuleType.SEASONAL_ACCESS,
      priority: 'low',
      title: 'Seasonal Access Pattern Detected',
      description: `Access is ${percentage}% ${trend} in ${recentMonthName} compared to prior months. Consider adjusting access rules for seasonal changes.`,
      reason: trend === 'higher'
        ? 'Guest access may be increasing seasonally. Consider extending access hours.'
        : 'Usage is dropping. Consider tightening access restrictions.',
      conditions: {
        trend,
        percentage,
        recent_month: recentMonth,
        recent_count: recentCount,
        prior_average: Math.round(priorAvg)
      },
      confidence: Math.min(85, 50 + months.length * 10),
      based_on: {
        months_analyzed: months.length,
        total_events: activities.length,
        ratio: Math.round(ratio * 100) / 100
      }
    });
  }

  return suggestions;
};

/**
 * Analyze per-user usage frequency for upgrade/downgrade suggestions
 */
const analyzeUsageFrequency = async (lockId) => {
  const suggestions = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get non-owner users with access
  const { data: userLocks } = await supabase
    .from('user_locks')
    .select(`
      user_id,
      role,
      users:user_id (first_name, last_name)
    `)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .neq('role', 'owner');

  if (!userLocks) return suggestions;

  for (const userLock of userLocks) {
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('lock_id', lockId)
      .eq('user_id', userLock.user_id)
      .eq('action', 'unlocked')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const userName = userLock.users
      ? `${userLock.users.first_name || ''} ${userLock.users.last_name || ''}`.trim()
      : 'User';

    const accessCount = activities?.length || 0;

    // Low usage: fewer than 2 accesses per month for non-guest roles
    if (accessCount < 2 && !['guest', 'guest_longterm'].includes(userLock.role)) {
      suggestions.push({
        type: RuleType.USAGE_BASED,
        priority: 'low',
        title: `Low Usage: ${userName}`,
        description: `${userName} has only used the lock ${accessCount} time(s) in the past 30 days. Consider downgrading to restricted access.`,
        reason: 'Infrequent users with elevated permissions increase security risk.',
        conditions: {
          user_id: userLock.user_id,
          access_count_30d: accessCount,
          current_role: userLock.role,
          suggested_action: 'downgrade'
        },
        confidence: Math.min(80, 60 + (30 - accessCount) * 2),
        based_on: {
          sample_period_days: 30,
          access_count: accessCount
        }
      });
    }

    // High, consistent usage: daily access at a regular time — suggest trusted/auto-unlock
    if (accessCount >= 20 && activities && activities.length >= 20) {
      const hours = activities.map(a => new Date(a.created_at).getHours());
      const hourCounts = {};
      hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });

      // Find peak hour
      const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
      const peakHour = parseInt(sortedHours[0][0]);
      const peakPct = (sortedHours[0][1] / accessCount) * 100;

      // If >40% of accesses are at one hour, suggest upgrade
      if (peakPct >= 40 && userLock.role !== 'admin') {
        suggestions.push({
          type: RuleType.USAGE_BASED,
          priority: 'low',
          title: `Frequent User: ${userName}`,
          description: `${userName} accesses daily around ${peakHour}:00 (${Math.round(peakPct)}% of the time). Consider upgrading to trusted for streamlined access.`,
          reason: 'Consistent daily users benefit from streamlined access.',
          conditions: {
            user_id: userLock.user_id,
            access_count_30d: accessCount,
            peak_hour: peakHour,
            current_role: userLock.role,
            suggested_action: 'upgrade'
          },
          confidence: Math.min(85, 50 + Math.round(peakPct / 2)),
          based_on: {
            sample_period_days: 30,
            access_count: accessCount,
            peak_hour: peakHour,
            peak_percentage: Math.round(peakPct)
          }
        });
      }
    }
  }

  return suggestions;
};

export default {
  generateRuleSuggestions,
  createRuleFromSuggestion,
  getActiveRules,
  toggleRule,
  deleteRule,
  dismissSuggestion,
  RuleType,
  RuleStatus
};
