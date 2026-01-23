import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  savePasscode,
  getPasscodes,
  deletePasscode
} from '../controllers/localPasscodeController.js';

const router = express.Router();

/**
 * @route   POST /api/locks/:lockId/passcodes
 * @desc    Save a passcode created via Bluetooth
 * @access  Private (requires auth + lock access)
 */
router.post('/locks/:lockId/passcodes', authenticate, savePasscode);

/**
 * @route   GET /api/locks/:lockId/passcodes
 * @desc    Get all passcodes for a lock
 * @access  Private (requires auth + lock access)
 */
router.get('/locks/:lockId/passcodes', authenticate, getPasscodes);

/**
 * @route   DELETE /api/locks/:lockId/passcodes/:passcodeId
 * @desc    Delete (deactivate) a passcode
 * @access  Private (requires auth + admin access)
 */
router.delete('/locks/:lockId/passcodes/:passcodeId', authenticate, deletePasscode);

export default router;
