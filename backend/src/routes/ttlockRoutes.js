import express from 'express';
import {
  getTTLockStatus,
  getTTLockToken,
  importLocks,
  syncLockBluetoothData,
  controlLock
} from '../controllers/ttlockController.js';
import {
  createCloudPasscode,
  getCloudPasscodes,
  deleteCloudPasscode
} from '../controllers/passcodeController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

console.log('🟣 [TTLOCK-ROUTES] Router initialized, about to add authenticate middleware');

// All routes require authentication
router.use((req, res, next) => {
  console.log('🟣 [TTLOCK-ROUTES] Middleware running for path:', req.path);
  console.log('🟣 [TTLOCK-ROUTES] Calling authenticate...');
  return authenticate(req, res, next);
});

// NOTE: TTLock integration is SECONDARY to Supabase auth
// Flow: 1) User signs up/logs in with Supabase (email/password)
//       2) User optionally links TTLock account to import cloud locks
//       3) TTLock tokens encrypted and stored in database
// See AUTHENTICATION_FLOW.md for complete details

/**
 * @route   GET /api/ttlock/status
 * @desc    Get TTLock account connection status
 * @access  Private
 */
router.get('/status', asyncHandler(getTTLockStatus));

/**
 * @route   GET /api/ttlock/token
 * @desc    Get decrypted TTLock access token
 * @access  Private
 */
router.get('/token', asyncHandler(getTTLockToken));

/**
 * @route   POST /api/ttlock/import-locks
 * @desc    Import locks from TTLock Cloud to our database
 * @access  Private
 */
router.post('/import-locks', asyncHandler(importLocks));

/**
 * @route   POST /api/ttlock/sync-lock-data
 * @desc    Sync Bluetooth data for existing locks from TTLock Cloud
 * @access  Private
 */
router.post('/sync-lock-data', asyncHandler(syncLockBluetoothData));

/**
 * @route   POST /api/ttlock/lock/:lockId/control
 * @desc    Hybrid lock control (Cloud API with Bluetooth fallback)
 * @access  Private
 */
router.post('/lock/:lockId/control', validateParams(params.lockId), validate(schemas.ttlockControl), asyncHandler(controlLock));

/**
 * @route   POST /api/ttlock/lock/:lockId/passcodes
 * @desc    Create passcode via TTLock Cloud API (requires gateway)
 * @access  Private
 * @body    { passcode, type: 'one_time'|'permanent'|'timed', name?, startDate?, endDate?, validHours? }
 */
router.post('/lock/:lockId/passcodes', validateParams(params.lockId), validate(schemas.ttlockPasscode), asyncHandler(createCloudPasscode));

/**
 * @route   GET /api/ttlock/lock/:lockId/passcodes
 * @desc    Get all passcodes from TTLock Cloud
 * @access  Private
 */
router.get('/lock/:lockId/passcodes', validateParams(params.lockId), asyncHandler(getCloudPasscodes));

/**
 * @route   DELETE /api/ttlock/lock/:lockId/passcodes/:passcodeId
 * @desc    Delete passcode via TTLock Cloud API
 * @access  Private
 */
router.delete('/lock/:lockId/passcodes/:passcodeId', validateParams(params.passcodeId), asyncHandler(deleteCloudPasscode));

export default router;
