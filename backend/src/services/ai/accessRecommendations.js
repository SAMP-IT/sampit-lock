/**
 * AI-Based Access Recommendations Service
 *
 * Analyzes access patterns to suggest:
 * - Users who should have access but don't
 * - Users with access who haven't used it
 * - Permission level adjustments
 * - Time restriction recommendations
 */

import { supabase } from '../supabase.js';
import { answerQuestion } from './llmService.js';

/**
 * Recommendation types
 */
export const RecommendationType = {
  REMOVE_INACTIVE: 'remove_inactive_user',
  ADJUST_PERMISSIONS: 'adjust_permissions',
  ADD_TIME_RESTRICTIONS: 'add_time_restrictions',
  EXTEND_ACCESS: 'extend_access',
  REVIEW_PERMISSIONS: 'review_permissions',
  CONSIDER_REMOVAL: 'consider_removal'
};

/**
 * Get access recommendations for a lock
 *
 * @param {string} lockId Lock UUID
 * @returns {Promise<Object>} Recommendations
 */
export const getAccessRecommendations = async (lockId) => {
  try {
    const recommendations = [];

    // Get all users with access to this lock
    const { data: userAccess, error: accessError } = await supabase
      .from('user_locks')
      .select(`
        id,
        user_id,
        role,
        can_unlock,
        can_lock,
        can_manage_users,
        time_restrictions,
        access_valid_from,
        access_valid_until,
        is_active,
        created_at,
        users:user_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (accessError) {
      console.error('[AccessRecommendations] Error fetching users:', accessError);
      return { recommendations: [], error: accessError.message };
    }

    // Get activity for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabase
      .from('activity_logs')
      .select('user_id, action, created_at')
      .eq('lock_id', lockId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('action', ['locked', 'unlocked']);

    // Build activity map by user
    const userActivityMap = {};
    for (const activity of activities || []) {
      if (!activity.user_id) continue;
      if (!userActivityMap[activity.user_id]) {
        userActivityMap[activity.user_id] = {
          count: 0,
          lastActivity: null,
          hours: {}
        };
      }
      userActivityMap[activity.user_id].count++;
      const activityDate = new Date(activity.created_at);
      if (!userActivityMap[activity.user_id].lastActivity ||
          activityDate > userActivityMap[activity.user_id].lastActivity) {
        userActivityMap[activity.user_id].lastActivity = activityDate;
      }

      // Track usage hours
      const hour = activityDate.getHours();
      userActivityMap[activity.user_id].hours[hour] =
        (userActivityMap[activity.user_id].hours[hour] || 0) + 1;
    }

    // Analyze each user
    for (const access of userAccess || []) {
      const userId = access.user_id;
      const userName = access.users ?
        `${access.users.first_name || ''} ${access.users.last_name || ''}`.trim() :
        'Unknown user';
      const activity = userActivityMap[userId];

      // Skip owners
      if (access.role === 'owner' || access.role === 'admin') {
        continue;
      }

      // Check for inactive users (no activity in 30 days)
      if (!activity || activity.count === 0) {
        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(access.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceCreated > 14) {
          recommendations.push({
            type: RecommendationType.REMOVE_INACTIVE,
            priority: 'medium',
            userId,
            userName,
            title: 'Inactive User',
            description: `${userName} hasn't used the lock in over 30 days. Consider removing their access.`,
            suggestion: {
              action: 'remove_access',
              reason: 'No activity in 30 days'
            }
          });
        }
      }

      // Check for users with full access but low usage
      if (access.can_manage_users && activity && activity.count < 5) {
        recommendations.push({
          type: RecommendationType.ADJUST_PERMISSIONS,
          priority: 'low',
          userId,
          userName,
          title: 'Review Admin Permissions',
          description: `${userName} has admin permissions but rarely uses the lock (${activity.count} times in 30 days).`,
          suggestion: {
            action: 'downgrade_permissions',
            reason: 'Low usage for admin level'
          }
        });
      }

      // Suggest time restrictions for users with consistent patterns
      if (activity && activity.count >= 10) {
        const peakHours = getPeakHours(activity.hours);
        if (peakHours.length > 0 && !access.time_restrictions?.enabled) {
          recommendations.push({
            type: RecommendationType.ADD_TIME_RESTRICTIONS,
            priority: 'low',
            userId,
            userName,
            title: 'Consider Time Restrictions',
            description: `${userName} typically accesses between ${formatHourRange(peakHours)}. Consider adding time restrictions for security.`,
            suggestion: {
              action: 'add_time_restrictions',
              recommended_hours: peakHours
            }
          });
        }
      }

      // Check for expiring access
      if (access.valid_until) {
        const expiresIn = Math.floor(
          (new Date(access.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (expiresIn > 0 && expiresIn <= 7) {
          // Check if they're still actively using
          if (activity && activity.count > 5) {
            recommendations.push({
              type: RecommendationType.EXTEND_ACCESS,
              priority: 'high',
              userId,
              userName,
              title: 'Access Expiring Soon',
              description: `${userName}'s access expires in ${expiresIn} days but they're actively using the lock. Consider extending.`,
              suggestion: {
                action: 'extend_access',
                current_expiry: access.valid_until,
                active_usage: true
              }
            });
          } else {
            recommendations.push({
              type: RecommendationType.REVIEW_PERMISSIONS,
              priority: 'low',
              userId,
              userName,
              title: 'Access Expiring',
              description: `${userName}'s access expires in ${expiresIn} days.`,
              suggestion: {
                action: 'review',
                current_expiry: access.valid_until,
                active_usage: false
              }
            });
          }
        }
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      recommendations,
      total: recommendations.length,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('[AccessRecommendations] Error:', error);
    return { recommendations: [], error: error.message };
  }
};

/**
 * Get peak usage hours from hour distribution
 */
const getPeakHours = (hourDistribution) => {
  const entries = Object.entries(hourDistribution);
  if (entries.length === 0) return [];

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const threshold = total * 0.7; // 70% of activity

  // Sort by count descending
  entries.sort((a, b) => b[1] - a[1]);

  let accumulated = 0;
  const peakHours = [];

  for (const [hour, count] of entries) {
    peakHours.push(parseInt(hour));
    accumulated += count;
    if (accumulated >= threshold) break;
  }

  // Sort hours chronologically
  peakHours.sort((a, b) => a - b);
  return peakHours;
};

/**
 * Format hour range for display
 */
const formatHourRange = (hours) => {
  if (hours.length === 0) return '';
  if (hours.length === 1) return `${hours[0]}:00`;

  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return `${min}:00 - ${max + 1}:00`;
};

/**
 * Get AI suggestions for a specific user's access
 */
export const getAIAccessSuggestion = async (lockId, userId) => {
  try {
    // Get user access details
    const { data: access } = await supabase
      .from('user_locks')
      .select(`
        *,
        users:user_id (first_name, last_name),
        locks:lock_id (name)
      `)
      .eq('lock_id', lockId)
      .eq('user_id', userId)
      .single();

    if (!access) {
      return { suggestion: null, error: 'User access not found' };
    }

    // Get user's activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabase
      .from('activity_logs')
      .select('action, created_at, access_method')
      .eq('lock_id', lockId)
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    const userName = `${access.users?.first_name || ''} ${access.users?.last_name || ''}`.trim();
    const lockName = access.locks?.name || 'the lock';

    // Build context for AI
    const context = {
      user: {
        name: userName,
        role: access.role,
        permissions: {
          can_unlock: access.can_unlock,
          can_lock: access.can_lock,
          can_manage_users: access.can_manage_users
        },
        time_restrictions: access.time_restrictions,
        valid_from: access.access_valid_from,
        valid_until: access.access_valid_until,
        created_at: access.created_at
      },
      activity: {
        total_actions: activities?.length || 0,
        last_activity: activities?.[0]?.created_at || null,
        access_methods: [...new Set(activities?.map(a => a.access_method) || [])]
      },
      lock: {
        name: lockName
      }
    };

    const question = `Based on this user's access permissions and activity, what would you recommend?
Should their permissions be adjusted? Should time restrictions be added?
Provide a brief, actionable recommendation.`;

    const response = await answerQuestion(question, context, []);

    return {
      suggestion: response,
      context,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('[AccessRecommendations] AI suggestion error:', error);
    return { suggestion: null, error: error.message };
  }
};

/**
 * Store a recommendation action (for feedback loop)
 */
export const recordRecommendationAction = async ({
  lockId,
  userId,
  recommendationType,
  action,
  metadata = {}
}) => {
  try {
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    if (lockError || !lock) {
      return { success: false, error: 'Lock not found' };
    }

    const now = new Date().toISOString();
    const normalizedAction = (action || '').toLowerCase();
    const statusMap = {
      applied: 'accepted',
      accepted: 'accepted',
      dismissed: 'dismissed',
      auto_applied: 'auto_applied',
      'auto-applied': 'auto_applied'
    };

    const status = statusMap[normalizedAction] || 'pending';
    const suggestedAction = metadata.suggested_action || metadata.suggestion || {
      action: recommendationType || 'access_recommendation',
      response: action
    };

    const insertData = {
      lock_id: lockId,
      owner_user_id: lock.owner_id,
      target_user_id: userId || null,
      suggestion_type: recommendationType || 'access_recommendation',
      title: metadata.title || 'Access recommendation',
      description: metadata.description || `Action recorded for ${recommendationType || 'recommendation'}.`,
      suggested_action: suggestedAction,
      status,
      confidence_score: metadata.confidence_score ?? null,
      created_at: now
    };

    if (status === 'accepted') {
      insertData.accepted_at = now;
    }
    if (status === 'dismissed') {
      insertData.dismissed_at = now;
    }
    if (metadata.expires_at) {
      insertData.expires_at = metadata.expires_at;
    }

    const { error } = await supabase
      .from('ai_suggestions')
      .insert([insertData]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[AccessRecommendations] Record action error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getAccessRecommendations,
  getAIAccessSuggestion,
  recordRecommendationAction,
  RecommendationType
};
