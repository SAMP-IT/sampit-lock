/**
 * AI Insights Controller
 *
 * Handles endpoints for:
 * - Natural language activity logs
 * - AI insights dashboard
 * - Risk scores
 * - Daily summaries
 */

import { supabase } from '../../services/supabase.js';
import llmService from '../../services/ai/llmService.js';
import { calculateRiskScore as calculateRiskScoreService } from '../../services/ai/riskScorer.js';
import logger from '../../utils/logger.js';

/**
 * Get Natural Language Activity Logs
 * GET /api/ai/locks/:lockId/activity/natural
 */
export const getNaturalLanguageActivity = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id;
    // logger.ai.request('getNaturalLanguageActivity', userId, { lockId, limit, offset });

    // Fetch activity logs with user info
    const { data: events, error } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        failure_reason,
        metadata,
        natural_language_summary,
        created_at,
        user:user_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch activity logs' }
      });
    }

    // Transform events with user names
    const eventsWithNames = events.map(e => ({
      ...e,
      user_name: e.user ? `${e.user.first_name} ${e.user.last_name}` : null
    }));

    // Check if we need to generate summaries
    const eventsNeedingSummary = eventsWithNames.filter(e => !e.natural_language_summary);

    if (eventsNeedingSummary.length > 0 && llmService.isConfigured()) {
      // Generate summaries for events that don't have them
      const summarizedEvents = await llmService.batchSummarizeEvents(eventsNeedingSummary);

      // Update database with new summaries (fire and forget)
      summarizedEvents.forEach(async (event) => {
        if (event.natural_language_summary) {
          await supabase
            .from('activity_logs')
            .update({ natural_language_summary: event.natural_language_summary })
            .eq('id', event.id);
        }
      });

      // Merge summaries back
      const summaryMap = new Map(summarizedEvents.map(e => [e.id, e.natural_language_summary]));
      eventsWithNames.forEach(e => {
        if (!e.natural_language_summary && summaryMap.has(e.id)) {
          e.natural_language_summary = summaryMap.get(e.id);
        }
      });
    }

    // Generate fallback summaries for any remaining
    const finalEvents = eventsWithNames.map(e => ({
      id: e.id,
      action: e.action,
      access_method: e.access_method,
      success: e.success,
      timestamp: e.created_at,
      user_name: e.user_name,
      summary: e.natural_language_summary || generateFallbackSummary(e)
    }));

    logger.info(`[AI] ✅ Natural language activity retrieved for lock ${lockId} (${finalEvents.length} events)`);
    res.json({
      success: true,
      data: {
        events: finalEvents,
        ai_enabled: llmService.isConfigured()
      }
    });
  } catch (error) {
    logger.error('[AI] ❌ Get natural language activity error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch activity' }
    });
  }
};

/**
 * Get Daily Summary for a Lock
 * GET /api/ai/locks/:lockId/summary/daily
 */
export const getDailySummary = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { date } = req.query;
    const userId = req.user?.id;

    // Use today if no date specified
    const targetDate = date || new Date().toISOString().split('T')[0];
    // logger.ai.request('getDailySummary', userId, { lockId, targetDate });

    // Check if we have a cached summary
    const { data: existingSummary } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('lock_id', lockId)
      .eq('summary_date', targetDate)
      .single();

    if (existingSummary && existingSummary.natural_language_summary) {
      return res.json({
        success: true,
        data: existingSummary
      });
    }

    // Get lock info
    const { data: lock } = await supabase
      .from('locks')
      .select('name, location')
      .eq('id', lockId)
      .single();

    // Fetch events for the day
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: events } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        created_at,
        user_id,
        user:user_id (first_name, last_name)
      `)
      .eq('lock_id', lockId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    const eventsWithNames = (events || []).map(e => ({
      ...e,
      user_name: e.user ? `${e.user.first_name} ${e.user.last_name}` : null
    }));

    // Calculate statistics
    const stats = calculateDayStatistics(eventsWithNames);

    // Generate summary
    let nlSummary = null;
    if (llmService.isConfigured()) {
      nlSummary = await llmService.generateDailySummary(
        lockId,
        lock?.name || 'Lock',
        eventsWithNames,
        targetDate
      );
    }

    // Build summary object
    const summary = {
      lock_id: lockId,
      summary_date: targetDate,
      total_accesses: stats.totalAccesses,
      unique_users: stats.uniqueUsers,
      failed_attempts: stats.failedAttempts,
      anomalies_detected: stats.anomalies,
      natural_language_summary: nlSummary || `${stats.totalAccesses} events recorded.`,
      highlights: stats.highlights,
      statistics: stats.breakdown
    };

    // Store the summary
    await supabase.from('daily_summaries').upsert({
      user_id: req.user.id,
      ...summary,
      created_at: new Date().toISOString()
    });

    logger.info(`[AI] ✅ Daily summary generated for lock ${lockId} on ${targetDate} (${stats.totalAccesses} events)`);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('[AI] ❌ Get daily summary error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to generate summary' }
    });
  }
};

/**
 * Get AI Insights for a Lock
 * GET /api/ai/locks/:lockId/insights
 */
export const getInsights = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { type, severity, limit = 20, include_dismissed = false } = req.query;
    const userId = req.user?.id;
    // logger.ai.request('getInsights', userId, { lockId, type, severity, limit });

    let query = supabase
      .from('ai_insights')
      .select('*')
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (type) query = query.eq('insight_type', type);
    if (severity) query = query.eq('severity', severity);
    if (!include_dismissed) query = query.eq('is_dismissed', false);

    const { data: insights, error } = await query;

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('relation')) {
        return res.json({
          success: true,
          data: {
            insights: [],
            unread_count: 0,
            message: 'AI insights feature is not yet configured'
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch insights' }
      });
    }

    // Count unread
    const unreadCount = (insights || []).filter(i => !i.is_read).length;

    logger.ai.insights(lockId, (insights || []).length, type ? [type] : null);
    res.json({
      success: true,
      data: {
        insights: insights || [],
        unread_count: unreadCount
      }
    });
  } catch (error) {
    logger.error('[AI] ❌ Get insights error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch insights' }
    });
  }
};

/**
 * Mark Insight as Read
 * POST /api/ai/insights/:insightId/read
 */
export const markInsightRead = async (req, res) => {
  try {
    const { insightId } = req.params;
    const userId = req.user?.id;
    // logger.ai.request('markInsightRead', userId, { insightId });

    const { error } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', insightId);

    if (error) {
      logger.error('[AI] ❌ Failed to mark insight as read:', { error: error.message, insightId });
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to mark insight as read' }
      });
    }

    logger.info(`[AI] ✅ Insight ${insightId} marked as read by user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[AI] ❌ Mark insight read error:', { error: error.message, insightId: req.params.insightId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update insight' }
    });
  }
};

/**
 * Dismiss Insight
 * POST /api/ai/insights/:insightId/dismiss
 */
export const dismissInsight = async (req, res) => {
  try {
    const { insightId } = req.params;
    const userId = req.user?.id;
    // logger.ai.request('dismissInsight', userId, { insightId });

    const { error } = await supabase
      .from('ai_insights')
      .update({ is_dismissed: true })
      .eq('id', insightId);

    if (error) {
      logger.error('[AI] ❌ Failed to dismiss insight:', { error: error.message, insightId });
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to dismiss insight' }
      });
    }

    logger.info(`[AI] ✅ Insight ${insightId} dismissed by user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[AI] ❌ Dismiss insight error:', { error: error.message, insightId: req.params.insightId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to dismiss insight' }
    });
  }
};

/**
 * Get Risk Score for a Lock
 * GET /api/ai/locks/:lockId/risk-score
 */
export const getRiskScore = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    // logger.ai.request('getRiskScore', userId, { lockId });

    // Get latest risk score
    const { data: latestScore, error: scoreError } = await supabase
      .from('lock_risk_scores')
      .select('*')
      .eq('lock_id', lockId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Check if table doesn't exist
    if (scoreError && (scoreError.code === '42P01' || scoreError.message?.includes('relation'))) {
      // Return a default risk score when table doesn't exist
      return res.json({
        success: true,
        data: {
          lock_id: lockId,
          overall_score: 85,
          failed_attempts_score: 100,
          access_pattern_score: 80,
          user_management_score: 90,
          settings_score: 70,
          calculated_at: new Date().toISOString(),
          message: 'Risk scoring feature is not yet configured - showing default score'
        }
      });
    }

    // If no score exists or it's older than 1 hour, calculate new one
    const needsRecalculation = !latestScore ||
      (new Date() - new Date(latestScore.calculated_at)) > 60 * 60 * 1000;

    if (needsRecalculation) {
      try {
        const newScore = await calculateRiskScoreService(lockId);
        logger.ai.riskScore(lockId, newScore.overall_score, newScore);
        res.json({
          success: true,
          data: newScore
        });
      } catch (calcError) {
        // If calculation fails (e.g., missing tables), return default
        logger.warn('[AI] ⚠️ Risk score calculation failed, using default:', { error: calcError.message, lockId });
        res.json({
          success: true,
          data: {
            lock_id: lockId,
            overall_score: 85,
            calculated_at: new Date().toISOString(),
            message: 'Using default risk score'
          }
        });
      }
    } else {
      logger.ai.riskScore(lockId, latestScore.overall_score);
      res.json({
        success: true,
        data: latestScore
      });
    }
  } catch (error) {
    logger.error('[AI] ❌ Get risk score error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get risk score' }
    });
  }
};

/**
 * Get Risk Scores for All User's Locks
 * GET /api/ai/risk-scores
 */
export const getAllRiskScores = async (req, res) => {
  try {
    const userId = req.user.id;
    // logger.ai.request('getAllRiskScores', userId, {});

    // Get all user's locks
    const { data: userLocks } = await supabase
      .from('user_locks')
      .select('lock_id, locks(id, name, location)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!userLocks || userLocks.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const lockIds = userLocks.map(ul => ul.lock_id);

    // Get latest risk scores for each lock
    const scores = await Promise.all(
      lockIds.map(async (lockId) => {
        const { data: score } = await supabase
          .from('lock_risk_scores')
          .select('*')
          .eq('lock_id', lockId)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();

        const lockInfo = userLocks.find(ul => ul.lock_id === lockId);

        return {
          lock_id: lockId,
          lock_name: lockInfo?.locks?.name || 'Unknown',
          lock_location: lockInfo?.locks?.location,
          ...score
        };
      })
    );

    const filteredScores = scores.filter(s => s.overall_score !== undefined);
    logger.info(`[AI] ✅ Retrieved risk scores for ${filteredScores.length} locks for user ${userId}`);
    res.json({
      success: true,
      data: filteredScores
    });
  } catch (error) {
    logger.error('[AI] ❌ Get all risk scores error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get risk scores' }
    });
  }
};

// Helper Functions

/**
 * Generate a fallback summary without LLM
 */
function generateFallbackSummary(event) {
  const userName = event.user_name || 'Someone';
  const method = event.access_method || 'unknown method';
  const time = new Date(event.created_at).toLocaleTimeString();

  switch (event.action) {
    case 'unlocked':
      return `${userName} unlocked the door using ${method} at ${time}`;
    case 'locked':
      return `${userName} locked the door using ${method} at ${time}`;
    case 'failed_attempt':
      return `Failed access attempt via ${method} at ${time}`;
    case 'user_added':
      return `${userName} added a new user at ${time}`;
    case 'user_removed':
      return `${userName} removed a user at ${time}`;
    case 'setting_changed':
      return `${userName} changed lock settings at ${time}`;
    default:
      return `${event.action} event at ${time}`;
  }
}

/**
 * Calculate day statistics from events
 */
function calculateDayStatistics(events) {
  const stats = {
    totalAccesses: events.length,
    uniqueUsers: new Set(events.filter(e => e.user_id).map(e => e.user_id)).size,
    failedAttempts: events.filter(e => e.action === 'failed_attempt').length,
    anomalies: 0,
    highlights: [],
    breakdown: {
      by_action: {},
      by_hour: {},
      by_user: {}
    }
  };

  events.forEach(event => {
    // Count by action
    stats.breakdown.by_action[event.action] = (stats.breakdown.by_action[event.action] || 0) + 1;

    // Count by hour
    const hour = new Date(event.created_at).getHours();
    stats.breakdown.by_hour[hour] = (stats.breakdown.by_hour[hour] || 0) + 1;

    // Count by user
    if (event.user_name) {
      stats.breakdown.by_user[event.user_name] = (stats.breakdown.by_user[event.user_name] || 0) + 1;
    }
  });

  // Generate highlights
  if (stats.failedAttempts > 0) {
    stats.highlights.push({
      type: 'warning',
      message: `${stats.failedAttempts} failed access attempt${stats.failedAttempts > 1 ? 's' : ''}`
    });
  }

  // Check for late night activity (2-5 AM)
  const lateNightEvents = Object.entries(stats.breakdown.by_hour)
    .filter(([hour]) => parseInt(hour) >= 2 && parseInt(hour) <= 5)
    .reduce((sum, [, count]) => sum + count, 0);

  if (lateNightEvents > 0) {
    stats.highlights.push({
      type: 'info',
      message: `${lateNightEvents} event${lateNightEvents > 1 ? 's' : ''} during late night hours`
    });
    stats.anomalies++;
  }

  return stats;
}

export default {
  getNaturalLanguageActivity,
  getDailySummary,
  getInsights,
  markInsightRead,
  dismissInsight,
  getRiskScore,
  getAllRiskScores
};
