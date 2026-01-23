import express from 'express';
import {
  listICCards,
  addICCard,
  deleteICCard,
  updateICCardPeriod
} from '../controllers/icCardController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// All IC card routes require authentication
router.use(authenticate);

// IC Card CRUD operations
// GET /locks/:lockId/cards - List all IC cards for a lock
router.get('/:lockId/cards', checkLockAccess, listICCards);

// POST /locks/:lockId/cards - Add new IC card to lock
router.post('/:lockId/cards', checkLockAccess, requirePermission('modify_settings'), addICCard);

// PATCH /locks/:lockId/cards/:cardId - Update IC card validity period
router.patch('/:lockId/cards/:cardId', checkLockAccess, requirePermission('modify_settings'), updateICCardPeriod);

// DELETE /locks/:lockId/cards/:cardId - Delete IC card from lock
router.delete('/:lockId/cards/:cardId', checkLockAccess, requirePermission('modify_settings'), deleteICCard);

export default router;
