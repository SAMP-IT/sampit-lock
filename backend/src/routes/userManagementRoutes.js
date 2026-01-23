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
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// New User Management Routes (Multi-lock support)
// ============================================

// Get all users across all locks the current user manages
router.get('/users/all', getAllUsersForAllLocks);

// Add user to multiple locks at once
router.post('/users/add', addUserToMultipleLocks);

// Remove user from specific locks (selective removal)
router.delete('/users/:userId/locks', removeUserFromMultipleLocks);

// ============================================
// Legacy Lock-specific User Management Routes
// ============================================

// GET users only needs lock access - all users with lock access can view who has access
router.get('/:lockId/users', checkLockAccess, getLockUsers);
router.post('/:lockId/users', checkLockAccess, requirePermission('manage_users'), validate(schemas.addUser), addUserToLock);
router.patch('/:lockId/users/:userId', checkLockAccess, requirePermission('manage_users'), updateUserPermissions);
router.delete('/:lockId/users/:userId', checkLockAccess, requirePermission('manage_users'), removeUserFromLock);

// Access methods management
router.get('/:lockId/users/:userId/access-methods', checkLockAccess, getUserAccessMethods);
router.post('/:lockId/users/:userId/access-methods', checkLockAccess, requirePermission('manage_users'), addAccessMethod);
router.patch('/:lockId/users/:userId/access-methods/:methodId', checkLockAccess, requirePermission('manage_users'), updateAccessMethod);
router.delete('/:lockId/users/:userId/access-methods/:methodId', checkLockAccess, requirePermission('manage_users'), deleteAccessMethod);

// Lock ownership transfer
router.post('/:lockId/transfer', requireLockOwner, transferLockOwnership);

export default router;
