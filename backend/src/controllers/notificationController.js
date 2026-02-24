import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';

/**
 * Get User Notifications
 * GET /notifications
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_read, type, limit = 50, offset = 0 } = req.query;
    logger.info('[NOTIFY] getUserNotifications', { userId, is_read, type, limit, offset });

    let query = supabase
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        is_read,
        created_at,
        lock:lock_id (
          id,
          name,
          location
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    if (type) {
      query = query.eq('type', type);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: notifications, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch notifications'
        }
      });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    logger.info(`[NOTIFICATION] ✅ Retrieved ${notifications?.length || 0} notifications for user ${userId} (${unreadCount || 0} unread)`);
    res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Get user notifications error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch notifications'
      }
    });
  }
};

/**
 * Mark Notification as Read
 * PATCH /notifications/:notificationId/read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    logger.notification.markRead(notificationId, userId);

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !notification) {
      logger.warn('[NOTIFICATION] ⚠️ Notification not found:', { notificationId, userId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found'
        }
      });
    }

    logger.info(`[NOTIFICATION] ✅ Notification ${notificationId} marked as read`);
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Mark notification as read error:', { error: error.message, notificationId: req.params.notificationId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark notification as read'
      }
    });
  }
};

/**
 * Mark All Notifications as Read
 * POST /notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('[NOTIFY] markAllNotificationsAsRead', { userId });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error('[NOTIFICATION] ❌ Failed to mark all notifications as read:', { error: error.message, userId });
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to mark all notifications as read'
        }
      });
    }

    logger.info(`[NOTIFICATION] ✅ All notifications marked as read for user ${userId}`);
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Mark all notifications as read error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark all notifications as read'
      }
    });
  }
};

/**
 * Delete Notification
 * DELETE /notifications/:notificationId
 */
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    logger.info('[NOTIFY] deleteNotification', { userId, notificationId });

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[NOTIFICATION] ❌ Failed to delete notification:', { error: error.message, notificationId, userId });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete notification'
        }
      });
    }

    logger.info(`[NOTIFICATION] ✅ Notification ${notificationId} deleted`);
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Delete notification error:', { error: error.message, notificationId: req.params.notificationId });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete notification'
      }
    });
  }
};

/**
 * Get Notification Preferences
 * GET /notification-preferences
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.notification.preferencesGet(userId);

    // In a real implementation, this would fetch from a notification_preferences table
    // For now, we'll return default preferences
    const preferences = {
      push_notifications: true,
      email_notifications: true,
      notification_types: {
        unlock: true,
        lock: true,
        battery_warning: true,
        tamper_alert: true,
        failed_attempt: true,
        offline: true,
        user_added: true,
        user_removed: true,
        guest_access: true
      },
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '07:00'
      }
    };

    logger.info(`[NOTIFICATION] ✅ Retrieved notification preferences for user ${userId}`);
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Get notification preferences error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch notification preferences'
      }
    });
  }
};

/**
 * Update Notification Preferences
 * PATCH /notification-preferences
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;
    logger.info('[NOTIFY] updateNotificationPreferences', { userId });

    // In a real implementation, this would update a notification_preferences table
    // For now, we'll just return the updated preferences

    logger.info(`[NOTIFICATION] ✅ Updated notification preferences for user ${userId}`);
    res.json({
      success: true,
      data: preferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Update notification preferences error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update notification preferences'
      }
    });
  }
};

/**
 * Helper function to create notification
 * This is used internally by other controllers
 */
export const createNotification = async (userId, lockId, type, title, message) => {
  try {
    logger.notification.sent(userId, type, title);

    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        lock_id: lockId,
        type,
        title,
        message,
        is_read: false
      }])
      .select()
      .single();

    if (error) {
      logger.error('[NOTIFICATION] ❌ Create notification error:', { error: error.message, userId, type });
      return null;
    }

    logger.info(`[NOTIFICATION] ✅ Notification created: ${type} for user ${userId}`);
    return data;
  } catch (error) {
    logger.error('[NOTIFICATION] ❌ Create notification error:', { error: error.message, userId, type });
    return null;
  }
};
