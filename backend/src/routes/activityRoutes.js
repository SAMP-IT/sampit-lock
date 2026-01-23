import express from 'express';
import {
  getAllActivities,
  getRecentActivities,
  getActivityLogs,
  getActivityStats,
  getUserActivityHistory,
  exportActivityLogs,
  getFailedAttempts
} from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All activities with filtering and sorting (for History screen)
router.get('/all', getAllActivities);

// Recent activities across all user's locks (no lock-specific access check needed)
router.get('/recent', getRecentActivities);

// Activity logs routes
router.get('/:lockId/activity', checkLockAccess, requirePermission('view_logs'), getActivityLogs);
router.get('/:lockId/activity/stats', checkLockAccess, requirePermission('view_logs'), getActivityStats);
router.get('/:lockId/activity/export', checkLockAccess, requirePermission('view_logs'), exportActivityLogs);
router.get('/:lockId/failed-attempts', checkLockAccess, requirePermission('view_logs'), getFailedAttempts);

// User activity history
router.get('/users/:userId/activity', getUserActivityHistory);

export default router;
