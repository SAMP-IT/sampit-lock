import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess } from '../middleware/rbac.js';
import {
  getTTLockStatus,
  sendEkey,
  getEkeyList,
  deleteEkey,
  freezeEkey,
  unfreezeEkey
} from '../controllers/ekeyController.js';

const router = express.Router();

/**
 * @route   GET /api/ekeys/status
 * @desc    Check TTLock connection status for the user
 * @access  Private (requires Supabase auth)
 */
router.get('/ekeys/status', authenticate, getTTLockStatus);

/**
 * @route   POST /api/locks/:lockId/ekeys
 * @desc    Send an eKey to a user
 * @access  Private (requires Supabase auth + lock admin access)
 */
router.post('/locks/:lockId/ekeys', authenticate, sendEkey);

/**
 * @route   GET /api/locks/:lockId/ekeys
 * @desc    Get all eKeys for a lock
 * @access  Private (requires Supabase auth + lock access)
 */
router.get('/locks/:lockId/ekeys', authenticate, checkLockAccess, getEkeyList);

/**
 * @route   DELETE /api/ekeys/:keyId
 * @desc    Delete an eKey
 * @access  Private (requires Supabase auth + lock admin access)
 */
router.delete('/ekeys/:keyId', authenticate, deleteEkey);

/**
 * @route   POST /api/ekeys/:keyId/freeze
 * @desc    Freeze (temporarily disable) an eKey
 * @access  Private (requires Supabase auth + lock admin access)
 */
router.post('/ekeys/:keyId/freeze', authenticate, freezeEkey);

/**
 * @route   POST /api/ekeys/:keyId/unfreeze
 * @desc    Unfreeze (re-enable) an eKey
 * @access  Private (requires Supabase auth + lock admin access)
 */
router.post('/ekeys/:keyId/unfreeze', authenticate, unfreezeEkey);

export default router;
