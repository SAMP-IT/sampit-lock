import express from 'express';
import {
  getLockUsers,
  getAllUsersForAllLocks,
  addUserToLock,
  addUserToMultipleLocks,
  updateUserPermissions,
  removeUserFromLock,
  removeUserFromMultipleLocks,
  getUserAccessMethods,
  addAccessMethod,
  updateAccessMethod,
  deleteAccessMethod,
  transferLockOwnership
} from '../controllers/userManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission, requireLockOwner } from '../middleware/rbac.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// New User Management Routes (Multi-lock support)
// ============================================

// Get all users across all locks the current user manages
router.get('/users/all', asyncHandler(getAllUsersForAllLocks));

// Add user to multiple locks at once
router.post('/users/add', validate(schemas.addUser), asyncHandler(addUserToMultipleLocks));

// Remove user from specific locks (selective removal)
router.delete('/users/:userId/locks', validateParams(params.userId), asyncHandler(removeUserFromMultipleLocks));

// ============================================
// Legacy Lock-specific User Management Routes
// ============================================

// GET users only needs lock access - all users with lock access can view who has access
router.get('/:lockId/users', validateParams(params.lockId), checkLockAccess, asyncHandler(getLockUsers));
router.post('/:lockId/users', validateParams(params.lockId), checkLockAccess, requirePermission('manage_users'), validate(schemas.addUser), asyncHandler(addUserToLock));
router.patch('/:lockId/users/:userId', validateParams(params.lockIdAndUserId), checkLockAccess, requirePermission('manage_users'), validate(schemas.updateUserPermissions), asyncHandler(updateUserPermissions));
router.delete('/:lockId/users/:userId', validateParams(params.lockIdAndUserId), checkLockAccess, requirePermission('manage_users'), asyncHandler(removeUserFromLock));

// Access methods management
router.get('/:lockId/users/:userId/access-methods', validateParams(params.lockIdAndUserId), checkLockAccess, asyncHandler(getUserAccessMethods));
router.post('/:lockId/users/:userId/access-methods', validateParams(params.lockIdAndUserId), checkLockAccess, requirePermission('manage_users'), validate(schemas.addAccessMethod), asyncHandler(addAccessMethod));
router.patch('/:lockId/users/:userId/access-methods/:methodId', validateParams(params.lockIdAndMethodId), checkLockAccess, requirePermission('manage_users'), validate(schemas.updateAccessMethod), asyncHandler(updateAccessMethod));
router.delete('/:lockId/users/:userId/access-methods/:methodId', validateParams(params.lockIdAndMethodId), checkLockAccess, requirePermission('manage_users'), asyncHandler(deleteAccessMethod));

// Lock ownership transfer
router.post('/:lockId/transfer', validateParams(params.lockId), requireLockOwner, validate(schemas.transferOwnership), asyncHandler(transferLockOwnership));

export default router;
