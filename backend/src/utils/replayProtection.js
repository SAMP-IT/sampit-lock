/**
 * Replay Protection for critical endpoints (unlock, lock, emergency).
 *
 * Each request must include:
 *   - x-request-nonce  (UUIDv4 or any unique string, max 64 chars)
 *   - x-request-timestamp (Unix epoch **milliseconds**)
 *
 * Rejection rules:
 *   1. Timestamp older than REQUEST_MAX_AGE_MS → 408 "Request too old"
 *   2. Timestamp in the future by more than CLOCK_SKEW_MS → 400 "Bad timestamp"
 *   3. Nonce already seen within the sliding window → 409 "Duplicate request"
 *
 * The nonce store is an in-memory Map with automatic eviction so it never
 * grows unbounded. For multi-instance deployments swap this with a Redis
 * SET + TTL and the same interface.
 */

const REQUEST_MAX_AGE_MS = 30_000;   // 30 seconds
const CLOCK_SKEW_MS      = 5_000;    // 5 seconds future tolerance
const EVICT_INTERVAL_MS   = 60_000;  // housekeeping every 60 s

// Map<nonce, expireAt>
const nonceStore = new Map();

// Periodic cleanup so old nonces don't accumulate
const evictTimer = setInterval(() => {
  const now = Date.now();
  for (const [nonce, expireAt] of nonceStore) {
    if (expireAt <= now) nonceStore.delete(nonce);
  }
}, EVICT_INTERVAL_MS);
// Allow Node to exit even if timer is still alive
if (evictTimer.unref) evictTimer.unref();

/**
 * Express middleware – attach to any route that needs replay protection.
 */
export const replayProtection = (req, res, next) => {
  const nonce     = req.headers['x-request-nonce'];
  const tsHeader  = req.headers['x-request-timestamp'];

  // --- Require both headers ---
  if (!nonce || !tsHeader) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'REPLAY_PROTECTION_MISSING',
        message: 'x-request-nonce and x-request-timestamp headers are required'
      }
    });
  }

  // --- Validate nonce format ---
  if (typeof nonce !== 'string' || nonce.length === 0 || nonce.length > 64) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_NONCE',
        message: 'x-request-nonce must be a non-empty string (max 64 characters)'
      }
    });
  }

  // --- Validate timestamp ---
  const timestamp = Number(tsHeader);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: 'x-request-timestamp must be a positive number (Unix epoch ms)'
      }
    });
  }

  const now = Date.now();

  // Too old?
  if (now - timestamp > REQUEST_MAX_AGE_MS) {
    return res.status(408).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_OLD',
        message: 'Request timestamp is too old. Please retry.'
      }
    });
  }

  // Too far in the future?
  if (timestamp - now > CLOCK_SKEW_MS) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: 'Request timestamp is in the future'
      }
    });
  }

  // --- Check & store nonce (scoped to user to prevent cross-user collision) ---
  const userId = req.user?.id || 'anon';
  const nonceKey = `${userId}:${nonce}`;

  if (nonceStore.has(nonceKey)) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_REQUEST',
        message: 'This request has already been processed (replay detected)'
      }
    });
  }

  // Store nonce with expiry = now + max age (so it stays at least that long)
  nonceStore.set(nonceKey, now + REQUEST_MAX_AGE_MS);

  next();
};

export default replayProtection;
