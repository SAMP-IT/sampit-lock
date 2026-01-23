import { supabase } from '../services/supabase.js';
import logger from '../utils/logger.js';

/**
 * Save a passcode created via Bluetooth to the database
 * POST /api/locks/:lockId/passcodes
 */
export const savePasscode = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const {
      code,
      name,
      code_type, // 'permanent', 'temporary', 'one_time'
      valid_from,
      valid_until
    } = req.body;

    logger.info(`[PASSCODE] 💾 Saving passcode for lock ${lockId}`);

    // Validation
    if (!code || code.length < 4 || code.length > 9) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'Passcode must be 4-9 digits' }
      });
    }

    if (!code_type || !['permanent', 'temporary', 'one_time'].includes(code_type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Code type must be permanent, temporary, or one_time' }
      });
    }

    // Check if user has access to this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this lock' }
      });
    }

    // Only admin/owner/family can create passcodes
    if (!['admin', 'owner', 'family'].includes(userLock.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'You do not have permission to create passcodes' }
      });
    }

    // Check if code already exists for this lock
    const { data: existingCode } = await supabase
      .from('passcodes')
      .select('id')
      .eq('lock_id', lockId)
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (existingCode) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_CODE', message: 'This passcode already exists for this lock' }
      });
    }

    // Save passcode
    const { data: savedPasscode, error: saveError } = await supabase
      .from('passcodes')
      .insert({
        lock_id: lockId,
        created_by: userId,
        code,
        name: name || `${code_type.charAt(0).toUpperCase() + code_type.slice(1)} Code`,
        code_type,
        valid_from: valid_from ? new Date(valid_from).toISOString() : null,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
        is_active: true
      })
      .select()
      .single();

    if (saveError) {
      logger.error('[PASSCODE] ❌ Failed to save passcode:', saveError);
      return res.status(500).json({
        success: false,
        error: { code: 'SAVE_FAILED', message: 'Failed to save passcode' }
      });
    }

    logger.info(`[PASSCODE] ✅ Passcode saved: ${savedPasscode.id}`);

    return res.status(201).json({
      success: true,
      data: {
        id: savedPasscode.id,
        code: savedPasscode.code,
        name: savedPasscode.name,
        code_type: savedPasscode.code_type,
        valid_from: savedPasscode.valid_from,
        valid_until: savedPasscode.valid_until,
        is_active: savedPasscode.is_active,
        created_at: savedPasscode.created_at
      }
    });

  } catch (error) {
    logger.error('[PASSCODE] ❌ Save passcode error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Get all passcodes for a lock
 * GET /api/locks/:lockId/passcodes
 */
export const getPasscodes = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { include_inactive } = req.query;

    logger.info(`[PASSCODE] 📋 Getting passcodes for lock ${lockId}`);

    // Check if user has access to this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this lock' }
      });
    }

    // Build query
    let query = supabase
      .from('passcodes')
      .select(`
        id,
        code,
        name,
        code_type,
        valid_from,
        valid_until,
        is_active,
        created_at,
        created_by,
        creator:created_by (
          first_name,
          last_name
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    // Filter inactive unless requested
    if (include_inactive !== 'true') {
      query = query.eq('is_active', true);
    }

    const { data: passcodes, error } = await query;

    if (error) {
      logger.error('[PASSCODE] ❌ Failed to fetch passcodes:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch passcodes' }
      });
    }

    // Process passcodes to add status info
    const now = new Date();
    const processedPasscodes = (passcodes || []).map(p => {
      let status = 'active';
      if (!p.is_active) {
        status = 'inactive';
      } else if (p.valid_until && new Date(p.valid_until) < now) {
        status = 'expired';
      } else if (p.valid_from && new Date(p.valid_from) > now) {
        status = 'scheduled';
      }

      return {
        ...p,
        status,
        creator_name: p.creator
          ? `${p.creator.first_name || ''} ${p.creator.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown'
      };
    });

    logger.info(`[PASSCODE] ✅ Retrieved ${processedPasscodes.length} passcodes`);

    return res.json({
      success: true,
      data: processedPasscodes
    });

  } catch (error) {
    logger.error('[PASSCODE] ❌ Get passcodes error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

/**
 * Delete a passcode
 * DELETE /api/locks/:lockId/passcodes/:passcodeId
 */
export const deletePasscode = async (req, res) => {
  try {
    const { lockId, passcodeId } = req.params;
    const userId = req.user.id;

    logger.info(`[PASSCODE] 🗑️ Deleting passcode ${passcodeId}`);

    // Check if user has access to this lock
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (accessError || !userLock) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this lock' }
      });
    }

    // Only admin/owner can delete passcodes
    if (!['admin', 'owner'].includes(userLock.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'PERMISSION_DENIED', message: 'Only lock administrators can delete passcodes' }
      });
    }

    // Soft delete - mark as inactive
    const { error: deleteError } = await supabase
      .from('passcodes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', passcodeId)
      .eq('lock_id', lockId);

    if (deleteError) {
      logger.error('[PASSCODE] ❌ Failed to delete passcode:', deleteError);
      return res.status(500).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to delete passcode' }
      });
    }

    logger.info(`[PASSCODE] ✅ Passcode ${passcodeId} deleted`);

    return res.json({
      success: true,
      message: 'Passcode deleted successfully'
    });

  } catch (error) {
    logger.error('[PASSCODE] ❌ Delete passcode error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};
