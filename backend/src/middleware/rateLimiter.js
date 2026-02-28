import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Global rate limiter - applies to all routes
 * 100 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

/**
 * Auth rate limiter (per-IP) - for login, signup, forgot-password
 * 5 attempts per 15 minutes per IP
 *
 * Protects the server from a single source flooding auth endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again in 15 minutes'
    }
  }
});

/**
 * Auth rate limiter (per-email) - caps how many attempts one account gets
 * from ANY IP address combined.
 *
 * 10 attempts per 15 minutes per email address.
 *
 * This prevents distributed brute-force attacks where many IPs each make
 * a few attempts against the same account, staying under the per-IP limit.
 * The email is normalised to lowercase and falls back to IP if no email
 * is provided (e.g. malformed request).
 */
export const authEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email && typeof email === 'string') {
      return `email:${email.trim().toLowerCase()}`;
    }
    // Fall back to IP if no email in body (malformed request)
    // Use ipKeyGenerator for proper IPv6 subnet grouping
    return ipKeyGenerator(req.ip);
  },
  message: {
    success: false,
    error: {
      code: 'ACCOUNT_RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts for this account, please try again in 15 minutes'
    }
  }
});

/**
 * API rate limiter - for authenticated API routes
 * 60 requests per 1 minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests, please slow down'
    }
  }
});
