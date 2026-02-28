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
import { validate, validateParams, schemas, params } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication and lock access
router.use(authenticate);

// Settings routes
router.get('/:lockId/settings', validateParams(params.lockId), checkLockAccess, asyncHandler(getLockSettings));
router.patch('/:lockId/settings', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.updateLockSettings), asyncHandler(updateLockSettings));

// Specific setting toggles
router.post('/:lockId/settings/auto-lock', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.autoLockSetting), asyncHandler(toggleAutoLock));
router.post('/:lockId/settings/passage-mode', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.booleanSetting), asyncHandler(togglePassageMode));
router.post('/:lockId/settings/sound', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.booleanSetting), asyncHandler(updateSoundSettings));
router.post('/:lockId/settings/led', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.booleanSetting), asyncHandler(updateLedSettings));
router.post('/:lockId/settings/security', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.booleanSetting), asyncHandler(updateSecuritySettings));
router.post('/:lockId/settings/one-touch', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.booleanSetting), asyncHandler(toggleOneTouchLocking));

// Remote unlock setting - Lock level (affects all users)
router.patch('/:lockId/remote-unlock', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), validate(schemas.remoteUnlockSetting), asyncHandler(updateRemoteUnlockSetting));

// Firmware management
router.get('/:lockId/firmware', validateParams(params.lockId), checkLockAccess, asyncHandler(getFirmwareInfo));
router.post('/:lockId/firmware/update', validateParams(params.lockId), checkLockAccess, requirePermission('modify_settings'), asyncHandler(updateFirmware));

export default router;
