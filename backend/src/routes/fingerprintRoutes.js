import express from 'express';
import {
  listFingerprints,
  addFingerprint,
  deleteFingerprint,
  updateFingerprintPeriod
} from '../controllers/fingerprintController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All fingerprint routes require authentication
router.use(authenticate);

// Fingerprint CRUD operations
// GET /locks/:lockId/fingerprints - List all fingerprints for a lock
router.get('/:lockId/fingerprints', validateParams(params.lockId), checkLockAccess, asyncHandler(listFingerprints));

// POST /locks/:lockId/fingerprints - Add new fingerprint to lock
router.post('/:lockId/fingerprints', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.addFingerprint), asyncHandler(addFingerprint));

// PATCH /locks/:lockId/fingerprints/:fingerprintId - Update fingerprint validity period
router.patch('/:lockId/fingerprints/:fingerprintId', validateParams(params.fingerprintId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.updateFingerprint), asyncHandler(updateFingerprintPeriod));

// DELETE /locks/:lockId/fingerprints/:fingerprintId - Delete fingerprint from lock
router.delete('/:lockId/fingerprints/:fingerprintId', validateParams(params.fingerprintId), checkLockAccess, requirePermission('modify_settings'), asyncHandler(deleteFingerprint));

export default router;
