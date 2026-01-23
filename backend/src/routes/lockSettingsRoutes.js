import express from 'express';
import {
  getLockSettings,
  updateLockSettings,
  toggleAutoLock,
  togglePassageMode,
  updateSoundSettings,
  updateLedSettings,
  updateSecuritySettings,
  toggleOneTouchLocking,
  getFirmwareInfo,
  updateFirmware,
  updateRemoteUnlockSetting
} from '../controllers/lockSettingsController.js';
import { authenticate } from '../middleware/auth.js';
import { checkLockAccess, requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// All routes require authentication and lock access
router.use(authenticate);

// Settings routes
router.get('/:lockId/settings', checkLockAccess, getLockSettings);
router.patch('/:lockId/settings', checkLockAccess, requirePermission('modify_settings'), updateLockSettings);

// Specific setting toggles
router.post('/:lockId/settings/auto-lock', checkLockAccess, requirePermission('modify_settings'), toggleAutoLock);
router.post('/:lockId/settings/passage-mode', checkLockAccess, requirePermission('modify_settings'), togglePassageMode);
router.post('/:lockId/settings/sound', checkLockAccess, requirePermission('modify_settings'), updateSoundSettings);
router.post('/:lockId/settings/led', checkLockAccess, requirePermission('modify_settings'), updateLedSettings);
router.post('/:lockId/settings/security', checkLockAccess, requirePermission('modify_settings'), updateSecuritySettings);
router.post('/:lockId/settings/one-touch', checkLockAccess, requirePermission('modify_settings'), toggleOneTouchLocking);

// Remote unlock setting - Lock level (affects all users)
router.patch('/:lockId/remote-unlock', checkLockAccess, requirePermission('modify_settings'), updateRemoteUnlockSetting);

// Firmware management
router.get('/:lockId/firmware', checkLockAccess, getFirmwareInfo);
router.post('/:lockId/firmware/update', checkLockAccess, requirePermission('modify_settings'), updateFirmware);

export default router;
