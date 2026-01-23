/**
 * Smart Scheduling / Vacation Mode Service
 *
 * Manages home modes and intelligent scheduling:
 * - Home/Away/Vacation modes
 * - Automatic mode switching based on patterns
 * - Temporary access management
 * - Presence simulation during vacation
 */

import { supabase } from '../supabase.js';
import { sendSmartNotification } from './smartNotifications.js';
import { logModeChange } from './eventLogger.js';

/**
 * Home modes
 */
export const HomeMode = {
  HOME: 'home',
  AWAY: 'away',
  VACATION: 'vacation',
  NIGHT: 'night'
};

/**
 * Get current home mode for a user
 */
export const getCurrentMode = async (userId) => {
  try {
    const { data: mode, error } = await supabase
      .from('home_modes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !mode) {
      return {
        mode: HomeMode.HOME,
        is_default: true,
        since: null
      };
    }

    return {
      mode: mode.mode,
      is_default: false,
      since: mode.activated_at,
      ends_at: mode.ends_at,
      settings: mode.settings ? JSON.parse(mode.settings) : {}
    };

  } catch (error) {
    console.error('[SmartScheduling] Get mode error:', error);
    return { mode: HomeMode.HOME, error: error.message };
  }
};

/**
 * Set home mode
 */
export const setHomeMode = async (userId, mode, options = {}) => {
  try {
    const { endsAt, settings, lockIds } = options;

    // Deactivate current mode
    await supabase
      .from('home_modes')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get previous mode for logging
    const { data: previousModeData } = await supabase
      .from('home_modes')
      .select('mode')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const previousMode = previousModeData?.mode || HomeMode.HOME;

    // Create new mode
    const { data: newMode, error } = await supabase
      .from('home_modes')
      .insert([{
        user_id: userId,
        mode,
        activated_at: new Date().toISOString(),
        ends_at: endsAt || null,
        settings: settings ? JSON.stringify(settings) : null,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Get user's locks if not specified
    let affectedLockIds = lockIds;
    if (!affectedLockIds) {
      const { data: userLocks } = await supabase
        .from('user_locks')
        .select('lock_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('role', ['owner', 'admin']);

      affectedLockIds = userLocks?.map(ul => ul.lock_id) || [];
    }

    // Apply mode-specific settings to locks
    await applyModeToLocks(mode, affectedLockIds, settings);

    // Log mode change
    await logModeChange({
      userId,
      previousMode,
      newMode: mode,
      lockIds: affectedLockIds
    });

    return {
      success: true,
      mode: {
        ...newMode,
        settings: settings || {}
      },
      affected_locks: affectedLockIds.length
    };

  } catch (error) {
    console.error('[SmartScheduling] Set mode error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Apply mode settings to locks
 */
const applyModeToLocks = async (mode, lockIds, settings = {}) => {
  if (lockIds.length === 0) return;

  const lockUpdates = {};

  switch (mode) {
    case HomeMode.VACATION:
      // Enable strict security settings
      lockUpdates.vacation_mode = true;
      // Optionally disable some access
      if (settings.disable_guest_access) {
        await disableGuestAccess(lockIds);
      }
      break;

    case HomeMode.AWAY:
      // Ensure auto-lock is enabled
      await supabase
        .from('lock_settings')
        .update({ auto_lock_enabled: true })
        .in('lock_id', lockIds);
      break;

    case HomeMode.NIGHT:
      // Enable privacy mode
      await supabase
        .from('lock_settings')
        .update({ privacy_lock: true })
        .in('lock_id', lockIds);
      break;

    case HomeMode.HOME:
      // Restore normal settings
      await supabase
        .from('locks')
        .update({ vacation_mode: false })
        .in('id', lockIds);

      await supabase
        .from('lock_settings')
        .update({ privacy_lock: false })
        .in('lock_id', lockIds);
      break;
  }
};

/**
 * Disable guest access temporarily
 */
const disableGuestAccess = async (lockIds) => {
  await supabase
    .from('user_locks')
    .update({ vacation_disabled: true })
    .in('lock_id', lockIds)
    .eq('role', 'guest');
};

/**
 * Enable vacation mode with full options
 */
export const enableVacationMode = async (userId, options = {}) => {
  const {
    startDate = new Date(),
    endDate,
    trustedUsers = [],
    disableGuests = true,
    presenceSimulation = false,
    alertOnAccess = true,
    lockIds
  } = options;

  try {
    const settings = {
      start_date: new Date(startDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      trusted_users: trustedUsers,
      disable_guests: disableGuests,
      presence_simulation: presenceSimulation,
      alert_on_access: alertOnAccess
    };

    const result = await setHomeMode(userId, HomeMode.VACATION, {
      endsAt: endDate ? new Date(endDate).toISOString() : null,
      settings,
      lockIds
    });

    if (result.success) {
      // Schedule presence simulation if enabled
      if (presenceSimulation) {
        await schedulePresenceSimulation(lockIds || [], settings);
      }

      // Set up access alerts
      if (alertOnAccess && result.affected_locks > 0) {
        await enableVacationAlerts(lockIds || [], trustedUsers);
      }
    }

    return result;

  } catch (error) {
    console.error('[SmartScheduling] Enable vacation mode error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule presence simulation (fake lock/unlock events)
 */
const schedulePresenceSimulation = async (lockIds, settings) => {
  // This would integrate with a task scheduler to simulate presence
  // For now, just store the configuration

  for (const lockId of lockIds) {
    await supabase
      .from('ai_processing_queue')
      .insert([{
        task_type: 'presence_simulation',
        payload: JSON.stringify({
          lock_id: lockId,
          start_date: settings.start_date,
          end_date: settings.end_date
        }),
        priority: 1,
        status: 'pending',
        scheduled_for: new Date(settings.start_date).toISOString()
      }]);
  }
};

/**
 * Enable vacation alerts for unexpected access
 */
const enableVacationAlerts = async (lockIds, trustedUsers) => {
  for (const lockId of lockIds) {
    await supabase
      .from('notification_rules')
      .insert([{
        lock_id: lockId,
        rule_type: 'vacation_alert',
        name: 'Vacation Mode Alert',
        conditions: JSON.stringify({
          action: ['unlocked'],
          exclude_users: trustedUsers
        }),
        actions: JSON.stringify([{
          action: 'notify',
          priority: 'high'
        }]),
        is_active: true
      }]);
  }
};

/**
 * Disable vacation mode
 */
export const disableVacationMode = async (userId) => {
  try {
    // Get current vacation settings
    const { data: currentMode } = await supabase
      .from('home_modes')
      .select('*')
      .eq('user_id', userId)
      .eq('mode', HomeMode.VACATION)
      .eq('is_active', true)
      .single();

    if (!currentMode) {
      return { success: true, message: 'Vacation mode not active' };
    }

    // Get user's locks
    const { data: userLocks } = await supabase
      .from('user_locks')
      .select('lock_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin']);

    const lockIds = userLocks?.map(ul => ul.lock_id) || [];

    // Re-enable guest access
    await supabase
      .from('user_locks')
      .update({ vacation_disabled: false })
      .in('lock_id', lockIds)
      .eq('vacation_disabled', true);

    // Remove vacation alert rules
    await supabase
      .from('notification_rules')
      .delete()
      .in('lock_id', lockIds)
      .eq('rule_type', 'vacation_alert');

    // Cancel presence simulations
    await supabase
      .from('ai_processing_queue')
      .update({ status: 'cancelled' })
      .eq('task_type', 'presence_simulation')
      .eq('status', 'pending')
      .in('payload->lock_id', lockIds);

    // Set mode back to home
    return await setHomeMode(userId, HomeMode.HOME, { lockIds });

  } catch (error) {
    console.error('[SmartScheduling] Disable vacation mode error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get suggested schedule based on patterns
 */
export const getSuggestedSchedule = async (userId) => {
  try {
    // Get user's locks
    const { data: userLocks } = await supabase
      .from('user_locks')
      .select('lock_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const lockIds = userLocks?.map(ul => ul.lock_id) || [];

    if (lockIds.length === 0) {
      return { suggestions: [] };
    }

    // Analyze activity patterns
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: activities } = await supabase
      .from('activity_logs')
      .select('created_at, action')
      .in('lock_id', lockIds)
      .eq('user_id', userId)
      .gte('created_at', fourWeeksAgo.toISOString())
      .in('action', ['unlocked', 'locked']);

    if (!activities || activities.length < 20) {
      return {
        suggestions: [],
        message: 'Not enough activity data for schedule suggestions'
      };
    }

    // Analyze patterns by day of week and hour
    const patterns = analyzeActivityPatterns(activities);

    const suggestions = [];

    // Suggest away mode times
    if (patterns.awayHours.length > 0) {
      suggestions.push({
        type: 'away_schedule',
        title: 'Suggested Away Times',
        description: `You're typically away between ${formatHourRange(patterns.awayHours)}`,
        schedule: {
          days: patterns.awayDays,
          start_hour: Math.min(...patterns.awayHours),
          end_hour: Math.max(...patterns.awayHours)
        }
      });
    }

    // Suggest night mode times
    if (patterns.sleepHours.length > 0) {
      suggestions.push({
        type: 'night_schedule',
        title: 'Suggested Night Mode',
        description: `Based on your patterns, night mode from ${formatHourRange(patterns.sleepHours)} may be helpful`,
        schedule: {
          start_hour: patterns.sleepHours[0],
          end_hour: patterns.sleepHours[patterns.sleepHours.length - 1]
        }
      });
    }

    return {
      suggestions,
      patterns,
      analyzed_activities: activities.length
    };

  } catch (error) {
    console.error('[SmartScheduling] Get suggested schedule error:', error);
    return { suggestions: [], error: error.message };
  }
};

/**
 * Analyze activity patterns
 */
const analyzeActivityPatterns = (activities) => {
  const hourCounts = Array(24).fill(0);
  const dayCounts = Array(7).fill(0);

  for (const activity of activities) {
    const date = new Date(activity.created_at);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
  }

  // Find inactive hours (potential away hours)
  const avgHourCount = hourCounts.reduce((a, b) => a + b, 0) / 24;
  const awayHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count < avgHourCount * 0.2)
    .map(h => h.hour)
    .filter(h => h >= 8 && h <= 18); // Only consider work hours

  // Find sleep hours (low activity late night/early morning)
  const sleepHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count < avgHourCount * 0.1)
    .map(h => h.hour)
    .filter(h => h >= 22 || h <= 6);

  // Find away days
  const avgDayCount = dayCounts.reduce((a, b) => a + b, 0) / 7;
  const awayDays = dayCounts
    .map((count, day) => ({ day, count }))
    .filter(d => d.count >= avgDayCount * 0.8)
    .map(d => d.day);

  return {
    awayHours,
    sleepHours,
    awayDays,
    hourDistribution: hourCounts,
    dayDistribution: dayCounts
  };
};

/**
 * Format hour range
 */
const formatHourRange = (hours) => {
  if (hours.length === 0) return '';
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return `${min}:00-${max}:00`;
};

/**
 * Check and auto-expire vacation mode
 */
export const checkExpiredModes = async () => {
  try {
    const now = new Date().toISOString();

    // Find expired vacation modes
    const { data: expiredModes } = await supabase
      .from('home_modes')
      .select('id, user_id, mode')
      .eq('is_active', true)
      .lt('ends_at', now);

    if (!expiredModes || expiredModes.length === 0) {
      return { expired: 0 };
    }

    for (const mode of expiredModes) {
      if (mode.mode === HomeMode.VACATION) {
        await disableVacationMode(mode.user_id);
      } else {
        await setHomeMode(mode.user_id, HomeMode.HOME);
      }
    }

    return { expired: expiredModes.length };

  } catch (error) {
    console.error('[SmartScheduling] Check expired modes error:', error);
    return { expired: 0, error: error.message };
  }
};

export default {
  getCurrentMode,
  setHomeMode,
  enableVacationMode,
  disableVacationMode,
  getSuggestedSchedule,
  checkExpiredModes,
  HomeMode
};
