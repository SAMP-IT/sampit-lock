import express from 'express';
import {
  getAccessCodes,
  createAccessCode,
  updateAccessCode,
  deleteAccessCode,
  verifyAccessCode
} from '../controllers/accessCodeController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Access code management
router.get('/:lockId/access-codes', checkLockAccess, requirePermission('view_logs'), getAccessCodes);
router.post('/:lockId/access-codes', checkLockAccess, requirePermission('manage_users'), validate(schemas.createAccessCode), createAccessCode);
router.patch('/:lockId/access-codes/:codeId', checkLockAccess, requirePermission('manage_users'), updateAccessCode);
router.delete('/:lockId/access-codes/:codeId', checkLockAccess, requirePermission('manage_users'), deleteAccessCode);

// Verify access code (used by the lock itself)
router.post('/:lockId/access-codes/verify', verifyAccessCode);

export default router;
