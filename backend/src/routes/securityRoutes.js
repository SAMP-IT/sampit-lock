/**
 * Security Routes
 *
 * Routes for security dashboard and activity insights
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getSecurityDashboard,
  getActivityInsights,
  acknowledgeSecurityAlert
} from '../controllers/securityDashboardController.js';
import { validateParams, validateQuery, params, queries } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/security/dashboard
 * @desc    Get comprehensive security dashboard data for a lock
 * @access  Private
 * @query   lockId - Lock ID (required)
 */
router.get('/dashboard', validateQuery(queries.securityDashboard), asyncHandler(getSecurityDashboard));

/**
 * @route   GET /api/activity/insights
 * @desc    Get activity insights for a lock
 * @access  Private
 * @query   lockId - Lock ID (required)
 */
router.get('/insights', validateQuery(queries.securityDashboard), asyncHandler(getActivityInsights));

/**
 * @route   POST /api/security/alerts/:alertId/acknowledge
 * @desc    Acknowledge a security alert
 * @access  Private
 */
router.post('/alerts/:alertId/acknowledge', validateParams(params.alertId), asyncHandler(acknowledgeSecurityAlert));

export default router;
