import { supabase } from '../services/supabase.js';

/**
 * Check if user has access to a specific lock
 */
export const checkLockAccess = async (req, res, next) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    // First check if user is the lock owner
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('owner_id')
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

    // If user is the owner, grant full access
    if (lock.owner_id === userId) {
      req.lockAccess = {
        role: 'owner',
        can_unlock: true,
        can_lock: true,
        can_view_logs: true,
        can_manage_users: true,
        can_modify_settings: true,
        remote_unlock_enabled: true,
        is_active: true
      };
      return next();
    }

    // Otherwise check if user has access through user_locks
    const { data: access, error } = await supabase
      .from('user_locks')
      .select('*')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (error || !access) {
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

/**
 * Check if user has specific permission for a lock
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    const lockAccess = req.lockAccess;

    if (!lockAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Lock access not verified'
        }
      });
    }

    // Owners and admins have all permissions
    if (lockAccess.role === 'owner' || lockAccess.role === 'admin') {
      return next();
    }

    // Check specific permission
    const hasPermission = lockAccess[`can_${permission}`];

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions: ${permission} required`
        }
      });
    }

    next();
  };
};

/**
 * Check if user is lock admin
 */
export const requireLockAdmin = async (req, res, next) => {
  const lockAccess = req.lockAccess;

  if (!lockAccess || lockAccess.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
  }

  next();
};

/**
 * Check if user is lock owner
 */
export const requireLockOwner = async (req, res, next) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;

    const { data: lock, error } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    if (error || !lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    if (lock.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Owner access required'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Owner check error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify ownership'
      }
    });
  }
};
