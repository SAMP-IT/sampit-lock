import express from 'express';
import {
  getAllLocks,
  getLockDetails,
  addLock,
  updateLock,
  deleteLock,
  factoryResetLock,
  pairLock,
  lockDoor,
  unlockDoor,
  getLockStatus,
  getBatteryLevel,
  logActivity,
  getRecoveryKeys
} from '../controllers/lockController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission, requireLockOwner } from '../middleware/rbac.js';
import { validate, validateParams, validateQuery, schemas, params, queries } from '../middleware/validation.js';
import replayProtection from '../utils/replayProtection.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All lock routes require authentication
router.use(authenticate);

// Lock CRUD operations
router.get('/', validateQuery(queries.lockList), asyncHandler(getAllLocks));
router.post('/', validate(schemas.addLock), asyncHandler(addLock));

// Lock-specific routes (require lock access)
router.get('/:lockId', validateParams(params.lockId), checkLockAccess, asyncHandler(getLockDetails));
router.patch('/:lockId', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.updateLock), asyncHandler(updateLock));
router.delete('/:lockId', validateParams(params.lockId), requireLockOwner, asyncHandler(deleteLock));

// Factory reset (clears all data but keeps lock - owner only)
router.post('/:lockId/factory-reset', validateParams(params.lockId), requireLockOwner, asyncHandler(factoryResetLock));

// Lock operations
router.post('/:lockId/pair', validateParams(params.lockId), validate(schemas.pairLock), checkLockAccess, asyncHandler(pairLock));
router.post('/:lockId/lock', validateParams(params.lockId), checkLockAccess, requirePermission('lock'), replayProtection, validate(schemas.lockAction), asyncHandler(lockDoor));
router.post('/:lockId/unlock', validateParams(params.lockId), checkLockAccess, requirePermission('unlock'), replayProtection, validate(schemas.lockAction), asyncHandler(unlockDoor));

// Lock status
router.get('/:lockId/status', validateParams(params.lockId), checkLockAccess, asyncHandler(getLockStatus));
router.get('/:lockId/battery', validateParams(params.lockId), checkLockAccess, asyncHandler(getBatteryLevel));

// Activity logging (for Bluetooth actions from mobile app)
router.post('/:lockId/activity', validateParams(params.lockId), validate(schemas.logActivity), checkLockAccess, asyncHandler(logActivity));

// Recovery keys (owner only)
router.get('/:lockId/recovery-keys', validateParams(params.lockId), requireLockOwner, asyncHandler(getRecoveryKeys));

export default router;
