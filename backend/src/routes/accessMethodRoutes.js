import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { checkLockAccess } from '../middleware/lockAccess.js';
import {
  getFingerprints,
  addFingerprint,
  updateFingerprint,
  deleteFingerprint,
  getCards,
  addCard,
  updateCard,
  deleteCard
} from '../controllers/accessMethodController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// =====================================================
// FINGERPRINT ROUTES
// =====================================================

// Get all fingerprints for a lock
router.get(
  '/locks/:lockId/fingerprints',
  checkLockAccess('can_view_logs'),
  getFingerprints
);

// Add a fingerprint
router.post(
  '/locks/:lockId/fingerprints',
  checkLockAccess('can_modify_settings'),
  addFingerprint
);

// Update a fingerprint
router.patch(
  '/locks/:lockId/fingerprints/:fingerprintId',
  checkLockAccess('can_modify_settings'),
  updateFingerprint
);

// Delete a fingerprint
router.delete(
  '/locks/:lockId/fingerprints/:fingerprintId',
  checkLockAccess('can_modify_settings'),
  deleteFingerprint
);

// =====================================================
// IC CARD ROUTES
// =====================================================

// Get all cards for a lock
router.get(
  '/locks/:lockId/cards',
  checkLockAccess('can_view_logs'),
  getCards
);

// Add a card
router.post(
  '/locks/:lockId/cards',
  checkLockAccess('can_modify_settings'),
  addCard
);

// Update a card
router.patch(
  '/locks/:lockId/cards/:cardId',
  checkLockAccess('can_modify_settings'),
  updateCard
);

// Delete a card
router.delete(
  '/locks/:lockId/cards/:cardId',
  checkLockAccess('can_modify_settings'),
  deleteCard
);

export default router;
