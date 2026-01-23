/**
 * Utility functions for displaying lock information consistently across the app
 */

/**
 * Model number patterns to detect TTLock model names that should be hidden
 * These patterns match common TTLock device naming conventions
 */
const MODEL_NUMBER_PATTERNS = [
  /^[A-Z]+\d*_/i,                    // M201_, P6PRO_, S31_
  /^[A-Z0-9]+_[A-Z0-9]+$/i,          // LOCK_12345678
  /^[A-Z]{1,3}\d+[A-Z]*_/i,          // M201_, S31PRO_
  /^[A-F0-9]{2}[:\-][A-F0-9]{2}/i,   // MAC address style (AA:BB:CC or AA-BB-CC)
  /^[A-Z0-9]{12,}$/i,                // Long alphanumeric codes (12+ chars)
  /^New Lock$/i,                      // Default name from pairing
  /^TTLock/i,                         // TTLock branded names
  /^M\d+_/i,                          // M201_, M300_
  /^S\d+/i,                           // S31, S50
  /^P\d+/i,                           // P6, P6PRO
];

/**
 * Check if a name looks like a TTLock model number or device identifier
 * @param {string} name - The lock name to check
 * @returns {boolean} - True if the name appears to be a model number
 */
export const isModelNumber = (name) => {
  if (!name || typeof name !== 'string') return true;
  return MODEL_NUMBER_PATTERNS.some(pattern => pattern.test(name.trim()));
};

/**
 * Get the display name for a lock, hiding model numbers
 * @param {object} lock - Lock object with name and location properties
 * @param {string} fallback - Fallback name if no valid name found (default: 'My Lock')
 * @returns {string} - The friendly display name
 */
export const getLockDisplayName = (lock, fallback = 'My Lock') => {
  if (!lock) return fallback;

  const name = lock.name;

  // If we have a custom name that's not a model number, use it
  if (name && !isModelNumber(name)) {
    return name;
  }

  // Return fallback
  return fallback;
};

/**
 * Get a friendly name for activity logs (shorter version)
 * @param {string} lockName - The lock name from activity log
 * @returns {string} - Friendly display name
 */
export const getFriendlyLockNameForActivity = (lockName) => {
  if (!lockName) return 'Lock';
  if (isModelNumber(lockName)) {
    return 'Lock';
  }
  return lockName;
};

export default {
  isModelNumber,
  getLockDisplayName,
  getFriendlyLockNameForActivity,
};
