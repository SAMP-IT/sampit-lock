import express from 'express';
import {
  listICCards,
  addICCard,
  deleteICCard,
  updateICCardPeriod
} from '../controllers/icCardController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All IC card routes require authentication
router.use(authenticate);

// IC Card CRUD operations
// GET /locks/:lockId/cards - List all IC cards for a lock
router.get('/:lockId/cards', validateParams(params.lockId), checkLockAccess, asyncHandler(listICCards));

// POST /locks/:lockId/cards - Add new IC card to lock
router.post('/:lockId/cards', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.addICCard), asyncHandler(addICCard));

// PATCH /locks/:lockId/cards/:cardId - Update IC card validity period
router.patch('/:lockId/cards/:cardId', validateParams(params.cardId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.updateICCard), asyncHandler(updateICCardPeriod));

// DELETE /locks/:lockId/cards/:cardId - Delete IC card from lock
router.delete('/:lockId/cards/:cardId', validateParams(params.cardId), checkLockAccess, requirePermission('modify_settings'), asyncHandler(deleteICCard));

export default router;
