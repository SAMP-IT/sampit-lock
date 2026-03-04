/**
 * Anomaly Detector Service
 *
 * Rule-based anomaly detection for smart lock activity.
 * Detects:
 * - Unusual access hours
 * - Failed attempt patterns
 * - Rapid cycling (lock/unlock)
 * - First-time user access
 * - Access spikes
 */

import { supabase } from '../supabase.js';
import llmService from './llmService.js';

// Anomaly thresholds (configurable via env)
const THRESHOLDS = {
  FAILED_ATTEMPTS_WINDOW_MINUTES: 5,
  FAILED_ATTEMPTS_LIMIT: 3,
  RAPID_CYCLE_WINDOW_MINUTES: 2,
  RAPID_CYCLE_LIMIT: 5,
  UNUSUAL_HOURS_START: 2, // 2 AM
  UNUSUAL_HOURS_END: 5,   // 5 AM
  ACCESS_SPIKE_MULTIPLIER: 3 // 3x normal activity
};

/**
 * Analyze an event for anomalies
 * @param {Object} event - Activity log event
 * @returns {Object} Anomaly analysis result
 */
export const analyzeEvent = async (event) => {
  console.log('🤖 AI Anomaly Detector: Starting analysis for event', {
    event_id: event.id,
    lock_id: event.lock_id,
    action: event.action,
    user_id: event.user_id,
    created_at: event.created_at
  });

  const anomalies = [];
  let anomalyScore = 0;

  // Check for unusual hours
  console.log('🕐 AI: Checking unusual hours...');
  const unusualHourResult = checkUnusualHours(event);
  if (unusualHourResult.isAnomaly) {
    console.log('⚠️ AI: Unusual hours detected:', unusualHourResult.message);
    anomalies.push(unusualHourResult);
    anomalyScore += unusualHourResult.score;
  }

  // Check for failed attempt patterns
  if (event.action === 'failed_attempt') {
    console.log('🔒 AI: Checking failed attempt patterns...');
    const failedResult = await checkFailedAttemptPattern(event);
    if (failedResult.isAnomaly) {
      console.log('🚨 AI: Failed attempt pattern detected:', failedResult.message);
      anomalies.push(failedResult);
      anomalyScore += failedResult.score;
    }
  }

  // Check for rapid cycling
  if (event.action === 'locked' || event.action === 'unlocked') {
    console.log('🔄 AI: Checking rapid cycling...');
    const cycleResult = await checkRapidCycling(event);
    if (cycleResult.isAnomaly) {
      console.log('⚠️ AI: Rapid cycling detected:', cycleResult.message);
      anomalies.push(cycleResult);
      anomalyScore += cycleResult.score;
    }
  }

  // Check if first-time user
  if (event.user_id) {
    console.log('👤 AI: Checking first-time user...');
    const firstTimeResult = await checkFirstTimeUser(event);
    if (firstTimeResult.isAnomaly) {
      console.log('ℹ️ AI: First-time user access detected');
      anomalies.push(firstTimeResult);
      anomalyScore += firstTimeResult.score;
    }
  }

  // Create insight if anomalies detected
  if (anomalies.length > 0) {
    console.log(`✅ AI: ${anomalies.length} anomalies detected, creating insight...`, {
      total_score: anomalyScore,
      anomaly_types: anomalies.map(a => a.type)
    });
    await createAnomalyInsight(event, anomalies, anomalyScore);
  } else {
    console.log('✅ AI: No anomalies detected for event', event.id);
  }

  const result = {
    hasAnomalies: anomalies.length > 0,
    anomalyScore: Math.min(anomalyScore, 100),
    anomalies,
    flags: anomalies.map(a => a.type)
  };

  console.log('🤖 AI Anomaly Detector: Analysis complete', result);
  return result;
};

/**
 * Check if access is at unusual hours
 */
function checkUnusualHours(event) {
  const eventHour = new Date(event.created_at).getHours();

  if (eventHour >= THRESHOLDS.UNUSUAL_HOURS_START && eventHour <= THRESHOLDS.UNUSUAL_HOURS_END) {
    return {
      isAnomaly: true,
      type: 'unusual_hours',
      score: 30,
      severity: 'warning',
      message: `Access at unusual hour (${eventHour}:00)`,
      data: { hour: eventHour }
    };
  }

  return { isAnomaly: false };
}

/**
 * Check for suspicious failed attempt patterns
 */
async function checkFailedAttemptPattern(event) {
  const windowStart = new Date(event.created_at);
  windowStart.setMinutes(windowStart.getMinutes() - THRESHOLDS.FAILED_ATTEMPTS_WINDOW_MINUTES);

  const { count } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', event.lock_id)
    .eq('action', 'failed_attempt')
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', event.created_at);

  if (count >= THRESHOLDS.FAILED_ATTEMPTS_LIMIT) {
    return {
      isAnomaly: true,
      type: 'failed_attempts_pattern',
      score: 50,
      severity: 'critical',
      message: `${count} failed attempts in ${THRESHOLDS.FAILED_ATTEMPTS_WINDOW_MINUTES} minutes`,
      data: {
        count,
        window_minutes: THRESHOLDS.FAILED_ATTEMPTS_WINDOW_MINUTES
      }
    };
  }

  return { isAnomaly: false };
}

/**
 * Check for rapid lock/unlock cycling
 */
async function checkRapidCycling(event) {
  const windowStart = new Date(event.created_at);
  windowStart.setMinutes(windowStart.getMinutes() - THRESHOLDS.RAPID_CYCLE_WINDOW_MINUTES);

  const { data: recentEvents } = await supabase
    .from('activity_logs')
    .select('action')
    .eq('lock_id', event.lock_id)
    .in('action', ['locked', 'unlocked'])
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', event.created_at);

  const cycleCount = recentEvents?.length || 0;

  if (cycleCount >= THRESHOLDS.RAPID_CYCLE_LIMIT) {
    return {
      isAnomaly: true,
      type: 'rapid_cycling',
      score: 25,
      severity: 'warning',
      message: `Rapid lock/unlock cycling detected (${cycleCount} times in ${THRESHOLDS.RAPID_CYCLE_WINDOW_MINUTES} min)`,
      data: {
        cycle_count: cycleCount,
        window_minutes: THRESHOLDS.RAPID_CYCLE_WINDOW_MINUTES
      }
    };
  }

  return { isAnomaly: false };
}

/**
 * Check if this is a first-time user access
 */
async function checkFirstTimeUser(event) {
  const { count } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('lock_id', event.lock_id)
    .eq('user_id', event.user_id)
    .in('action', ['locked', 'unlocked'])
    .lt('created_at', event.created_at);

  if (count === 0) {
    return {
      isAnomaly: true,
      type: 'first_time_user',
      score: 15,
      severity: 'info',
      message: 'First-time access by this user',
      data: { user_id: event.user_id }
    };
  }

  return { isAnomaly: false };
}

/**
 * Create an AI insight for detected anomalies
 * Includes deduplication: skips if a similar insight was created recently
 */
async function createAnomalyInsight(event, anomalies, totalScore) {
  console.log('📝 AI: Creating anomaly insight...', {
    event_id: event.id || null,
    anomaly_count: anomalies.length,
    total_score: totalScore
  });

  // Deduplication: check if a similar insight was created recently (within 5 min)
  const primaryType = anomalies[0]?.type;
  const cooldownMinutes = 5;
  const cooldownStart = new Date();
  cooldownStart.setMinutes(cooldownStart.getMinutes() - cooldownMinutes);

  const { data: recentInsights } = await supabase
    .from('ai_insights')
    .select('id, created_at')
    .eq('lock_id', event.lock_id)
    .eq('insight_type', 'anomaly')
    .eq('is_dismissed', false)
    .gte('created_at', cooldownStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentInsights && recentInsights.length > 0) {
    console.log(`⏭️ AI: Skipping insight creation - similar insight ${recentInsights[0].id} created ${recentInsights[0].created_at} (within ${cooldownMinutes} min cooldown)`);
    return;
  }

  // Determine overall severity
  let severity = 'info';
  if (anomalies.some(a => a.severity === 'critical')) {
    severity = 'critical';
  } else if (anomalies.some(a => a.severity === 'warning')) {
    severity = 'warning';
  }

  console.log('🎯 AI: Insight severity determined:', severity);

  // Generate description
  let description;
  if (llmService.isConfigured() && anomalies.some(a => a.type !== 'first_time_user')) {
    // Use LLM for important anomalies
    console.log('🧠 AI: Using LLM to generate insight description...');
    const primaryAnomaly = anomalies.find(a => a.severity === 'critical') || anomalies[0];
    description = await llmService.generateInsightDescription(primaryAnomaly.type, {
      ...primaryAnomaly.data,
      userName: event.user_name,
      time: new Date(event.created_at).toLocaleString()
    });
    console.log('✅ AI: LLM description generated');
  } else {
    // Use simple description
    console.log('📋 AI: Using simple description (LLM not configured)');
    description = anomalies.map(a => a.message).join('. ');
  }

  // Create title
  const title = anomalies.length === 1
    ? anomalies[0].message
    : `${anomalies.length} anomalies detected`;

  console.log('💾 AI: Inserting insight into database...', { title, severity });

  // Insert insight
  const { data, error } = await supabase.from('ai_insights').insert([{
    lock_id: event.lock_id,
    user_id: event.user_id,
    insight_type: 'anomaly',
    severity,
    title,
    description,
    metadata: {
      event_id: event.id || null,
      anomalies,
      total_score: totalScore
    },
    ...(event.id ? { related_event_id: event.id } : {}),
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString()
  }]).select();

  if (error) {
    console.error('❌ AI: Failed to create insight:', error);
  } else {
    console.log('✅ AI: Insight created successfully:', data[0]?.id);
  }
}

/**
 * Analyze access patterns for a user-lock combination
 * Used for learning typical behavior
 */
export const analyzeUserPatterns = async (userId, lockId) => {
  // Get last 30 days of activity
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: events } = await supabase
    .from('activity_logs')
    .select('action, created_at')
    .eq('lock_id', lockId)
    .eq('user_id', userId)
    .in('action', ['locked', 'unlocked'])
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (!events || events.length < 7) {
    // Not enough data for pattern analysis
    return null;
  }

  // Analyze patterns by day of week
  const patterns = {};
  for (let day = 0; day <= 6; day++) {
    const dayEvents = events.filter(e => new Date(e.created_at).getDay() === day);
    if (dayEvents.length > 0) {
      const hours = dayEvents.map(e => new Date(e.created_at).getHours());
      patterns[day] = {
        typical_start_hour: Math.min(...hours),
        typical_end_hour: Math.max(...hours),
        average_daily_accesses: dayEvents.length / 4, // Approximate 4 weeks
        sample_count: dayEvents.length
      };
    }
  }

  // Update user_access_patterns table
  for (const [day, pattern] of Object.entries(patterns)) {
    await supabase.from('user_access_patterns').upsert({
      user_id: userId,
      lock_id: lockId,
      day_of_week: parseInt(day),
      ...pattern,
      confidence_score: Math.min(pattern.sample_count / 10, 1),
      last_calculated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,lock_id,day_of_week'
    });
  }

  return patterns;
};

/**
 * Check if current event deviates from learned patterns
 */
export const checkPatternDeviation = async (event) => {
  if (!event.user_id) return { isDeviation: false };

  const eventDate = new Date(event.created_at);
  const dayOfWeek = eventDate.getDay();
  const hour = eventDate.getHours();

  const { data: pattern } = await supabase
    .from('user_access_patterns')
    .select('typical_start_hour, typical_end_hour, confidence_score')
    .eq('user_id', event.user_id)
    .eq('lock_id', event.lock_id)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (!pattern || pattern.confidence_score < 0.5) {
    // Not enough confidence in pattern
    return { isDeviation: false };
  }

  // Check if outside typical hours
  if (hour < pattern.typical_start_hour - 2 || hour > pattern.typical_end_hour + 2) {
    return {
      isDeviation: true,
      type: 'pattern_deviation',
      message: `Access outside typical hours (usually ${pattern.typical_start_hour}:00 - ${pattern.typical_end_hour}:00)`,
      data: {
        expected_start: pattern.typical_start_hour,
        expected_end: pattern.typical_end_hour,
        actual_hour: hour
      }
    };
  }

  return { isDeviation: false };
};

/**
 * Batch analyze unprocessed events
 * Called periodically to process queue
 */
export const processEventQueue = async (limit = 50) => {
  console.log(`🔄 AI: Starting event queue processing (limit: ${limit})...`);

  // Get unprocessed events
  const { data: events, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:user_id (first_name, last_name)
    `)
    .eq('ai_processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('❌ AI: Failed to fetch events from queue:', error);
    return { processed: 0, error: error.message };
  }

  if (!events || events.length === 0) {
    console.log('✅ AI: Event queue is empty, no events to process');
    return { processed: 0 };
  }

  console.log(`📊 AI: Found ${events.length} unprocessed events in queue`);

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      console.log(`🔍 AI: Processing event ${processed + 1}/${events.length}`, {
        id: event.id,
        action: event.action
      });

      const eventWithName = {
        ...event,
        user_name: event.user ? `${event.user.first_name} ${event.user.last_name}` : null
      };

      // Analyze for anomalies
      const analysis = await analyzeEvent(eventWithName);

      // Update event with analysis results
      const { error: updateError } = await supabase
        .from('activity_logs')
        .update({
          ai_processed: true,
          anomaly_score: analysis.anomalyScore,
          anomaly_flags: analysis.flags
        })
        .eq('id', event.id);

      if (updateError) {
        console.error(`❌ AI: Failed to update event ${event.id}:`, updateError);
        failed++;
      } else {
        processed++;
        console.log(`✅ AI: Event ${event.id} processed successfully`);
      }
    } catch (err) {
      console.error(`❌ AI: Error processing event ${event.id}:`, err);
      failed++;
    }
  }

  const result = { processed, failed, total: events.length };
  console.log('🏁 AI: Event queue processing complete', result);
  return result;
};

export default {
  analyzeEvent,
  analyzeUserPatterns,
  checkPatternDeviation,
  processEventQueue
};
