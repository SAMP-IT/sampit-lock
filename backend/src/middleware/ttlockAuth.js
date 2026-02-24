import { supabase } from '../services/supabase.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * TTLock Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticateTTLock = async (req, res, next) => {
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

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired. Please login again.'
          }
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    // Verify token type
    if (decoded.type !== 'ttlock_auth') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type'
        }
      });
    }

    // Fetch full user details from database
    const { data: userDetails, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (dbError || !userDetails) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
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
    req.ttlockUserId = decoded.ttlockUserId;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
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
 * Optional TTLock authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalTTLockAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type === 'ttlock_auth') {
          const { data: userDetails } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();

          if (userDetails && userDetails.is_active) {
            req.user = userDetails;
            req.token = token;
            req.ttlockUserId = decoded.ttlockUserId;
          }
        }
      } catch (jwtError) {
        // Token invalid, continue without user
      }
    }

    next();
  } catch (error) {
    // Continue even if authentication fails
    next();
  }
};

// DO NOT USE THESE ALIASES - they conflict with Supabase auth
// Use authenticateTTLock directly if you need TTLock JWT auth
// export const authenticate = authenticateTTLock;  // DISABLED
// export const authenticateToken = authenticateTTLock;  // DISABLED
// export const optionalAuth = optionalTTLockAuth;  // DISABLED
