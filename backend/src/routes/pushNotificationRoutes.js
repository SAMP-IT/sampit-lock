import express from 'express';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  unregisterAllDeviceTokens,
  getDeviceTokens,
  sendTestNotification,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../controllers/pushNotificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/push/register
 * @desc    Register device for push notifications
 * @access  Private
 * @body    { expoPushToken, platform, deviceName? }
 */
router.post('/register', registerDeviceToken);

/**
 * @route   DELETE /api/push/unregister
 * @desc    Unregister device from push notifications
 * @access  Private
 * @body    { expoPushToken }
 */
router.delete('/unregister', unregisterDeviceToken);

/**
 * @route   DELETE /api/push/unregister-all
 * @desc    Unregister all devices (logout from all)
 * @access  Private
 */
router.delete('/unregister-all', unregisterAllDeviceTokens);

/**
 * @route   GET /api/push/devices
 * @desc    Get list of registered devices
 * @access  Private
 */
router.get('/devices', getDeviceTokens);

/**
 * @route   POST /api/push/test
 * @desc    Send test notification to current user
 * @access  Private
 */
router.post('/test', sendTestNotification);

/**
 * @route   GET /api/push/preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/preferences', getNotificationPreferences);

/**
 * @route   PATCH /api/push/preferences
 * @desc    Update notification preferences
 * @access  Private
 * @body    { push_enabled?, unlock_notifications?, battery_warnings?, etc. }
 */
router.patch('/preferences', updateNotificationPreferences);

export default router;
