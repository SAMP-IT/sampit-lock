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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Emergency unlock
router.post('/:lockId/emergency/unlock', checkLockAccess, emergencyUnlock);
router.post('/:lockId/emergency/alert', checkLockAccess, sendEmergencyAlert);

// Trusted contacts management
router.get('/trusted-contacts', getTrustedContacts);
router.post('/trusted-contacts', addTrustedContact);
router.patch('/trusted-contacts/:contactId', updateTrustedContact);
router.delete('/trusted-contacts/:contactId', deleteTrustedContact);

export default router;
