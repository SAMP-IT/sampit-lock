/**
 * Hybrid Lock Control Service
 *
 * Provides intelligent lock control with automatic fallback:
 * 1. Try Cloud API if lock has Gateway
 * 2. Fallback to Bluetooth if Cloud API unavailable/fails
 * 3. Direct Bluetooth for locks without Gateway
 */

import { Alert, Platform, Linking } from "react-native";
import { backendApi, logLockActivity, syncActivityFromCloud } from "./api";
import TTLockService from "./ttlockService";

// Record types we skip during sync (already logged by app when user unlocks/locks via app)
const SKIP_SYNC_RECORD_TYPES = new Set([1, 11, 15, 29, 46, 47, 93]);

/**
 * Check Bluetooth state and prompt user to enable it if off.
 * Returns true if Bluetooth is on or user dismissed the prompt.
 * Returns false if we should not proceed with Bluetooth operation.
 */
async function ensureBluetoothEnabled() {
  try {
    const state = await TTLockService.getBluetoothState();
    console.log("[LockControl] Bluetooth state:", state);

    if (state === "poweredOn") {
      return { enabled: true };
    }

    if (state === "poweredOff") {
      // Show prompt to enable Bluetooth
      return new Promise((resolve) => {
        Alert.alert(
          "Bluetooth Required",
          "Bluetooth is turned off. Please enable Bluetooth to control your lock.",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => resolve({ enabled: false, cancelled: true }),
            },
            {
              text: "Open Settings",
              onPress: async () => {
                try {
                  if (Platform.OS === "android") {
                    // Try to open Bluetooth settings directly
                    await Linking.sendIntent(
                      "android.settings.BLUETOOTH_SETTINGS",
                    );
                  } else {
                    // iOS - open the app's settings page (App-Prefs: is a private API that causes App Store rejection)
                    await Linking.openSettings();
                  }
                } catch (e) {
                  // Fallback to general settings
                  try {
                    await Linking.openSettings();
                  } catch (settingsError) {
                    console.warn("Could not open settings:", settingsError);
                  }
                }
                resolve({ enabled: false, openedSettings: true });
              },
            },
          ],
        );
      });
    }

    // For other states (unauthorized, unavailable, unknown), just return true
    // and let the actual Bluetooth operation fail with a more specific error
    return { enabled: true };
  } catch (error) {
    console.warn("[LockControl] Could not check Bluetooth state:", error);
    // If we can't check, proceed anyway and let the operation fail naturally
    return { enabled: true };
  }
}

/**
 * Extract the encrypted lockData string that the TTLock SDK expects.
 * The SDK's controlLock function requires the raw encrypted string returned
 * from initLock, NOT a JSON object.
 *
 * @param {string} ttlockData - The ttlock_data field from database
 * @returns {string|null} - The encrypted lockData string, or null if invalid
 */
function extractLockData(ttlockData) {
  if (!ttlockData) return null;

  // If it's already a plain encrypted string (starts with typical lockData patterns)
  // TTLock lockData strings are typically long base64-like strings
  if (typeof ttlockData === "string" && !ttlockData.startsWith("{")) {
    return ttlockData;
  }

  // Try to parse as JSON and extract the lockData field
  try {
    const parsed = JSON.parse(ttlockData);

    // Case 1: Object from Bluetooth pairing with lockData property
    if (parsed.lockData && typeof parsed.lockData === "string") {
      return parsed.lockData;
    }

    // Case 2: Cloud-imported lock with lockKey/aesKeyStr (cannot use for Bluetooth control)
    // These locks were imported from cloud and don't have the encrypted lockData
    if (parsed.lockKey && parsed.aesKeyStr) {
      console.warn(
        "[LockControl] Lock has cloud keys but no encrypted lockData - Bluetooth control unavailable",
      );
      return null;
    }

    console.warn("[LockControl] Unknown ttlock_data format");
    return null;
  } catch (e) {
    // Not JSON, might be the raw encrypted string
    return ttlockData;
  }
}

class LockControlService {
  constructor() {
    // Track in-progress operations per lock to prevent concurrent requests
    this._operationsInProgress = new Map(); // lockId -> 'lock' | 'unlock'
  }

  /**
   * Check if an operation is already in progress for a lock.
   * Returns the operation name if busy, or null if free.
   */
  getOperationInProgress(lockId) {
    return this._operationsInProgress.get(lockId) || null;
  }

  /**
   * Check if ANY lock operation is in progress (global guard).
   */
  isAnyOperationInProgress() {
    return this._operationsInProgress.size > 0;
  }

  /**
   * Unlock a lock using hybrid control method
   * @param {Object} lock - Lock object from database
   * @returns {Promise<Object>} Result with control method used
   */
  async unlock(lock) {
    // Prevent concurrent operations on the same lock
    const existingOp = this._operationsInProgress.get(lock.id);
    if (existingOp) {
      console.warn(
        `[LockControl] Operation "${existingOp}" already in progress for lock ${lock.id}`,
      );
      return {
        success: false,
        method: "none",
        message: `Lock is busy (${existingOp} in progress). Please wait and try again.`,
        busy: true,
      };
    }

    this._operationsInProgress.set(lock.id, "unlock");
    console.log(`🔓 Attempting to unlock: ${lock.name} (ID: ${lock.id})`);

    try {
      // Check available control methods
      const methods = this.getAvailableControlMethods(lock);

      // If lock has Gateway and TTLock ID, try Cloud API first
      if (methods.cloud) {
        console.log("☁️ Lock has Gateway - trying Cloud API...");

        try {
          const response = await backendApi.post(
            `/ttlock/lock/${lock.id}/control`,
            {
              action: "unlock",
            },
          );

          if (response.data.success) {
            console.log("✅ Unlocked via Cloud API");
            return {
              success: true,
              method: "cloud",
              message: "Unlocked remotely via Cloud API",
              data: response.data,
            };
          }

          // If Cloud API returns bluetooth_required, fallback to Bluetooth
          if (response.data.bluetooth_required) {
            console.log("⚠️ Cloud API requires Bluetooth fallback");
            return await this._unlockViaBluetooth(lock);
          }
        } catch (cloudError) {
          console.warn(
            "⚠️ Cloud API failed, falling back to Bluetooth:",
            cloudError.message,
          );
          // Only fallback to Bluetooth if it's available
          if (methods.bluetooth) {
            return await this._unlockViaBluetooth(lock);
          }
          throw cloudError;
        }
      }

      // Try Bluetooth if available
      if (methods.bluetooth) {
        console.log("📱 Using Bluetooth control");
        return await this._unlockViaBluetooth(lock);
      }

      // No control method available
      return {
        success: false,
        method: "none",
        message: methods.readOnly
          ? "Lock is read-only. Please delete and re-pair via Bluetooth to enable control."
          : "No control method available for this lock.",
        requires_pairing: methods.readOnly,
      };
    } catch (error) {
      console.error("🔴 Unlock failed:", error);

      // Note: _unlockViaBluetooth already logs the failed attempt to the database
      // so we don't log again here to avoid duplicate activity entries

      return {
        success: false,
        method: "none",
        message: error.message || "Failed to unlock",
        error: error,
      };
    } finally {
      this._operationsInProgress.delete(lock.id);
    }
  }

  /**
   * Lock a lock using hybrid control method
   * @param {Object} lock - Lock object from database
   * @returns {Promise<Object>} Result with control method used
   */
  async lock(lock) {
    // Prevent concurrent operations on the same lock
    const existingOp = this._operationsInProgress.get(lock.id);
    if (existingOp) {
      console.warn(
        `[LockControl] Operation "${existingOp}" already in progress for lock ${lock.id}`,
      );
      return {
        success: false,
        method: "none",
        message: `Lock is busy (${existingOp} in progress). Please wait and try again.`,
        busy: true,
      };
    }

    this._operationsInProgress.set(lock.id, "lock");
    console.log(`🔒 Attempting to lock: ${lock.name} (ID: ${lock.id})`);

    try {
      // Check available control methods
      const methods = this.getAvailableControlMethods(lock);

      // If lock has Gateway and TTLock ID, try Cloud API first
      if (methods.cloud) {
        console.log("☁️ Lock has Gateway - trying Cloud API...");

        try {
          const response = await backendApi.post(
            `/ttlock/lock/${lock.id}/control`,
            {
              action: "lock",
            },
          );

          if (response.data.success) {
            console.log("✅ Locked via Cloud API");
            return {
              success: true,
              method: "cloud",
              message: "Locked remotely via Cloud API",
              data: response.data,
            };
          }

          // If Cloud API returns bluetooth_required, fallback to Bluetooth
          if (response.data.bluetooth_required) {
            console.log("⚠️ Cloud API requires Bluetooth fallback");
            return await this._lockViaBluetooth(lock);
          }
        } catch (cloudError) {
          console.warn(
            "⚠️ Cloud API failed, falling back to Bluetooth:",
            cloudError.message,
          );
          // Only fallback to Bluetooth if it's available
          if (methods.bluetooth) {
            return await this._lockViaBluetooth(lock);
          }
          throw cloudError;
        }
      }

      // Try Bluetooth if available
      if (methods.bluetooth) {
        console.log("📱 Using Bluetooth control");
        return await this._lockViaBluetooth(lock);
      }

      // No control method available
      return {
        success: false,
        method: "none",
        message: methods.readOnly
          ? "Lock is read-only. Please delete and re-pair via Bluetooth to enable control."
          : "No control method available for this lock.",
        requires_pairing: methods.readOnly,
      };
    } catch (error) {
      console.error("🔴 Lock failed:", error);

      // Note: _lockViaBluetooth already logs the failed attempt to the database
      // so we don't log again here to avoid duplicate activity entries

      return {
        success: false,
        method: "none",
        message: error.message || "Failed to lock",
        error: error,
      };
    } finally {
      this._operationsInProgress.delete(lock.id);
    }
  }

  /**
   * Get current lock state (locked/unlocked) using hybrid method
   * Prioritizes: 1) Cloud API (if gateway), 2) Bluetooth, 3) Cached from DB
   * @param {Object} lock - Lock object from database
   * @returns {Promise<Object>} { isLocked: boolean, batteryLevel: number, method: string }
   */
  async getLockState(lock) {
    console.log(`📊 Getting lock state for: ${lock.name} (ID: ${lock.id})`);

    const lockMac = lock.ttlock_mac || lock.mac_address;
    const encryptedLockData = extractLockData(lock.ttlock_data);
    const methods = this.getAvailableControlMethods(lock);

    // Try Cloud API first if gateway is available (most reliable for state)
    if (methods.cloud && lock.ttlock_lock_id) {
      try {
        console.log("☁️ Querying lock state via Cloud API...");
        const response = await backendApi.get(
          `/ttlock-v3/gateway/query-open-state`,
          {
            params: { lockId: lock.ttlock_lock_id },
          },
        );

        if (
          response.data?.success &&
          response.data?.data?.state !== undefined
        ) {
          const cloudState = response.data.data.state;
          // TTLock API: 0 = locked, 1 = unlocked, 2 = unknown
          const isLocked = cloudState === 0;
          console.log(
            `✅ Cloud API state: ${isLocked ? "Locked" : cloudState === 1 ? "Unlocked" : "Unknown"}`,
          );

          if (cloudState !== 2) {
            // Update database with real state
            try {
              await backendApi.patch(`/locks/${lock.id}`, {
                is_locked: isLocked,
              });
            } catch (dbErr) {
              console.warn(
                "⚠️ Failed to update lock state in DB:",
                dbErr.message,
              );
            }

            return {
              isLocked,
              batteryLevel:
                response.data.data.electricQuantity || lock.battery_level,
              method: "cloud",
              state: cloudState,
            };
          }
        }
      } catch (cloudError) {
        console.warn("⚠️ Cloud API state query failed:", cloudError.message);
      }
    }

    // Try Bluetooth if available
    if (lockMac && encryptedLockData) {
      try {
        console.log("📱 Querying lock state via Bluetooth...");
        const status = await TTLockService.getLockStatus(encryptedLockData);
        console.log(
          `✅ Bluetooth state: ${status.isLocked ? "Locked" : "Unlocked"}`,
        );

        // Update database with real state
        try {
          await backendApi.patch(`/locks/${lock.id}`, {
            is_locked: status.isLocked,
            battery_level: status.batteryLevel,
          });
        } catch (dbErr) {
          console.warn("⚠️ Failed to update lock state in DB:", dbErr.message);
        }

        return {
          isLocked: status.isLocked,
          batteryLevel: status.batteryLevel,
          method: "bluetooth",
        };
      } catch (btError) {
        console.warn("⚠️ Bluetooth state query failed:", btError.message);
      }
    }

    // Fallback to cached state from database
    console.log("ℹ️ Using cached lock state from database");
    return {
      isLocked: lock.is_locked,
      batteryLevel: lock.battery_level,
      method: "cached",
    };
  }

  /**
   * Query real lock state after lock/unlock operation
   * This ensures UI reflects actual lock state, not optimistic updates
   * @param {Object} lock - Lock object from database
   * @returns {Promise<Object>} Real lock state
   */
  async queryRealState(lock) {
    // Wait a moment for lock to finish processing
    await new Promise((resolve) => setTimeout(resolve, 500));
    return this.getLockState(lock);
  }

  /**
   * Get lock status using hybrid method
   * @param {Object} lock - Lock object from database
   * @returns {Promise<Object>} Lock status
   */
  async getStatus(lock) {
    console.log(`📊 Getting status for: ${lock.name} (ID: ${lock.id})`);

    try {
      // Try Bluetooth first (always works if lock is nearby)
      if (lock.ttlock_mac && lock.ttlock_data) {
        try {
          const encryptedLockData = extractLockData(lock.ttlock_data);
          const status = await TTLockService.getLockStatus(encryptedLockData);
          console.log("✅ Got status via Bluetooth");
          return {
            success: true,
            method: "bluetooth",
            is_locked: status.isLocked,
            battery_level: status.batteryLevel,
            data: status,
          };
        } catch (btError) {
          console.warn("⚠️ Bluetooth status failed:", btError.message);
        }
      }

      // Fallback to database cached status
      console.log("ℹ️ Using cached status from database");
      return {
        success: true,
        method: "cached",
        is_locked: lock.is_locked,
        battery_level: lock.battery_level,
        message: "Using cached status (lock out of Bluetooth range)",
      };
    } catch (error) {
      console.error("🔴 Get status failed:", error);
      return {
        success: false,
        method: "none",
        message: error.message || "Failed to get lock status",
        error: error,
      };
    }
  }

  /**
   * Private method to unlock via Bluetooth
   */
  async _unlockViaBluetooth(lock) {
    console.log("[LockControl] _unlockViaBluetooth called");

    // Check Bluetooth state and prompt to enable if off
    const btCheck = await ensureBluetoothEnabled();
    if (!btCheck.enabled) {
      if (btCheck.openedSettings) {
        return {
          success: false,
          method: "bluetooth",
          message: "Please enable Bluetooth and try again.",
          bluetooth_off: true,
        };
      }
      return {
        success: false,
        method: "bluetooth",
        message: "Bluetooth is required for this operation.",
        bluetooth_off: true,
        cancelled: btCheck.cancelled,
      };
    }

    console.log(
      "[LockControl] Lock object:",
      JSON.stringify({
        id: lock?.id,
        name: lock?.name,
        ttlock_mac: lock?.ttlock_mac,
        mac_address: lock?.mac_address,
        ttlock_data_type: typeof lock?.ttlock_data,
        ttlock_data_length: lock?.ttlock_data?.length,
      }),
    );

    // Support both field names: ttlock_mac (from pairing) and mac_address (from database)
    const lockMac = lock.ttlock_mac || lock.mac_address;

    if (!lockMac) {
      console.error("[LockControl] No MAC address found");
      throw new Error("Lock has no Bluetooth MAC address");
    }

    // Extract the encrypted lockData string from ttlock_data
    let encryptedLockData = null;
    try {
      encryptedLockData = extractLockData(lock.ttlock_data);
      console.log(
        "[LockControl] Extracted lockData:",
        encryptedLockData
          ? `${encryptedLockData.substring(0, 50)}... (len=${encryptedLockData.length})`
          : "null",
      );
    } catch (extractError) {
      console.error("[LockControl] extractLockData failed:", extractError);
      throw new Error(`Failed to extract lock data: ${extractError.message}`);
    }

    if (!encryptedLockData) {
      console.warn("[LockControl] No valid lockData - lock is read-only");
      return {
        success: false,
        method: "bluetooth",
        message:
          "Lock is read-only. Please delete and re-pair via Bluetooth to enable control.",
        requires_pairing: true,
      };
    }

    try {
      console.log(`🔓 Bluetooth unlock: MAC=${lockMac}`);
      console.log(`🔓 LockData length: ${encryptedLockData.length}`);

      // TTLock SDK only needs the lockData (encrypted blob)
      console.log("[LockControl] Calling TTLockService.unlock...");
      const result = await TTLockService.unlock(encryptedLockData);
      console.log(
        "[LockControl] TTLockService.unlock returned:",
        JSON.stringify(result),
      );

      // Log activity to backend immediately (don't wait for battery)
      try {
        await logLockActivity(lock.id, "unlocked", "bluetooth", null);
        console.log("✅ Activity logged to database");
      } catch (logError) {
        console.warn("⚠️ Failed to log activity:", logError.message);
      }

      // Fire-and-forget battery read — don't block the success response
      TTLockService.getBatteryLevel(encryptedLockData)
        .then((level) => {
          console.log(`🔋 Battery level after unlock: ${level}%`);
          logLockActivity(lock.id, "unlocked", "bluetooth", { battery_level: level }).catch(() => {});
        })
        .catch((err) => console.warn("⚠️ Could not get battery level:", err.message));

      return {
        success: true,
        method: "bluetooth",
        message: "Unlocked via Bluetooth",
        data: result,
      };
    } catch (error) {
      // Log failed unlock attempt to database
      try {
        await logLockActivity(lock.id, "failed", "bluetooth", {
          error_message: error.message,
          operation: "unlock",
        });
        console.log("✅ Failed unlock attempt logged to database");
      } catch (logError) {
        console.warn(
          "⚠️ Failed to log failed unlock attempt:",
          logError.message,
        );
      }

      throw new Error(`Bluetooth unlock failed: ${error.message}`);
    }
  }

  /**
   * Private method to lock via Bluetooth
   */
  async _lockViaBluetooth(lock) {
    console.log("[LockControl] _lockViaBluetooth called");

    // Check Bluetooth state and prompt to enable if off
    const btCheck = await ensureBluetoothEnabled();
    if (!btCheck.enabled) {
      if (btCheck.openedSettings) {
        return {
          success: false,
          method: "bluetooth",
          message: "Please enable Bluetooth and try again.",
          bluetooth_off: true,
        };
      }
      return {
        success: false,
        method: "bluetooth",
        message: "Bluetooth is required for this operation.",
        bluetooth_off: true,
        cancelled: btCheck.cancelled,
      };
    }

    console.log(
      "[LockControl] Lock object:",
      JSON.stringify({
        id: lock?.id,
        name: lock?.name,
        ttlock_mac: lock?.ttlock_mac,
        mac_address: lock?.mac_address,
        ttlock_data_type: typeof lock?.ttlock_data,
        ttlock_data_length: lock?.ttlock_data?.length,
      }),
    );

    // Support both field names: ttlock_mac (from pairing) and mac_address (from database)
    const lockMac = lock.ttlock_mac || lock.mac_address;

    if (!lockMac) {
      console.error("[LockControl] No MAC address found");
      throw new Error("Lock has no Bluetooth MAC address");
    }

    // Extract the encrypted lockData string from ttlock_data
    let encryptedLockData = null;
    try {
      encryptedLockData = extractLockData(lock.ttlock_data);
      console.log(
        "[LockControl] Extracted lockData:",
        encryptedLockData
          ? `${encryptedLockData.substring(0, 50)}... (len=${encryptedLockData.length})`
          : "null",
      );
    } catch (extractError) {
      console.error("[LockControl] extractLockData failed:", extractError);
      throw new Error(`Failed to extract lock data: ${extractError.message}`);
    }

    if (!encryptedLockData) {
      console.warn("[LockControl] No valid lockData - lock is read-only");
      return {
        success: false,
        method: "bluetooth",
        message:
          "Lock is read-only. Please delete and re-pair via Bluetooth to enable control.",
        requires_pairing: true,
      };
    }

    try {
      console.log(`🔒 Bluetooth lock: MAC=${lockMac}`);
      console.log(`🔒 LockData length: ${encryptedLockData.length}`);

      // TTLock SDK only needs the lockData (encrypted blob)
      console.log("[LockControl] Calling TTLockService.lock...");
      const result = await TTLockService.lock(encryptedLockData);
      console.log(
        "[LockControl] TTLockService.lock returned:",
        JSON.stringify(result),
      );

      // Log activity to backend immediately (don't wait for battery)
      try {
        await logLockActivity(lock.id, "locked", "bluetooth", null);
        console.log("✅ Activity logged to database");
      } catch (logError) {
        console.warn("⚠️ Failed to log activity:", logError.message);
      }

      // Fire-and-forget battery read — don't block the success response
      TTLockService.getBatteryLevel(encryptedLockData)
        .then((level) => {
          console.log(`🔋 Battery level after lock: ${level}%`);
          logLockActivity(lock.id, "locked", "bluetooth", { battery_level: level }).catch(() => {});
        })
        .catch((err) => console.warn("⚠️ Could not get battery level:", err.message));

      return {
        success: true,
        method: "bluetooth",
        message: "Locked via Bluetooth",
        data: result,
      };
    } catch (error) {
      // Log failed lock attempt to database
      try {
        await logLockActivity(lock.id, "failed", "bluetooth", {
          error_message: error.message,
          operation: "lock",
        });
        console.log("✅ Failed lock attempt logged to database");
      } catch (logError) {
        console.warn("⚠️ Failed to log failed lock attempt:", logError.message);
      }

      throw new Error(`Bluetooth lock failed: ${error.message}`);
    }
  }

  /**
   * Sync operation records from lock and log them to the backend.
   * When lock has gateway: uses TTLock Cloud API. Otherwise: fetches via Bluetooth.
   * @param {Object} lock - Lock object with ttlock_data
   * @param {number} [timeoutMs=25000] - Timeout in ms for Bluetooth fetch
   * @param {AbortSignal} [signal] - Optional abort signal
   * @returns {Promise<{ success: boolean, count: number, aborted?: boolean }>}
   */
  async syncOperationRecords(lock, timeoutMs = 10000, signal = null) {
    const methods = this.getAvailableControlMethods(lock);

    if (methods.cloud && lock.ttlock_lock_id) {
      try {
        console.log("[LockControl] Syncing from TTLock Cloud (gateway)...");
        const res = await syncActivityFromCloud(lock.id);
        const count = res?.data?.data?.count ?? 0;
        console.log(`[LockControl] Cloud sync: ${count} record(s)`);
        return { success: true, count };
      } catch (cloudErr) {
        console.warn(
          "[LockControl] Cloud sync failed, falling back to Bluetooth:",
          cloudErr?.message,
        );
      }
    }

    const lockData = extractLockData(lock?.ttlock_data);
    if (!lockData) {
      throw new Error("Lock data not available for Bluetooth sync");
    }

    const btCheck = await ensureBluetoothEnabled();
    if (!btCheck.enabled) {
      throw new Error("Bluetooth is required to sync from lock");
    }

    const isAborted = () => signal?.aborted === true;

    const doFetch = () => {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error(
                "Sync timed out. Wake the lock (press it or use keypad), wait a few seconds, then try again.",
              ),
            ),
          timeoutMs,
        );
      });
      const fetchPromise = TTLockService.getOperationRecords(lockData, 0)
        .then((records) => {
          clearTimeout(timeoutId);
          if (isAborted()) return undefined;
          return records;
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          if (isAborted()) return undefined;
          throw err;
        });
      return Promise.race([fetchPromise, timeoutPromise]);
    };

    let records;
    try {
      records = await doFetch();
      // When Latest (type=0) returns empty, return immediately - do NOT fallback to All (type=1).
      // Fallback to All fetches entire lock history (hundreds of records) and causes rate limits.
    } catch (err) {
      const isBusy = /lock is busy|\(36\)/.test(err?.message || "");
      if (isBusy) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          records = await doFetch();
        } catch (retryErr) {
          throw new Error("Lock is busy. Wait a moment, then try again.");
        }
      } else {
        throw err;
      }
    }

    if (records === undefined && isAborted()) {
      return { success: false, count: 0, aborted: true };
    }
    if (!Array.isArray(records) || records.length === 0) {
      return { success: true, count: 0 };
    }

    // Cap records to avoid rate limits and long sync times
    const MAX_RECORDS_PER_SYNC = 50;
    const toProcess = records.slice(0, MAX_RECORDS_PER_SYNC);
    if (records.length > MAX_RECORDS_PER_SYNC) {
      console.log(
        `[LockControl] Capping at ${MAX_RECORDS_PER_SYNC} of ${records.length} records`,
      );
    }

    const recordTypeMap = {
      // 1: { action: "unlocked", access_method: "bluetooth" },
      3: { action: "unlocked", access_method: "remote" },
      4: { action: "unlocked", access_method: "pin" },
      7: { action: "unlocked", access_method: "card" },
      8: { action: "unlocked", access_method: "fingerprint" },
      9: { action: "unlocked", access_method: "wristband" },
      10: { action: "unlocked", access_method: "mechanical_key" },
      // 11: { action: "locked", access_method: "bluetooth" },
      12: { action: "unlocked", access_method: "remote" },
      // 29: { action: "unlocked", access_method: "bluetooth" },
      33: { action: "locked", access_method: "fingerprint" },
      34: { action: "locked", access_method: "pin" },
      35: { action: "locked", access_method: "card" },
      36: { action: "locked", access_method: "mechanical_key" },
      17: { action: "unlocked", access_method: "card" },
      20: { action: "unlocked", access_method: "fingerprint" },
      21: { action: "locked", access_method: "fingerprint" },
      22: { action: "unlocked", access_method: "card" },
      23: { action: "locked", access_method: "card" },
      37: { action: "unlocked", access_method: "remote" },
      45: { action: "locked", access_method: "auto" },
      44: { action: "alert", access_method: "tamper" },
      30: { action: "closed", access_method: "door_sensor" },
      31: { action: "opened", access_method: "door_sensor" },
      32: { action: "unlocked", access_method: "inside" },
      // 46: { action: "unlocked", access_method: "bluetooth" },
      // 47: { action: "locked", access_method: "bluetooth" },
      48: { action: "failed", access_method: "pin" },
      55: { action: "unlocked", access_method: "remote" },
    };

    let logged = 0;
    for (const rec of toProcess) {
      if (isAborted()) break;
      const rt =
        rec.recordType ??
        rec.record_type ??
        rec.type ??
        rec.unlockType ??
        rec.operType;
      const mapped = recordTypeMap[rt];
      if (!mapped) {
        if (!SKIP_SYNC_RECORD_TYPES.has(rt)) {
          console.warn("[LockControl] Unknown recordType:", rt);
        }
        continue;
      }
      const metadata = {};
      const lockDate = rec.lockDate ?? rec.operateDate ?? rec.timestamp;
      if (lockDate != null) metadata.record_timestamp = lockDate;
      if (rec.electricQuantity != null)
        metadata.battery_level = rec.electricQuantity;
      try {
        await logLockActivity(
          lock.id,
          mapped.action,
          mapped.access_method,
          Object.keys(metadata).length ? metadata : null,
        );
        logged++;
      } catch (e) {
        const isRateLimited = /429|rate limit|RATE_LIMIT/.test(
          e?.message || "",
        );
        if (isRateLimited) {
          console.warn(
            "[LockControl] Rate limited, stopping sync. Try again later.",
          );
          break;
        }
        console.warn("[LockControl] Failed to log record:", e?.message);
      }
    }
    return {
      success: true,
      count: logged,
      ...(isAborted() && { aborted: true }),
    };
  }

  /**
   * Check what control methods are available for a lock
   * @param {Object} lock - Lock object from database
   * @returns {Object} Available control methods
   */
  getAvailableControlMethods(lock) {
    // Check if we have valid encrypted lockData for Bluetooth control
    const hasValidLockData = !!extractLockData(lock.ttlock_data);

    // Check if lock has cloud keys (lockKey, aesKeyStr) from TTLock import
    let hasCloudKeys = false;
    if (
      lock.ttlock_data &&
      typeof lock.ttlock_data === "string" &&
      lock.ttlock_data.startsWith("{")
    ) {
      try {
        const parsed = JSON.parse(lock.ttlock_data);
        hasCloudKeys = !!(parsed.lockKey && parsed.aesKeyStr);
      } catch (e) {
        // Not JSON
      }
    }

    // Cloud control is available if:
    // 1. Lock has gateway AND ttlock_lock_id (for API call)
    const hasCloudControl = !!(lock.has_gateway && lock.ttlock_lock_id);

    return {
      cloud: hasCloudControl,
      bluetooth: !!(lock.ttlock_mac && hasValidLockData),
      readOnly: !!(lock.ttlock_mac && !hasValidLockData && !hasCloudControl),
      hasCloudKeys,
    };
  }

  /**
   * Get user-friendly control method description
   * @param {Object} lock - Lock object from database
   * @returns {string} Description of available control methods
   */
  getControlMethodDescription(lock) {
    const methods = this.getAvailableControlMethods(lock);

    if (methods.cloud && methods.bluetooth) {
      return "Remote & Local Control";
    } else if (methods.cloud) {
      return "Remote Control Only";
    } else if (methods.bluetooth) {
      return "Local Control Only";
    } else if (methods.readOnly) {
      return "Read-Only (No Control)";
    } else {
      return "No Control Available";
    }
  }
}

// Export helper functions for use in Fingerprint/Card screens
export { extractLockData, ensureBluetoothEnabled };

// Export singleton instance
export default new LockControlService();
