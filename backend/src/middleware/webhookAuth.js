import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * TTLock Webhook Authentication Middleware
 *
 * 3-layer defense for webhook endpoints:
 *   Layer 1: Secret token verification (query param or header)
 *   Layer 2: Payload structure validation (must look like a real TTLock event)
 *   Layer 3: Timestamp freshness check (reject stale/replayed events)
 *
 * Setup:
 *   1. Set TTLOCK_WEBHOOK_SECRET in your .env (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 *   2. Register your callback URL in TTLock Open Platform as:
 *      https://your-domain.com/api/webhook/ttlock?token=YOUR_SECRET
 *      (TTLock requires the token in the URL since it can't send custom headers.
 *       The middleware scrubs the token from the URL immediately to prevent log leaks.)
 *   3. For non-TTLock callers, prefer the X-Webhook-Token header instead.
 */

const WEBHOOK_SECRET = process.env.TTLOCK_WEBHOOK_SECRET;

// How old a webhook event can be before we reject it (5 minutes)
const MAX_EVENT_AGE_MS = 5 * 60 * 1000;

/**
 * Layer 1: Secret Token Verification
 *
 * Accepts the token via X-Webhook-Token header (preferred) or query param (for TTLock).
 *
 * TTLock's callback system only supports URL registration — it cannot send custom
 * headers. So the registered callback URL includes ?token=<secret>. We must accept
 * this, but we immediately scrub the token from req.query and req.originalUrl to
 * prevent it leaking into access logs, error reporters, or Referer headers.
 *
 * For non-TTLock callers, prefer X-Webhook-Token header.
 */
const verifyWebhookToken = (req, res, next) => {
  // In production, a missing secret is a misconfiguration — reject all requests
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[WEBHOOK-AUTH] TTLOCK_WEBHOOK_SECRET is not set in production — rejecting all webhook requests.');
      return res.status(403).json({
        success: false,
        error: 'Webhook authentication is not configured'
      });
    }
    // In development/test, warn and allow through for easier local testing
    logger.warn('[WEBHOOK-AUTH] TTLOCK_WEBHOOK_SECRET is not set — webhook authentication is DISABLED. Set it in .env for production.');
    return next();
  }

  // Prefer header over query param
  const token = req.headers['x-webhook-token'] || req.query.token;

  // Immediately scrub the token from the URL so it never appears in logs
  if (req.query.token) {
    delete req.query.token;
    // Rebuild originalUrl without the token query param
    const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
    url.searchParams.delete('token');
    req.originalUrl = url.pathname + url.search;
  }

  if (!token) {
    logger.warn('[WEBHOOK-AUTH] Rejected: no token provided', {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    // Return 200 so attackers don't get useful error info, but mark as rejected
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  // Constant-time comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token, 'utf8');
  const secretBuffer = Buffer.from(WEBHOOK_SECRET, 'utf8');

  if (tokenBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
    logger.warn('[WEBHOOK-AUTH] Rejected: invalid token', {
      ip: req.ip,
      path: req.path
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  next();
};

/**
 * Layer 2: Payload Structure Validation
 *
 * Real TTLock webhook payloads always contain certain fields.
 * This rejects garbage/scanner requests that don't match the expected structure.
 */
const REQUIRED_TTLOCK_FIELDS = ['lockId'];
const KNOWN_TTLOCK_FIELDS = new Set([
  'lockId', 'serverDate', 'eventType', 'recordType',
  'username', 'keyboardPwd', 'electricQuantity', 'success',
  'lockMac', 'lockData', 'gatewayId', 'isOnline', 'lockIds',
  'specialValue', 'lockName', 'date', 'type'
]);

const validatePayloadStructure = (req, res, next) => {
  const payload = req.body;

  // Must have a body
  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    logger.warn('[WEBHOOK-AUTH] Rejected: empty or invalid payload', {
      ip: req.ip,
      contentType: req.headers['content-type']
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  // Gateway webhook has different required fields
  if (req.path === '/ttlock/gateway') {
    if (!payload.gatewayId && !payload.lockIds) {
      logger.warn('[WEBHOOK-AUTH] Rejected: gateway payload missing required fields', {
        ip: req.ip,
        fields: Object.keys(payload)
      });
      return res.status(200).json({
        success: true,
        message: 'Event received'
      });
    }
    return next();
  }

  // Main webhook: must have lockId
  const hasRequired = REQUIRED_TTLOCK_FIELDS.every(field => payload[field] !== undefined && payload[field] !== null);
  if (!hasRequired) {
    logger.warn('[WEBHOOK-AUTH] Rejected: missing required fields', {
      ip: req.ip,
      fields: Object.keys(payload),
      missing: REQUIRED_TTLOCK_FIELDS.filter(f => payload[f] === undefined || payload[f] === null)
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  // lockId must be numeric (TTLock uses numeric lock IDs)
  if (!Number.isFinite(Number(payload.lockId))) {
    logger.warn('[WEBHOOK-AUTH] Rejected: lockId is not numeric', {
      ip: req.ip,
      lockId: payload.lockId
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  // Must have either eventType or recordType
  if (payload.eventType === undefined && payload.recordType === undefined) {
    logger.warn('[WEBHOOK-AUTH] Rejected: missing both eventType and recordType', {
      ip: req.ip,
      fields: Object.keys(payload)
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  next();
};

/**
 * Layer 3: Timestamp Freshness Check
 *
 * Rejects events with a serverDate older than MAX_EVENT_AGE_MS.
 * Prevents replay attacks where an attacker captures and re-sends old events.
 *
 * Note: Only rejects if serverDate IS present and IS stale. If TTLock omits
 * serverDate for some event types, we still process them (fail-open on missing timestamp).
 */
const validateTimestamp = (req, res, next) => {
  const { serverDate } = req.body;

  if (!serverDate) {
    // Some TTLock events may not include serverDate — allow through
    return next();
  }

  const eventTime = new Date(serverDate).getTime();
  const now = Date.now();

  if (Number.isNaN(eventTime)) {
    logger.warn('[WEBHOOK-AUTH] Rejected: invalid serverDate format', {
      ip: req.ip,
      serverDate
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  const age = now - eventTime;

  // Reject events older than 5 minutes
  if (age > MAX_EVENT_AGE_MS) {
    logger.warn('[WEBHOOK-AUTH] Rejected: stale event', {
      ip: req.ip,
      serverDate,
      ageSeconds: Math.round(age / 1000)
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  // Also reject events claiming to be from the future (clock skew tolerance: 60s)
  if (age < -60000) {
    logger.warn('[WEBHOOK-AUTH] Rejected: future-dated event', {
      ip: req.ip,
      serverDate,
      aheadSeconds: Math.round(Math.abs(age) / 1000)
    });
    return res.status(200).json({
      success: true,
      message: 'Event received'
    });
  }

  next();
};

/**
 * Webhook-specific rate limiter
 * Tighter than the global API limiter: 30 requests per minute per IP.
 * TTLock typically sends events one at a time, so this is generous.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: true,
    message: 'Event received'
  }
});

/**
 * Combined middleware stack — apply this to all webhook routes.
 * Order: rate limit → token verify → payload validate → timestamp check
 */
export const authenticateWebhook = [
  webhookLimiter,
  verifyWebhookToken,
  validatePayloadStructure,
  validateTimestamp
];

/**
 * Lighter middleware for the health endpoint (just rate limiting, no auth)
 */
export const webhookHealthOnly = [webhookLimiter];

export { verifyWebhookToken, validatePayloadStructure, validateTimestamp };
