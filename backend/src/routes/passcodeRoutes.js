import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import {
  savePasscode,
  getPasscodes,
  deletePasscode
} from '../controllers/localPasscodeController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   POST /api/locks/:lockId/passcodes
 * @desc    Save a passcode created via Bluetooth
 * @access  Private (requires auth + lock access)
 */
router.post('/locks/:lockId/passcodes', authenticate, validateParams(params.lockId), validate(schemas.addPasscode), asyncHandler(savePasscode));

/**
 * @route   GET /api/locks/:lockId/passcodes
 * @desc    Get all passcodes for a lock
 * @access  Private (requires auth + lock access)
 */
router.get('/locks/:lockId/passcodes', authenticate, validateParams(params.lockId), asyncHandler(getPasscodes));

/**
 * @route   DELETE /api/locks/:lockId/passcodes/:passcodeId
 * @desc    Delete (deactivate) a passcode
 * @access  Private (requires auth + admin access)
 */
router.delete('/locks/:lockId/passcodes/:passcodeId', authenticate, validateParams(params.passcodeId), asyncHandler(deletePasscode));

export default router;
