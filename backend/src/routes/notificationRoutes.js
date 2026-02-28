import express from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, validateQuery, schemas, params, queries } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Notification routes
router.get('/', validateQuery(queries.notifications), asyncHandler(getUserNotifications));
router.patch('/:notificationId/read', validateParams(params.notificationId), asyncHandler(markNotificationAsRead));
router.post('/read-all', asyncHandler(markAllNotificationsAsRead));
router.delete('/:notificationId', validateParams(params.notificationId), asyncHandler(deleteNotification));

// Notification preferences
router.get('/preferences', asyncHandler(getNotificationPreferences));
router.patch('/preferences', validate(schemas.updateNotificationPreferences), asyncHandler(updateNotificationPreferences));

export default router;
