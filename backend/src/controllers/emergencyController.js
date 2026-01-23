import { supabase } from '../services/supabase.js';
import { createNotification } from './notificationController.js';

/**
 * Trigger Emergency Unlock
 * POST /locks/:lockId/emergency/unlock
 */
export const emergencyUnlock = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Check if user has access to this lock
    const { data: access } = await supabase
      .from('user_locks')
      .select('can_unlock')
      .eq('user_id', userId)
      .eq('lock_id', lockId)
      .eq('is_active', true)
      .single();

    if (!access || !access.can_unlock) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to unlock this lock'
        }
      });
    }

    // In a real implementation, this would:
    // 1. Send immediate unlock command to the lock
    // 2. Bypass normal time restrictions and access controls
    // 3. Sound alarm if configured

    // Update lock state
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .update({ is_locked: false })
      .eq('id', lockId)
      .select()
      .single();

    if (lockError) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UNLOCK_FAILED',
          message: 'Emergency unlock failed'
        }
      });
    }

    // Log the emergency unlock
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        action: 'unlocked',
        access_method: 'emergency',
        metadata: {
          reason: reason || 'Emergency unlock',
          emergency: true
        }
      }]);

    // Notify all users with access to this lock
    const { data: lockUsers } = await supabase
      .from('user_locks')
      .select('user_id')
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (lockUsers) {
      for (const lockUser of lockUsers) {
        if (lockUser.user_id !== userId) {
          await createNotification(
            lockUser.user_id,
            lockId,
            'emergency',
            'Emergency Unlock',
            `${req.user.first_name} ${req.user.last_name} triggered an emergency unlock`
          );
        }
      }
    }

    res.json({
      success: true,
      data: {
        message: 'Emergency unlock successful',
        is_locked: lock.is_locked
      }
    });
  } catch (error) {
    console.error('Emergency unlock error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Emergency unlock failed'
      }
    });
  }
};

/**
 * Get Trusted Contacts
 * GET /trusted-contacts
 */
export const getTrustedContacts = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: contacts, error } = await supabase
      .from('trusted_contacts')
      .select(`
        id,
        name,
        phone,
        email,
        relationship,
        is_active,
        can_emergency_unlock,
        notify_on_emergency,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch trusted contacts'
        }
      });
    }

    res.json({
      success: true,
      data: contacts || []
    });
  } catch (error) {
    console.error('Get trusted contacts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch trusted contacts'
      }
    });
  }
};

/**
 * Add Trusted Contact
 * POST /trusted-contacts
 */
export const addTrustedContact = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      phone,
      email,
      relationship,
      can_emergency_unlock = false,
      notify_on_emergency = true
    } = req.body;

    const { data: contact, error } = await supabase
      .from('trusted_contacts')
      .insert([{
        user_id: userId,
        name,
        phone,
        email,
        relationship,
        can_emergency_unlock,
        notify_on_emergency,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to add trusted contact'
        }
      });
    }

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Add trusted contact error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add trusted contact'
      }
    });
  }
};

/**
 * Update Trusted Contact
 * PATCH /trusted-contacts/:contactId
 */
export const updateTrustedContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const { data: contact, error } = await supabase
      .from('trusted_contacts')
      .update(updates)
      .eq('id', contactId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !contact) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Trusted contact not found'
        }
      });
    }

    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Update trusted contact error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update trusted contact'
      }
    });
  }
};

/**
 * Delete Trusted Contact
 * DELETE /trusted-contacts/:contactId
 */
export const deleteTrustedContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('trusted_contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete trusted contact'
        }
      });
    }

    res.json({
      success: true,
      message: 'Trusted contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete trusted contact error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete trusted contact'
      }
    });
  }
};

/**
 * Send Emergency Alert
 * POST /locks/:lockId/emergency/alert
 */
export const sendEmergencyAlert = async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user.id;
    const { message, alert_type = 'general' } = req.body;

    // Get lock details
    const { data: lock } = await supabase
      .from('locks')
      .select('name, location, owner_id')
      .eq('id', lockId)
      .single();

    if (!lock) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Lock not found'
        }
      });
    }

    // Get trusted contacts who should be notified
    const { data: contacts } = await supabase
      .from('trusted_contacts')
      .select('name, phone, email, notify_on_emergency')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('notify_on_emergency', true);

    // In a real implementation, send SMS/Email to trusted contacts
    // For now, we'll log the alert
    const alertData = {
      lock_name: lock.name,
      lock_location: lock.location,
      user_name: `${req.user.first_name} ${req.user.last_name}`,
      alert_type,
      message,
      timestamp: new Date().toISOString(),
      contacts_notified: contacts ? contacts.length : 0
    };

    // Log the emergency alert
    await supabase
      .from('activity_logs')
      .insert([{
        lock_id: lockId,
        user_id: userId,
        action: 'tamper_detected',
        access_method: 'system',
        metadata: {
          alert_type,
          emergency_alert: true,
          message
        }
      }]);

    // Notify all users with access to this lock
    const { data: lockUsers } = await supabase
      .from('user_locks')
      .select('user_id')
      .eq('lock_id', lockId)
      .eq('is_active', true);

    if (lockUsers) {
      for (const lockUser of lockUsers) {
        await createNotification(
          lockUser.user_id,
          lockId,
          'emergency',
          'Emergency Alert',
          message || `Emergency alert triggered at ${lock.location}`
        );
      }
    }

    res.json({
      success: true,
      data: {
        message: 'Emergency alert sent successfully',
        contacts_notified: contacts ? contacts.length : 0,
        alert_details: alertData
      }
    });
  } catch (error) {
    console.error('Send emergency alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send emergency alert'
      }
    });
  }
};
