import { NativeModules, NativeEventEmitter, LogBox } from 'react-native';

/**
 * TTLock Service - Bluetooth-based lock operations
 * Uses NativeModules.Ttlock directly since the library export is broken.
 */

// Suppress NativeEventEmitter warnings for TTLock module
// The native module works fine but doesn't implement the optional addListener/removeListeners methods
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method',
]);

// Get the native module directly
const TtlockNative = NativeModules.Ttlock;

// Lock control types (from the official SDK - index.d.ts lines 479-482)
// CRITICAL: These values MUST match the SDK enum exactly!
const LockControlType = {
  Unlock: 0,  // SDK enum: Unlock = 0
  Lock: 1,    // SDK enum: Lock = 1
};

// Check if available
const TTLOCK_AVAILABLE = TtlockNative &&
  typeof TtlockNative.getBluetoothState === 'function' &&
  typeof TtlockNative.startScan === 'function';

if (!TTLOCK_AVAILABLE) {
  console.warn('[TTLock] Native module not available');
}

// Create event emitter for scan callbacks
// We wrap the module to add stub methods if they don't exist (prevents warnings)
let ttLockEventEmitter = null;
if (TTLOCK_AVAILABLE) {
  // Add stub methods to suppress NativeEventEmitter warnings
  // These are optional methods that the TTLock native module doesn't implement
  if (!TtlockNative.addListener) {
    TtlockNative.addListener = () => {};
  }
  if (!TtlockNative.removeListeners) {
    TtlockNative.removeListeners = () => {};
  }
  ttLockEventEmitter = new NativeEventEmitter(TtlockNative);
}

class TTLockService {
  constructor() {
    this.isScanning = false;
  }

  /**
   * Check if TTLock native module is available
   * @returns {boolean}
   */
  isAvailable() {
    return TTLOCK_AVAILABLE;
  }

  /**
   * Get Bluetooth state
   * @returns {Promise<string>} - 'poweredOn', 'poweredOff', 'unauthorized', etc.
   */
  async getBluetoothState() {
    if (!TTLOCK_AVAILABLE) {
      return 'unavailable';
    }
    return new Promise((resolve) => {
      TtlockNative.getBluetoothState((state) => {
        // IMPORTANT: Native module returns integers (4 = ON, 5 = OFF)
        // Convert to string format expected by UI
        console.log('[TTLock] Bluetooth state (raw):', state, typeof state);

        let stateString;
        if (state === 4) {
          stateString = 'poweredOn';
        } else if (state === 5) {
          stateString = 'poweredOff';
        } else {
          stateString = 'unknown';
        }

        console.log('[TTLock] Bluetooth state (converted):', stateString);
        resolve(stateString);
      });
    });
  }

  /**
   * Start scanning for nearby TTLock devices
   * @param {number} duration - Scan duration in milliseconds (default: 15000)
   * @returns {Promise<Array>} - Array of discovered locks
   */
  async scanLocks(duration = 15000) {
    if (!TTLOCK_AVAILABLE) {
      return [];
    }

    const discoveredLocks = [];

    return new Promise((resolve, reject) => {
      if (this.isScanning) {
        reject(new Error('Already scanning'));
        return;
      }

      this.isScanning = true;
      console.log('[TTLock] Starting scan for', duration, 'ms');

      // Subscribe to scan events via NativeEventEmitter
      // IMPORTANT: Native event name is 'EventScanLock' (from TTLockEvent.java)
      const scanSubscription = ttLockEventEmitter.addListener('EventScanLock', (lockData) => {
        const exists = discoveredLocks.find(l => l.lockMac === lockData.lockMac);
        if (!exists) {
          console.log('[TTLock] Found lock:', lockData.lockName, lockData.lockMac, 'RSSI:', lockData.rssi, 'Inited:', lockData.isInited);
          discoveredLocks.push({
            lockMac: lockData.lockMac,
            lockName: lockData.lockName || 'TTLock',
            isInitialized: lockData.isInited || false,
            lockData: lockData,
            rssi: lockData.rssi || -100
          });
        } else {
          // Update RSSI with latest signal strength (keep best reading)
          if (lockData.rssi > exists.rssi) {
            exists.rssi = lockData.rssi;
          }
        }
      });

      // Start the scan (no arguments needed)
      TtlockNative.startScan();

      // Stop after duration
      setTimeout(() => {
        scanSubscription.remove();
        this.stopScan();
        this.isScanning = false;
        console.log('[TTLock] Scan complete. Found', discoveredLocks.length, 'locks');
        resolve(discoveredLocks);
      }, duration);
    });
  }

  stopScan() {
    if (TTLOCK_AVAILABLE) {
      TtlockNative.stopScan();
    }
    this.isScanning = false;
  }

  async initializeLock(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }
    console.log('[TTLock] Initializing lock:', lockData.lockMac);
    return new Promise((resolve, reject) => {
      TtlockNative.initLock(
        lockData,
        (lockDataString) => {
          // IMPORTANT: Native module returns a single encrypted string (lockData)
          // NOT an object with properties. This is the encrypted blob from TTLock SDK.
          console.log('[TTLock] Lock initialized successfully');
          console.log('[TTLock] Lock data string length:', lockDataString?.length);

          resolve({
            lockMac: lockData.lockMac,              // From original scan data
            lockName: lockData.lockName || 'My Lock', // From original scan data
            lockData: lockDataString,                // Encrypted string from native SDK
            timestamp: Date.now()
          });
        },
        (errorCode, errorDesc) => {
          console.log('[TTLock] Init failed:', errorCode, errorDesc);
          reject(new Error(`Init failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  async resetLock(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }
    return new Promise((resolve, reject) => {
      TtlockNative.resetLock(
        lockData,
        () => resolve(),
        (errorCode, errorDesc) => reject(new Error(`Reset failed: ${errorDesc} (${errorCode})`))
      );
    });
  }

  async lock(lockMacOrData, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }
    const payload = lockData || lockMacOrData;

    // Validate payload to prevent crashes
    if (!payload || typeof payload !== 'string' || payload.length < 10) {
      console.error('[TTLock] Invalid lock payload:', typeof payload, payload?.length);
      throw new Error('Invalid lock data. Please re-pair the lock via Bluetooth.');
    }

    console.log('[TTLock] Locking via controlLock, payload length:', payload?.length);

    return new Promise((resolve, reject) => {
      TtlockNative.controlLock(
        LockControlType.Lock,
        payload,
        // SUCCESS CALLBACK: Keep it simple like the original working version
        // The native module returns a WritableArray but we don't need to parse it
        // Just resolve with success - the callback being called means it worked
        () => {
          console.log('[TTLock] Lock success');
          resolve({ success: true });
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Lock failed:', errorCode, errorDesc);
          reject(new Error(`Lock failed: ${errorDesc || 'Unknown error'} (${errorCode || 'unknown'})`));
        }
      );
    });
  }

  async unlock(lockMacOrData, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }
    const payload = lockData || lockMacOrData;

    // Validate payload to prevent crashes
    if (!payload || typeof payload !== 'string' || payload.length < 10) {
      console.error('[TTLock] Invalid unlock payload:', typeof payload, payload?.length);
      throw new Error('Invalid lock data. Please re-pair the lock via Bluetooth.');
    }

    console.log('[TTLock] Unlocking via controlLock, payload length:', payload?.length);

    return new Promise((resolve, reject) => {
      TtlockNative.controlLock(
        LockControlType.Unlock,
        payload,
        // SUCCESS CALLBACK: Keep it simple like the original working version
        // The native module returns a WritableArray but we don't need to parse it
        // Just resolve with success - the callback being called means it worked
        () => {
          console.log('[TTLock] Unlock success');
          resolve({ success: true });
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Unlock failed:', errorCode, errorDesc);
          reject(new Error(`Unlock failed: ${errorDesc || 'Unknown error'} (${errorCode || 'unknown'})`));
        }
      );
    });
  }

  /**
   * Get operation records from the lock via Bluetooth.
   * @param {string} lockData - Encrypted lock data string
   * @param {number} [type=1] - 0 = Latest only, 1 = All records
   * @returns {Promise<Array>} Parsed operation records
   */
  async getOperationRecords(lockData, type = 1) {
    if (!TTLOCK_AVAILABLE) {
      return [];
    }
    return new Promise((resolve, reject) => {
      TtlockNative.getLockOperationRecord(
        type,
        lockData,
        (records) => {
          try {
            const parsed = typeof records === 'string' ? JSON.parse(records) : records;
            let arr = Array.isArray(parsed) ? parsed : parsed?.records || parsed?.list || [];
            if (!Array.isArray(arr)) arr = [];
            resolve(arr);
          } catch (e) {
            resolve([]);
          }
        },
        (errorCode, errorDesc) =>
          reject(new Error(`Get records failed: ${errorDesc} (${errorCode})`))
      );
    });
  }

  async getLockStatus(lockMacOrData, lockData) {
    if (!TTLOCK_AVAILABLE) {
      return null;
    }
    const payload = lockData || lockMacOrData;
    return new Promise((resolve, reject) => {
      TtlockNative.getLockSwitchState(
        payload,
        (status) => resolve(status),
        (errorCode, errorDesc) => reject(new Error(`Status failed: ${errorDesc} (${errorCode})`))
      );
    });
  }

  async getBatteryLevel(lockMacOrData, lockData) {
    if (!TTLOCK_AVAILABLE) {
      return null;
    }
    const payload = lockData || lockMacOrData;
    return new Promise((resolve, reject) => {
      TtlockNative.getLockElectricQuantity(
        payload,
        (battery) => resolve(battery),
        (errorCode, errorDesc) => reject(new Error(`Battery failed: ${errorDesc} (${errorCode})`))
      );
    });
  }

  /**
   * Create a custom passcode for the lock
   * @param {string} passcode - The passcode to create (4-9 digits)
   * @param {number} startDate - Start time in milliseconds
   * @param {number} endDate - End time in milliseconds
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<Object>} - Result with passcode info
   */
  async createCustomPasscode(passcode, startDate, endDate, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Creating custom passcode:', passcode);
    console.log('[TTLock] Valid from:', new Date(startDate).toISOString());
    console.log('[TTLock] Valid until:', new Date(endDate).toISOString());
    console.log('[TTLock] LockData length:', lockData?.length);

    return new Promise((resolve, reject) => {
      TtlockNative.createCustomPasscode(
        passcode,
        startDate,
        endDate,
        lockData,
        () => {
          // IMPORTANT: Native module success callback takes NO parameters
          // (see TtlockModule.java line 840: successCallback.invoke())
          console.log('[TTLock] Passcode created successfully');
          resolve({
            success: true,
            passcode,
            startDate,
            endDate
          });
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Create passcode failed:', errorCode, errorDesc);
          reject(new Error(`Create passcode failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Delete a passcode from the lock
   * @param {string} passcode - The passcode to delete
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async deletePasscode(passcode, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Deleting passcode:', passcode);

    return new Promise((resolve, reject) => {
      TtlockNative.deletePasscode(
        passcode,
        lockData,
        () => {
          console.log('[TTLock] Passcode deleted successfully');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Delete passcode failed:', errorCode, errorDesc);
          reject(new Error(`Delete passcode failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Get all passcodes from the lock
   * NOTE: This method is NOT supported by the react-native-ttlock SDK
   * The passcodes must be managed through the app's database or TTLock Cloud API
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<Array>} - Empty array (not supported)
   */
  async getAllPasscodes(lockData) {
    // The react-native-ttlock SDK does not expose getAllValidPasscodes
    // Passcodes should be managed through the backend/cloud API
    console.warn('[TTLock] getAllPasscodes is not supported by the Bluetooth SDK');
    console.warn('[TTLock] Use the TTLock Cloud API to retrieve passcodes');
    return [];
  }

  // =====================================================
  // FINGERPRINT METHODS
  // =====================================================

  /**
   * Add a fingerprint to the lock
   * @param {number} startDate - Start time in milliseconds
   * @param {number} endDate - End time in milliseconds
   * @param {string} lockData - The encrypted lockData string
   * @param {function} onProgress - Progress callback (currentCount, totalCount)
   * @returns {Promise<Object>} - Result with fingerprint number
   */
  async addFingerprint(startDate, endDate, lockData, onProgress = () => {}) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Adding fingerprint...');
    console.log('[TTLock] Valid from:', new Date(startDate).toISOString());
    console.log('[TTLock] Valid until:', new Date(endDate).toISOString());

    return new Promise((resolve, reject) => {
      // Subscribe to progress events
      const progressSubscription = ttLockEventEmitter.addListener(
        'EventAddFingerprintProgrress',
        (dataArray) => {
          const currentCount = dataArray[0];
          const totalCount = dataArray[1];
          console.log('[TTLock] Fingerprint progress:', currentCount, '/', totalCount);
          onProgress(currentCount, totalCount);
        }
      );

      TtlockNative.addFingerprint(
        [], // cycleList - null for no periodic restrictions
        startDate,
        endDate,
        lockData,
        (fingerprintNumber) => {
          progressSubscription.remove();
          console.log('[TTLock] Fingerprint added successfully:', fingerprintNumber);
          resolve({
            success: true,
            fingerprintNumber,
            startDate,
            endDate
          });
        },
        (errorCode, errorDesc) => {
          progressSubscription.remove();
          console.error('[TTLock] Add fingerprint failed:', errorCode, errorDesc);
          reject(new Error(`Add fingerprint failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Modify fingerprint validity period
   * @param {string} fingerprintNumber - The fingerprint ID to modify
   * @param {number} startDate - New start time in milliseconds
   * @param {number} endDate - New end time in milliseconds
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async modifyFingerprintValidityPeriod(fingerprintNumber, startDate, endDate, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Modifying fingerprint:', fingerprintNumber);

    return new Promise((resolve, reject) => {
      TtlockNative.modifyFingerprintValidityPeriod(
        fingerprintNumber,
        [], // cycleList
        startDate,
        endDate,
        lockData,
        () => {
          console.log('[TTLock] Fingerprint modified successfully');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Modify fingerprint failed:', errorCode, errorDesc);
          reject(new Error(`Modify fingerprint failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Delete a fingerprint from the lock
   * @param {string} fingerprintNumber - The fingerprint ID to delete
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async deleteFingerprint(fingerprintNumber, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Deleting fingerprint:', fingerprintNumber);

    return new Promise((resolve, reject) => {
      TtlockNative.deleteFingerprint(
        fingerprintNumber,
        lockData,
        () => {
          console.log('[TTLock] Fingerprint deleted successfully');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Delete fingerprint failed:', errorCode, errorDesc);
          reject(new Error(`Delete fingerprint failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Clear all fingerprints from the lock
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async clearAllFingerprints(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Clearing all fingerprints...');

    return new Promise((resolve, reject) => {
      TtlockNative.clearAllFingerprints(
        lockData,
        () => {
          console.log('[TTLock] All fingerprints cleared');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Clear fingerprints failed:', errorCode, errorDesc);
          reject(new Error(`Clear fingerprints failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  // =====================================================
  // IC CARD METHODS
  // =====================================================

  /**
   * Add an IC card to the lock
   * @param {number} startDate - Start time in milliseconds
   * @param {number} endDate - End time in milliseconds
   * @param {string} lockData - The encrypted lockData string
   * @param {function} onProgress - Progress callback (called when card is being read)
   * @returns {Promise<Object>} - Result with card number
   */
  async addCard(startDate, endDate, lockData, onProgress = () => {}) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Adding IC card...');
    console.log('[TTLock] Valid from:', new Date(startDate).toISOString());
    console.log('[TTLock] Valid until:', new Date(endDate).toISOString());

    return new Promise((resolve, reject) => {
      // Subscribe to progress events
      const progressSubscription = ttLockEventEmitter.addListener(
        'EventAddCardProgrress',
        () => {
          console.log('[TTLock] Card reading in progress...');
          onProgress();
        }
      );

      TtlockNative.addCard(
        [], // cycleList - null for no periodic restrictions
        startDate,
        endDate,
        lockData,
        (cardNumber) => {
          progressSubscription.remove();
          console.log('[TTLock] Card added successfully:', cardNumber);
          resolve({
            success: true,
            cardNumber,
            startDate,
            endDate
          });
        },
        (errorCode, errorDesc) => {
          progressSubscription.remove();
          console.error('[TTLock] Add card failed:', errorCode, errorDesc);
          reject(new Error(`Add card failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Modify card validity period
   * @param {string} cardNumber - The card ID to modify
   * @param {number} startDate - New start time in milliseconds
   * @param {number} endDate - New end time in milliseconds
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async modifyCardValidityPeriod(cardNumber, startDate, endDate, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Modifying card:', cardNumber);

    return new Promise((resolve, reject) => {
      TtlockNative.modifyCardValidityPeriod(
        cardNumber,
        [], // cycleList
        startDate,
        endDate,
        lockData,
        () => {
          console.log('[TTLock] Card modified successfully');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Modify card failed:', errorCode, errorDesc);
          reject(new Error(`Modify card failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Delete a card from the lock
   * @param {string} cardNumber - The card ID to delete
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async deleteCard(cardNumber, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Deleting card:', cardNumber);

    return new Promise((resolve, reject) => {
      TtlockNative.deleteCard(
        cardNumber,
        lockData,
        () => {
          console.log('[TTLock] Card deleted successfully');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Delete card failed:', errorCode, errorDesc);
          reject(new Error(`Delete card failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Clear all cards from the lock
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async clearAllCards(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Clearing all cards...');

    return new Promise((resolve, reject) => {
      TtlockNative.clearAllCards(
        lockData,
        () => {
          console.log('[TTLock] All cards cleared');
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Clear cards failed:', errorCode, errorDesc);
          reject(new Error(`Clear cards failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  // =====================================================
  // LOCK CONFIGURATION (BLUETOOTH)
  // =====================================================

  /**
   * Set lock configuration value via Bluetooth
   * @param {number} configType - Configuration type (see LockConfigType enum below)
   * @param {boolean} configValue - true to enable, false to disable
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   *
   * LockConfigType enum values:
   * - 0: Audio (lock sound on/off)
   * - 1: PasscodeVisible (show passcode on screen)
   * - 2: Freeze (freeze lock)
   * - 3: TamperAlert (tamper alert on/off)
   * - 4: ResetButton (physical reset button enable/disable)
   * - 5: PrivacyLock (privacy lock mode)
   * - 6: PassageModeAutoUnlock (auto unlock in passage mode)
   */
  async setLockConfig(configType, configValue, lockData, retryCount = 0) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    // IMPORTANT: Native module expects boolean, not string!
    // Convert any string/number values to proper boolean
    const boolValue = configValue === true || configValue === '1' || configValue === 1;
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 second between retries
    const INITIAL_DELAY = 300; // 300ms wake-up delay before first command

    console.log('[TTLock] Setting lock config:', configType, '=', boolValue, '(type:', typeof boolValue, '), attempt:', retryCount + 1);
    console.log('[TTLock] LockData length:', lockData?.length);

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    // Add a small delay before sending command to ensure lock is ready
    // This helps with "hit or miss" issues caused by the lock not being fully awake
    if (retryCount === 0) {
      console.log('[TTLock] Waiting for lock to be ready...');
      await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));
    }

    return new Promise((resolve, reject) => {
      TtlockNative.setLockConfig(
        configType,
        boolValue,  // Pass boolean, not string!
        lockData,
        () => {
          console.log('[TTLock] ✅ Lock config set successfully (attempt:', retryCount + 1, ')');
          resolve();
        },
        async (errorCode, errorDesc) => {
          console.error('[TTLock] ❌ Set lock config failed (attempt:', retryCount + 1, '):', errorCode, errorDesc);

          // Retry if we haven't exceeded max retries
          if (retryCount < MAX_RETRIES) {
            console.log(`[TTLock] ⏳ Retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, RETRY_DELAY));
            try {
              await this.setLockConfig(configType, configValue, lockData, retryCount + 1);
              resolve();
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(new Error(`Set config failed after ${MAX_RETRIES + 1} attempts: ${errorDesc} (${errorCode})`));
          }
        }
      );
    });
  }

  /**
   * Get lock configuration value via Bluetooth
   * @param {number} configType - Configuration type (see LockConfigType enum)
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<string>} - '1' if enabled, '0' if disabled
   */
  async getLockConfig(configType, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting lock config:', configType);

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    return new Promise((resolve, reject) => {
      TtlockNative.getLockConfig(
        configType,
        lockData,
        (configValue) => {
          console.log('[TTLock] Lock config value:', configValue);
          resolve(configValue);
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] Get lock config failed:', errorCode, errorDesc);
          reject(new Error(`Get config failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Enable/disable the physical reset button on the lock via Bluetooth
   * @param {boolean} enabled - true to enable, false to disable
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async setResetButton(enabled, lockData) {
    const RESET_BUTTON_CONFIG_TYPE = 4;
    console.log(`[TTLock] Setting reset button: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.setLockConfig(RESET_BUTTON_CONFIG_TYPE, !!enabled, lockData);
  }

  /**
   * Get reset button status via Bluetooth
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>} - true if enabled, false if disabled
   */
  async getResetButtonStatus(lockData) {
    const RESET_BUTTON_CONFIG_TYPE = 4;
    const configValue = await this.getLockConfig(RESET_BUTTON_CONFIG_TYPE, lockData);
    return configValue === '1' || configValue === 1 || configValue === true;
  }

  // =====================================================
  // READ SETTINGS FROM LOCK (for sync feature)
  // =====================================================

  /**
   * Get automatic locking period from lock via Bluetooth
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<number>} - Auto-lock delay in seconds (0 = disabled)
   */
  async getAutomaticLockingPeriod(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting automatic locking period...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    return new Promise((resolve, reject) => {
      // Check available method names
      const methodName = typeof TtlockNative.getLockAutomaticLockingPeriodicTime === 'function'
        ? 'getLockAutomaticLockingPeriodicTime'
        : typeof TtlockNative.getAutomaticLockingPeriod === 'function'
        ? 'getAutomaticLockingPeriod'
        : null;

      if (!methodName) {
        console.warn('[TTLock] Auto-lock read method not available in native module');
        reject(new Error('Auto-lock read method not available in TTLock SDK.'));
        return;
      }

      console.log(`[TTLock] Using method: ${methodName}`);

      TtlockNative[methodName](
        lockData,
        (seconds) => {
          console.log(`[TTLock] ✅ Automatic locking period: ${seconds} seconds`);
          resolve(seconds);
        },
        (errorCode, errorDesc) => {
          console.error(`[TTLock] ❌ Get automatic locking period failed:`, errorCode, errorDesc);
          reject(new Error(`Get automatic locking period failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Get passage mode status from lock via Bluetooth
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<Object>} - Passage mode configuration { enabled, weekDays, startTime, endTime }
   */
  async getPassageMode(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting passage mode status...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    return new Promise((resolve, reject) => {
      // Check if getPassageMode method exists
      if (typeof TtlockNative.getPassageMode !== 'function') {
        console.warn('[TTLock] getPassageMode method not available in native module');
        reject(new Error('Passage mode read method not available in TTLock SDK.'));
        return;
      }

      TtlockNative.getPassageMode(
        lockData,
        (passageModeData) => {
          console.log('[TTLock] ✅ Passage mode data:', passageModeData);
          // The SDK returns passage mode configuration or null/empty if disabled
          // Parse the response to determine if enabled
          let enabled = false;
          let config = null;

          if (passageModeData && (Array.isArray(passageModeData) ? passageModeData.length > 0 : true)) {
            enabled = true;
            config = passageModeData;
          }

          resolve({
            enabled,
            data: config
          });
        },
        (errorCode, errorDesc) => {
          console.error('[TTLock] ❌ Get passage mode failed:', errorCode, errorDesc);
          reject(new Error(`Get passage mode failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Get lock sound status from lock via Bluetooth
   * Uses getLockConfig with Audio type (0) or dedicated getLockSound method
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>} - true if sound enabled, false if disabled
   */
  async getLockSoundStatus(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting lock sound status...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    // Try dedicated getLockSound method first, fallback to getLockConfig
    if (typeof TtlockNative.getLockSound === 'function') {
      return new Promise((resolve, reject) => {
        TtlockNative.getLockSound(
          lockData,
          (soundEnabled) => {
            console.log('[TTLock] ✅ Lock sound status (getLockSound):', soundEnabled);
            resolve(soundEnabled === '1' || soundEnabled === 1 || soundEnabled === true);
          },
          (errorCode, errorDesc) => {
            console.error('[TTLock] ❌ Get lock sound failed:', errorCode, errorDesc);
            reject(new Error(`Get lock sound failed: ${errorDesc} (${errorCode})`));
          }
        );
      });
    }

    // Fallback to getLockConfig with Audio type (0)
    const AUDIO_CONFIG_TYPE = 0;
    const configValue = await this.getLockConfig(AUDIO_CONFIG_TYPE, lockData);
    return configValue === '1' || configValue === 1 || configValue === true;
  }

  /**
   * Get tamper alarm switch state from lock via Bluetooth
   * Uses getLockConfig with TamperAlert type (3) or dedicated getTamperAlarmSwitchState method
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>} - true if tamper alert enabled, false if disabled
   */
  async getTamperAlertStatus(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting tamper alert status...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    // Try dedicated getTamperAlarmSwitchState method first, fallback to getLockConfig
    if (typeof TtlockNative.getTamperAlarmSwitchState === 'function') {
      return new Promise((resolve, reject) => {
        TtlockNative.getTamperAlarmSwitchState(
          lockData,
          (tamperEnabled) => {
            console.log('[TTLock] ✅ Tamper alert status (getTamperAlarmSwitchState):', tamperEnabled);
            resolve(tamperEnabled === '1' || tamperEnabled === 1 || tamperEnabled === true);
          },
          (errorCode, errorDesc) => {
            console.error('[TTLock] ❌ Get tamper alert failed:', errorCode, errorDesc);
            reject(new Error(`Get tamper alert failed: ${errorDesc} (${errorCode})`));
          }
        );
      });
    }

    // Fallback to getLockConfig with TamperAlert type (3)
    const TAMPER_ALERT_CONFIG_TYPE = 3;
    const configValue = await this.getLockConfig(TAMPER_ALERT_CONFIG_TYPE, lockData);
    return configValue === '1' || configValue === 1 || configValue === true;
  }

  /**
   * Get reset lock switch state from lock via Bluetooth
   * Uses getLockConfig with ResetButton type (4) or dedicated getResetLockSwitchState method
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>} - true if reset button enabled, false if disabled
   */
  async getResetButtonSwitchState(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Getting reset button status...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    // Try dedicated getResetLockSwitchState method first, fallback to getLockConfig
    if (typeof TtlockNative.getResetLockSwitchState === 'function') {
      return new Promise((resolve, reject) => {
        TtlockNative.getResetLockSwitchState(
          lockData,
          (resetEnabled) => {
            console.log('[TTLock] ✅ Reset button status (getResetLockSwitchState):', resetEnabled);
            resolve(resetEnabled === '1' || resetEnabled === 1 || resetEnabled === true);
          },
          (errorCode, errorDesc) => {
            console.error('[TTLock] ❌ Get reset button failed:', errorCode, errorDesc);
            reject(new Error(`Get reset button failed: ${errorDesc} (${errorCode})`));
          }
        );
      });
    }

    // Fallback to getLockConfig with ResetButton type (4)
    const RESET_BUTTON_CONFIG_TYPE = 4;
    const configValue = await this.getLockConfig(RESET_BUTTON_CONFIG_TYPE, lockData);
    return configValue === '1' || configValue === 1 || configValue === true;
  }

  /**
   * Read all settings from lock via Bluetooth (for sync feature)
   * Reads all available settings with 200ms stagger between calls
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<Object>} - Object with all settings { autoLock, passageMode, lockSound, tamperAlert, resetButton }
   */
  async readAllSettings(lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log('[TTLock] Reading all settings from lock...');

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    const results = {
      autoLock: { success: false, enabled: false, delay: 0, error: null },
      passageMode: { success: false, enabled: false, data: null, error: null },
      lockSound: { success: false, enabled: true, error: null },
      tamperAlert: { success: false, enabled: true, error: null },
      resetButton: { success: false, enabled: true, error: null },
    };

    // Helper function to add delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Read Auto Lock setting
    try {
      const autoLockSeconds = await this.getAutomaticLockingPeriod(lockData);
      results.autoLock.success = true;
      results.autoLock.enabled = autoLockSeconds > 0;
      results.autoLock.delay = autoLockSeconds;
    } catch (err) {
      results.autoLock.error = err.message;
      console.warn('[TTLock] Failed to read auto-lock:', err.message);
    }

    await delay(200);

    // Read Passage Mode setting
    try {
      const passageModeData = await this.getPassageMode(lockData);
      results.passageMode.success = true;
      results.passageMode.enabled = passageModeData.enabled;
      results.passageMode.data = passageModeData.data;
    } catch (err) {
      results.passageMode.error = err.message;
      console.warn('[TTLock] Failed to read passage mode:', err.message);
    }

    await delay(200);

    // Read Lock Sound setting
    try {
      const soundEnabled = await this.getLockSoundStatus(lockData);
      results.lockSound.success = true;
      results.lockSound.enabled = soundEnabled;
    } catch (err) {
      results.lockSound.error = err.message;
      console.warn('[TTLock] Failed to read lock sound:', err.message);
    }

    await delay(200);

    // Read Tamper Alert setting
    try {
      const tamperEnabled = await this.getTamperAlertStatus(lockData);
      results.tamperAlert.success = true;
      results.tamperAlert.enabled = tamperEnabled;
    } catch (err) {
      results.tamperAlert.error = err.message;
      console.warn('[TTLock] Failed to read tamper alert:', err.message);
    }

    await delay(200);

    // Read Reset Button setting
    try {
      const resetEnabled = await this.getResetButtonSwitchState(lockData);
      results.resetButton.success = true;
      results.resetButton.enabled = resetEnabled;
    } catch (err) {
      results.resetButton.error = err.message;
      console.warn('[TTLock] Failed to read reset button:', err.message);
    }

    console.log('[TTLock] ✅ All settings read:', results);
    return results;
  }

  /**
   * Enable/disable tamper alert via Bluetooth
   * @param {boolean} enabled - true to enable, false to disable
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async setTamperAlert(enabled, lockData) {
    const TAMPER_ALERT_CONFIG_TYPE = 3;
    console.log(`[TTLock] Setting tamper alert: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.setLockConfig(TAMPER_ALERT_CONFIG_TYPE, !!enabled, lockData);
  }

  /**
   * Enable/disable lock sound via Bluetooth
   * @param {boolean} enabled - true to enable, false to disable
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async setLockSound(enabled, lockData) {
    const AUDIO_CONFIG_TYPE = 0;
    console.log(`[TTLock] Setting lock sound: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.setLockConfig(AUDIO_CONFIG_TYPE, !!enabled, lockData);
  }

  /**
   * Set Automatic Locking Period via Bluetooth
   * Sets how long after unlocking the lock should automatically re-lock
   * @param {number} seconds - Auto-lock delay in seconds (0 to disable, 5-300 seconds typical range)
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async setAutomaticLockingPeriod(seconds, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    // Validate seconds: 0 to disable, or 5-300 seconds
    const validSeconds = Math.max(0, Math.min(300, parseInt(seconds) || 0));
    
    console.log(`[TTLock] Setting automatic locking period: ${validSeconds} seconds`);
    console.log(`[TTLock] LockData length: ${lockData?.length}`);

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    return new Promise((resolve, reject) => {
      // Check available method names (the React Native bridge uses setLockAutomaticLockingPeriodicTime)
      const methodName = typeof TtlockNative.setLockAutomaticLockingPeriodicTime === 'function'
        ? 'setLockAutomaticLockingPeriodicTime'
        : typeof TtlockNative.setAutomaticLockingPeriod === 'function'
        ? 'setAutomaticLockingPeriod'
        : null;

      if (!methodName) {
        console.warn('[TTLock] Auto-lock method not available in native module');
        console.warn('[TTLock] Available methods:', Object.keys(TtlockNative).filter(k => k.toLowerCase().includes('lock') || k.toLowerCase().includes('auto')));
        // If method doesn't exist, reject so caller can fallback to Gateway API
        reject(new Error('Auto-lock method not available in TTLock SDK. Use Gateway API instead.'));
        return;
      }

      console.log(`[TTLock] Using method: ${methodName}`);
      console.log(`[TTLock] Calling ${methodName} with seconds=${validSeconds}, lockData length=${lockData?.length}`);

      TtlockNative[methodName](
        validSeconds,
        lockData,
        () => {
          console.log(`[TTLock] ✅ Automatic locking period set successfully: ${validSeconds} seconds`);
          resolve();
        },
        (errorCode, errorDesc) => {
          console.error(`[TTLock] ❌ Set automatic locking period failed:`, errorCode, errorDesc);
          reject(new Error(`Set automatic locking period failed: ${errorDesc} (${errorCode})`));
        }
      );
    });
  }

  /**
   * Set Passage Mode via Bluetooth
   * Configures passage mode which keeps the lock unlocked for a period
   * @param {Object} config - Passage mode configuration
   * @param {boolean} config.enabled - true to enable, false to disable
   * @param {number} config.startTime - Start time in minutes from midnight (0-1439)
   * @param {number} config.endTime - End time in minutes from midnight (0-1439)
   * @param {boolean} config.isAllDay - true for all day, false for time period
   * @param {Array<number>} config.weekDays - Array of weekdays [1-7], 1=Monday, 7=Sunday
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<void>}
   */
  async setPassageMode(config, lockData) {
    if (!TTLOCK_AVAILABLE) {
      throw new Error('TTLock native module not available. Please rebuild the app.');
    }

    console.log(`[TTLock] Setting passage mode:`, config);
    console.log(`[TTLock] LockData length: ${lockData?.length}`);

    // Validate lockData
    if (!lockData || typeof lockData !== 'string' || lockData.length < 10) {
      throw new Error('Invalid lock data. Please ensure the lock is properly paired via Bluetooth.');
    }

    // Build passage mode config object
    // Note: TTLock SDK expects specific format - check if it needs to be an object or separate parameters
    const passageModeConfig = {
      enabled: config.enabled || false,
      startTime: config.startTime || 0,
      endTime: config.endTime || 1439,
      isAllDay: config.isAllDay || false,
      weekDays: config.weekDays || [1, 2, 3, 4, 5, 6, 7] // All days by default
    };

    return new Promise((resolve, reject) => {
      // Check available methods
      const hasAddPassageMode = typeof TtlockNative.addPassageMode === 'function';
      const hasSetPassageMode = typeof TtlockNative.setPassageMode === 'function';
      const hasSetPassbackMode = typeof TtlockNative.setPassbackMode === 'function';
      const hasClearAllPassageModes = typeof TtlockNative.clearAllPassageModes === 'function';

      console.log('[TTLock] Passage mode methods available:', {
        addPassageMode: hasAddPassageMode,
        setPassageMode: hasSetPassageMode,
        setPassbackMode: hasSetPassbackMode,
        clearAllPassageModes: hasClearAllPassageModes
      });

      // If disabling, clear all passage modes
      if (!passageModeConfig.enabled) {
        if (hasClearAllPassageModes) {
          console.log('[TTLock] Disabling passage mode - clearing all passage modes');
          TtlockNative.clearAllPassageModes(
            lockData,
            () => {
              console.log(`[TTLock] ✅ Passage mode disabled successfully`);
              resolve();
            },
            (errorCode, errorDesc) => {
              console.error(`[TTLock] ❌ Clear passage mode failed:`, errorCode, errorDesc);
              reject(new Error(`Disable passage mode failed: ${errorDesc} (${errorCode})`));
            }
          );
          return;
        } else {
          reject(new Error('clearAllPassageModes method not available in TTLock SDK. Use Gateway API instead.'));
          return;
        }
      }

      // If enabling, FIRST clear existing passage modes, then add new one
      // This prevents conflicts from multiple overlapping passage mode configurations
      // The native method signature is: addPassageMode(type, weekly, monthly, startDate, endDate, lockData, success, fail)
      // type: 0 = Weekly, 1 = Monthly
      // weekly: array of weekdays [1-7] for weekly mode
      // monthly: array of days [1-31] for monthly mode (not used for weekly)
      // startDate: minutes from midnight (0-1439)
      // endDate: minutes from midnight (0-1439)
      if (hasAddPassageMode) {
        const modeType = 0; // 0 = Weekly mode
        const weekly = passageModeConfig.weekDays || [1, 2, 3, 4, 5, 6, 7];
        const monthly = []; // Not used for weekly mode
        const startDate = passageModeConfig.startTime || 0;
        const endDate = passageModeConfig.endTime || 1439;

        console.log(`[TTLock] Enabling passage mode - first clearing existing modes...`);

        // Step 1: Clear existing passage modes first to prevent conflicts
        const clearFirst = () => {
          return new Promise((clearResolve, clearReject) => {
            if (hasClearAllPassageModes) {
              TtlockNative.clearAllPassageModes(
                lockData,
                () => {
                  console.log(`[TTLock] ✅ Cleared existing passage modes`);
                  clearResolve();
                },
                (errorCode, errorDesc) => {
                  // Log warning but continue - maybe there were no existing modes
                  console.warn(`[TTLock] ⚠️ Clear passage modes warning:`, errorCode, errorDesc);
                  clearResolve(); // Continue anyway
                }
              );
            } else {
              clearResolve(); // No clear method available, continue
            }
          });
        };

        // Step 2: Add the new passage mode after clearing
        clearFirst().then(() => {
          // Small delay to ensure lock processed the clear command
          setTimeout(() => {
            console.log(`[TTLock] Adding passage mode:`, {
              modeType,
              weekly,
              startDate,
              endDate,
              isAllDay: passageModeConfig.isAllDay
            });

            TtlockNative.addPassageMode(
              modeType,
              weekly,
              monthly,
              startDate,
              endDate,
              lockData,
              () => {
                console.log(`[TTLock] ✅ Passage mode enabled successfully`);
                resolve();
              },
              (errorCode, errorDesc) => {
                console.error(`[TTLock] ❌ Add passage mode failed:`, errorCode, errorDesc);
                reject(new Error(`Enable passage mode failed: ${errorDesc} (${errorCode})`));
              }
            );
          }, 500); // 500ms delay to let lock process clear command
        }).catch((err) => {
          reject(err);
        });
        return; // Exit early since we're handling this async
      } else if (hasSetPassageMode) {
        // Try setPassageMode with config object
        TtlockNative.setPassageMode(
          passageModeConfig,
          lockData,
          () => {
            console.log(`[TTLock] ✅ Passage mode set successfully:`, passageModeConfig);
            resolve();
          },
          (errorCode, errorDesc) => {
            console.error(`[TTLock] ❌ Set passage mode failed:`, errorCode, errorDesc);
            reject(new Error(`Set passage mode failed: ${errorDesc} (${errorCode})`));
          }
        );
      } else if (hasSetPassbackMode) {
        // Try setPassbackMode (alternative name)
        TtlockNative.setPassbackMode(
          passageModeConfig,
          lockData,
          () => {
            console.log(`[TTLock] ✅ Passage mode set successfully (passback):`, passageModeConfig);
            resolve();
          },
          (errorCode, errorDesc) => {
            console.error(`[TTLock] ❌ Set passback mode failed:`, errorCode, errorDesc);
            reject(new Error(`Set passback mode failed: ${errorDesc} (${errorCode})`));
          }
        );
      } else {
        console.warn('[TTLock] No passage mode methods available in native module');
        console.warn('[TTLock] Available methods:', Object.keys(TtlockNative).filter(k => k.toLowerCase().includes('pass')));
        reject(new Error('Passage mode methods not available in TTLock SDK. Use Gateway API instead.'));
      }
    });
  }

  // =====================================================
  // FEATURE SUPPORT CHECK
  // =====================================================

  /**
   * Check if lock supports a specific feature
   * @param {number} feature - Feature code (1=IcCard, 2=Fingerprint, 53=Face)
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>} - Whether feature is supported
   */
  async supportFunction(feature, lockData) {
    if (!TTLOCK_AVAILABLE) {
      return false;
    }

    return new Promise((resolve) => {
      TtlockNative.supportFunction(
        feature,
        lockData,
        (isSupport) => {
          console.log('[TTLock] Feature', feature, 'supported:', isSupport);
          resolve(isSupport);
        }
      );
    });
  }

  /**
   * Check if lock supports fingerprint
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>}
   */
  async supportsFingerprint(lockData) {
    return this.supportFunction(2, lockData); // LockFunction.Fingerprint = 2
  }

  /**
   * Check if lock supports IC cards
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>}
   */
  async supportsCard(lockData) {
    return this.supportFunction(1, lockData); // LockFunction.IcCard = 1
  }

  /**
   * Check if lock supports face recognition
   * @param {string} lockData - The encrypted lockData string
   * @returns {Promise<boolean>}
   */
  async supportsFace(lockData) {
    return this.supportFunction(53, lockData); // LockFunction.Face = 53
  }
}

export default new TTLockService();
