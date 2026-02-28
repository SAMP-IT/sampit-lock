import express from 'express';
import {
  emergencyUnlock,
  getTrustedContacts,
  addTrustedContact,
  updateTrustedContact,
  deleteTrustedContact,
  sendEmergencyAlert
} from '../controllers/emergencyController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess } from '../middleware/rbac.js';
import replayProtection from '../utils/replayProtection.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Emergency unlock (replay-protected)
router.post('/:lockId/emergency/unlock', checkLockAccess, replayProtection, asyncHandler(emergencyUnlock));
router.post('/:lockId/emergency/alert', checkLockAccess, asyncHandler(sendEmergencyAlert));

// Trusted contacts management
router.get('/trusted-contacts', asyncHandler(getTrustedContacts));
router.post('/trusted-contacts', asyncHandler(addTrustedContact));
router.patch('/trusted-contacts/:contactId', asyncHandler(updateTrustedContact));
router.delete('/trusted-contacts/:contactId', asyncHandler(deleteTrustedContact));

export default router;
