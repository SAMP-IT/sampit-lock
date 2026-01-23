import express from 'express';
import {
  listFingerprints,
  addFingerprint,
  deleteFingerprint,
  updateFingerprintPeriod
} from '../controllers/fingerprintController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// All fingerprint routes require authentication
router.use(authenticate);

// Fingerprint CRUD operations
// GET /locks/:lockId/fingerprints - List all fingerprints for a lock
router.get('/:lockId/fingerprints', checkLockAccess, listFingerprints);

// POST /locks/:lockId/fingerprints - Add new fingerprint to lock
router.post('/:lockId/fingerprints', checkLockAccess, requirePermission('modify_settings'), addFingerprint);

// PATCH /locks/:lockId/fingerprints/:fingerprintId - Update fingerprint validity period
router.patch('/:lockId/fingerprints/:fingerprintId', checkLockAccess, requirePermission('modify_settings'), updateFingerprintPeriod);

// DELETE /locks/:lockId/fingerprints/:fingerprintId - Delete fingerprint from lock
router.delete('/:lockId/fingerprints/:fingerprintId', checkLockAccess, requirePermission('modify_settings'), deleteFingerprint);

export default router;
