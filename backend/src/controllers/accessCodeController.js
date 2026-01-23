import { supabase } from '../services/supabase.js';
import bcrypt from 'bcrypt';

/**
 * Get All Access Codes for a Lock
 * GET /locks/:lockId/access-codes
 */
export const getAccessCodes = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { code_type, is_active } = req.query;

    let query = supabase
      .from('access_codes')
      .select(`
        id,
        name,
        code_type,
        valid_from,
        valid_until,
        usage_count,
        max_usage_count,
        is_active,
        created_at,
        creator:created_by (
          first_name,
          last_name
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (code_type) {
      query = query.eq('code_type', code_type);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: codes, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch access codes'
        }
      });
    }

    res.json({
      success: true,
      data: codes || []
    });
  } catch (error) {
    console.error('Get access codes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch access codes'
      }
    });
  }
};

/**
 * Create Access Code
 * POST /locks/:lockId/access-codes
 */
export const createAccessCode = async (req, res) => {
  try {
    const { lockId } = req.params;
    const creatorId = req.user.id;
    const {
      name,
      code_type,
      code,
      valid_from,
      valid_until,
      max_usage_count
    } = req.body;

    // Hash the code before storing
    const code_hash = await bcrypt.hash(code, 10);

    // Check if code already exists for this lock
    const { data: existingCodes } = await supabase
      .from('access_codes')
      .select('id, code_hash')
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (existingCodes) {
      for (const existingCode of existingCodes) {
        const matches = await bcrypt.compare(code, existingCode.code_hash);
        if (matches) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'DUPLICATE_CODE',
              message: 'This access code already exists'
            }
          });
        }
      }
    }

    const { data: accessCode, error } = await supabase
      .from('access_codes')
      .insert([{
        lock_id: lockId,
        created_by: creatorId,
        name,
        code_type,
        code_hash,
        valid_from: valid_from ? new Date(valid_from).toISOString() : null,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
        max_usage_count,
        usage_count: 0,
        is_active: true
      }])
      .select(`
        id,
        name,
        code_type,
        valid_from,
        valid_until,
        usage_count,
        max_usage_count,
        is_active,
        created_at
      `)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create access code'
        }
      });
    }

    res.status(201).json({
      success: true,
      data: accessCode
    });
  } catch (error) {
    console.error('Create access code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create access code'
      }
    });
  }
};

/**
 * Update Access Code
 * PATCH /locks/:lockId/access-codes/:codeId
 */
export const updateAccessCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const {
      name,
      valid_from,
      valid_until,
      max_usage_count,
      is_active
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (valid_from !== undefined) updates.valid_from = new Date(valid_from).toISOString();
    if (valid_until !== undefined) updates.valid_until = new Date(valid_until).toISOString();
    if (max_usage_count !== undefined) updates.max_usage_count = max_usage_count;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: accessCode, error } = await supabase
      .from('access_codes')
      .update(updates)
      .eq('id', codeId)
      .select()
      .single();

    if (error || !accessCode) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Access code not found'
        }
      });
    }

    res.json({
      success: true,
      data: accessCode
    });
  } catch (error) {
    console.error('Update access code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update access code'
      }
    });
  }
};

/**
 * Delete Access Code
 * DELETE /locks/:lockId/access-codes/:codeId
 */
export const deleteAccessCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const { error } = await supabase
      .from('access_codes')
      .delete()
      .eq('id', codeId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete access code'
        }
      });
    }

    res.json({
      success: true,
      message: 'Access code deleted successfully'
    });
  } catch (error) {
    console.error('Delete access code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete access code'
      }
    });
  }
};

/**
 * Verify Access Code
 * POST /locks/:lockId/access-codes/verify
 */
export const verifyAccessCode = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { code } = req.body;

    // Get all active codes for this lock
    const { data: codes, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (error || !codes || codes.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid access code'
        }
      });
    }

    // Find matching code
    let matchedCode = null;
    for (const dbCode of codes) {
      const matches = await bcrypt.compare(code, dbCode.code_hash);
      if (matches) {
        matchedCode = dbCode;
        break;
      }
    }

    if (!matchedCode) {
      // Log failed attempt
      await supabase
        .from('activity_logs')
        .insert([{
          lock_id: lockId,
          user_id: null,
          action: 'failed_attempt',
          access_method: 'pin',
          metadata: {
            reason: 'Invalid access code'
          }
        }]);

      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid access code'
        }
      });
    }

    // Check validity period
    const now = new Date();
    if (matchedCode.valid_from && new Date(matchedCode.valid_from) > now) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_NOT_VALID_YET',
          message: 'This access code is not valid yet'
        }
      });
    }

    if (matchedCode.valid_until && new Date(matchedCode.valid_until) < now) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_EXPIRED',
          message: 'This access code has expired'
        }
      });
    }

    // Check usage limit
    if (matchedCode.max_usage_count && matchedCode.usage_count >= matchedCode.max_usage_count) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_LIMIT_REACHED',
          message: 'This access code has reached its usage limit'
        }
      });
    }

    // Increment usage count
    await supabase
      .from('access_codes')
      .update({
        usage_count: matchedCode.usage_count + 1,
        last_used_at: now.toISOString()
      })
      .eq('id', matchedCode.id);

    // Deactivate one-time codes
    if (matchedCode.code_type === 'one_time') {
      await supabase
        .from('access_codes')
        .update({ is_active: false })
        .eq('id', matchedCode.id);
    }

    // Log successful access
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: matchedCode.created_by,
        action: 'unlocked',
        access_method: 'pin',
        metadata: {
          code_name: matchedCode.name,
          code_type: matchedCode.code_type
        }
      }]);

    res.json({
      success: true,
      data: {
        valid: true,
        code_name: matchedCode.name,
        code_type: matchedCode.code_type,
        remaining_uses: matchedCode.max_usage_count
          ? matchedCode.max_usage_count - (matchedCode.usage_count + 1)
          : null
      }
    });
  } catch (error) {
    console.error('Verify access code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify access code'
      }
    });
  }
};
