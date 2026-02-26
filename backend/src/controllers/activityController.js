import { supabase } from '../services/supabase.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Role-based log filtering helper
 * Applies visibility restrictions based on user's role for a specific lock
 *
 * @param {Object} query - Supabase query builder
 * @param {Object} lockAccess - User's lock access record with role and permissions
 * @param {string} userId - Current user's ID
 * @returns {Object} Modified query with role-based filtering
 */
const applyRoleBasedLogFiltering = (query, lockAccess, userId) => {
  // Restricted and Long Term Guest can only see their own activity
  if (lockAccess.can_view_own_logs_only ||
      lockAccess.role === 'restricted' ||
      lockAccess.role === 'long_term_guest') {
    query = query.eq('user_id', userId);
  }

  // Guest role (short-term) cannot see any logs - return empty result
  if (lockAccess.role === 'guest') {
    // Use an impossible condition to return empty result set
    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  return query;
};

/**
 * Get user's lock access for role-based filtering
 * @param {string} userId - User ID
 * @param {string} lockId - Lock ID
 * @returns {Object|null} Lock access record with role and permissions
 */
const getUserLockAccess = async (userId, lockId) => {
  const { data } = await supabase
    .from('user_locks')
    .select('role, can_view_logs, can_view_own_logs_only')
    .eq('user_id', userId)
    .eq('lock_id', lockId)
    .eq('is_active', true)
    .single();

  return data;
};

/**
 * Get All Activities with Filtering and Sorting
 * GET /activity/all
 *
 * Query params:
 * - limit: number of records (default 50)
 * - offset: pagination offset (default 0)
 * - action: filter by action type (unlocked, locked, failed_attempt, etc.)
 * - access_method: filter by access method (bluetooth, fingerprint, pin, etc.)
 * - user_id: filter by specific user
 * - start_date: filter by date range start
 * - end_date: filter by date range end
 * - sort_by: field to sort by (created_at, action, access_method)
 * - sort_order: asc or desc (default desc)
 *
 * Role-based visibility:
 * - owner, admin, family: Full log visibility for their locks
 * - restricted, long_term_guest: Own activity only across all locks
 * - guest: No log access for locks where they are guest
 */
export const getAllActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      action,
      access_method,
      user_id,
      start_date,
      end_date,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;
    const { limit, offset } = parsePagination(req.query);

    // Get all locks the user has access to WITH their roles
    // Note: can_view_own_logs_only may not exist in older database schemas
    const { data: userLocks, error: locksError } = await supabase
      .from('user_locks')
      .select('lock_id, role, can_view_logs')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (locksError) {
      console.error('Error fetching user locks:', locksError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch user locks'
        }
      });
    }

    // Add default can_view_own_logs_only value (column may not exist in DB)
    const userLocksWithDefaults = userLocks?.map(ul => ({
      ...ul,
      can_view_own_logs_only: ul.can_view_own_logs_only ?? false
    })) || [];

    // Also include locks owned by the user (owners have full visibility)
    const { data: ownedLocks, error: ownedError } = await supabase
      .from('locks')
      .select('id')
      .eq('owner_id', userId);

    if (ownedError) {
      console.error('Error fetching owned locks:', ownedError);
    }

    // Categorize locks by visibility level
    const ownedLockIds = new Set((ownedLocks || []).map(l => l.id));

    // Full visibility locks: owned locks + admin/family roles
    const fullVisibilityLockIds = [];
    // Own activity only locks: restricted, long_term_guest roles
    const ownActivityLockIds = [];
    // No visibility locks: guest roles (unless can_view_logs is true)
    const noVisibilityLockIds = [];

    // Add owned locks to full visibility
    ownedLockIds.forEach(lockId => fullVisibilityLockIds.push(lockId));

    // Categorize user_locks based on role
    userLocksWithDefaults.forEach(ul => {
      // Skip if already in owned (owner has full visibility)
      if (ownedLockIds.has(ul.lock_id)) return;

      if (ul.role === 'guest' && !ul.can_view_logs) {
        noVisibilityLockIds.push(ul.lock_id);
      } else if (ul.can_view_own_logs_only ||
                 ul.role === 'restricted' ||
                 ul.role === 'long_term_guest') {
        ownActivityLockIds.push(ul.lock_id);
      } else {
        // admin, family, or roles with full log visibility
        fullVisibilityLockIds.push(ul.lock_id);
      }
    });

    const allAccessibleLockIds = [...fullVisibilityLockIds, ...ownActivityLockIds];

    if (allAccessibleLockIds.length === 0) {
      return res.json({
        success: true,
        data: {
          activities: [],
          pagination: {
            total: 0,
            limit,
            offset,
            has_more: false
          },
          filters: {
            available_actions: [],
            available_methods: [],
            available_users: []
          }
        }
      });
    }

    // Build the query with role-based filtering
    // We need to use OR conditions for different visibility levels
    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        failure_reason,
        created_at,
        metadata,
        lock:lock_id (
          id,
          name,
          location
        ),
        user:user_id (
          id,
          first_name,
          last_name
        )
      `);

    // Apply role-based visibility filter using OR conditions
    if (fullVisibilityLockIds.length > 0 && ownActivityLockIds.length > 0) {
      // Complex case: some locks with full visibility, some with own-only
      // We need to use raw filter for OR conditions
      query = query.or(
        `lock_id.in.(${fullVisibilityLockIds.join(',')}),` +
        `and(lock_id.in.(${ownActivityLockIds.join(',')}),user_id.eq.${userId})`
      );
    } else if (fullVisibilityLockIds.length > 0) {
      // Only full visibility locks
      query = query.in('lock_id', fullVisibilityLockIds);
    } else if (ownActivityLockIds.length > 0) {
      // Only own-activity locks
      query = query.in('lock_id', ownActivityLockIds).eq('user_id', userId);
    }

    // Apply user-specified filters
    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (access_method && access_method !== 'all') {
      query = query.eq('access_method', access_method);
    }

    // Only allow user_id filter if viewing all logs (not restricted visibility)
    if (user_id && ownActivityLockIds.length === 0) {
      query = query.eq('user_id', user_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'action', 'access_method'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const ascending = sort_order === 'asc';
    query = query.order(sortField, { ascending });

    // Get total count before pagination (with same role-based filtering)
    let countQuery = supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true });

    // Apply same role-based visibility to count query
    if (fullVisibilityLockIds.length > 0 && ownActivityLockIds.length > 0) {
      countQuery = countQuery.or(
        `lock_id.in.(${fullVisibilityLockIds.join(',')}),` +
        `and(lock_id.in.(${ownActivityLockIds.join(',')}),user_id.eq.${userId})`
      );
    } else if (fullVisibilityLockIds.length > 0) {
      countQuery = countQuery.in('lock_id', fullVisibilityLockIds);
    } else if (ownActivityLockIds.length > 0) {
      countQuery = countQuery.in('lock_id', ownActivityLockIds).eq('user_id', userId);
    }

    if (action && action !== 'all') {
      countQuery = countQuery.eq('action', action);
    }
    if (access_method && access_method !== 'all') {
      countQuery = countQuery.eq('access_method', access_method);
    }
    if (user_id && ownActivityLockIds.length === 0) {
      countQuery = countQuery.eq('user_id', user_id);
    }
    if (start_date) {
      countQuery = countQuery.gte('created_at', start_date);
    }
    if (end_date) {
      countQuery = countQuery.lte('created_at', end_date);
    }

    const { count: totalCount } = await countQuery;

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch activities'
        }
      });
    }

    // Get available filter options (respecting role-based visibility)
    let filterOptionsQuery = supabase
      .from('activity_logs')
      .select('action, access_method, user_id');

    // Apply same role-based visibility
    if (fullVisibilityLockIds.length > 0 && ownActivityLockIds.length > 0) {
      filterOptionsQuery = filterOptionsQuery.or(
        `lock_id.in.(${fullVisibilityLockIds.join(',')}),` +
        `and(lock_id.in.(${ownActivityLockIds.join(',')}),user_id.eq.${userId})`
      );
    } else if (fullVisibilityLockIds.length > 0) {
      filterOptionsQuery = filterOptionsQuery.in('lock_id', fullVisibilityLockIds);
    } else if (ownActivityLockIds.length > 0) {
      filterOptionsQuery = filterOptionsQuery.in('lock_id', ownActivityLockIds).eq('user_id', userId);
    }

    const { data: filterOptions } = await filterOptionsQuery;

    const availableActions = [...new Set((filterOptions || []).map(f => f.action).filter(Boolean))];
    const availableMethods = [...new Set((filterOptions || []).map(f => f.access_method).filter(Boolean))];
    const availableUserIds = [...new Set((filterOptions || []).map(f => f.user_id).filter(Boolean))];

    // Get user names for filter options
    let availableUsers = [];
    if (availableUserIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', availableUserIds);

      availableUsers = (users || []).map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`
      }));
    }

    // Transform the data for the frontend
    const transformedActivities = (activities || []).map(activity => ({
      id: activity.id,
      action: activity.action,
      access_method: activity.access_method,
      success: activity.success,
      failure_reason: activity.failure_reason,
      timestamp: activity.created_at,
      metadata: activity.metadata,
      lock_id: activity.lock?.id,
      lock_name: activity.lock?.name || 'Unknown Lock',
      lock_location: activity.lock?.location,
      user_id: activity.user?.id,
      user_name: activity.user ? `${activity.user.first_name} ${activity.user.last_name}` : 'Unknown User'
    }));

    // Build response
    const response = {
      success: true,
      data: {
        activities: transformedActivities,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          has_more: (offset + limit) < (totalCount || 0)
        },
        filters: {
          available_actions: availableActions,
          available_methods: availableMethods,
          available_users: availableUsers
        }
      }
    };

    // Add visibility notice if user has restricted visibility on some locks
    if (ownActivityLockIds.length > 0) {
      response.data.visibility_notice = 'Some locks show your activity only based on your access level';
    }

    res.json(response);
  } catch (error) {
    console.error('Get all activities error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch activities'
      }
    });
  }
};

/**
 * Get Recent Activities for User (across all their locks)
 * GET /activity/recent
 *
 * Role-based visibility:
 * - owner, admin, family: Full log visibility
 * - restricted, long_term_guest: Own activity only
 * - guest: No log access
 */
export const getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = parsePagination(req.query, { limit: 10 });

    // Get all locks the user has access to WITH their roles
    // Note: can_view_own_logs_only may not exist in older database schemas
    const { data: userLocks, error: locksError } = await supabase
      .from('user_locks')
      .select('lock_id, role, can_view_logs')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (locksError) {
      console.error('Error fetching user locks:', locksError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch user locks'
        }
      });
    }

    // Add default can_view_own_logs_only value (column may not exist in DB)
    const userLocksWithDefaults = userLocks?.map(ul => ({
      ...ul,
      can_view_own_logs_only: ul.can_view_own_logs_only ?? false
    })) || [];

    // Also include locks owned by the user (owners have full visibility)
    const { data: ownedLocks, error: ownedError } = await supabase
      .from('locks')
      .select('id')
      .eq('owner_id', userId);

    if (ownedError) {
      console.error('Error fetching owned locks:', ownedError);
    }

    // Categorize locks by visibility level
    const ownedLockIds = new Set((ownedLocks || []).map(l => l.id));

    // Full visibility locks: owned locks + admin/family roles
    const fullVisibilityLockIds = [];
    // Own activity only locks: restricted, long_term_guest roles
    const ownActivityLockIds = [];

    // Add owned locks to full visibility
    ownedLockIds.forEach(lockId => fullVisibilityLockIds.push(lockId));

    // Categorize user_locks based on role
    userLocksWithDefaults.forEach(ul => {
      // Skip if already in owned (owner has full visibility)
      if (ownedLockIds.has(ul.lock_id)) return;

      if (ul.role === 'guest' && !ul.can_view_logs) {
        // No visibility - skip this lock
        return;
      } else if (ul.can_view_own_logs_only ||
                 ul.role === 'restricted' ||
                 ul.role === 'long_term_guest') {
        ownActivityLockIds.push(ul.lock_id);
      } else {
        // admin, family, or roles with full log visibility
        fullVisibilityLockIds.push(ul.lock_id);
      }
    });

    const allAccessibleLockIds = [...fullVisibilityLockIds, ...ownActivityLockIds];

    if (allAccessibleLockIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Build query with role-based filtering
    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        created_at,
        lock:lock_id (
          id,
          name,
          location
        ),
        user:user_id (
          id,
          first_name,
          last_name
        )
      `);

    // Apply role-based visibility filter using OR conditions
    if (fullVisibilityLockIds.length > 0 && ownActivityLockIds.length > 0) {
      query = query.or(
        `lock_id.in.(${fullVisibilityLockIds.join(',')}),` +
        `and(lock_id.in.(${ownActivityLockIds.join(',')}),user_id.eq.${userId})`
      );
    } else if (fullVisibilityLockIds.length > 0) {
      query = query.in('lock_id', fullVisibilityLockIds);
    } else if (ownActivityLockIds.length > 0) {
      query = query.in('lock_id', ownActivityLockIds).eq('user_id', userId);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch activities'
        }
      });
    }

    // Transform the data for the frontend
    const transformedActivities = (activities || []).map(activity => ({
      id: activity.id,
      action: activity.action,
      access_method: activity.access_method,
      timestamp: activity.created_at,
      lock_name: activity.lock?.name || 'Unknown Lock',
      lock_id: activity.lock?.id,
      user_name: activity.user ? `${activity.user.first_name} ${activity.user.last_name}` : 'Unknown User'
    }));

    res.json({
      success: true,
      data: transformedActivities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch recent activities'
      }
    });
  }
};

/**
 * Get Activity Logs
 * GET /locks/:lockId/activity
 *
 * Role-based visibility:
 * - owner, admin, family: Full log visibility
 * - restricted, long_term_guest: Own activity only
 * - guest: No log access (returns empty)
 */
export const getActivityLogs = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      action,
      user_id,
      start_date,
      end_date,
      access_method
    } = req.query;
    const { limit, offset } = parsePagination(req.query);

    // Get user's lock access for role-based filtering
    // req.lockAccess may be provided by middleware, otherwise fetch it
    const lockAccess = req.lockAccess || await getUserLockAccess(userId, lockId);

    if (!lockAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this lock'
        }
      });
    }

    // Check if user has permission to view logs at all
    if (lockAccess.role === 'guest' && !lockAccess.can_view_logs) {
      return res.json({
        success: true,
        data: {
          logs: [],
          pagination: {
            total: 0,
            limit,
            offset,
            has_more: false
          },
          visibility_notice: 'Guest users cannot view activity logs'
        }
      });
    }

    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        failure_reason,
        created_at,
        metadata,
        user:user_id (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    // Apply role-based filtering BEFORE other filters
    query = applyRoleBasedLogFiltering(query, lockAccess, userId);

    // Apply user-specified filters
    if (action) {
      query = query.eq('action', action);
    }

    // Only allow filtering by user_id if user can see all logs
    if (user_id && !lockAccess.can_view_own_logs_only) {
      query = query.eq('user_id', user_id);
    }

    if (access_method) {
      query = query.eq('access_method', access_method);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch activity logs'
        }
      });
    }

    // Get total count with same role-based filtering
    let countQuery = supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId);

    // Apply same role-based filtering to count query
    countQuery = applyRoleBasedLogFiltering(countQuery, lockAccess, userId);

    const { count: totalCount } = await countQuery;

    // Build response with visibility notice for restricted users
    const response = {
      success: true,
      data: {
        logs,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          has_more: offset + limit < (totalCount || 0)
        }
      }
    };

    // Add visibility notice for restricted roles
    if (lockAccess.can_view_own_logs_only ||
        lockAccess.role === 'restricted' ||
        lockAccess.role === 'long_term_guest') {
      response.data.visibility_notice = 'Showing your activity only';
    }

    res.json(response);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch activity logs'
      }
    });
  }
};

/**
 * Get Activity Statistics
 * GET /locks/:lockId/activity/stats
 */
export const getActivityStats = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { period = '7d' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get all logs in the period
    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('action, access_method, created_at')
      .eq('lock_id', lockId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch activity statistics'
        }
      });
    }

    // Calculate statistics
    const stats = {
      total_events: logs.length,
      by_action: {},
      by_access_method: {},
      timeline: []
    };

    // Count by action type
    logs.forEach(log => {
      stats.by_action[log.action] = (stats.by_action[log.action] || 0) + 1;
      if (log.access_method) {
        stats.by_access_method[log.access_method] = (stats.by_access_method[log.access_method] || 0) + 1;
      }
    });

    // Group by day for timeline
    const dayGroups = {};
    logs.forEach(log => {
      const day = new Date(log.created_at).toISOString().split('T')[0];
      dayGroups[day] = (dayGroups[day] || 0) + 1;
    });

    stats.timeline = Object.entries(dayGroups).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        period,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        ...stats
      }
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch activity statistics'
      }
    });
  }
};

/**
 * Get User Activity History
 * GET /users/:userId/activity
 */
export const getUserActivityHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { lock_id } = req.query;
    const { limit, offset } = parsePagination(req.query);

    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        failure_reason,
        created_at,
        metadata,
        lock:lock_id (
          id,
          name,
          location
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by lock if specified
    if (lock_id) {
      query = query.eq('lock_id', lock_id);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch user activity'
        }
      });
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: totalCount,
          limit,
          offset,
          has_more: offset + limit < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get user activity history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch user activity'
      }
    });
  }
};

/**
 * Export Activity Logs
 * GET /locks/:lockId/activity/export
 */
export const exportActivityLogs = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { format = 'csv', start_date, end_date } = req.query;

    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        success,
        failure_reason,
        created_at,
        metadata,
        user:user_id (
          first_name,
          last_name,
          email
        ),
        lock:lock_id (
          name,
          location
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    // Apply date filters
    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data: logs, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export activity logs'
        }
      });
    }

    if (format === 'csv') {
      // Generate CSV
      const csvRows = [];
      csvRows.push('Timestamp,Action,User,Access Method,Lock Location');

      logs.forEach(log => {
        const row = [
          log.created_at,
          log.action,
          log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown',
          log.access_method || 'N/A',
          log.lock?.location || 'N/A'
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${lockId}_${Date.now()}.csv"`);
      res.send(csvContent);
    } else if (format === 'json') {
      // Return as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${lockId}_${Date.now()}.json"`);
      res.json({
        success: true,
        data: {
          lock_id: lockId,
          export_date: new Date().toISOString(),
          start_date: start_date || 'N/A',
          end_date: end_date || 'N/A',
          total_records: logs.length,
          logs
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Unsupported export format. Use "csv" or "json"'
        }
      });
    }
  } catch (error) {
    console.error('Export activity logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to export activity logs'
      }
    });
  }
};

/**
 * Get Recent Failed Attempts
 * GET /locks/:lockId/failed-attempts
 */
export const getFailedAttempts = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { limit } = parsePagination(req.query, { limit: 20 });

    const { data: attempts, error } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        access_method,
        created_at,
        metadata,
        user:user_id (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('lock_id', lockId)
      .eq('action', 'failed_attempt')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch failed attempts'
        }
      });
    }

    // Get count of failed attempts in last 24 hours
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const { count: recent_count } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('lock_id', lockId)
      .eq('action', 'failed_attempt')
      .gte('created_at', last24h.toISOString());

    res.json({
      success: true,
      data: {
        attempts,
        recent_24h_count: recent_count || 0
      }
    });
  } catch (error) {
    console.error('Get failed attempts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch failed attempts'
      }
    });
  }
};
