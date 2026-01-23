import { supabase } from '../services/supabase.js';

/**
 * Middleware factory to check lock access with specific permission
 * @param {string} requiredPermission - The permission required (e.g., 'can_view_logs', 'can_manage_users')
 * @returns {Function} Express middleware function
 */
export const checkLockAccess = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      const lockId = req.params.lockId || req.params.id;
      const userId = req.user.id;

      if (!lockId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Lock ID is required'
          }
        });
      }

      // Check if user has access to this lock
      const { data: access, error } = await supabase
        .from('user_locks')
        .select('*')
        .eq('user_id', userId)
        .eq('lock_id', lockId)
        .eq('is_active', true)
        .single();

      if (error || !access) {
        // Check if user is the lock owner
        const { data: lock } = await supabase
          .from('locks')
          .select('owner_id')
          .eq('id', lockId)
          .single();

        if (lock && lock.owner_id === userId) {
          // Owner has full access
          req.lockAccess = {
            user_id: userId,
            lock_id: lockId,
            role: 'owner',
            can_unlock: true,
            can_lock: true,
            can_view_logs: true,
            can_manage_users: true,
            can_manage_passcodes: true,
            can_manage_settings: true,
            is_active: true
          };
          return next();
        }

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this lock'
          }
        });
      }

      // Attach lock access permissions to request
      req.lockAccess = access;

      // If no specific permission required, allow access
      if (!requiredPermission) {
        return next();
      }

      // Owners and admins have all permissions
      if (access.role === 'owner' || access.role === 'admin') {
        return next();
      }

      // Check specific permission
      // Handle both 'can_view_logs' format and 'view_logs' format
      const permissionKey = requiredPermission.startsWith('can_')
        ? requiredPermission
        : `can_${requiredPermission}`;

      const hasPermission = access[permissionKey];

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions: ${requiredPermission} required`
          }
        });
      }

      next();
    } catch (error) {
      console.error('Lock access check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to verify lock access'
        }
      });
    }
  };
};

/**
 * Simple lock access check without permission requirement
 */
export const verifyLockAccess = checkLockAccess(null);

/**
 * Check if user can manage access methods (fingerprints, cards, passcodes)
 */
export const canManageAccessMethods = checkLockAccess('can_manage_passcodes');

/**
 * Check if user can view lock logs
 */
export const canViewLogs = checkLockAccess('can_view_logs');

/**
 * Check if user can manage lock settings
 */
export const canManageSettings = checkLockAccess('can_manage_settings');

/**
 * Check if user can manage other users' access
 */
export const canManageUsers = checkLockAccess('can_manage_users');

export default {
  checkLockAccess,
  verifyLockAccess,
  canManageAccessMethods,
  canViewLogs,
  canManageSettings,
  canManageUsers
};
