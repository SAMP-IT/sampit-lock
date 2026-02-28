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
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import replayProtection from '../utils/replayProtection.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Emergency unlock (replay-protected)
router.post('/:lockId/emergency/unlock', validateParams(params.lockId), checkLockAccess, replayProtection, validate(schemas.emergencyUnlock), asyncHandler(emergencyUnlock));
router.post('/:lockId/emergency/alert', validateParams(params.lockId), checkLockAccess, validate(schemas.emergencyAlert), asyncHandler(sendEmergencyAlert));

// Trusted contacts management
router.get('/trusted-contacts', asyncHandler(getTrustedContacts));
router.post('/trusted-contacts', validate(schemas.addTrustedContact), asyncHandler(addTrustedContact));
router.patch('/trusted-contacts/:contactId', validateParams(params.contactId), validate(schemas.updateTrustedContact), asyncHandler(updateTrustedContact));
router.delete('/trusted-contacts/:contactId', validateParams(params.contactId), asyncHandler(deleteTrustedContact));

export default router;
