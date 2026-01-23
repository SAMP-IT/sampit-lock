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
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All lock routes require authentication
router.use(authenticate);

// Lock CRUD operations
router.get('/', getAllLocks);
router.post('/', validate(schemas.addLock), addLock);

// Lock-specific routes (require lock access)
router.get('/:lockId', checkLockAccess, getLockDetails);
router.patch('/:lockId', checkLockAccess, requirePermission('modify_settings'), validate(schemas.updateLock), updateLock);
router.delete('/:lockId', requireLockOwner, deleteLock);

// Factory reset (clears all data but keeps lock - owner only)
router.post('/:lockId/factory-reset', requireLockOwner, factoryResetLock);

// Lock operations
router.post('/:lockId/pair', checkLockAccess, pairLock);
router.post('/:lockId/lock', checkLockAccess, requirePermission('lock'), validate(schemas.lockAction), lockDoor);
router.post('/:lockId/unlock', checkLockAccess, requirePermission('unlock'), validate(schemas.lockAction), unlockDoor);

// Lock status
router.get('/:lockId/status', checkLockAccess, getLockStatus);
router.get('/:lockId/battery', checkLockAccess, getBatteryLevel);

// Activity logging (for Bluetooth actions from mobile app)
router.post('/:lockId/activity', checkLockAccess, logActivity);

// Recovery keys (owner only)
router.get('/:lockId/recovery-keys', requireLockOwner, getRecoveryKeys);

export default router;
