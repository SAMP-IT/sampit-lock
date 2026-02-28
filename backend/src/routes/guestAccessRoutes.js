import express from 'express';
import {
  createInvite,
  acceptInvite,
  getLockInvites,
  revokeInvite,
  generateOTP,
  verifyOTP,
  getGuestAccessHistory,
  revokeGuestAccess
} from '../controllers/guestAccessController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Invite management
router.post('/:lockId/invites', validateParams(params.lockId), checkLockAccess, requirePermission('manage_users'), validate(schemas.createInvite), asyncHandler(createInvite));
router.get('/:lockId/invites', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getLockInvites));
router.delete('/invites/:inviteId', validateParams(params.inviteId), asyncHandler(revokeInvite));

// Accept invite (public-ish route, but requires authentication)
router.post('/invites/:inviteCode/accept', validateParams(params.inviteCode), asyncHandler(acceptInvite));

// OTP management
router.post('/:lockId/otp', validateParams(params.lockId), checkLockAccess, requirePermission('manage_users'), validate(schemas.generateOTP), asyncHandler(generateOTP));
router.post('/:lockId/otp/verify', validateParams(params.lockId), validate(schemas.verifyOTP), asyncHandler(verifyOTP));

// Guest access history
router.get('/:lockId/guest-access', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getGuestAccessHistory));
router.delete('/guest-access/:accessId', validateParams(params.accessId), asyncHandler(revokeGuestAccess));

export default router;
