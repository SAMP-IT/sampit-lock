import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header'
        }
      });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.auth.middleware(null, req.path, false);
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token'
        }
      });
    }

    // Fetch full user details from database
    let { data: userDetails, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // If user doesn't exist in database, create them automatically
    if (dbError && dbError.code === 'PGRST116') {
      logger.info(`[AUTH] Creating new user in database: ${user.email}`);

      const newUser = {
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || user.email.split('@')[0],
        last_name: user.user_metadata?.last_name || '',
        role: user.user_metadata?.role || 'owner',
        is_active: true,
        password_hash: 'supabase_auth', // Placeholder since auth is handled by Supabase
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (createError) {
        logger.error('[AUTH] Failed to create user profile', { error: createError.message });
        return res.status(500).json({
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Failed to create user profile'
          }
        });
      }

      userDetails = createdUser;
    } else if (dbError || !userDetails) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }

    // Check if user is active
    if (!userDetails.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User account is inactive'
        }
      });
    }

    // Attach user to request
    req.user = userDetails;
    req.token = token;

    logger.auth.middleware(user.id, req.path, true);
    next();
  } catch (error) {
    logger.error('[AUTH] Authentication error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        const { data: userDetails } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userDetails && userDetails.is_active) {
          req.user = userDetails;
          req.token = token;
        }
      }
    }

    next();
  } catch (error) {
    // Continue even if authentication fails
    next();
  }
};

// Alias for backwards compatibility
export const authenticateToken = authenticate;
