/**
 * Predictive Battery Alerts Service
 *
 * Uses historical battery drain patterns to:
 * - Predict when battery will reach low/critical levels
 * - Alert users before battery becomes critical
 * - Consider usage patterns for prediction accuracy
 */

import { supabase } from '../supabase.js';
import { sendSmartNotification } from './smartNotifications.js';
import { EventAction } from './eventLogger.js';

/**
 * Battery status levels
 */
export const BatteryStatus = {
  GOOD: 'good',        // > 40%
  MEDIUM: 'medium',    // 21-40%
  LOW: 'low',          // 11-20%
  CRITICAL: 'critical' // <= 10%
};

/**
 * Analyze battery history and predict depletion
 *
 * @param {string} lockId Lock UUID
 * @returns {Promise<Object>} Battery prediction
 */
export const predictBatteryDepletion = async (lockId) => {
  try {
    // Get current battery level
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('id, name, battery_level, updated_at')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return { error: 'Lock not found' };
    }

    // Get battery history (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: batteryHistory, error: historyError } = await supabase
      .from('battery_history')
      .select('battery_level, recorded_at')
      .eq('lock_id', lockId)
      .gte('recorded_at', ninetyDaysAgo.toISOString())
      .order('recorded_at', { ascending: true });

    if (historyError || !batteryHistory || batteryHistory.length < 2) {
      // Not enough data for prediction
      return {
        current_level: lock.battery_level,
        status: getBatteryStatus(lock.battery_level),
        prediction_available: false,
        message: 'Not enough battery history for prediction'
      };
    }

    // Get activity count for context
    const { count: activityCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .in('action', ['locked', 'unlocked']);

    // Calculate drain rate
    const drainAnalysis = calculateDrainRate(batteryHistory);

    if (!drainAnalysis.hasValidData) {
      return {
        current_level: lock.battery_level,
        status: getBatteryStatus(lock.battery_level),
        prediction_available: false,
        message: 'Battery levels too stable for prediction'
      };
    }

    // Predict days until low (20%) and critical (10%)
    const daysToLow = calculateDaysTo(lock.battery_level, 20, drainAnalysis.dailyDrain);
    const daysToCritical = calculateDaysTo(lock.battery_level, 10, drainAnalysis.dailyDrain);

    // Predict replacement date
    const replacementDate = new Date();
    replacementDate.setDate(replacementDate.getDate() + Math.max(0, daysToCritical));

    return {
      current_level: lock.battery_level,
      status: getBatteryStatus(lock.battery_level),
      prediction_available: true,
      drain_rate: {
        daily_percent: Math.round(drainAnalysis.dailyDrain * 100) / 100,
        per_action: activityCount > 0 ?
          Math.round((drainAnalysis.totalDrain / activityCount) * 100) / 100 : null
      },
      predictions: {
        days_to_low: Math.max(0, Math.round(daysToLow)),
        days_to_critical: Math.max(0, Math.round(daysToCritical)),
        estimated_replacement_date: lock.battery_level > 10 ? replacementDate.toISOString() : null,
        confidence: drainAnalysis.confidence
      },
      usage: {
        total_actions: activityCount || 0,
        period_days: 90
      },
      recommendations: generateBatteryRecommendations(lock.battery_level, daysToLow, daysToCritical),
      last_updated: lock.updated_at
    };

  } catch (error) {
    console.error('[BatteryPredictor] Error:', error);
    return { error: error.message };
  }
};

/**
 * Calculate battery drain rate from history
 */
const calculateDrainRate = (history) => {
  if (history.length < 2) {
    return { hasValidData: false };
  }

  // Find significant drain events (drops of more than 1%)
  const drainEvents = [];
  for (let i = 1; i < history.length; i++) {
    const drain = history[i - 1].battery_level - history[i].battery_level;
    if (drain > 0) {
      const daysDiff = (new Date(history[i].recorded_at) - new Date(history[i - 1].recorded_at)) /
        (1000 * 60 * 60 * 24);
      if (daysDiff > 0) {
        drainEvents.push({
          drain,
          days: daysDiff,
          dailyRate: drain / daysDiff
        });
      }
    }
  }

  if (drainEvents.length === 0) {
    return { hasValidData: false };
  }

  // Calculate average daily drain
  const totalDrain = history[0].battery_level - history[history.length - 1].battery_level;
  const totalDays = (new Date(history[history.length - 1].recorded_at) - new Date(history[0].recorded_at)) /
    (1000 * 60 * 60 * 24);

  if (totalDays <= 0 || totalDrain <= 0) {
    return { hasValidData: false };
  }

  const dailyDrain = totalDrain / totalDays;

  // Calculate confidence based on data consistency
  const drainRates = drainEvents.map(e => e.dailyRate);
  const avgRate = drainRates.reduce((a, b) => a + b, 0) / drainRates.length;
  const variance = drainRates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / drainRates.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgRate > 0 ? stdDev / avgRate : 1;

  // Higher confidence when data is consistent
  const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation));

  return {
    hasValidData: true,
    dailyDrain,
    totalDrain,
    totalDays,
    confidence: Math.round(confidence * 100) / 100
  };
};

/**
 * Calculate days until target battery level
 */
const calculateDaysTo = (currentLevel, targetLevel, dailyDrain) => {
  if (currentLevel <= targetLevel) return 0;
  if (dailyDrain <= 0) return Infinity;
  return (currentLevel - targetLevel) / dailyDrain;
};

/**
 * Get battery status from level
 */
const getBatteryStatus = (level) => {
  if (level > 40) return BatteryStatus.GOOD;
  if (level > 20) return BatteryStatus.MEDIUM;
  if (level > 10) return BatteryStatus.LOW;
  return BatteryStatus.CRITICAL;
};

/**
 * Generate battery recommendations
 */
const generateBatteryRecommendations = (currentLevel, daysToLow, daysToCritical) => {
  const recommendations = [];

  if (currentLevel <= 10) {
    recommendations.push({
      priority: 'critical',
      message: 'Replace batteries immediately to prevent lockout'
    });
  } else if (currentLevel <= 20) {
    recommendations.push({
      priority: 'high',
      message: 'Replace batteries soon - current level is low'
    });
  } else if (daysToLow <= 7) {
    recommendations.push({
      priority: 'medium',
      message: `Battery will be low in approximately ${Math.round(daysToLow)} days. Plan ahead for replacement.`
    });
  } else if (daysToLow <= 14) {
    recommendations.push({
      priority: 'low',
      message: `Battery expected to last about ${Math.round(daysToLow)} more days at current usage.`
    });
  }

  if (daysToCritical <= 30 && currentLevel > 20) {
    recommendations.push({
      priority: 'info',
      message: 'Consider ordering replacement batteries'
    });
  }

  return recommendations;
};

/**
 * Check all locks for battery alerts and send notifications
 */
export const checkAllBatteryLevels = async () => {
  try {
    // Get all locks with low or medium battery
    const { data: locks, error } = await supabase
      .from('locks')
      .select('id, name, battery_level, owner_id')
      .lte('battery_level', 40);

    if (error || !locks) {
      console.error('[BatteryPredictor] Error fetching locks:', error);
      return { checked: 0, alerts_sent: 0 };
    }

    let alertsSent = 0;

    for (const lock of locks) {
      const prediction = await predictBatteryDepletion(lock.id);

      if (!prediction.prediction_available) continue;

      // Send alert if battery is critical or will be critical soon
      if (lock.battery_level <= 10) {
        await sendSmartNotification({
          lockId: lock.id,
          action: EventAction.BATTERY_CRITICAL,
          metadata: {
            battery_level: lock.battery_level,
            days_to_empty: prediction.predictions.days_to_critical
          }
        });
        alertsSent++;
      } else if (lock.battery_level <= 20) {
        await sendSmartNotification({
          lockId: lock.id,
          action: EventAction.BATTERY_LOW,
          metadata: {
            battery_level: lock.battery_level,
            days_to_critical: prediction.predictions.days_to_critical
          }
        });
        alertsSent++;
      } else if (prediction.predictions.days_to_low <= 7) {
        // Predictive alert - battery will be low within a week
        await sendSmartNotification({
          lockId: lock.id,
          action: 'battery_warning',
          metadata: {
            battery_level: lock.battery_level,
            days_to_low: prediction.predictions.days_to_low,
            predicted: true
          }
        });
        alertsSent++;
      }
    }

    return {
      checked: locks.length,
      alerts_sent: alertsSent
    };

  } catch (error) {
    console.error('[BatteryPredictor] Check all error:', error);
    return { checked: 0, alerts_sent: 0, error: error.message };
  }
};

/**
 * Record battery level (called when battery is read from lock)
 */
export const recordBatteryLevel = async (lockId, batteryLevel) => {
  try {
    // Get previous level
    const { data: lock } = await supabase
      .from('locks')
      .select('battery_level')
      .eq('id', lockId)
      .single();

    const previousLevel = lock?.battery_level;

    // Update lock battery level
    await supabase
      .from('locks')
      .update({
        battery_level: batteryLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', lockId);

    // Record in history
    await supabase
      .from('battery_history')
      .insert([{
        lock_id: lockId,
        battery_level: batteryLevel,
        recorded_at: new Date().toISOString()
      }]);

    // Check if we should send an alert
    if (batteryLevel <= 20 && (previousLevel === null || previousLevel > 20)) {
      const action = batteryLevel <= 10 ? EventAction.BATTERY_CRITICAL : EventAction.BATTERY_LOW;
      await sendSmartNotification({
        lockId,
        action,
        metadata: {
          battery_level: batteryLevel,
          previous_level: previousLevel
        }
      });
    }

    return { success: true };

  } catch (error) {
    console.error('[BatteryPredictor] Record error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get battery history for visualization
 */
export const getBatteryHistory = async (lockId, days = 30) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: history, error } = await supabase
      .from('battery_history')
      .select('battery_level, recorded_at')
      .eq('lock_id', lockId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      return { history: [], error: error.message };
    }

    return {
      history: history || [],
      period_days: days
    };

  } catch (error) {
    console.error('[BatteryPredictor] Get history error:', error);
    return { history: [], error: error.message };
  }
};

export default {
  predictBatteryDepletion,
  checkAllBatteryLevels,
  recordBatteryLevel,
  getBatteryHistory,
  BatteryStatus
};
