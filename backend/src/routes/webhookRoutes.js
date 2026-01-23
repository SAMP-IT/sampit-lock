import express from 'express';
import { supabase } from '../services/supabase.js';
import { sendSmartNotification, logEvent, EventAction, AccessMethod } from '../services/ai/index.js';

const router = express.Router();

/**
 * TTLock Webhook Callback
 * POST /api/webhook/ttlock
 *
 * This endpoint receives real-time events from TTLock Cloud:
 * - Lock/unlock events
 * - Battery alerts
 * - Tamper alerts
 * - Gateway status
 *
 * Configure this URL in TTLock Open Platform:
 * https://open.ttlock.com -> Application Settings -> Callback URL
 */
router.post('/ttlock', async (req, res) => {
  try {
    console.log('ðŸ“¨ TTLock Webhook received:', JSON.stringify(req.body, null, 2));

    const payload = req.body;

    // TTLock sends different event types
    // Common fields: lockId, serverDate, eventType
    const {
      lockId: ttlockLockId,
      serverDate,
      eventType,
      recordType,
      username,
      keyboardPwd,
      electricQuantity,
      success: operationSuccess
    } = payload;
    const recordTypeValue = Number.isFinite(Number(recordType)) ? Number(recordType) : null;

    // Log the webhook event
    const { data: webhookEvent, error: logError } = await supabase
      .from('webhook_events')
      .insert([{
        event_type: eventType || `record_${recordType}`,
        ttlock_lock_id: ttlockLockId,
        payload,
        processed: false
      }])
      .select()
      .single();

    if (logError) {
      console.error('Failed to log webhook event:', logError);
    }

    // Find our lock by TTLock lock ID
    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .select('id, name, owner_id, battery_level')
      .eq('ttlock_lock_id', ttlockLockId)
      .single();

    if (lockError || !lock) {
      console.log('Lock not found for TTLock ID:', ttlockLockId);
      // Still return 200 to acknowledge receipt
      return res.status(200).json({ success: true, message: 'Event received, lock not in our system' });
    }

    // Update webhook event with our lock ID
    if (webhookEvent) {
      await supabase
        .from('webhook_events')
        .update({ lock_id: lock.id })
        .eq('id', webhookEvent.id);
    }
    const batteryLevel = parseBatteryLevel(electricQuantity);
    if (batteryLevel !== null) {
      const { error: lockUpdateError } = await supabase
        .from('locks')
        .update({ battery_level: batteryLevel, updated_at: new Date().toISOString() })
        .eq('id', lock.id);

      if (lockUpdateError) {
        console.error('Failed to update battery level:', lockUpdateError);
      }

      const { error: batteryError } = await supabase
        .from('battery_history')
        .insert([{
          lock_id: lock.id,
          battery_level: batteryLevel,
          recorded_at: new Date().toISOString()
        }]);

      if (batteryError) {
        console.error('Failed to record battery history:', batteryError);
      }
    }

    const recordInfo = getRecordTypeEvent(recordTypeValue);
    const eventInfo = recordInfo || getEventTypeEvent(eventType, batteryLevel);

    if (eventInfo) {
      let {
        action,
        accessMethod,
        success,
        failureReason,
        metadata: eventMetadata = {}
      } = eventInfo;

      const normalizedSuccess = normalizeSuccess(operationSuccess);
      if (normalizedSuccess === false && (action === EventAction.UNLOCKED || action === EventAction.LOCKED)) {
        eventMetadata = { ...eventMetadata, original_action: action };
        action = EventAction.FAILED_ATTEMPT;
        success = false;
        failureReason = failureReason || 'ttlock_failed';
      }

      if (normalizedSuccess === false) {
        success = false;
      } else if (normalizedSuccess === true) {
        success = true;
      }

      const metadata = {
        ...eventMetadata,
        record_type: recordTypeValue ?? recordType ?? null,
        event_type: eventType ?? null,
        ttlock_username: username ?? null,
        ttlock_lock_id: ttlockLockId ?? null,
        battery_level: batteryLevel,
        keyboard_pwd_present: keyboardPwd ? true : undefined,
        ttlock_success: normalizedSuccess === null ? undefined : normalizedSuccess
      };

      await logEvent({
        lockId: lock.id,
        action,
        accessMethod,
        success,
        failureReason,
        metadata,
        createdAt: serverDate || null
      });

      sendSmartNotification({
        lockId: lock.id,
        action,
        metadata
      }).catch(err => console.error('Smart notification error:', err));

      if (webhookEvent) {
        await supabase
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', webhookEvent.id);
      }
    } else {
      console.log('Unhandled record type:', recordTypeValue ?? recordType);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: webhookEvent?.id
    });

  } catch (error) {
    console.error('TTLock webhook error:', error);

    // Still return 200 to prevent TTLock from retrying
    // Log the error for debugging
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: error.message
    });
  }
});

/**
 * Gateway Status Webhook
 * POST /api/webhook/ttlock/gateway
 */
router.post('/ttlock/gateway', async (req, res) => {
  try {
    console.log('ðŸ“¨ TTLock Gateway Webhook:', JSON.stringify(req.body, null, 2));

    const { gatewayId, isOnline, lockIds } = req.body;

    // Log the event
    await supabase
      .from('webhook_events')
      .insert([{
        event_type: isOnline ? 'gateway_online' : 'gateway_offline',
        payload: req.body,
        processed: true,
        processed_at: new Date().toISOString()
      }]);

    // Update affected locks if gateway goes offline
    if (!isOnline && lockIds && lockIds.length > 0) {
      for (const ttlockLockId of lockIds) {
        const { data: lock } = await supabase
          .from('locks')
          .select('id, name, owner_id')
          .eq('ttlock_lock_id', ttlockLockId)
          .single();

        if (lock) {
          await logEvent({
            lockId: lock.id,
            action: EventAction.OFFLINE,
            metadata: { gateway_id: gatewayId }
          });

          sendSmartNotification({
            lockId: lock.id,
            action: EventAction.OFFLINE,
            metadata: { gateway_id: gatewayId }
          }).catch(err => console.error('Smart notification error:', err));
        }
      }
    }

    res.status(200).json({ success: true, message: 'Gateway webhook processed' });

  } catch (error) {
    console.error('Gateway webhook error:', error);
    res.status(200).json({ success: false, message: 'Webhook received but processing failed' });
  }
});

/**
 * Health check for webhook endpoint
 * GET /api/webhook/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Test webhook endpoint (for development)
 * POST /api/webhook/test
 */
router.post('/test', async (req, res) => {
  try {
    console.log('Test webhook received:', req.body);

    res.json({
      success: true,
      message: 'Test webhook received successfully',
      receivedPayload: req.body
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const parseBatteryLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;
  return Math.round(parsed);
};

const normalizeSuccess = (value) => {
  if (value === undefined || value === null) return null;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
};

const getRecordTypeEvent = (recordType) => {
  switch (recordType) {
    case 1: // App unlock
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.PHONE };
    case 3: // Gateway unlock
    case 12: // Gateway unlock
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.REMOTE, metadata: { gateway: true } };
    case 4: // Passcode unlock
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.PIN };
    case 7: // IC card unlock
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.CARD };
    case 8: // Fingerprint unlock
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.FINGERPRINT };
    case 9: // Wristband unlock
      return { action: EventAction.UNLOCKED, metadata: { method: 'wristband' } };
    case 10: // Mechanical key unlock
      return { action: EventAction.UNLOCKED, metadata: { method: 'mechanical_key' } };
    case 11: // Bluetooth lock
      return { action: EventAction.LOCKED, accessMethod: AccessMethod.BLUETOOTH };
    case 29: // Unexpected unlock
      return { action: EventAction.UNLOCKED, metadata: { unexpected: true } };
    case 33: // Lock by fingerprint
      return { action: EventAction.LOCKED, accessMethod: AccessMethod.FINGERPRINT };
    case 34: // Lock by passcode
      return { action: EventAction.LOCKED, accessMethod: AccessMethod.PIN };
    case 35: // Lock by IC card
      return { action: EventAction.LOCKED, accessMethod: AccessMethod.CARD };
    case 36: // Lock by mechanical key
      return { action: EventAction.LOCKED, metadata: { method: 'mechanical_key' } };
    case 37: // Remote control
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.REMOTE, metadata: { remote_control: true } };
    case 44: // Tamper alert
      return { action: EventAction.TAMPER_DETECTED };
    case 45: // Auto lock
      return { action: EventAction.AUTO_LOCK, accessMethod: AccessMethod.AUTO };
    case 46: // Unlock by unlock key
      return { action: EventAction.UNLOCKED, metadata: { method: 'unlock_key' } };
    case 47: // Lock by lock key
      return { action: EventAction.LOCKED, metadata: { method: 'lock_key' } };
    case 48: // Invalid passcode several times
      return {
        action: EventAction.FAILED_ATTEMPT,
        accessMethod: AccessMethod.PIN,
        success: false,
        failureReason: 'invalid_passcode'
      };
    case 55: // Remote unlock via gateway (legacy)
      return { action: EventAction.UNLOCKED, accessMethod: AccessMethod.REMOTE, metadata: { gateway: true } };
    default:
      return null;
  }
};

const getEventTypeEvent = (eventType, batteryLevel) => {
  if (!eventType) return null;
  const normalized = String(eventType).toLowerCase();

  if (normalized.includes('tamper')) {
    return { action: EventAction.TAMPER_DETECTED };
  }

  if (normalized.includes('offline')) {
    return { action: EventAction.OFFLINE };
  }

  if (normalized.includes('battery')) {
    if (batteryLevel !== null && batteryLevel <= 10) {
      return { action: EventAction.BATTERY_CRITICAL };
    }
    return { action: EventAction.BATTERY_LOW };
  }

  return null;
};

export default router;

