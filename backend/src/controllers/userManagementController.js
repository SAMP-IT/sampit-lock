import { supabase } from '../services/supabase.js';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { logUserEvent, EventAction } from '../services/ai/eventLogger.js';
import ttlockCrypto from '../utils/ttlockCrypto.js';
import { invalidateAllUserSessions } from '../utils/sessionManager.js';

// TTLock API configuration
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;

/**
 * Send TTLock eKey when adding a user to a lock
 * This syncs the user's access with TTLock cloud
 * @param {string} lockId - Our internal lock UUID
 * @param {object} targetUser - User object with email, phone, ttlock_username, first_name
 * @param {string} role - User role (admin, family, restricted, long_term_guest, guest)
 * @param {number|null} startDate - Start timestamp in ms (null for permanent)
 * @param {number|null} endDate - End timestamp in ms (null for permanent)
 * @returns {object|null} - { ttlock_ekey_id, ttlock_key_status } or null on failure
 */
const sendTTLockEkey = async (lockId, targetUser, role, startDate, endDate) => {
  try {
    // Get lock's TTLock data
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('ttlock_lock_id, owner_id')
      .eq('id', lockId)
      .single();

    if (lockError || !lock?.ttlock_lock_id) {
      console.log('[UserManagement] Lock not connected to TTLock, skipping eKey');
      return null;
    }

    // Get owner's TTLock token
    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', lock.owner_id)
      .single();

    if (ownerError || !owner?.ttlock_access_token) {
      console.log('[UserManagement] Owner has no TTLock token, skipping eKey');
      return null;
    }

    const accessToken = ttlockCrypto.decrypt(owner.ttlock_access_token);
    if (!accessToken) {
      console.log('[UserManagement] Failed to decrypt owner TTLock token');
      return null;
    }

    // Determine TTLock recipient username
    const receiverUsername = targetUser.ttlock_username ||
                            targetUser.phone?.replace(/[^a-zA-Z0-9]/g, '') ||
                            targetUser.email;

    if (!receiverUsername) {
      console.log('[UserManagement] No valid receiver username for TTLock eKey');
      return null;
    }

    // Calculate validity based on role
    // TTLock uses 0 for permanent eKey
    let ekeyStartDate = 0;
    let ekeyEndDate = 0;

    if (role === 'scheduled' || role === 'guest_longterm') {
      ekeyStartDate = startDate ? new Date(startDate).getTime() : Date.now();
      ekeyEndDate = endDate ? new Date(endDate).getTime() : 0;
    }

    // Call TTLock API to send eKey
    // Note: TTLock API accepts params as query string despite being POST
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/send`,
      null,
      {
        params: {
          clientId: TTLOCK_CLIENT_ID,
          accessToken: accessToken,
          lockId: parseInt(lock.ttlock_lock_id),
          receiverUsername: receiverUsername,
          keyName: `${role} - ${targetUser.first_name || targetUser.email}`,
          startDate: ekeyStartDate,
          endDate: ekeyEndDate,
          remoteEnable: 1,
          date: Date.now()
        }
      }
    );

    if (response.data?.keyId) {
      console.log(`[UserManagement] ✅ Sent TTLock eKey ${response.data.keyId} to ${receiverUsername}`);
      return {
        ttlock_ekey_id: response.data.keyId,
        ttlock_key_status: 'active'
      };
    } else if (response.data?.errcode) {
      console.warn(`[UserManagement] TTLock eKey error: ${response.data.errcode} - ${response.data.errmsg || response.data.description}`);
      return null;
    }
  } catch (error) {
    console.error('[UserManagement] Failed to send TTLock eKey:', error.message);
  }
  return null;
};

/**
 * Delete TTLock eKey when removing a user from a lock
 * @param {string} lockId - Our internal lock UUID
 * @param {number} ekeyId - TTLock eKey ID to delete
 * @returns {boolean} - true if successful
 */
const deleteTTLockEkey = async (lockId, ekeyId) => {
  try {
    // Get lock owner's token
    const { data: lock } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    if (!lock?.owner_id) return false;

    const { data: owner } = await supabase
      .from('users')
      .select('ttlock_access_token')
      .eq('id', lock.owner_id)
      .single();

    if (!owner?.ttlock_access_token) return false;

    const accessToken = ttlockCrypto.decrypt(owner.ttlock_access_token);
    if (!accessToken) return false;

    // Call TTLock API to delete eKey
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/key/delete`,
      null,
      {
        params: {
          clientId: TTLOCK_CLIENT_ID,
          accessToken: accessToken,
          keyId: ekeyId,
          date: Date.now()
        }
      }
    );

    if (response.data?.errcode === 0 || !response.data?.errcode) {
      console.log(`[UserManagement] ✅ Deleted TTLock eKey ${ekeyId}`);
      return true;
    } else {
      console.warn(`[UserManagement] TTLock delete eKey error: ${response.data.errcode}`);
      return false;
    }
  } catch (error) {
    console.error('[UserManagement] Failed to delete TTLock eKey:', error.message);
    return false;
  }
};

/**
 * Get All Users for a Lock (excluding owner)
 * GET /locks/:lockId/users
 */
export const getLockUsers = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { role, is_active } = req.query;

    // Get the lock owner to exclude them from the list
    const { data: lock } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    let query = supabase
      .from('user_locks')
      .select(`
        id,
        role,
        is_active,
        can_unlock,
        can_lock,
        can_view_logs,
        can_manage_users,
        can_modify_settings,
        remote_unlock_enabled,
        time_restrictions,
        notes,
        created_at,
        user:user_id (
          id,
          email,
          first_name,
          last_name,
          phone,
          avatar_url
        )
      `)
      .eq('lock_id', lockId);

    // Include owner in the list (no longer excluding)
    // Owner will have role 'owner' in user_locks table

    // Filter by role if specified
    if (role) {
      query = query.eq('role', role);
    }

    // Filter by active status if specified
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: userLocks, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Get lock users query error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch users',
          details: error.message
        }
      });
    }

    // Handle null or undefined userLocks
    if (!userLocks || !Array.isArray(userLocks)) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Transform data safely
    const users = userLocks.map(ul => ({
      user_lock_id: ul.id,
      id: ul.user?.id || null,
      email: ul.user?.email || null,
      first_name: ul.user?.first_name || null,
      last_name: ul.user?.last_name || null,
      phone: ul.user?.phone || null,
      avatar_url: ul.user?.avatar_url || null,
      role: ul.role,
      is_active: ul.is_active,
      notes: ul.notes,
      permissions: {
        can_unlock: ul.can_unlock,
        can_lock: ul.can_lock,
        can_view_logs: ul.can_view_logs,
        can_manage_users: ul.can_manage_users,
        can_modify_settings: ul.can_modify_settings,
        remote_unlock_enabled: ul.remote_unlock_enabled
      },
      time_restrictions: ul.time_restrictions,
      added_at: ul.created_at
    }));

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get lock users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch users'
      }
    });
  }
};

/**
 * Get All Users Across All Locks (for current user's locks)
 * GET /users/all
 * Returns users grouped by which locks they have access to
 */
export const getAllUsersForAllLocks = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { role, lock_id } = req.query;

    // Get all locks the current user owns or has admin access to
    const { data: ownedLocks } = await supabase
      .from('locks')
      .select('id, name')
      .eq('owner_id', currentUserId);

    const { data: adminLocks } = await supabase
      .from('user_locks')
      .select('lock_id, lock:locks(id, name)')
      .eq('user_id', currentUserId)
      .eq('can_manage_users', true);

    // Combine lock IDs
    const lockIds = [
      ...(ownedLocks || []).map(l => l.id),
      ...(adminLocks || []).map(ul => ul.lock_id)
    ];
    const uniqueLockIds = [...new Set(lockIds)];

    if (uniqueLockIds.length === 0) {
      return res.json({
        success: true,
        data: {
          users: [],
          locks: [],
          stats: { total_users: 0, admins: 0, family: 0 }
        }
      });
    }

    // Get all user_locks for these locks (excluding owners)
    let query = supabase
      .from('user_locks')
      .select(`
        id,
        lock_id,
        role,
        is_active,
        notes,
        created_at,
        user:user_id (
          id,
          email,
          first_name,
          last_name,
          avatar_url
        ),
        lock:locks (
          id,
          name,
          location,
          owner_id
        )
      `)
      .in('lock_id', uniqueLockIds);

    // Apply role filter if specified
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    // Apply lock filter if specified
    if (lock_id) {
      query = query.eq('lock_id', lock_id);
    }

    const { data: userLocks, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Get all users query error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch users'
        }
      });
    }

    // Group users with their locks (including owners)
    const userMap = new Map();

    (userLocks || []).forEach(ul => {
      const userId = ul.user?.id;
      if (!userId) return;
      
      // Mark if user is owner of this lock
      const isOwner = ul.lock?.owner_id === ul.user?.id;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: ul.user.id,
          email: ul.user.email,
          first_name: ul.user.first_name,
          last_name: ul.user.last_name,
          avatar_url: ul.user.avatar_url,
          locks: []
        });
      }

      userMap.get(userId).locks.push({
        lock_id: ul.lock_id,
        lock_name: ul.lock?.location || ul.lock?.name,  // Use location as user-friendly name, fallback to model name
        lock_model: ul.lock?.name,  // Model number like "M302_48bc98"
        location: ul.lock?.location,  // Location like "Front Door"
        role: isOwner ? 'owner' : ul.role,  // Use 'owner' role if user owns the lock
        is_active: ul.is_active,
        notes: ul.notes,
        added_at: ul.created_at
      });
    });

    const users = Array.from(userMap.values());

    // Calculate stats
    const allUserLocks = users.flatMap(u => u.locks);
    const stats = {
      total_users: users.length,
      admins: new Set(allUserLocks.filter(ul => ul.role === 'admin').map(ul => users.find(u => u.locks.includes(ul))?.id)).size,
      family: new Set(allUserLocks.filter(ul => ul.role === 'family').map(ul => users.find(u => u.locks.includes(ul))?.id)).size,
      owners: new Set(allUserLocks.filter(ul => ul.role === 'owner').map(ul => users.find(u => u.locks.includes(ul))?.id)).size
    };

    // Get list of locks for filter dropdown
    const locks = [...(ownedLocks || []), ...(adminLocks || []).map(ul => ul.lock)].filter(Boolean);
    const uniqueLocks = Array.from(new Map(locks.map(l => [l.id, l])).values());

    res.json({
      success: true,
      data: {
        users,
        locks: uniqueLocks,
        stats
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch users'
      }
    });
  }
};

/**
 * Add User to Multiple Locks
 * POST /users/add
 * Body: { email, lock_ids: [...], role, notes }
 * - User must already exist in AwayKey
 * - If user already has access to a lock, updates their role
 * - Same role is applied to all selected locks
 */
export const addUserToMultipleLocks = async (req, res) => {
  try {
    const {
      email,
      lock_ids,
      role,
      notes,
      // New fields for restricted/long_term_guest roles
      time_restricted,
      days_of_week,
      time_restriction_start,
      time_restriction_end,
      access_valid_from,
      access_valid_until
    } = req.body;
    const currentUserId = req.user.id;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email is required'
        }
      });
    }

    if (!lock_ids || !Array.isArray(lock_ids) || lock_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCKS',
          message: 'At least one lock must be selected'
        }
      });
    }

    // Check if user exists - MUST be an existing AwayKey user
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, avatar_url')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'No AwayKey account found with this email. User must sign up for AwayKey first.'
        }
      });
    }

    const targetUserId = existingUser.id;

    // Can't add yourself
    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_ADD',
          message: 'You cannot add yourself'
        }
      });
    }

    // Verify current user has manage_users permission for all selected locks
    const { data: ownedLocks } = await supabase
      .from('locks')
      .select('id')
      .eq('owner_id', currentUserId)
      .in('id', lock_ids);

    const { data: adminLocks } = await supabase
      .from('user_locks')
      .select('lock_id')
      .eq('user_id', currentUserId)
      .eq('can_manage_users', true)
      .in('lock_id', lock_ids);

    const allowedLockIds = [
      ...(ownedLocks || []).map(l => l.id),
      ...(adminLocks || []).map(ul => ul.lock_id)
    ];

    const unauthorizedLocks = lock_ids.filter(id => !allowedLockIds.includes(id));
    if (unauthorizedLocks.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to add users to some of the selected locks'
        }
      });
    }

    // Get existing access for this user across selected locks
    const { data: existingAccess } = await supabase
      .from('user_locks')
      .select('lock_id')
      .eq('user_id', targetUserId)
      .in('lock_id', lock_ids);

    const existingLockIds = (existingAccess || []).map(ea => ea.lock_id);
    const newLockIds = lock_ids.filter(id => !existingLockIds.includes(id));

    // Build permissions based on role - comprehensive RBAC
    const rolePermissions = {
      owner: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: true,
        can_manage_users: true,
        can_modify_settings: true,
        can_manage_own_credentials: true,
        can_view_own_logs_only: false,
        remote_unlock_enabled: true,
        time_restricted: false
      },
      admin: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: true,
        can_manage_users: true,        // Can manage all except owner
        can_modify_settings: true,     // Except factory reset/delete (enforced in controller)
        can_manage_own_credentials: true,
        can_view_own_logs_only: false,
        remote_unlock_enabled: true,
        time_restricted: false
      },
      family: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: true,           // Full household history
        can_manage_users: false,
        can_modify_settings: false,
        can_manage_own_credentials: true,  // Own fingerprint only
        can_view_own_logs_only: false,
        remote_unlock_enabled: true,
        time_restricted: false
      },
      scheduled: {
        can_unlock: true,              // Only during schedule (enforced in controller)
        can_lock: true,
        can_view_logs: true,
        can_manage_users: false,
        can_modify_settings: false,
        can_manage_own_credentials: true,  // Own fingerprint
        can_view_own_logs_only: true,      // Only own history
        remote_unlock_enabled: true,
        time_restricted: true              // Always enforced
      },
      guest_longterm: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: false,
        can_manage_users: false,
        can_modify_settings: false,
        can_manage_own_credentials: true,  // Own fingerprint/PIN - auto-expires
        can_view_own_logs_only: true,
        remote_unlock_enabled: true,
        time_restricted: false             // Uses access_valid_until instead
      },
      guest_otp: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: false,
        can_manage_users: false,
        can_modify_settings: false,
        can_manage_own_credentials: false,
        can_view_own_logs_only: true,
        remote_unlock_enabled: true,
        time_restricted: false
      },
      // Keep 'guest' for backward compatibility (maps to short-term guest)
      guest: {
        can_unlock: true,
        can_lock: true,
        can_view_logs: false,
        can_manage_users: false,
        can_modify_settings: false,
        can_manage_own_credentials: false,
        can_view_own_logs_only: true,
        remote_unlock_enabled: true,
        time_restricted: false
      }
    };

    const permissions = rolePermissions[role] || rolePermissions.family;
    const results = { added: [], updated: [], failed: [] };

    // Build time restriction fields
    const timeRestrictionFields = {};
    if (role === 'scheduled' || time_restricted) {
      timeRestrictionFields.time_restricted = true;
      if (days_of_week) timeRestrictionFields.days_of_week = days_of_week;
      if (time_restriction_start) timeRestrictionFields.time_restriction_start = time_restriction_start;
      if (time_restriction_end) timeRestrictionFields.time_restriction_end = time_restriction_end;
    }
    if (access_valid_from) timeRestrictionFields.access_valid_from = access_valid_from;
    if (access_valid_until) timeRestrictionFields.access_valid_until = access_valid_until;

    // Update existing access (change role) — but protect lock owners
    if (existingLockIds.length > 0) {
      // Find locks where the target user is the owner — their role cannot be changed
      const { data: ownerLocks } = await supabase
        .from('locks')
        .select('id')
        .eq('owner_id', targetUserId)
        .in('id', existingLockIds);

      const ownerLockIds = (ownerLocks || []).map(l => l.id);
      const updatableLockIds = existingLockIds.filter(id => !ownerLockIds.includes(id));

      // Skip owner locks (cannot change owner's role)
      if (ownerLockIds.length > 0) {
        results.failed.push(...ownerLockIds);
      }

      if (updatableLockIds.length > 0) {
        const { error: updateError } = await supabase
          .from('user_locks')
          .update({
            role: role || 'family',
            notes: notes || null,
            ...permissions,
            ...timeRestrictionFields
          })
          .eq('user_id', targetUserId)
          .in('lock_id', updatableLockIds);

        if (updateError) {
          results.failed.push(...updatableLockIds);
        } else {
          results.updated.push(...updatableLockIds);
        }
      }
    }

    // Add new access
    if (newLockIds.length > 0) {
      const insertData = newLockIds.map(lockId => ({
        user_id: targetUserId,
        lock_id: lockId,
        role: role || 'family',
        notes: notes || null,
        is_active: true,
        ...permissions,
        ...timeRestrictionFields
      }));

      const { error: insertError } = await supabase
        .from('user_locks')
        .insert(insertData);

      if (insertError) {
        console.error('Insert user_locks error:', insertError);
        results.failed.push(...newLockIds);
      } else {
        results.added.push(...newLockIds);

        // Send TTLock eKey for each lock and update user_locks with eKey ID
        for (const lockId of newLockIds) {
          // Send TTLock eKey (async, non-blocking for main flow)
          const ekeyResult = await sendTTLockEkey(
            lockId,
            existingUser,
            role || 'family',
            access_valid_from,
            access_valid_until
          );

          // If eKey was sent, update user_locks with eKey ID
          if (ekeyResult) {
            await supabase
              .from('user_locks')
              .update(ekeyResult)
              .eq('user_id', targetUserId)
              .eq('lock_id', lockId);
          }

          // Log the user added event for AI
          await logUserEvent({
            lockId,
            actorUserId: currentUserId,
            targetUserId,
            action: EventAction.USER_ADDED,
            details: {
              role: role || 'family',
              notes,
              ...(access_valid_until && { expires_at: access_valid_until }),
              ...(ekeyResult && { ttlock_ekey_id: ekeyResult.ttlock_ekey_id })
            }
          });
        }
      }
    }

    // Build informative message
    let message = '';
    if (results.added.length > 0 && results.updated.length > 0) {
      message = `User added to ${results.added.length} lock(s) and role updated in ${results.updated.length} lock(s)`;
    } else if (results.added.length > 0) {
      message = `User added to ${results.added.length} lock(s) successfully`;
    } else if (results.updated.length > 0) {
      message = `User already had access — role updated to ${role} in ${results.updated.length} lock(s)`;
    } else {
      message = 'No changes were made';
    }

    res.status(201).json({
      success: true,
      data: {
        user: existingUser,
        results,
        message
      }
    });
  } catch (error) {
    console.error('Add user to multiple locks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add user'
      }
    });
  }
};

/**
 * Add User to Lock (Legacy - Single Lock)
 * POST /locks/:lockId/users
 */
export const addUserToLock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const { email, first_name, last_name, role, permissions, access_methods, time_restrictions, notes } = req.body;

    // Generate a temporary password hash in case a new user needs to be created
    const temporaryPassword = Math.random().toString(36).slice(-12);
    const password_hash = await bcrypt.hash(temporaryPassword, 10);

    // Atomic transaction: find-or-create user + grant/update lock access
    const { data: result, error: rpcError } = await supabase
      .rpc('add_user_to_lock', {
        p_email: email,
        p_first_name: first_name,
        p_last_name: last_name,
        p_password_hash: password_hash,
        p_lock_id: lockId,
        p_role: role || 'family',
        p_notes: notes || null,
        p_can_unlock: permissions?.can_unlock ?? true,
        p_can_lock: permissions?.can_lock ?? true,
        p_can_view_logs: permissions?.can_view_logs ?? true,
        p_can_manage_users: permissions?.can_manage_users ?? false,
        p_can_modify_settings: permissions?.can_modify_settings ?? false,
        p_remote_unlock_enabled: permissions?.remote_unlock_enabled ?? true,
        p_time_restrictions: time_restrictions || null
      });

    if (rpcError) {
      console.error('Add user to lock RPC error:', rpcError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ACCESS_GRANT_FAILED',
          message: 'Failed to add user to lock'
        }
      });
    }

    const user = result.user;
    const userLock = result.user_lock;
    const isNewUser = result.is_new_user;
    const wasUpdated = result.updated;

    // Add access methods if provided (best-effort, non-transactional)
    if (access_methods && access_methods.length > 0 && userLock?.id) {
      const accessMethodsData = access_methods.map(method => ({
        user_lock_id: userLock.id,
        method_type: method,
        is_enabled: true
      }));

      const { error: methodError } = await supabase
        .from('user_access_methods')
        .insert(accessMethodsData);

      if (methodError) {
        console.warn('Failed to insert access methods:', methodError);
      }
    }

    // Log the user added event for AI
    logUserEvent({
      lockId,
      actorUserId: req.user.id,
      targetUserId: user.id,
      action: EventAction.USER_ADDED,
      details: {
        role: role || 'family',
        permissions: {
          can_unlock: permissions?.can_unlock ?? true,
          can_lock: permissions?.can_lock ?? true,
          can_view_logs: permissions?.can_view_logs ?? true,
          can_manage_users: permissions?.can_manage_users ?? false,
          can_modify_settings: permissions?.can_modify_settings ?? false
        },
        access_methods: access_methods || [],
        is_new_user: isNewUser
      }
    }).catch(() => {});

    const statusCode = wasUpdated ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      data: {
        ...user,
        role: userLock.role,
        notes: userLock.notes,
        updated: wasUpdated,
        permissions: {
          can_unlock: userLock.can_unlock,
          can_lock: userLock.can_lock,
          can_view_logs: userLock.can_view_logs,
          can_manage_users: userLock.can_manage_users,
          can_modify_settings: userLock.can_modify_settings,
          remote_unlock_enabled: userLock.remote_unlock_enabled
        },
        time_restrictions: userLock.time_restrictions
      }
    });
  } catch (error) {
    console.error('Add user to lock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add user'
      }
    });
  }
};

/**
 * Update User Permissions
 * PATCH /locks/:lockId/users/:userId
 */
// Roles that can be assigned via the PATCH endpoint.
// 'owner' is excluded — ownership is transferred via the dedicated transfer endpoint.
const ASSIGNABLE_ROLES = ['admin', 'family', 'scheduled', 'guest_otp', 'guest_longterm'];

export const updateUserPermissions = async (req, res) => {
  try {
    const { lockId, userId } = req.params;
    const { role, permissions, time_restrictions, is_active } = req.body;

    // Prevent modifying the lock owner's role/permissions
    const { data: lock } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    if (lock && lock.owner_id === userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OWNER_PROTECTED',
          message: 'Cannot modify the lock owner\'s role or permissions. Transfer ownership first if needed.'
        }
      });
    }

    const updates = {};

    if (role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role. Allowed values: ${ASSIGNABLE_ROLES.join(', ')}`
          }
        });
      }
      updates.role = role;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (time_restrictions !== undefined) updates.time_restrictions = time_restrictions;

    if (permissions) {
      if (permissions.can_unlock !== undefined) updates.can_unlock = permissions.can_unlock;
      if (permissions.can_lock !== undefined) updates.can_lock = permissions.can_lock;
      if (permissions.can_view_logs !== undefined) updates.can_view_logs = permissions.can_view_logs;
      if (permissions.can_manage_users !== undefined) updates.can_manage_users = permissions.can_manage_users;
      if (permissions.can_modify_settings !== undefined) updates.can_modify_settings = permissions.can_modify_settings;
      if (permissions.remote_unlock_enabled !== undefined) updates.remote_unlock_enabled = permissions.remote_unlock_enabled;
    }

    const { data: userLock, error } = await supabase
      .from('user_locks')
      .update(updates)
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update user permissions'
        }
      });
    }

    // Log the permission change event for AI
    await logUserEvent({
      lockId,
      actorUserId: req.user.id,
      targetUserId: userId,
      action: EventAction.PERMISSION_CHANGED,
      details: {
        changes: updates,
        new_role: userLock.role,
        is_active: userLock.is_active
      }
    });

    // Invalidate sessions when role changes or user is deactivated
    // Forces the user to re-authenticate so their client picks up new permissions
    if (role !== undefined || is_active === false) {
      const reason = is_active === false ? 'user_deactivated' : 'role_changed';
      await invalidateAllUserSessions(userId, reason);
    }

    res.json({
      success: true,
      data: userLock
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update permissions'
      }
    });
  }
};

/**
 * Remove User from Lock
 * DELETE /locks/:lockId/users/:userId
 *
 * Protections:
 * - Cannot remove lock owner (must transfer ownership first)
 * - Admin cannot remove other admins (only owner can)
 * - Deletes TTLock eKey if exists
 */
export const removeUserFromLock = async (req, res) => {
  try {
    const { lockId, userId: targetUserId } = req.params;
    const requesterId = req.user.id;

    console.log('[removeUserFromLock] Request:', { lockId, targetUserId, requesterId });

    // Get lock to check ownership
    const { data: lock } = await supabase
      .from('locks')
      .select('owner_id')
      .eq('id', lockId)
      .single();

    // PROTECTION: Cannot remove lock owner
    if (lock && lock.owner_id === targetUserId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CANNOT_REMOVE_OWNER',
          message: 'Cannot remove lock owner. Transfer ownership first.'
        }
      });
    }

    // Get target user's role and TTLock eKey info
    const { data: targetUserLock, error: lookupError } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('lock_id', lockId)
      .maybeSingle();

    if (lookupError) {
      console.error('[removeUserFromLock] user_locks lookup error:', lookupError, { targetUserId, lockId });
    }

    if (!targetUserLock) {
      console.warn('[removeUserFromLock] No user_locks record found:', { targetUserId, lockId });
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found on this lock'
        }
      });
    }

    // Get requester's role
    const { data: requesterLock } = await supabase
      .from('user_locks')
      .select('role')
      .eq('user_id', requesterId)
      .eq('lock_id', lockId)
      .single();

    // Determine requester's effective role (owner takes precedence)
    const requesterRole = lock?.owner_id === requesterId ? 'owner' : requesterLock?.role;

    // PROTECTION: Admin cannot remove other admins (only owner can)
    if (targetUserLock.role === 'admin' && requesterRole !== 'owner') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_PROTECTION',
          message: 'Only lock owner can remove admin users'
        }
      });
    }

    // Delete TTLock eKey if exists
    if (targetUserLock.ttlock_ekey_id) {
      try {
        await deleteTTLockEkey(lockId, targetUserLock.ttlock_ekey_id);
        console.log(`[removeUserFromLock] Deleted TTLock eKey ${targetUserLock.ttlock_ekey_id}`);
      } catch (ekeyError) {
        console.warn('[removeUserFromLock] Failed to delete TTLock eKey:', ekeyError.message);
        // Continue with removal even if eKey deletion fails
      }
    }

    // Get user info before deleting for logging
    const { data: targetUser } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', targetUserId)
      .single();

    // Delete user access
    const { error } = await supabase
      .from('user_locks')
      .delete()
      .eq('user_id', targetUserId)
      .eq('lock_id', lockId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to remove user'
        }
      });
    }

    // Log the user removed event for AI
    await logUserEvent({
      lockId,
      actorUserId: requesterId,
      targetUserId: targetUserId,
      action: EventAction.USER_REMOVED,
      details: {
        removed_user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Unknown',
        removed_user_email: targetUser?.email,
        removed_user_role: targetUserLock.role,
        ttlock_ekey_deleted: !!targetUserLock.ttlock_ekey_id
      }
    });

    // Invalidate sessions so the user's client picks up reduced access
    await invalidateAllUserSessions(targetUserId, 'removed_from_lock');

    res.json({
      success: true,
      message: 'User removed successfully',
      data: {
        removed_role: targetUserLock.role,
        ttlock_ekey_deleted: !!targetUserLock.ttlock_ekey_id
      }
    });
  } catch (error) {
    console.error('Remove user from lock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to remove user'
      }
    });
  }
};

/**
 * Remove User from Multiple Locks (Selective Removal)
 * DELETE /users/:userId/locks
 * Body: { lock_ids: [...] }
 */
export const removeUserFromMultipleLocks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { lock_ids } = req.body;
    const currentUserId = req.user.id;

    if (!lock_ids || !Array.isArray(lock_ids) || lock_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCKS',
          message: 'At least one lock must be selected'
        }
      });
    }

    // Verify current user has manage_users permission for all selected locks
    const { data: ownedLocks } = await supabase
      .from('locks')
      .select('id')
      .eq('owner_id', currentUserId)
      .in('id', lock_ids);

    const { data: adminLocks } = await supabase
      .from('user_locks')
      .select('lock_id')
      .eq('user_id', currentUserId)
      .eq('can_manage_users', true)
      .in('lock_id', lock_ids);

    const allowedLockIds = [
      ...(ownedLocks || []).map(l => l.id),
      ...(adminLocks || []).map(ul => ul.lock_id)
    ];

    const unauthorizedLocks = lock_ids.filter(id => !allowedLockIds.includes(id));
    if (unauthorizedLocks.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to remove users from some of the selected locks'
        }
      });
    }

    // Get user info for logging
    const { data: targetUser } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single();

    // Check if user is owner of any selected locks (can't remove owner)
    const { data: ownerLocks } = await supabase
      .from('locks')
      .select('id, name')
      .eq('owner_id', userId)
      .in('id', lock_ids);

    if (ownerLocks && ownerLocks.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: `Cannot remove user - they own: ${ownerLocks.map(l => l.name).join(', ')}`
        }
      });
    }

    // Delete user access from selected locks
    const { error } = await supabase
      .from('user_locks')
      .delete()
      .eq('user_id', userId)
      .in('lock_id', lock_ids);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to remove user'
        }
      });
    }

    // Log the user removed event for AI
    for (const lockId of lock_ids) {
      await logUserEvent({
        lockId,
        actorUserId: currentUserId,
        targetUserId: userId,
        action: EventAction.USER_REMOVED,
        details: {
          removed_user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Unknown',
          removed_user_email: targetUser?.email,
          selective_removal: true
        }
      });
    }

    res.json({
      success: true,
      message: `User removed from ${lock_ids.length} lock(s) successfully`
    });
  } catch (error) {
    console.error('Remove user from multiple locks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to remove user'
      }
    });
  }
};

/**
 * Get User Access Methods
 * GET /locks/:lockId/users/:userId/access-methods
 */
export const getUserAccessMethods = async (req, res) => {
  try {
    const { lockId, userId } = req.params;

    const { data: accessMethods, error } = await supabase
      .from('user_access_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('lock_id', lockId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch access methods'
        }
      });
    }

    res.json({
      success: true,
      data: accessMethods || []
    });
  } catch (error) {
    console.error('Get user access methods error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch access methods'
      }
    });
  }
};

/**
 * Add Access Method
 * POST /locks/:lockId/users/:userId/access-methods
 */
export const addAccessMethod = async (req, res) => {
  try {
    const { lockId, userId } = req.params;
    const { method_type, credential_data } = req.body;

    // Check if method already exists
    const { data: existingMethod } = await supabase
      .from('user_access_methods')
      .select('id')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('method_type', method_type)
      .single();

    if (existingMethod) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_METHOD',
          message: 'Access method already exists'
        }
      });
    }

    const { data: accessMethod, error } = await supabase
      .from('user_access_methods')
      .insert([{
        user_id: userId,
        lock_id: lockId,
        method_type,
        credential_data,
        is_enabled: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to add access method'
        }
      });
    }

    res.status(201).json({
      success: true,
      data: accessMethod
    });
  } catch (error) {
    console.error('Add access method error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add access method'
      }
    });
  }
};

/**
 * Update Access Method
 * PATCH /locks/:lockId/users/:userId/access-methods/:methodId
 */
export const updateAccessMethod = async (req, res) => {
  try {
    const { methodId } = req.params;
    const { is_enabled, credential_data } = req.body;

    const updates = {};
    if (is_enabled !== undefined) updates.is_enabled = is_enabled;
    if (credential_data !== undefined) updates.credential_data = credential_data;

    const { data: accessMethod, error } = await supabase
      .from('user_access_methods')
      .update(updates)
      .eq('id', methodId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update access method'
        }
      });
    }

    res.json({
      success: true,
      data: accessMethod
    });
  } catch (error) {
    console.error('Update access method error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update access method'
      }
    });
  }
};

/**
 * Delete Access Method
 * DELETE /locks/:lockId/users/:userId/access-methods/:methodId
 */
export const deleteAccessMethod = async (req, res) => {
  try {
    const { methodId } = req.params;

    const { error } = await supabase
      .from('user_access_methods')
      .delete()
      .eq('id', methodId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete access method'
        }
      });
    }

    res.json({
      success: true,
      message: 'Access method deleted successfully'
    });
  } catch (error) {
    console.error('Delete access method error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete access method'
      }
    });
  }
};

/**
 * Transfer Lock Ownership
 * POST /locks/:lockId/transfer
 */
export const transferLockOwnership = async (req, res) => {
  try {
    const { lockId } = req.params;
    const currentOwnerId = req.user.id;
    const { new_owner_id } = req.body;

    // Atomic transaction: verify ownership, transfer, and update roles
    const { data: result, error: rpcError } = await supabase
      .rpc('transfer_lock_ownership', {
        p_lock_id: lockId,
        p_current_owner_id: currentOwnerId,
        p_new_owner_id: new_owner_id
      });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('FORBIDDEN')) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the owner can transfer ownership' }
        });
      }
      if (msg.includes('INVALID_USER')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_USER', message: 'New owner must have access to the lock' }
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'TRANSFER_FAILED', message: 'Failed to transfer ownership' }
      });
    }

    res.json({
      success: true,
      message: 'Ownership transferred successfully'
    });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to transfer ownership'
      }
    });
  }
};
