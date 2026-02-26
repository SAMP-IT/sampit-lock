import { supabase } from '../services/supabase.js';
import logger from './logger.js';

/**
 * Invalidate all sessions for a user (global sign-out).
 * Revokes all refresh tokens so the user must re-authenticate on every device.
 * Note: Existing access tokens (JWTs) remain valid until they expire (default 1hr),
 * but no new tokens can be obtained via refresh.
 *
 * @param {string} userId - The Supabase auth user ID
 * @param {string} reason - Reason for invalidation (for logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const invalidateAllUserSessions = async (userId, reason = 'unspecified') => {
  try {
    const { error } = await supabase.auth.admin.signOut(userId, 'global');

    if (error) {
      logger.error(`[SESSION] Failed to invalidate sessions for user ${userId} (reason: ${reason})`, {
        error: error.message
      });
      return { success: false, error: error.message };
    }

    logger.info(`[SESSION] Invalidated all sessions for user ${userId} (reason: ${reason})`);
    return { success: true };
  } catch (err) {
    logger.error(`[SESSION] Exception invalidating sessions for user ${userId}`, {
      error: err.message
    });
    return { success: false, error: err.message };
  }
};

/**
 * Invalidate all OTHER sessions for a user, keeping the current one active.
 * Useful after a password change initiated by the user themselves.
 *
 * @param {string} userId - The Supabase auth user ID
 * @param {string} reason - Reason for invalidation (for logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const invalidateOtherUserSessions = async (userId, reason = 'unspecified') => {
  try {
    const { error } = await supabase.auth.admin.signOut(userId, 'others');

    if (error) {
      logger.error(`[SESSION] Failed to invalidate other sessions for user ${userId} (reason: ${reason})`, {
        error: error.message
      });
      return { success: false, error: error.message };
    }

    logger.info(`[SESSION] Invalidated other sessions for user ${userId} (reason: ${reason})`);
    return { success: true };
  } catch (err) {
    logger.error(`[SESSION] Exception invalidating other sessions for user ${userId}`, {
      error: err.message
    });
    return { success: false, error: err.message };
  }
};
