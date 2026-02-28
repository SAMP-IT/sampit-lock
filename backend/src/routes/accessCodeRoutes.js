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
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Access code management
router.get('/:lockId/access-codes', validateParams(params.lockId), checkLockAccess, requirePermission('view_logs'), asyncHandler(getAccessCodes));
router.post('/:lockId/access-codes', validateParams(params.lockId), checkLockAccess, requirePermission('manage_users'), validate(schemas.createAccessCode), asyncHandler(createAccessCode));
router.patch('/:lockId/access-codes/:codeId', validateParams(params.codeId), checkLockAccess, requirePermission('manage_users'), validate(schemas.updateAccessCode), asyncHandler(updateAccessCode));
router.delete('/:lockId/access-codes/:codeId', validateParams(params.codeId), checkLockAccess, requirePermission('manage_users'), asyncHandler(deleteAccessCode));

// Verify access code (used by the lock itself)
router.post('/:lockId/access-codes/verify', validateParams(params.lockId), validate(schemas.verifyAccessCode), asyncHandler(verifyAccessCode));

export default router;
