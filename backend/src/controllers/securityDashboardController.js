/**
 * Security Dashboard Controller
 *
 * Aggregates security data for a comprehensive dashboard view:
 * - Risk scores
 * - Failed attempts
 * - Recent anomalies/insights
 * - Security alerts
 * - Fraud detection summary
 */

import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';
import { getFraudSummary, getFraudAlerts } from '../services/ai/fraudDetector.js';

/**
 * Get comprehensive security dashboard data for a lock
 * GET /api/security/dashboard
 */
export const getSecurityDashboard = async (req, res) => {
  try {
    const { lockId } = req.query;
    const userId = req.user.id;

    logger.info(`[SECURITY_DASHBOARD] 📊 User ${userId} requesting dashboard${lockId ? ` for lock ${lockId}` : ' (all locks)'}`);

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'lockId query parameter is required'
        }
      });
    }

    // Verify user has access to this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('can_view_logs')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      logger.warn(`[SECURITY_DASHBOARD] ⚠️ User ${userId} does not have access to lock ${lockId}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this lock'
        }
      });
    }

    // Get lock details
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('id, name, location')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCK_NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // 1. Get risk score
    logger.info('[SECURITY_DASHBOARD] Fetching risk score...');
    const { data: riskScore } = await supabase
      .from('risk_scores')
      .select('*')
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 2. Get failed attempts (last 24 hours)
    logger.info('[SECURITY_DASHBOARD] Fetching failed attempts...');
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: failedAttempts, count: failedCount } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        created_at,
        user:user_id (first_name, last_name)
      `, { count: 'exact' })
      .eq('lock_id', lockId)
      .eq('action', 'failed_attempt')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. Get recent anomalies/insights (last 7 days)
    logger.info('[SECURITY_DASHBOARD] Fetching recent anomalies...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: insights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('lock_id', lockId)
      .eq('insight_type', 'anomaly')
      .eq('is_dismissed', false)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Get fraud detection summary
    logger.info('[SECURITY_DASHBOARD] Fetching fraud summary...');
    const fraudSummary = await getFraudSummary(lockId);

    // 5. Get security alerts (last 7 days)
    logger.info('[SECURITY_DASHBOARD] Fetching security alerts...');
    const fraudAlerts = await getFraudAlerts(lockId, 7);

    // 6. Count critical insights
    const { count: criticalInsightsCount } = await supabase
      .from('ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('severity', 'critical')
      .eq('is_dismissed', false)
      .gte('created_at', sevenDaysAgo.toISOString());

    // 7. Get access pattern summary (last 30 days)
    logger.info('[SECURITY_DASHBOARD] Fetching access patterns...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: accessLogs, count: totalAccesses } = await supabase
      .from('activity_logs')
      .select('action, created_at', { count: 'exact' })
      .eq('lock_id', lockId)
      .in('action', ['locked', 'unlocked'])
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Calculate unique users
    const { data: uniqueUsersData } = await supabase
      .from('activity_logs')
      .select('user_id')
      .eq('lock_id', lockId)
      .not('user_id', 'is', null)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const uniqueUsers = new Set(uniqueUsersData?.map(u => u.user_id) || []).size;

    // Build dashboard response
    const dashboard = {
      lock: {
        id: lock.id,
        name: lock.name,
        location: lock.location
      },
      risk_score: riskScore ? {
        score: riskScore.score,
        level: riskScore.risk_level,
        last_calculated: riskScore.created_at,
        factors: riskScore.factors || {}
      } : null,
      failed_attempts: {
        count_24h: failedCount || 0,
        recent: failedAttempts?.map(fa => ({
          id: fa.id,
          time: fa.created_at,
          method: fa.access_method,
          user_name: fa.user ? `${fa.user.first_name} ${fa.user.last_name}` : 'Unknown'
        })) || []
      },
      anomalies: {
        recent: insights?.map(i => ({
          id: i.id,
          type: i.insight_type,
          severity: i.severity,
          title: i.title,
          description: i.description,
          created_at: i.created_at,
          is_read: i.is_read
        })) || [],
        critical_count: criticalInsightsCount || 0
      },
      fraud_summary: fraudSummary || {
        alerts_by_severity: { critical: 0, warning: 0, info: 0 },
        total_alerts: 0,
        failed_attempts: 0,
        security_status: 'good',
        period_days: 7
      },
      security_alerts: {
        total_count: fraudAlerts?.total_count || 0,
        alerts: fraudAlerts?.alerts?.slice(0, 5) || [],
        alerts_by_type: fraudAlerts?.alerts_by_type || {}
      },
      access_summary: {
        total_accesses_30d: totalAccesses || 0,
        unique_users_30d: uniqueUsers,
        avg_daily_accesses: totalAccesses ? Math.round(totalAccesses / 30) : 0
      },
      generated_at: new Date().toISOString()
    };

    logger.info(`[SECURITY_DASHBOARD] ✅ Dashboard generated for lock ${lockId}`, {
      risk_level: dashboard.risk_score?.level || 'unknown',
      failed_attempts: dashboard.failed_attempts.count_24h,
      anomalies: dashboard.anomalies.recent.length,
      security_status: dashboard.fraud_summary.security_status
    });

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    logger.error('[SECURITY_DASHBOARD] ❌ Error generating dashboard:', {
      error: error.message,
      userId: req.user?.id,
      lockId: req.query?.lockId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to generate security dashboard'
      }
    });
  }
};

/**
 * Get activity insights for a lock
 * GET /api/activity/insights
 */
export const getActivityInsights = async (req, res) => {
  try {
    const { lockId } = req.query;
    const userId = req.user.id;

    logger.info(`[ACTIVITY_INSIGHTS] 📈 User ${userId} requesting insights${lockId ? ` for lock ${lockId}` : ' (all locks)'}`);

    if (!lockId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCK_ID',
          message: 'lockId query parameter is required'
        }
      });
    }

    // Verify user has access to this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('can_view_logs')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this lock'
        }
      });
    }

    // Get lock name
    const { data: lock } = await supabase
      .from('locks')
      .select('name')
      .eq('id', lockId)
      .single();

    // 1. Get all insights (not just anomalies)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: insights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('lock_id', lockId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // 2. Group insights by type and severity
    const insightsByType = {};
    const insightsBySeverity = { critical: 0, warning: 0, info: 0 };

    for (const insight of insights || []) {
      // By type
      if (!insightsByType[insight.insight_type]) {
        insightsByType[insight.insight_type] = [];
      }
      insightsByType[insight.insight_type].push(insight);

      // By severity
      if (insightsBySeverity[insight.severity] !== undefined) {
        insightsBySeverity[insight.severity]++;
      }
    }

    // 3. Get access patterns
    const { data: accessLogs } = await supabase
      .from('activity_logs')
      .select('action, created_at, user_id')
      .eq('lock_id', lockId)
      .in('action', ['locked', 'unlocked'])
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // Calculate hourly distribution
    const hourlyDistribution = new Array(24).fill(0);
    for (const log of accessLogs || []) {
      const hour = new Date(log.created_at).getHours();
      hourlyDistribution[hour]++;
    }

    // Calculate daily distribution
    const dailyDistribution = new Array(7).fill(0);
    for (const log of accessLogs || []) {
      const day = new Date(log.created_at).getDay();
      dailyDistribution[day]++;
    }

    // Find peak hours
    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    const peakDay = dailyDistribution.indexOf(Math.max(...dailyDistribution));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Build insights response
    const response = {
      lock: {
        id: lockId,
        name: lock?.name || 'Unknown'
      },
      insights: {
        total_count: insights?.length || 0,
        by_type: insightsByType,
        by_severity: insightsBySeverity,
        recent: insights?.slice(0, 10) || []
      },
      access_patterns: {
        hourly_distribution: hourlyDistribution,
        daily_distribution: dailyDistribution,
        peak_hour: peakHour,
        peak_day: dayNames[peakDay],
        total_accesses: accessLogs?.length || 0,
        unique_users: new Set(accessLogs?.map(l => l.user_id).filter(Boolean) || []).size
      },
      period_days: 30,
      generated_at: new Date().toISOString()
    };

    logger.info(`[ACTIVITY_INSIGHTS] ✅ Insights generated for lock ${lockId}`, {
      total_insights: response.insights.total_count,
      total_accesses: response.access_patterns.total_accesses,
      peak_hour: response.access_patterns.peak_hour,
      peak_day: response.access_patterns.peak_day
    });

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('[ACTIVITY_INSIGHTS] ❌ Error generating insights:', {
      error: error.message,
      userId: req.user?.id,
      lockId: req.query?.lockId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to generate activity insights'
      }
    });
  }
};

/**
 * Acknowledge a security alert
 * POST /api/security/alerts/:alertId/acknowledge
 */
export const acknowledgeSecurityAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user.id;

    logger.info(`[SECURITY_ALERTS] User ${userId} acknowledging alert ${alertId}`);

    // Try to update in ai_insights table (where alerts are stored)
    const { data: insight, error: updateError } = await supabase
      .from('ai_insights')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();

    if (updateError) {
      // If not found in ai_insights, try fraud_alerts table
      const { data: fraudAlert, error: fraudError } = await supabase
        .from('fraud_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId
        })
        .eq('id', alertId)
        .select()
        .single();

      if (fraudError) {
        logger.error(`[SECURITY_ALERTS] Alert ${alertId} not found`, { updateError, fraudError });
        return res.status(404).json({
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Security alert not found'
          }
        });
      }

      logger.info(`[SECURITY_ALERTS] ✅ Fraud alert ${alertId} acknowledged`);
      return res.json({
        success: true,
        data: { acknowledged: true, alert: fraudAlert }
      });
    }

    logger.info(`[SECURITY_ALERTS] ✅ Insight alert ${alertId} acknowledged`);
    res.json({
      success: true,
      data: { acknowledged: true, alert: insight }
    });

  } catch (error) {
    logger.error('[SECURITY_ALERTS] ❌ Error acknowledging alert:', {
      error: error.message,
      alertId: req.params?.alertId,
      userId: req.user?.id
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to acknowledge security alert'
      }
    });
  }
};

export default {
  getSecurityDashboard,
  getActivityInsights,
  acknowledgeSecurityAlert
};
