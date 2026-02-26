import { supabase } from '../services/supabase.js';
import crypto from 'crypto';

/**
 * Create Invite
 * POST /locks/:lockId/invites
 */
export const createInvite = async (req, res) => {
  try {
    const { lockId } = req.params;
    const creatorId = req.user.id;
    const { email, role, permissions, valid_days = 7 } = req.body;

    // Generate unique invite code
    const invite_code = crypto.randomBytes(16).toString('hex');

    // Calculate expiry date
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + valid_days);

    const { data: invite, error } = await supabase
      .from('invites')
      .insert([{
        lock_id: lockId,
        invited_by: creatorId,
        email,
        role,
        permissions,
        invite_code,
        expires_at: expires_at.toISOString(),
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create invite'
        }
      });
    }

    // In a real implementation, send invitation email
    // await sendInvitationEmail(email, invite_code, lockId);

    res.status(201).json({
      success: true,
      data: invite
    });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create invite'
      }
    });
  }
};

/**
 * Accept Invite
 * POST /invites/:inviteCode/accept
 */
export const acceptInvite = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user.id;

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invalid or expired invite'
        }
      });
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITE_EXPIRED',
          message: 'This invite has expired'
        }
      });
    }

    // Check if user already has access
    const { data: existingAccess } = await supabase
      .from('user_locks')
      .select('id')
      .eq('user_id', userId)
      .eq('lock_id', invite.lock_id)
      .single();

    if (existingAccess) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_ACCESS',
          message: 'You already have access to this lock'
        }
      });
    }

    // Grant access
    const { data: userLock, error: accessError } = await supabase
      .from('user_locks')
      .insert([{
        user_id: userId,
        lock_id: invite.lock_id,
        role: invite.role,
        ...invite.permissions,
        is_active: true
      }])
      .select()
      .single();

    if (accessError) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'ACCESS_GRANT_FAILED',
          message: 'Failed to grant access'
        }
      });
    }

    // Update invite status
    await supabase
      .from('invites')
      .update({
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id);

    res.json({
      success: true,
      data: {
        message: 'Invite accepted successfully',
        lock_access: userLock
      }
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept invite'
      }
    });
  }
};

/**
 * Get Lock Invites
 * GET /locks/:lockId/invites
 */
export const getLockInvites = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('invites')
      .select(`
        id,
        email,
        role,
        permissions,
        invite_code,
        status,
        expires_at,
        created_at,
        accepted_at,
        invited_by_user:invited_by (
          first_name,
          last_name,
          email
        ),
        accepted_by_user:accepted_by (
          first_name,
          last_name,
          email
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invites, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch invites'
        }
      });
    }

    res.json({
      success: true,
      data: invites
    });
  } catch (error) {
    console.error('Get lock invites error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch invites'
      }
    });
  }
};

/**
 * Revoke Invite
 * DELETE /invites/:inviteId
 */
export const revokeInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const userId = req.user.id;

    // First verify the invite exists and the caller owns it or has lock access
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, invited_by, lock_id, status')
      .eq('id', inviteId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invite) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invite not found or already processed'
        }
      });
    }

    // Check: caller must be the invite creator OR be lock owner/admin with manage_users
    if (invite.invited_by !== userId) {
      const { data: lockOwner } = await supabase
        .from('locks')
        .select('id')
        .eq('id', invite.lock_id)
        .eq('owner_id', userId)
        .single();

      if (!lockOwner) {
        const { data: lockAdmin } = await supabase
          .from('user_locks')
          .select('lock_id')
          .eq('lock_id', invite.lock_id)
          .eq('user_id', userId)
          .eq('can_manage_users', true)
          .single();

        if (!lockAdmin) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to revoke this invite'
            }
          });
        }
      }
    }

    // Now perform the revocation
    const { data: revokedInvite, error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !revokedInvite) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invite not found or already processed'
        }
      });
    }

    res.json({
      success: true,
      message: 'Invite revoked successfully'
    });
  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to revoke invite'
      }
    });
  }
};

/**
 * Generate One-Time Password (OTP)
 * POST /locks/:lockId/otp
 *
 * This creates an OTP code in our database. The code can be verified through:
 * 1. The GuestOTPScreen app verification (validates against database)
 * 2. For lock keypad access, use the TTLock Cloud Passcode API instead
 */
export const generateOTP = async (req, res) => {
  try {
    const { lockId } = req.params;
    const creatorId = req.user.id;
    const {
      guest_name,
      access_start,
      access_end,
      expires_at,      // Alternative: direct expiry timestamp
      valid_duration,  // Alternative: duration in seconds
      max_uses = 1
    } = req.body;

    // Generate 6-digit OTP
    const otp_code = Math.floor(100000 + Math.random() * 900000).toString();

    // Calculate access window
    const now = new Date();
    let startTime = access_start ? new Date(access_start) : now;
    let endTime;

    if (access_end) {
      endTime = new Date(access_end);
    } else if (expires_at) {
      endTime = new Date(expires_at);
    } else if (valid_duration) {
      endTime = new Date(now.getTime() + (valid_duration * 1000));
    } else {
      // Default: 1 hour validity
      endTime = new Date(now.getTime() + (60 * 60 * 1000));
    }

    const { data: guestAccess, error } = await supabase
      .from('guest_access')
      .insert([{
        lock_id: lockId,
        created_by_user_id: creatorId,
        guest_name,
        access_code: otp_code,
        access_type: 'otp',
        access_start: startTime.toISOString(),
        access_end: endTime.toISOString(),
        max_uses,
        usage_count: 0,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Generate OTP database error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to generate OTP'
        }
      });
    }

    // Return the OTP code in a format the mobile app expects
    res.status(201).json({
      success: true,
      data: {
        ...guestAccess,
        code: otp_code,  // Include code in response for display
        expires_at: endTime.toISOString()
      }
    });
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to generate OTP'
      }
    });
  }
};

/**
 * Verify OTP
 * POST /locks/:lockId/otp/verify
 */
export const verifyOTP = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { otp_code } = req.body;

    // Find active OTP
    const { data: guestAccess, error } = await supabase
      .from('guest_access')
      .select('*')
      .eq('lock_id', lockId)
      .eq('access_code', otp_code)
      .eq('access_type', 'otp')
      .eq('is_active', true)
      .single();

    if (error || !guestAccess) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid OTP code'
        }
      });
    }

    // Check if OTP is within valid time window
    const now = new Date();
    const accessStart = new Date(guestAccess.access_start);
    const accessEnd = new Date(guestAccess.access_end);

    if (now < accessStart || now > accessEnd) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OTP_EXPIRED',
          message: 'OTP is not valid at this time'
        }
      });
    }

    // Check usage limit
    if (guestAccess.usage_count >= guestAccess.max_uses) {
      await supabase
        .from('guest_access')
        .update({ is_active: false })
        .eq('id', guestAccess.id);

      return res.status(400).json({
        success: false,
        error: {
          code: 'OTP_USED',
          message: 'OTP has reached maximum usage limit'
        }
      });
    }

    // Increment usage count
    await supabase
      .from('guest_access')
      .update({
        usage_count: guestAccess.usage_count + 1,
        last_used_at: now.toISOString()
      })
      .eq('id', guestAccess.id);

    // Log the access
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: guestAccess.created_by_user_id,
        action: 'unlocked',
        access_method: 'otp',
        metadata: {
          guest_name: guestAccess.guest_name,
          otp_usage_count: guestAccess.usage_count + 1
        }
      }]);

    res.json({
      success: true,
      data: {
        valid: true,
        guest_name: guestAccess.guest_name,
        remaining_uses: guestAccess.max_uses - (guestAccess.usage_count + 1)
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify OTP'
      }
    });
  }
};

/**
 * Get Guest Access History
 * GET /locks/:lockId/guest-access
 */
export const getGuestAccessHistory = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { is_active } = req.query;

    let query = supabase
      .from('guest_access')
      .select(`
        id,
        guest_name,
        access_code,
        access_type,
        access_start,
        access_end,
        max_uses,
        usage_count,
        is_active,
        last_used_at,
        created_at,
        creator:created_by_user_id (
          first_name,
          last_name
        )
      `)
      .eq('lock_id', lockId)
      .order('created_at', { ascending: false });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: guestAccess, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch guest access history'
        }
      });
    }

    res.json({
      success: true,
      data: guestAccess
    });
  } catch (error) {
    console.error('Get guest access history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch guest access history'
      }
    });
  }
};

/**
 * Revoke Guest Access
 * DELETE /guest-access/:accessId
 */
export const revokeGuestAccess = async (req, res) => {
  try {
    const { accessId } = req.params;
    const userId = req.user.id;

    // First fetch the guest access to verify ownership
    const { data: accessRecord, error: fetchError } = await supabase
      .from('guest_access')
      .select('id, created_by_user_id, lock_id')
      .eq('id', accessId)
      .single();

    if (fetchError || !accessRecord) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Guest access not found'
        }
      });
    }

    // Check: caller must be the creator OR be lock owner/admin with manage_users
    if (accessRecord.created_by_user_id !== userId) {
      const { data: lockOwner } = await supabase
        .from('locks')
        .select('id')
        .eq('id', accessRecord.lock_id)
        .eq('owner_id', userId)
        .single();

      if (!lockOwner) {
        const { data: lockAdmin } = await supabase
          .from('user_locks')
          .select('lock_id')
          .eq('lock_id', accessRecord.lock_id)
          .eq('user_id', userId)
          .eq('can_manage_users', true)
          .single();

        if (!lockAdmin) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to revoke this guest access'
            }
          });
        }
      }
    }

    // Now perform the revocation
    const { data: guestAccess, error } = await supabase
      .from('guest_access')
      .update({ is_active: false })
      .eq('id', accessId)
      .select()
      .single();

    if (error || !guestAccess) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Guest access not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Guest access revoked successfully'
    });
  } catch (error) {
    console.error('Revoke guest access error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to revoke guest access'
      }
    });
  }
};
