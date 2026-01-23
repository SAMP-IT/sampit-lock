/**
 * Fingerprint Controller
 * Manages fingerprint access methods with TTLock API integration and database storage
 */

import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { logEvent, EventAction, AccessMethod } from '../services/ai/eventLogger.js';

const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Get TTLock access token for the current user
 */
async function getTTLockAccessToken(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('ttlock_access_token, ttlock_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Failed to get TTLock access token');
  }

  // Check if token is expired
  const expiresAt = new Date(data.ttlock_token_expires_at);
  if (expiresAt < new Date()) {
    throw new Error('TTLock access token expired. Please reconnect your TTLock account.');
  }

  return data.ttlock_access_token;
}

/**
 * List all fingerprints for a lock
 * GET /locks/:lockId/fingerprints
 */
export const listFingerprints = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { pageNo = 1, pageSize = 20, sync = false } = req.query;

    logger.info(`[FINGERPRINT] Listing fingerprints for lock ${lockId}`);

    // Check user has access to this lock
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('ttlock_lock_id')
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

    // If sync=true, fetch from TTLock cloud and update database
    if (sync === 'true' && lock.ttlock_lock_id) {
      try {
        const accessToken = await getTTLockAccessToken(userId);

        const params = {
          clientId: TTLOCK_CLIENT_ID,
          accessToken,
          lockId: lock.ttlock_lock_id,
          pageNo: parseInt(pageNo),
          pageSize: parseInt(pageSize),
          date: Date.now()
        };

        const response = await axios.post(
          `${TTLOCK_API_BASE_URL}/v3/fingerprint/list`,
          null,
          { params }
        );

        if (response.data && response.data.list) {
          // Sync fingerprints to database
          for (const fp of response.data.list) {
            await supabase
              .from('fingerprints')
              .upsert({
                lock_id: lockId,
                user_id: userId,
                ttlock_fingerprint_id: fp.fingerprintId,
                fingerprint_number: fp.fingerprintNumber,
                fingerprint_name: fp.fingerprintName,
                fingerprint_type: fp.fingerprintType,
                valid_from: fp.startDate ? new Date(fp.startDate).toISOString() : null,
                valid_until: fp.endDate ? new Date(fp.endDate).toISOString() : null,
                cyclic_config: fp.cyclicConfig ? JSON.parse(fp.cyclicConfig) : [],
                is_active: fp.status === 1,
                sender_username: fp.senderUsername
              }, {
                onConflict: 'ttlock_fingerprint_id'
              });
          }

          logger.info(`[FINGERPRINT] Synced ${response.data.list.length} fingerprints from cloud`);
        }
      } catch (syncError) {
        logger.warn('[FINGERPRINT] Cloud sync failed:', syncError.message);
        // Continue to return database records even if sync fails
      }
    }

    // Fetch from database - use fingerprints table with user join
    const { data: fingerprints, error } = await supabase
      .from('fingerprints')
      .select(`
        *,
        user:user_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[FINGERPRINT] Database query failed:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch fingerprints'
        }
      });
    }

    logger.info(`[FINGERPRINT] ✅ Retrieved ${fingerprints.length} fingerprints for lock ${lockId}`);

    res.json({
      success: true,
      data: fingerprints
    });

  } catch (error) {
    logger.error('[FINGERPRINT] List error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to list fingerprints'
      }
    });
  }
};

/**
 * Add a new fingerprint to a lock
 * POST /locks/:lockId/fingerprints
 */
export const addFingerprint = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      fingerprintNumber,
      fingerprintName,
      fingerprintType = 1,
      startDate,
      endDate,
      cyclicConfig,
      addType = 2 // 1 = Bluetooth, 2 = Gateway (default)
    } = req.body;

    logger.info(`[FINGERPRINT] Adding fingerprint to lock ${lockId} via ${addType === 1 ? 'Bluetooth' : 'Cloud API'}`);

    // Validate required fields
    if (!fingerprintNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FINGERPRINT_NUMBER',
          message: 'Fingerprint number is required (obtained from SDK enrollment)'
        }
      });
    }

    // Get lock details
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('ttlock_lock_id')
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

    let ttlockFingerprintId = null;

    // If addType is Bluetooth (1), fingerprint is already on lock - just save to database
    if (addType === 1) {
      logger.info('[FINGERPRINT] Bluetooth enrollment - fingerprint already on lock, saving to database only');

      // For Bluetooth additions, we use the fingerprintNumber as a unique identifier
      // since there's no cloud API call to get a fingerprintId
      // IMPORTANT: Don't use parseInt() - these can be very large numbers (e.g., 53784736890887)
      // that exceed JavaScript's safe integer range. Store as string and let PostgreSQL BIGINT handle it.
      ttlockFingerprintId = String(fingerprintNumber);

    } else {
      // addType is Gateway (2) - need to call TTLock cloud API
      if (!lock.ttlock_lock_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LOCK_NOT_CONNECTED',
            message: 'Lock not connected to TTLock cloud. Use Bluetooth enrollment or connect lock to cloud first.'
          }
        });
      }

      // Get TTLock access token
      const accessToken = await getTTLockAccessToken(userId);

      // Prepare TTLock API params
      const params = {
        clientId: TTLOCK_CLIENT_ID,
        accessToken,
        lockId: lock.ttlock_lock_id,
        fingerprintNumber,
        fingerprintType,
        date: Date.now()
      };

      if (fingerprintName) params.fingerprintName = fingerprintName;
      if (startDate) params.startDate = new Date(startDate).getTime();
      if (endDate) params.endDate = new Date(endDate).getTime();
      if (cyclicConfig && fingerprintType === 4) {
        params.cyclicConfig = JSON.stringify(cyclicConfig);
      }

      logger.info('[FINGERPRINT] Calling TTLock API to add fingerprint...');

      // Call TTLock API
      const response = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/fingerprint/add`,
        null,
        { params }
      );

      if (!response.data || !response.data.fingerprintId) {
        throw new Error('TTLock API did not return fingerprint ID');
      }

      ttlockFingerprintId = response.data.fingerprintId;

      logger.info(`[FINGERPRINT] ✅ Fingerprint added to TTLock cloud: ID ${ttlockFingerprintId}`);
    }

    // Store in our database
    // IMPORTANT: Use correct column names that match the database schema:
    // - valid_from (not start_date)
    // - valid_until (not end_date)
    // - is_active (not status)
    const insertData = {
      lock_id: lockId,
      user_id: userId,
      ttlock_fingerprint_id: ttlockFingerprintId,
      fingerprint_number: fingerprintNumber,
      fingerprint_name: fingerprintName || 'Unnamed Fingerprint',
      fingerprint_type: fingerprintType,
      valid_from: startDate ? new Date(startDate).toISOString() : null,
      valid_until: endDate ? new Date(endDate).toISOString() : null,
      is_active: true,
      add_type: addType || 1
    };

    // Add optional columns if they have values
    if (cyclicConfig && fingerprintType === 4) {
      insertData.cyclic_config = cyclicConfig;
    }

    const { data: fingerprint, error: dbError } = await supabase
      .from('fingerprints')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      logger.error('[FINGERPRINT] Database insert failed:', dbError);

      // Log failed fingerprint enrollment to activity logs
      await logEvent({
        lockId,
        userId,
        action: EventAction.FINGERPRINT_ENROLLED,
        accessMethod: addType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
        success: false,
        failureReason: 'Database error: ' + dbError.message,
        metadata: {
          fingerprint_name: fingerprintName || 'Unnamed Fingerprint',
          fingerprint_number: fingerprintNumber,
          error_code: 'DATABASE_ERROR'
        }
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Fingerprint added to lock but failed to save to database',
          details: dbError.message
        }
      });
    }

    logger.info(`[FINGERPRINT] ✅ Fingerprint saved to database: ${fingerprint.id}`);

    // Log successful fingerprint enrollment to activity logs
    await logEvent({
      lockId,
      userId,
      action: EventAction.FINGERPRINT_ENROLLED,
      accessMethod: addType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
      success: true,
      metadata: {
        fingerprint_name: fingerprintName || 'Unnamed Fingerprint',
        fingerprint_number: fingerprintNumber,
        fingerprint_type: fingerprintType,
        enrollment_method: addType === 1 ? 'bluetooth' : 'gateway'
      }
    });

    res.status(201).json({
      success: true,
      data: fingerprint,
      message: `Fingerprint added successfully via ${addType === 1 ? 'Bluetooth' : 'Cloud API'}`
    });

  } catch (error) {
    logger.error('[FINGERPRINT] Add error:', error);

    const { lockId } = req.params;
    const userId = req.user?.id;
    const { fingerprintName, fingerprintNumber, addType = 1 } = req.body;

    // Parse TTLock API errors
    if (error.response && error.response.data) {
      const apiError = error.response.data;

      // Log failed fingerprint enrollment to activity logs
      try {
        await logEvent({
          lockId,
          userId,
          action: EventAction.FINGERPRINT_ENROLLED,
          accessMethod: addType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
          success: false,
          failureReason: apiError.errmsg || error.message,
          metadata: {
            fingerprint_name: fingerprintName || 'Unknown',
            fingerprint_number: fingerprintNumber || 'Unknown',
            error_code: 'TTLOCK_API_ERROR',
            ttlock_error_code: apiError.errcode
          }
        });
      } catch (logError) {
        logger.error('[FINGERPRINT] Failed to log activity:', logError);
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    // Log failed fingerprint enrollment for general server errors
    try {
      await logEvent({
        lockId,
        userId,
        action: EventAction.FINGERPRINT_ENROLLED,
        accessMethod: addType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
        success: false,
        failureReason: error.message || 'Failed to add fingerprint',
        metadata: {
          fingerprint_name: fingerprintName || 'Unknown',
          fingerprint_number: fingerprintNumber || 'Unknown',
          error_code: 'SERVER_ERROR'
        }
      });
    } catch (logError) {
      logger.error('[FINGERPRINT] Failed to log activity:', logError);
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to add fingerprint'
      }
    });
  }
};

/**
 * Delete a fingerprint from a lock
 * DELETE /locks/:lockId/fingerprints/:fingerprintId
 */
export const deleteFingerprint = async (req, res) => {
  try {
    const { lockId, fingerprintId } = req.params;
    const userId = req.user.id;
    // Accept deleteType from query params (preferred for DELETE) or body
    // Default to 2 (Gateway) for backward compatibility
    const deleteType = parseInt(req.query.deleteType) || req.body?.deleteType || 2; // 1=Bluetooth, 2=Gateway

    logger.info(`[FINGERPRINT] Deleting fingerprint ${fingerprintId} from lock ${lockId}`);

    // Get fingerprint from database
    const { data: fingerprint, error: fpError } = await supabase
      .from('fingerprints')
      .select('*, locks(ttlock_lock_id)')
      .eq('id', fingerprintId)
      .eq('lock_id', lockId)
      .single();

    if (fpError || !fingerprint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FINGERPRINT_NOT_FOUND',
          message: 'Fingerprint not found'
        }
      });
    }

    // If deleteType is Bluetooth (1), the fingerprint is already deleted from the lock
    // via Bluetooth SDK - we just need to delete from database
    if (deleteType === 1) {
      logger.info('[FINGERPRINT] Bluetooth deletion - fingerprint already removed from lock, deleting from database only');
    } else {
      // Gateway deletion - require TTLock cloud connection
      if (!fingerprint.locks || !fingerprint.locks.ttlock_lock_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LOCK_NOT_CONNECTED',
            message: 'Lock not connected to TTLock cloud. Use Bluetooth deletion or connect lock to cloud first.'
          }
        });
      }

      // Get TTLock access token
      const accessToken = await getTTLockAccessToken(userId);

      // Call TTLock API to delete
      const params = {
        clientId: TTLOCK_CLIENT_ID,
        accessToken,
        lockId: fingerprint.locks.ttlock_lock_id,
        fingerprintId: fingerprint.ttlock_fingerprint_id,
        deleteType,
        date: Date.now()
      };

      logger.info('[FINGERPRINT] Calling TTLock API to delete fingerprint...');

      const response = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/fingerprint/delete`,
        null,
        { params }
      );

      logger.info('[FINGERPRINT] ✅ Fingerprint deleted from TTLock cloud');
    }

    // Delete from our database
    const { error: deleteError } = await supabase
      .from('fingerprints')
      .delete()
      .eq('id', fingerprintId);

    if (deleteError) {
      logger.error('[FINGERPRINT] Database delete failed:', deleteError);
    } else {
      logger.info('[FINGERPRINT] ✅ Fingerprint deleted from database');
    }

    // Log successful fingerprint deletion to activity logs
    await logEvent({
      lockId,
      userId,
      action: EventAction.FINGERPRINT_DELETED,
      accessMethod: deleteType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
      success: true,
      metadata: {
        fingerprint_name: fingerprint.fingerprint_name || 'Unknown',
        fingerprint_number: fingerprint.fingerprint_number,
        deletion_method: deleteType === 1 ? 'bluetooth' : 'gateway'
      }
    });

    res.json({
      success: true,
      message: 'Fingerprint deleted successfully'
    });

  } catch (error) {
    logger.error('[FINGERPRINT] Delete error:', error);

    const { lockId, fingerprintId } = req.params;
    const userId = req.user?.id;
    const { deleteType = 2 } = req.body;

    if (error.response && error.response.data) {
      const apiError = error.response.data;

      // Log failed fingerprint deletion to activity logs
      try {
        await logEvent({
          lockId,
          userId,
          action: EventAction.FINGERPRINT_DELETED,
          accessMethod: deleteType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
          success: false,
          failureReason: apiError.errmsg || error.message,
          metadata: {
            fingerprint_id: fingerprintId,
            error_code: 'TTLOCK_API_ERROR',
            ttlock_error_code: apiError.errcode
          }
        });
      } catch (logError) {
        logger.error('[FINGERPRINT] Failed to log activity:', logError);
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    // Log failed fingerprint deletion for general server errors
    try {
      await logEvent({
        lockId,
        userId,
        action: EventAction.FINGERPRINT_DELETED,
        accessMethod: deleteType === 1 ? AccessMethod.BLUETOOTH : AccessMethod.GATEWAY,
        success: false,
        failureReason: error.message || 'Failed to delete fingerprint',
        metadata: {
          fingerprint_id: fingerprintId,
          error_code: 'SERVER_ERROR'
        }
      });
    } catch (logError) {
      logger.error('[FINGERPRINT] Failed to log activity:', logError);
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to delete fingerprint'
      }
    });
  }
};

/**
 * Update fingerprint validity period
 * PATCH /locks/:lockId/fingerprints/:fingerprintId
 */
export const updateFingerprintPeriod = async (req, res) => {
  try {
    const { lockId, fingerprintId } = req.params;
    const userId = req.user.id;
    const { startDate, endDate, cyclicConfig, changeType = 2 } = req.body;

    logger.info(`[FINGERPRINT] Updating period for fingerprint ${fingerprintId}`);

    // Get fingerprint from database
    const { data: fingerprint, error: fpError } = await supabase
      .from('fingerprints')
      .select('*, locks(ttlock_lock_id)')
      .eq('id', fingerprintId)
      .eq('lock_id', lockId)
      .single();

    if (fpError || !fingerprint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FINGERPRINT_NOT_FOUND',
          message: 'Fingerprint not found'
        }
      });
    }

    // Get TTLock access token
    const accessToken = await getTTLockAccessToken(userId);

    // Prepare params
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      accessToken,
      lockId: fingerprint.locks.ttlock_lock_id,
      fingerprintId: fingerprint.ttlock_fingerprint_id,
      changeType,
      date: Date.now()
    };

    if (startDate) params.startDate = new Date(startDate).getTime();
    if (endDate) params.endDate = new Date(endDate).getTime();
    if (cyclicConfig) params.cyclicConfig = JSON.stringify(cyclicConfig);

    logger.info('[FINGERPRINT] Calling TTLock API to update period...');

    // Call TTLock API
    await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/fingerprint/changePeriod`,
      null,
      { params }
    );

    logger.info('[FINGERPRINT] ✅ Period updated in TTLock cloud');

    // Update in our database
    const { data: updated, error: updateError } = await supabase
      .from('fingerprints')
      .update({
        valid_from: startDate ? new Date(startDate).toISOString() : fingerprint.valid_from,
        valid_until: endDate ? new Date(endDate).toISOString() : fingerprint.valid_until,
        cyclic_config: cyclicConfig || fingerprint.cyclic_config
      })
      .eq('id', fingerprintId)
      .select()
      .single();

    if (updateError) {
      logger.error('[FINGERPRINT] Database update failed:', updateError);
    }

    logger.info('[FINGERPRINT] ✅ Period updated in database');

    res.json({
      success: true,
      data: updated,
      message: 'Fingerprint period updated successfully'
    });

  } catch (error) {
    logger.error('[FINGERPRINT] Update period error:', error);

    if (error.response && error.response.data) {
      const apiError = error.response.data;
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_API_ERROR',
          message: apiError.errmsg || error.message,
          ttlock_code: apiError.errcode
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to update fingerprint period'
      }
    });
  }
};

export default {
  listFingerprints,
  addFingerprint,
  deleteFingerprint,
  updateFingerprintPeriod
};
