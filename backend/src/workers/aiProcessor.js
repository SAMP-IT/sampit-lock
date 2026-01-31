import cron from 'node-cron';
import axios from 'axios';
import batteryPredictor from '../services/ai/batteryPredictor.js';
import fraudDetector from '../services/ai/fraudDetector.js';
import riskScorer from '../services/ai/riskScorer.js';
import accessRecommendations from '../services/ai/accessRecommendations.js';
import autoRulesEngine from '../services/ai/autoRulesEngine.js';
import smartNotifications from '../services/ai/smartNotifications.js';
import smartScheduling from '../services/ai/smartScheduling.js';
import { decrypt } from '../utils/ttlockCrypto.js';

const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://euapi.ttlock.com';

let supabase;

function initWorker(supabaseClient) {
  supabase = supabaseClient;
  console.log('[AI Worker] Initializing background AI jobs...');

  // Every 6 hours: battery predictions for all locks
  cron.schedule('0 */6 * * *', async () => {
    console.log('[AI Worker] Running battery predictions...');
    try {
      const { data: locks, error } = await supabase
        .from('locks')
        .select('id, owner_id')
        .not('battery_level', 'is', null);

      if (error) throw error;

      let successCount = 0;
      for (const lock of locks || []) {
        try {
          await batteryPredictor.predictBatteryLife(lock.id, lock.owner_id);
          successCount++;
        } catch (err) {
          console.error(`[AI Worker] Battery prediction failed for lock ${lock.id}:`, err.message);
        }
      }
      console.log(`[AI Worker] Battery predictions complete: ${successCount}/${locks?.length || 0} successful`);
    } catch (error) {
      console.error('[AI Worker] Battery prediction job failed:', error.message);
    }
  });

  // Every hour: fraud detection scan
  cron.schedule('0 * * * *', async () => {
    console.log('[AI Worker] Scanning for suspicious activity...');
    try {
      const { data: locks, error } = await supabase
        .from('locks')
        .select('id, owner_id');

      if (error) throw error;

      let alertCount = 0;
      for (const lock of locks || []) {
        try {
          const summary = await fraudDetector.getFraudSummary(lock.id);
          if (summary?.alerts_by_severity?.critical > 0 || summary?.alerts_by_severity?.warning > 0) {
            alertCount++;
          }
        } catch (err) {
          console.error(`[AI Worker] Fraud detection failed for lock ${lock.id}:`, err.message);
        }
      }
      console.log(`[AI Worker] Fraud scan complete: ${alertCount} suspicious activities detected`);
    } catch (error) {
      console.error('[AI Worker] Fraud detection job failed:', error.message);
    }
  });

  // Daily at 2 AM: risk scores and access recommendations
  cron.schedule('0 2 * * *', async () => {
    console.log('[AI Worker] Updating risk scores and recommendations...');
    try {
      const { data: users, error } = await supabase
        .from('locks')
        .select('owner_id')
        .not('owner_id', 'is', null);

      if (error) throw error;

      // Get unique users
      const uniqueUsers = [...new Set(users?.map(u => u.owner_id) || [])];

      let riskCount = 0, recCount = 0, ruleCount = 0;
      for (const userId of uniqueUsers) {
        try {
          // Calculate risk score
          await riskScorer.calculateRiskScore(userId);
          riskCount++;

          // Generate access recommendations
          const recs = await accessRecommendations.generateSuggestions(userId);
          if (recs?.length > 0) recCount++;

          // Suggest auto rules
          const rules = await autoRulesEngine.suggestRules(userId);
          if (rules?.length > 0) ruleCount++;
        } catch (err) {
          console.error(`[AI Worker] Daily analysis failed for user ${userId}:`, err.message);
        }
      }
      console.log(`[AI Worker] Daily analysis complete: ${riskCount} risk scores, ${recCount} recommendations, ${ruleCount} rule suggestions`);
    } catch (error) {
      console.error('[AI Worker] Daily analysis job failed:', error.message);
    }
  });

  // Every 15 minutes: process notification queue
  cron.schedule('*/15 * * * *', async () => {
    try {
      const processed = await smartNotifications.processBatchedNotifications();
      if (processed > 0) {
        console.log(`[AI Worker] Processed ${processed} queued notifications`);
      }
    } catch (error) {
      console.error('[AI Worker] Notification queue processing failed:', error.message);
    }
  });

  // Every 30 minutes: auto-pilot mode evaluation
  cron.schedule('*/30 * * * *', async () => {
    try {
      const result = await smartScheduling.runAutoPilot();
      if (result.switched > 0) {
        console.log(`[AI Worker] Auto-pilot: switched ${result.switched} user modes`);
      }
    } catch (error) {
      console.error('[AI Worker] Auto-pilot job failed:', error.message);
    }
  });

  // Daily at 3 AM: cleanup old data (optional)
  cron.schedule('0 3 * * *', async () => {
    console.log('[AI Worker] Running cleanup tasks...');
    try {
      // Delete old dismissed notifications (>90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { error: notifError } = await supabase
        .from('smart_notifications')
        .delete()
        .eq('status', 'dismissed')
        .lt('created_at', ninetyDaysAgo);

      if (notifError) console.error('[AI Worker] Notification cleanup error:', notifError.message);

      // Delete old rejected suggestions (>60 days)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { error: suggError } = await supabase
        .from('ai_suggestions')
        .delete()
        .eq('status', 'rejected')
        .lt('created_at', sixtyDaysAgo);

      if (suggError) console.error('[AI Worker] Suggestion cleanup error:', suggError.message);

      console.log('[AI Worker] Cleanup complete');
    } catch (error) {
      console.error('[AI Worker] Cleanup job failed:', error.message);
    }
  });

  // ============================================================
  // DAILY AT MIDNIGHT: Auto-expire guest credentials
  // ============================================================
  cron.schedule('0 0 * * *', async () => {
    console.log('[AI Worker] Running guest credential auto-expiry job...');

    const now = new Date().toISOString();

    try {
      // 1. Find expired user_locks (long_term_guest/restricted with passed access_valid_until)
      const { data: expiredAccess, error: queryError } = await supabase
        .from('user_locks')
        .select(`
          id,
          user_id,
          lock_id,
          role,
          ttlock_ekey_id,
          locks!inner(owner_id, ttlock_lock_id)
        `)
        .in('role', ['long_term_guest', 'restricted'])
        .lt('access_valid_until', now)
        .eq('is_active', true);

      if (queryError) {
        console.error('[AutoExpiry] Query error:', queryError);
        return;
      }

      console.log(`[AutoExpiry] Found ${expiredAccess?.length || 0} expired access records`);

      let expiredCount = 0;
      let ekeyDeletedCount = 0;

      for (const access of expiredAccess || []) {
        try {
          console.log(`[AutoExpiry] Processing user ${access.user_id} on lock ${access.lock_id} (role: ${access.role})`);

          // 2. Delete TTLock eKey if exists
          if (access.ttlock_ekey_id && access.locks?.ttlock_lock_id) {
            try {
              const { data: owner } = await supabase
                .from('users')
                .select('ttlock_access_token')
                .eq('id', access.locks.owner_id)
                .single();

              if (owner?.ttlock_access_token) {
                const accessToken = decrypt(owner.ttlock_access_token);
                if (accessToken) {
                  // TTLock API expects POST BODY
                  await axios.post(`${TTLOCK_API_BASE_URL}/v3/key/delete`, null, {
                    params: {
                      clientId: TTLOCK_CLIENT_ID,
                      accessToken: accessToken,
                      keyId: access.ttlock_ekey_id,
                      date: Date.now()
                    }
                  });
                  ekeyDeletedCount++;
                  console.log(`[AutoExpiry] Deleted TTLock eKey ${access.ttlock_ekey_id}`);
                }
              }
            } catch (ekeyError) {
              console.warn(`[AutoExpiry] Failed to delete eKey:`, ekeyError.message);
            }
          }

          // 3. Hard delete associated fingerprints
          const { error: fpError } = await supabase
            .from('fingerprints')
            .delete()
            .eq('lock_id', access.lock_id)
            .eq('user_id', access.user_id);

          if (fpError) console.warn(`[AutoExpiry] Failed to delete fingerprints:`, fpError.message);

          // 4. Hard delete associated passcodes
          const { error: pcError } = await supabase
            .from('passcodes')
            .delete()
            .eq('lock_id', access.lock_id)
            .eq('user_id', access.user_id);

          if (pcError) console.warn(`[AutoExpiry] Failed to delete passcodes:`, pcError.message);

          // 5. Hard delete the user-lock relationship
          const { error: ulError } = await supabase
            .from('user_locks')
            .delete()
            .eq('id', access.id);

          if (ulError) {
            console.error(`[AutoExpiry] Failed to delete user_lock:`, ulError.message);
            continue;
          }

          // 6. Log the expiry event (retained for owner/admin audit)
          await supabase.from('activity_logs').insert({
            lock_id: access.lock_id,
            user_id: access.user_id,
            action: 'access_expired',
            success: true,
            metadata: {
              reason: `${access.role}_auto_expiry`,
              expired_at: now
            },
            created_at: now
          });

          expiredCount++;
          console.log(`[AutoExpiry] Successfully expired access for user ${access.user_id}`);

        } catch (accessError) {
          console.error(`[AutoExpiry] Failed to process access ${access.id}:`, accessError);
        }
      }

      console.log(`[AutoExpiry] Completed. Expired ${expiredCount} credentials, deleted ${ekeyDeletedCount} eKeys.`);

    } catch (error) {
      console.error('[AutoExpiry] Job failed:', error);
    }
  });

  console.log('[AI Worker] ✓ Battery predictions scheduled (every 6 hours)');
  console.log('[AI Worker] ✓ Fraud detection scheduled (every hour)');
  console.log('[AI Worker] ✓ Daily analysis scheduled (2 AM)');
  console.log('[AI Worker] ✓ Notification queue scheduled (every 15 min)');
  console.log('[AI Worker] ✓ Cleanup scheduled (3 AM)');
  console.log('[AI Worker] ✓ Guest auto-expiry scheduled (midnight)');
}

// Manual trigger functions for testing
async function triggerBatteryPredictions(lockId = null) {
  if (!supabase) throw new Error('Worker not initialized');

  const query = supabase.from('locks').select('id, owner_id');
  if (lockId) query.eq('id', lockId);

  const { data: locks, error } = await query;
  if (error) throw error;

  const results = [];
  for (const lock of locks || []) {
    try {
      const result = await batteryPredictor.predictBatteryLife(lock.id, lock.owner_id);
      results.push({ lockId: lock.id, success: true, result });
    } catch (err) {
      results.push({ lockId: lock.id, success: false, error: err.message });
    }
  }
  return results;
}

async function triggerFraudDetection(lockId = null) {
  if (!supabase) throw new Error('Worker not initialized');

  const query = supabase.from('locks').select('id, owner_id');
  if (lockId) query.eq('id', lockId);

  const { data: locks, error } = await query;
  if (error) throw error;

  const results = [];
  for (const lock of locks || []) {
    try {
      const result = await fraudDetector.getFraudSummary(lock.id);
      results.push({ lockId: lock.id, success: true, result });
    } catch (err) {
      results.push({ lockId: lock.id, success: false, error: err.message });
    }
  }
  return results;
}

async function triggerDailyAnalysis(userId = null) {
  if (!supabase) throw new Error('Worker not initialized');

  let userIds = [];
  if (userId) {
    userIds = [userId];
  } else {
    const { data: users, error } = await supabase
      .from('locks')
      .select('owner_id')
      .not('owner_id', 'is', null);

    if (error) throw error;
    userIds = [...new Set(users?.map(u => u.owner_id) || [])];
  }

  const results = [];
  for (const uid of userIds) {
    try {
      const riskScore = await riskScorer.calculateRiskScore(uid);
      const recommendations = await accessRecommendations.generateSuggestions(uid);
      const rules = await autoRulesEngine.suggestRules(uid);

      results.push({
        userId: uid,
        success: true,
        riskScore,
        recommendations,
        rules
      });
    } catch (err) {
      results.push({ userId: uid, success: false, error: err.message });
    }
  }
  return results;
}

/**
 * Manual trigger for guest auto-expiry (useful for testing)
 * @param {string} lockId - Optional: Only process specific lock
 * @returns {Object} Results of expiry processing
 */
async function triggerGuestAutoExpiry(lockId = null) {
  if (!supabase) throw new Error('Worker not initialized');

  const now = new Date().toISOString();

  // Build query
  let query = supabase
    .from('user_locks')
    .select(`
      id,
      user_id,
      lock_id,
      role,
      ttlock_ekey_id,
      access_valid_until,
      locks!inner(owner_id, ttlock_lock_id)
    `)
    .in('role', ['long_term_guest', 'restricted'])
    .lt('access_valid_until', now)
    .eq('is_active', true);

  if (lockId) {
    query = query.eq('lock_id', lockId);
  }

  const { data: expiredAccess, error } = await query;

  if (error) throw error;

  const results = [];
  for (const access of expiredAccess || []) {
    try {
      // Delete user_lock
      const { error: deleteError } = await supabase
        .from('user_locks')
        .delete()
        .eq('id', access.id);

      if (deleteError) throw deleteError;

      results.push({
        userId: access.user_id,
        lockId: access.lock_id,
        role: access.role,
        expiredAt: access.access_valid_until,
        success: true
      });
    } catch (err) {
      results.push({
        userId: access.user_id,
        lockId: access.lock_id,
        success: false,
        error: err.message
      });
    }
  }

  return {
    total: expiredAccess?.length || 0,
    processed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

export {
  initWorker,
  triggerBatteryPredictions,
  triggerFraudDetection,
  triggerDailyAnalysis,
  triggerGuestAutoExpiry
};
