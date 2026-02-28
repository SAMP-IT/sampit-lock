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
import { validateParams, validateQuery, params, queries } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All activities with filtering and sorting (for History screen)
router.get('/all', validateQuery(queries.activityList), asyncHandler(getAllActivities));

// Recent activities across all user's locks (no lock-specific access check needed)
router.get('/recent', validateQuery(queries.pagination), asyncHandler(getRecentActivities));

// Activity logs routes
router.get('/:lockId/activity', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getActivityLogs));
router.get('/:lockId/activity/stats', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getActivityStats));
router.get('/:lockId/activity/export', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(exportActivityLogs));
router.get('/:lockId/failed-attempts', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getFailedAttempts));

// User activity history
router.get('/users/:userId/activity', validateParams(params.userId), validateQuery(queries.userActivity), asyncHandler(getUserActivityHistory));

export default router;
