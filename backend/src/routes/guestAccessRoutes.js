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
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Invite management
router.post('/:lockId/invites', checkLockAccess, requirePermission('manage_users'), validate(schemas.createInvite), createInvite);
router.get('/:lockId/invites', checkLockAccess, requirePermission('view_logs'), getLockInvites);
router.delete('/invites/:inviteId', revokeInvite);

// Accept invite (public-ish route, but requires authentication)
router.post('/invites/:inviteCode/accept', acceptInvite);

// OTP management
router.post('/:lockId/otp', checkLockAccess, requirePermission('manage_users'), validate(schemas.generateOTP), generateOTP);
router.post('/:lockId/otp/verify', verifyOTP);

// Guest access history
router.get('/:lockId/guest-access', checkLockAccess, requirePermission('view_logs'), getGuestAccessHistory);
router.delete('/guest-access/:accessId', revokeGuestAccess);

export default router;
