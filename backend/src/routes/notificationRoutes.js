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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Notification routes
router.get('/', getUserNotifications);
router.patch('/:notificationId/read', markNotificationAsRead);
router.post('/read-all', markAllNotificationsAsRead);
router.delete('/:notificationId', deleteNotification);

// Notification preferences
router.get('/preferences', getNotificationPreferences);
router.patch('/preferences', updateNotificationPreferences);

export default router;
