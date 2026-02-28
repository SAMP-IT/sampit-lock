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
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/push/register
 * @desc    Register device for push notifications
 * @access  Private
 * @body    { expoPushToken, platform, deviceName? }
 */
router.post('/register', validate(schemas.registerPushToken), asyncHandler(registerDeviceToken));

/**
 * @route   DELETE /api/push/unregister
 * @desc    Unregister device from push notifications
 * @access  Private
 * @body    { expoPushToken }
 */
router.delete('/unregister', validate(schemas.unregisterPushToken), asyncHandler(unregisterDeviceToken));

/**
 * @route   DELETE /api/push/unregister-all
 * @desc    Unregister all devices (logout from all)
 * @access  Private
 */
router.delete('/unregister-all', asyncHandler(unregisterAllDeviceTokens));

/**
 * @route   GET /api/push/devices
 * @desc    Get list of registered devices
 * @access  Private
 */
router.get('/devices', asyncHandler(getDeviceTokens));

/**
 * @route   POST /api/push/test
 * @desc    Send test notification to current user
 * @access  Private
 */
router.post('/test', asyncHandler(sendTestNotification));

/**
 * @route   GET /api/push/preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/preferences', asyncHandler(getNotificationPreferences));

/**
 * @route   PATCH /api/push/preferences
 * @desc    Update notification preferences
 * @access  Private
 * @body    { push_enabled?, unlock_notifications?, battery_warnings?, etc. }
 */
router.patch('/preferences', validate(schemas.updateNotificationPreferences), asyncHandler(updateNotificationPreferences));

export default router;
