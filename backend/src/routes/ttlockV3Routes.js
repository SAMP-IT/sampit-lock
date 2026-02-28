import express from 'express';
import { authenticateTTLock as authenticate } from '../middleware/ttlockAuth.js';

// Import OAuth controller
import { getAccessToken, refreshAccessToken } from '../controllers/ttlock-cloud-api-v3/oauth.js';

// Import User controller
import { registerUser, resetPassword, getUserList, deleteUser } from '../controllers/ttlock-cloud-api-v3/user.js';

// Import Lock controller
import { initializeLock, getLockList, getLockDetail, deleteLockFromCloud, updateLockConfig, setLockTime, resetLock } from '../controllers/ttlock-cloud-api-v3/lock.js';

// Import Gateway controller
import { getUserId, getLockTime, adjustLockTime, unlockViaGateway, lockViaGateway, getLockOpenState, freezeLock, unfreezeLock, getLockStatus, getGatewayList, getGatewayListByLock, deleteGateway, transferGateway, getGatewayLockList, queryGatewayInitStatus, uploadGatewayDetail, checkGatewayUpgrade, setGatewayUpgradeMode } from '../controllers/ttlock-cloud-api-v3/gateway.js';

// Import IC Card controller
import { getICCardList, addICCard, deleteICCard, clearICCards, changeICCardPeriod } from '../controllers/ttlock-cloud-api-v3/icCard.js';

// Import Fingerprint controller
import { getFingerprintList, addFingerprint, deleteFingerprint, clearFingerprints, changeFingerprintPeriod } from '../controllers/ttlock-cloud-api-v3/fingerprint.js';

// Import Unlock Record controller
import { getUnlockRecords, uploadRecords } from '../controllers/ttlock-cloud-api-v3/unlockRecord.js';

// Import Lock Upgrade controller
import { upgradeCheck, upgradeRecheck } from '../controllers/ttlock-cloud-api-v3/lockUpgrade.js';

// Import QR Code controller
import { getQRCodeList, addQRCode, getQRCodeData, deleteQRCode, clearQRCodes, updateQRCode } from '../controllers/ttlock-cloud-api-v3/qrCode.js';

// Import Wireless Keypad controller
import { addWirelessKeypad, renameWirelessKeypad, deleteWirelessKeypad, getWirelessKeypadsByLock } from '../controllers/ttlock-cloud-api-v3/wirelessKeypad.js';

// Import Ekey controller
import { sendEkey, getEkeyList, getEkey, deleteEkey, freezeEkey, unfreezeEkey, changeEkeyPeriod, authorizeEkey, unauthorizeEkey } from '../controllers/ttlock-cloud-api-v3/ekey.js';

// Import Group controller
import { addGroup, getGroupList, updateGroup, deleteGroup, setLockGroup } from '../controllers/ttlock-cloud-api-v3/group.js';

// Import Passcode controller
import { getPasscode, deletePasscode, changePasscode, addPasscode } from '../controllers/ttlock-cloud-api-v3/passcode.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   POST /api/ttlock-v3/oauth/token
 * @desc    Get access token (OAuth - Resource Owner Password Grant)
 * @access  Private
 */
router.post('/oauth/token', authenticate, asyncHandler(getAccessToken));

/**
 * @route   POST /api/ttlock-v3/oauth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Private
 */
router.post('/oauth/refresh', authenticate, asyncHandler(refreshAccessToken));

/**
 * @route   POST /api/ttlock-v3/user/register
 * @desc    Register a new user in TTLock Cloud
 * @access  Public (no authentication required for registration)
 */
router.post('/user/register', asyncHandler(registerUser));

/**
 * @route   POST /api/ttlock-v3/user/reset-password
 * @desc    Reset user password in TTLock Cloud
 * @access  Public (no authentication required for password reset)
 */
router.post('/user/reset-password', asyncHandler(resetPassword));

/**
 * @route   POST /api/ttlock-v3/user/list
 * @desc    Get list of users registered under this app
 * @access  Private (requires authentication)
 */
router.post('/user/list', authenticate, asyncHandler(getUserList));

/**
 * @route   POST /api/ttlock-v3/user/delete
 * @desc    Delete a user from TTLock Cloud
 * @access  Private (requires authentication)
 */
router.post('/user/delete', authenticate, asyncHandler(deleteUser));

/**
 * @route   POST /api/ttlock-v3/lock/initialize
 * @desc    Initialize a lock after adding via SDK (creates admin ekey)
 * @access  Private (requires access token in request body)
 */
router.post('/lock/initialize', authenticate, asyncHandler(initializeLock));

/**
 * @route   POST /api/ttlock-v3/lock/list
 * @desc    Get the lock list of an account with pagination
 * @access  Private (requires access token in request body)
 */
router.post('/lock/list', authenticate, asyncHandler(getLockList));

/**
 * @route   POST /api/ttlock-v3/lock/detail
 * @desc    Get detailed information about a specific lock
 * @access  Private (requires access token in request body)
 */
router.post('/lock/detail', authenticate, asyncHandler(getLockDetail));

/**
 * @route   POST /api/ttlock-v3/lock/delete
 * @desc    Delete a lock from TTLock Cloud (all ekeys and passcodes will be deleted)
 * @access  Private (requires authentication)
 */
router.post('/lock/delete', authenticate, asyncHandler(deleteLockFromCloud));

/**
 * @route   POST /api/ttlock-v3/gateway/get-uid
 * @desc    Get the user ID associated with an access token
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/get-uid', authenticate, asyncHandler(getUserId));

/**
 * @route   POST /api/ttlock-v3/gateway/query-date
 * @desc    Get the current time of a lock via WiFi
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/query-date', authenticate, asyncHandler(getLockTime));

/**
 * @route   POST /api/ttlock-v3/gateway/update-date
 * @desc    Adjust/synchronize the time of a lock via WiFi
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/update-date', authenticate, asyncHandler(adjustLockTime));

/**
 * @route   POST /api/ttlock-v3/gateway/unlock
 * @desc    Unlock a lock via WiFi gateway
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/unlock', authenticate, asyncHandler(unlockViaGateway));

/**
 * @route   POST /api/ttlock-v3/gateway/lock
 * @desc    Lock a lock via WiFi gateway
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/lock', authenticate, asyncHandler(lockViaGateway));

/**
 * @route   POST /api/ttlock-v3/gateway/query-open-state
 * @desc    Get the open state of a lock via WiFi gateway
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/query-open-state', authenticate, asyncHandler(getLockOpenState));

/**
 * @route   POST /api/ttlock-v3/gateway/freeze
 * @desc    Freeze a lock via WiFi gateway (disables all unlocking methods)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/freeze', authenticate, asyncHandler(freezeLock));

/**
 * @route   POST /api/ttlock-v3/gateway/unfreeze
 * @desc    Unfreeze a lock via WiFi gateway (restores all unlocking methods)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/unfreeze', authenticate, asyncHandler(unfreezeLock));

/**
 * @route   POST /api/ttlock-v3/gateway/query-status
 * @desc    Get the status of a lock via WiFi gateway (frozen or not)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/query-status', authenticate, asyncHandler(getLockStatus));

/**
 * @route   POST /api/ttlock-v3/gateway/list
 * @desc    Get the gateway list of an account with pagination
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/list', authenticate, asyncHandler(getGatewayList));

/**
 * @route   POST /api/ttlock-v3/gateway/list-by-lock
 * @desc    Get the gateway list of a specific lock
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/list-by-lock', authenticate, asyncHandler(getGatewayListByLock));

/**
 * @route   POST /api/ttlock-v3/gateway/delete
 * @desc    Delete a gateway from the account
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/delete', authenticate, asyncHandler(deleteGateway));

/**
 * @route   POST /api/ttlock-v3/gateway/transfer
 * @desc    Transfer gateway(s) to another user (permanent)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/transfer', authenticate, asyncHandler(transferGateway));

/**
 * @route   POST /api/ttlock-v3/gateway/list-lock
 * @desc    Get the lock list of a specific gateway
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/list-lock', authenticate, asyncHandler(getGatewayLockList));

/**
 * @route   POST /api/ttlock-v3/gateway/is-init-success
 * @desc    Query if gateway initialization was successful (within 3 minutes of SDK add)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/is-init-success', authenticate, asyncHandler(queryGatewayInitStatus));

/**
 * @route   POST /api/ttlock-v3/gateway/upload-detail
 * @desc    Upload firmware and network info after gateway is successfully added
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/upload-detail', authenticate, asyncHandler(uploadGatewayDetail));

/**
 * @route   POST /api/ttlock-v3/gateway/upgrade-check
 * @desc    Check if firmware upgrade is available for a G2 gateway
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/upgrade-check', authenticate, asyncHandler(checkGatewayUpgrade));

/**
 * @route   POST /api/ttlock-v3/gateway/set-upgrade-mode
 * @desc    Set gateway into upgrade mode (gateway cannot accept commands during upgrade)
 * @access  Private (requires access token in request body)
 */
router.post('/gateway/set-upgrade-mode', authenticate, asyncHandler(setGatewayUpgradeMode));

/**
 * @route   POST /api/ttlock-v3/ic-card/list
 * @desc    Get all IC cards of a lock with pagination
 * @access  Private (requires access token in request body)
 */
router.post('/ic-card/list', authenticate, asyncHandler(getICCardList));

/**
 * @route   POST /api/ttlock-v3/ic-card/add
 * @desc    Add IC card after calling SDK method (bluetooth) or directly (gateway)
 * @access  Private (requires access token in request body)
 */
router.post('/ic-card/add', authenticate, asyncHandler(addICCard));

/**
 * @route   POST /api/ttlock-v3/ic-card/delete
 * @desc    Delete IC card after calling SDK method (bluetooth) or directly (gateway)
 * @access  Private (requires access token in request body)
 */
router.post('/ic-card/delete', authenticate, asyncHandler(deleteICCard));

/**
 * @route   POST /api/ttlock-v3/ic-card/clear
 * @desc    Clear all IC cards from a lock after calling SDK method
 * @access  Private (requires access token in request body)
 */
router.post('/ic-card/clear', authenticate, asyncHandler(clearICCards));

/**
 * @route   POST /api/ttlock-v3/ic-card/change-period
 * @desc    Change IC card validity period via gateway or bluetooth
 * @access  Private (requires access token in request body)
 */
router.post('/ic-card/change-period', authenticate, asyncHandler(changeICCardPeriod));

/**
 * @route   POST /api/ttlock-v3/fingerprint/list
 * @desc    Get all fingerprints of a lock with pagination
 * @access  Private (requires access token in request body)
 */
router.post('/fingerprint/list', authenticate, asyncHandler(getFingerprintList));

/**
 * @route   POST /api/ttlock-v3/fingerprint/add
 * @desc    Add fingerprint after it has been added to the lock
 * @access  Private (requires access token in request body)
 */
router.post('/fingerprint/add', authenticate, asyncHandler(addFingerprint));

/**
 * @route   POST /api/ttlock-v3/fingerprint/delete
 * @desc    Delete fingerprint after it has been deleted from the lock
 * @access  Private (requires access token in request body)
 */
router.post('/fingerprint/delete', authenticate, asyncHandler(deleteFingerprint));

/**
 * @route   POST /api/ttlock-v3/fingerprint/clear
 * @desc    Clear all fingerprints from a lock
 * @access  Private (requires access token in request body)
 */
router.post('/fingerprint/clear', authenticate, asyncHandler(clearFingerprints));

/**
 * @route   POST /api/ttlock-v3/fingerprint/change-period
 * @desc    Change the validity period of a fingerprint
 * @access  Private (requires access token in request body)
 */
router.post('/fingerprint/change-period', authenticate, asyncHandler(changeFingerprintPeriod));

/**
 * @route   POST /api/ttlock-v3/unlock-record/list
 * @desc    Get unlock records of a lock with pagination and optional date filtering
 * @access  Private (requires access token in request body)
 */
router.post('/unlock-record/list', authenticate, asyncHandler(getUnlockRecords));

/**
 * @route   POST /api/ttlock-v3/unlock-record/upload
 * @desc    Upload records stored in lock (read from SDK)
 * @access  Private (requires access token in request body)
 */
router.post('/unlock-record/upload', authenticate, asyncHandler(uploadRecords));

/**
 * @route   POST /api/ttlock-v3/lock/upgrade-check
 * @desc    Check if there is any upgrade available for a lock
 * @access  Private (requires access token in request body)
 */
router.post('/lock/upgrade-check', authenticate, asyncHandler(upgradeCheck));

/**
 * @route   POST /api/ttlock-v3/lock/upgrade-recheck
 * @desc    Recheck upgrade availability with lock data from SDK
 * @access  Private (requires access token in request body)
 */
router.post('/lock/upgrade-recheck', authenticate, asyncHandler(upgradeRecheck));

/**
 * @route   POST /api/ttlock-v3/qr-code/list
 * @desc    Get all QR codes of a lock with pagination
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/list', authenticate, asyncHandler(getQRCodeList));

/**
 * @route   POST /api/ttlock-v3/qr-code/add
 * @desc    Add a QR code to a lock
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/add', authenticate, asyncHandler(addQRCode));

/**
 * @route   POST /api/ttlock-v3/qr-code/get-data
 * @desc    Get QR code data including qrCodeContent for generating QR image
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/get-data', authenticate, asyncHandler(getQRCodeData));

/**
 * @route   POST /api/ttlock-v3/qr-code/delete
 * @desc    Delete a QR code from the lock
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/delete', authenticate, asyncHandler(deleteQRCode));

/**
 * @route   POST /api/ttlock-v3/qr-code/clear
 * @desc    Clear all QR codes from a lock
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/clear', authenticate, asyncHandler(clearQRCodes));

/**
 * @route   POST /api/ttlock-v3/qr-code/update
 * @desc    Update QR code name, validity period, or cyclic configuration
 * @access  Private (requires access token in request body)
 */
router.post('/qr-code/update', authenticate, asyncHandler(updateQRCode));

/**
 * @route   POST /api/ttlock-v3/wireless-keypad/add
 * @desc    Add a wireless keypad to a lock
 * @access  Private (requires access token in request body)
 */
router.post('/wireless-keypad/add', authenticate, asyncHandler(addWirelessKeypad));

/**
 * @route   POST /api/ttlock-v3/wireless-keypad/rename
 * @desc    Rename a wireless keypad
 * @access  Private (requires access token in request body)
 */
router.post('/wireless-keypad/rename', authenticate, asyncHandler(renameWirelessKeypad));

/**
 * @route   POST /api/ttlock-v3/wireless-keypad/delete
 * @desc    Delete a wireless keypad
 * @access  Private (requires access token in request body)
 */
router.post('/wireless-keypad/delete', authenticate, asyncHandler(deleteWirelessKeypad));

/**
 * @route   POST /api/ttlock-v3/wireless-keypad/list-by-lock
 * @desc    Get all wireless keypads for a specific lock
 * @access  Private (requires access token in request body)
 */
router.post('/wireless-keypad/list-by-lock', authenticate, asyncHandler(getWirelessKeypadsByLock));

/**
 * @route   POST /api/ttlock-v3/ekey/send
 * @desc    Send ekey to a user (permanent or timed access)
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/send', authenticate, asyncHandler(sendEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/list
 * @desc    Get ekey list with pagination and optional filters
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/list', authenticate, asyncHandler(getEkeyList));

/**
 * @route   POST /api/ttlock-v3/ekey/get
 * @desc    Get one ekey of an account for a specific lock
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/get', authenticate, asyncHandler(getEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/delete
 * @desc    Delete ekey (WARNING: deleting admin ekey removes ALL access)
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/delete', authenticate, asyncHandler(deleteEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/freeze
 * @desc    Freeze ekey (temporarily disable access)
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/freeze', authenticate, asyncHandler(freezeEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/unfreeze
 * @desc    Unfreeze ekey (re-enable access)
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/unfreeze', authenticate, asyncHandler(unfreezeEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/change-period
 * @desc    Change the validity period of an ekey
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/change-period', authenticate, asyncHandler(changeEkeyPeriod));

/**
 * @route   POST /api/ttlock-v3/ekey/authorize
 * @desc    Grant admin rights to common user ekey
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/authorize', authenticate, asyncHandler(authorizeEkey));

/**
 * @route   POST /api/ttlock-v3/ekey/unauthorize
 * @desc    Remove admin rights from common user ekey
 * @access  Private (requires access token in request body)
 */
router.post('/ekey/unauthorize', authenticate, asyncHandler(unauthorizeEkey));

/**
 * @route   POST /api/ttlock-v3/group/add
 * @desc    Create a new group for organizing locks and ekeys
 * @access  Private (requires access token in request body)
 */
router.post('/group/add', authenticate, asyncHandler(addGroup));

/**
 * @route   POST /api/ttlock-v3/group/list
 * @desc    Get all groups for an account
 * @access  Private (requires access token in request body)
 */
router.post('/group/list', authenticate, asyncHandler(getGroupList));

/**
 * @route   POST /api/ttlock-v3/group/update
 * @desc    Update the name of a group
 * @access  Private (requires access token in request body)
 */
router.post('/group/update', authenticate, asyncHandler(updateGroup));

/**
 * @route   POST /api/ttlock-v3/group/delete
 * @desc    Delete a group (locks and ekeys become ungrouped)
 * @access  Private (requires access token in request body)
 */
router.post('/group/delete', authenticate, asyncHandler(deleteGroup));

/**
 * @route   POST /api/ttlock-v3/lock/set-group
 * @desc    Assign or reassign a lock to a specific group
 * @access  Private (requires access token in request body)
 */
router.post('/lock/set-group', authenticate, asyncHandler(setLockGroup));

/**
 * @route   POST /api/ttlock-v3/passcode/get
 * @desc    Get a passcode (create/retrieve passcode for a lock)
 * @access  Private (requires access token in request body)
 */
router.post('/passcode/get', authenticate, asyncHandler(getPasscode));

/**
 * @route   POST /api/ttlock-v3/passcode/delete
 * @desc    Delete one passcode from a lock
 * @access  Private (requires access token in request body)
 */
router.post('/passcode/delete', authenticate, asyncHandler(deletePasscode));

/**
 * @route   POST /api/ttlock-v3/passcode/change
 * @desc    Change an existing passcode (name, value, or validity period)
 * @access  Private (requires access token in request body)
 */
router.post('/passcode/change', authenticate, asyncHandler(changePasscode));

/**
 * @route   POST /api/ttlock-v3/passcode/add
 * @desc    Add a custom passcode to a lock (you specify the exact passcode)
 * @access  Private (requires access token in request body)
 */
router.post('/passcode/add', authenticate, asyncHandler(addPasscode));

/**
 * @route   POST /api/ttlock-v3/lock/config
 * @desc    Update lock configuration settings (door direction, anti-peep, etc.)
 * @access  Private (requires authentication)
 */
router.post('/lock/config', authenticate, asyncHandler(updateLockConfig));

/**
 * @route   POST /api/ttlock-v3/lock/time
 * @desc    Sync lock time with server (requires gateway)
 * @access  Private (requires authentication)
 */
router.post('/lock/time', authenticate, asyncHandler(setLockTime));

/**
 * @route   POST /api/ttlock-v3/lock/reset
 * @desc    Factory reset lock via gateway
 * @access  Private (requires authentication)
 */
router.post('/lock/reset', authenticate, asyncHandler(resetLock));

export default router;
