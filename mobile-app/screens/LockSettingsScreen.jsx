import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppScreen from "../components/ui/AppScreen";
import Section from "../components/ui/Section";
import AppCard from "../components/ui/AppCard";
import Colors from "../constants/Colors";
import Theme from "../constants/Theme";
import { normalizeLockSettings, coerceBoolean } from "../utils/lockSettings";
import {
  getLockById,
  getLockSettings,
  updateLockSettings,
  deleteLock,
  toggleAutoLock,
  togglePassageMode,
  updateLockConfig,
} from "../services/api";
import { extractLockData } from "../services/lockControlService";
import TTLockService from "../services/ttlockService";

const LockSettingsScreen = ({ navigation, route }) => {
  const { lockId } = route.params;
  const [currentLock, setCurrentLock] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [settings, setSettings] = useState({
    autoLockEnabled: true,
    autoLockDelay: 5,
    passageModeEnabled: false,
    lockSoundEnabled: true,
    antiPeepPassword: false,
    resetButtonEnabled: true,
    tamperAlertEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Loading states for individual settings
  const [autoLockLoading, setAutoLockLoading] = useState(false);
  const [passageModeLoading, setPassageModeLoading] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const [antiPeepLoading, setAntiPeepLoading] = useState(false);
  const [resetButtonLoading, setResetButtonLoading] = useState(false);
  const [tamperAlertLoading, setTamperAlertLoading] = useState(false);
  const [syncingFromLock, setSyncingFromLock] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Check if user is admin or owner
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";

  // Check if user is the actual lock owner (by role OR by owner_id match)
  // Note: Legacy data may have owner with role='admin', so we also check owner.id
  const isOwner =
    userRole === "owner" ||
    (currentLock?.owner?.id && currentLock.owner.id === currentUserId);

  // Check if lock has gateway connection (for cloud API settings)
  const hasGateway = currentLock?.has_gateway === true;

  // Check if Bluetooth lock data is available
  const hasBluetoothData = !!extractLockData(currentLock?.ttlock_data);

  // Load current user ID to check ownership
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.warn("[LockSettingsScreen] Failed to load current user:", err);
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [lockDetails, lockSettings] = await Promise.all([
          getLockById(lockId),
          getLockSettings(lockId),
        ]);

        const lockData =
          lockDetails?.data?.data?.lock ||
          lockDetails?.data?.lock ||
          lockDetails?.data;
        const settingsData = lockSettings?.data?.data || lockSettings?.data;
        const permissions =
          lockDetails?.data?.data?.permissions ||
          lockDetails?.data?.permissions;

        console.log(
          "[LockSettingsScreen] Lock data:",
          JSON.stringify(lockData),
        );
        console.log(
          "[LockSettingsScreen] Settings data:",
          JSON.stringify(settingsData),
        );
        console.log("[LockSettingsScreen] Has gateway:", lockData?.has_gateway);
        console.log(
          "[LockSettingsScreen] TTLock data available:",
          !!lockData?.ttlock_data,
        );
        console.log(
          "[LockSettingsScreen] Permissions:",
          JSON.stringify(permissions),
        );
        console.log("[LockSettingsScreen] Lock owner ID:", lockData?.owner?.id);

        setCurrentLock(lockData);
        setSettings(normalizeLockSettings(settingsData));

        if (permissions?.role) {
          setUserRole(permissions.role);
        }
      } catch (err) {
        console.error("[LockSettingsScreen] Error loading settings:", err);
        setError("Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [lockId]);

  // =====================================================
  // HELPER: Check Bluetooth state before operations
  // Returns lockData if Bluetooth is available, null otherwise (will fallback to Gateway)
  // =====================================================
  const checkBluetoothAndGetLockData = async () => {
    // Check if TTLock native module is available
    if (!TTLockService.isAvailable()) {
      console.log(
        "[LockSettings] TTLock native module not available - will use Gateway",
      );
      return null;
    }

    // Check Bluetooth state
    const btState = await TTLockService.getBluetoothState();
    console.log("[LockSettings] Bluetooth state:", btState);

    if (btState !== "poweredOn") {
      console.log("[LockSettings] Bluetooth is off - will use Gateway");
      return null;
    }

    // Get lock data
    const lockData = extractLockData(currentLock?.ttlock_data);
    if (!lockData) {
      console.log(
        "[LockSettings] Lock not paired via Bluetooth - will use Gateway",
      );
      return null;
    }

    console.log(
      "[LockSettings] ✅ Bluetooth available, will try Bluetooth first",
    );
    return lockData;
  };

  // =====================================================
  // SYNC SETTINGS FROM LOCK - Read all settings from physical lock via Bluetooth
  // =====================================================
  const handleSyncFromLock = async () => {
    // Show instruction alert first
    Alert.alert(
      "Update Settings from Lock",
      'To read settings from your lock:\n\n1. Stand within Bluetooth range of the lock (within 2-3 meters)\n\n2. Wake up the lock by touching the keypad or fingerprint sensor\n\n3. Press "Continue" to sync settings',
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: performSyncFromLock },
      ],
    );
  };

  const performSyncFromLock = async () => {
    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) {
      Alert.alert(
        "Bluetooth Required",
        "Please ensure:\n\n• Bluetooth is turned on\n• You are near the lock\n• The lock is paired with this app\n\nThis feature requires a direct Bluetooth connection to read settings from the physical lock.",
      );
      return;
    }

    setSyncingFromLock(true);

    try {
      console.log(
        "[LockSettings] Starting sync from physical lock using readAllSettings...",
      );

      // Use the comprehensive readAllSettings method that reads all settings with 200ms stagger
      const results = await TTLockService.readAllSettings(lockData);

      const syncedSettings = {};
      const errors = [];
      const settingsList = [];

      // Process Auto Lock result
      if (results.autoLock.success) {
        syncedSettings.autoLockEnabled = results.autoLock.enabled;
        syncedSettings.autoLockDelay = results.autoLock.delay || 5;
        settingsList.push(
          `• Auto Lock: ${results.autoLock.enabled ? `Enabled (${results.autoLock.delay}s)` : "Disabled"}`,
        );
      } else if (results.autoLock.error) {
        errors.push("Auto Lock");
      }

      // Process Passage Mode result
      if (results.passageMode.success) {
        syncedSettings.passageModeEnabled = results.passageMode.enabled;
        settingsList.push(
          `• Passage Mode: ${results.passageMode.enabled ? "Enabled" : "Disabled"}`,
        );
      } else if (results.passageMode.error) {
        errors.push("Passage Mode");
      }

      // Process Lock Sound result
      if (results.lockSound.success) {
        syncedSettings.lockSoundEnabled = results.lockSound.enabled;
        settingsList.push(
          `• Lock Sound: ${results.lockSound.enabled ? "Enabled" : "Disabled"}`,
        );
      } else if (results.lockSound.error) {
        errors.push("Lock Sound");
      }

      // Process Tamper Alert result
      if (results.tamperAlert.success) {
        syncedSettings.tamperAlertEnabled = results.tamperAlert.enabled;
        settingsList.push(
          `• Tamper Alert: ${results.tamperAlert.enabled ? "Enabled" : "Disabled"}`,
        );
      } else if (results.tamperAlert.error) {
        errors.push("Tamper Alert");
      }

      // Process Reset Button result
      if (results.resetButton.success) {
        syncedSettings.resetButtonEnabled = results.resetButton.enabled;
        settingsList.push(
          `• Reset Button: ${results.resetButton.enabled ? "Enabled" : "Disabled"}`,
        );
      } else if (results.resetButton.error) {
        errors.push("Reset Button");
      }

      // Update local state with synced settings
      if (Object.keys(syncedSettings).length > 0) {
        setSettings((prev) => ({ ...prev, ...syncedSettings }));

        // Save to database
        try {
          const dbUpdateData = {};
          if ("autoLockEnabled" in syncedSettings) {
            dbUpdateData.auto_lock_enabled = syncedSettings.autoLockEnabled;
            dbUpdateData.auto_lock_delay = syncedSettings.autoLockDelay;
          }
          if ("passageModeEnabled" in syncedSettings) {
            dbUpdateData.passage_mode_enabled =
              syncedSettings.passageModeEnabled;
          }
          if ("lockSoundEnabled" in syncedSettings) {
            dbUpdateData.sound_enabled = syncedSettings.lockSoundEnabled;
          }
          if ("tamperAlertEnabled" in syncedSettings) {
            dbUpdateData.tamper_alert_enabled =
              syncedSettings.tamperAlertEnabled;
          }
          if ("resetButtonEnabled" in syncedSettings) {
            dbUpdateData.reset_button_enabled =
              syncedSettings.resetButtonEnabled;
          }

          if (Object.keys(dbUpdateData).length > 0) {
            await updateLockSettings(lockId, dbUpdateData);
            console.log("[LockSettings] Settings saved to database");
          }
        } catch (dbErr) {
          console.warn(
            "[LockSettings] Failed to save settings to database:",
            dbErr,
          );
        }
      }

      // Show result
      const successCount = Object.keys(syncedSettings).length;
      if (successCount > 0 && errors.length === 0) {
        Alert.alert(
          "Settings Updated",
          `Successfully read ${successCount} setting(s) from your lock:\n\n` +
            settingsList.join("\n") +
            "\n\nSettings have been saved to your account.",
        );
      } else if (successCount > 0 && errors.length > 0) {
        Alert.alert(
          "Partial Sync",
          `Read ${successCount} setting(s) successfully:\n\n` +
            settingsList.join("\n") +
            `\n\nFailed to read: ${errors.join(", ")}\n\nThis may be due to your lock model not supporting these features.`,
        );
      } else {
        Alert.alert(
          "Sync Failed",
          "Could not read settings from the lock. Please ensure:\n\n• You are within Bluetooth range\n• The lock is awake (touch the keypad)\n• Try moving closer to the lock",
        );
      }
    } catch (err) {
      console.error("[LockSettings] Sync from lock error:", err);
      Alert.alert(
        "Sync Error",
        `Failed to read settings from lock.\n\nError: ${err.message}\n\nPlease try again while standing closer to the lock.`,
      );
    } finally {
      setSyncingFromLock(false);
    }
  };

  // =====================================================
  // AUTO LOCK - Works via Bluetooth (when near) or Gateway (remote)
  // =====================================================
  const handleAutoLockToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const newEnabled = !coerceBoolean(settings.autoLockEnabled);
    const originalSettings = settings;

    setAutoLockLoading(true);
    setSettings({ ...settings, autoLockEnabled: newEnabled });

    try {
      // Try Bluetooth first if lock is paired and phone is near lock
      const lockData = await checkBluetoothAndGetLockData();
      let syncedViaBluetooth = false;

      if (lockData) {
        try {
          console.log("[LockSettings] Attempting auto-lock via Bluetooth...");
          const autoLockSeconds = newEnabled ? settings.autoLockDelay || 5 : 0;
          await TTLockService.setAutomaticLockingPeriod(
            autoLockSeconds,
            lockData,
          );
          syncedViaBluetooth = true;
          console.log("[LockSettings] ✅ Auto-lock set via Bluetooth");
          Alert.alert(
            "Success",
            `Auto-lock ${newEnabled ? "enabled" : "disabled"} on physical lock via Bluetooth`,
          );

          // Also update backend database
          try {
            await toggleAutoLock(lockId, newEnabled, settings.autoLockDelay);
          } catch (dbErr) {
            console.warn(
              "[LockSettings] Failed to update database, but lock setting was applied:",
              dbErr,
            );
          }
        } catch (btError) {
          console.warn(
            "[LockSettings] Bluetooth SDK method failed, trying Gateway API with Bluetooth sync:",
            btError.message,
          );
          // Fallback to Gateway API with type: 1 (Bluetooth sync)
          // This tells the gateway to sync the setting via Bluetooth
          try {
            const response = await toggleAutoLock(
              lockId,
              newEnabled,
              settings.autoLockDelay,
              { useBluetooth: true },
            );
            if (response.data?.data?.synced_to_lock) {
              syncedViaBluetooth = true;
              Alert.alert(
                "Success",
                `Auto-lock ${newEnabled ? "enabled" : "disabled"} via Gateway (Bluetooth sync)`,
              );
            }
          } catch (gatewayErr) {
            console.warn(
              "[LockSettings] Gateway API also failed:",
              gatewayErr.message,
            );
            // Will fall through to regular Gateway attempt below
          }
        }
      }

      // If Bluetooth didn't work, try Gateway (regular remote sync)
      if (!syncedViaBluetooth) {
        const response = await toggleAutoLock(
          lockId,
          newEnabled,
          settings.autoLockDelay,
        );
        console.log(
          "[LockSettings] Auto-lock toggled via Gateway:",
          response.data,
        );

        const syncedToLock = response.data?.data?.synced_to_lock;
        if (syncedToLock) {
          Alert.alert(
            "Success",
            `Auto-lock ${newEnabled ? "enabled" : "disabled"} on physical lock via Gateway`,
          );
        } else {
          Alert.alert(
            "Saved to Cloud",
            `Auto-lock ${newEnabled ? "enabled" : "disabled"}.\n\nNo gateway detected - setting saved to cloud but will sync to lock when gateway is available.`,
          );
        }
      }
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Auto-lock toggle error:", err);
      Alert.alert(
        "Error",
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to toggle auto-lock",
      );
    } finally {
      setAutoLockLoading(false);
    }
  };

  const handleAutoLockDelayPress = () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const delayOptions = [
      { label: "5 seconds", value: 5 },
      { label: "15 seconds", value: 15 },
      { label: "30 seconds", value: 30 },
      { label: "1 minute", value: 60 },
      { label: "5 minutes", value: 300 },
    ];

    Alert.alert(
      "Auto-lock Delay",
      "Choose how long after unlocking the lock should automatically re-lock",
      [
        ...delayOptions.map((option) => ({
          text: option.label,
          onPress: async () => {
            const originalSettings = settings;
            setAutoLockLoading(true);
            setSettings({ ...settings, autoLockDelay: option.value });
            try {
              // Try Bluetooth first if available
              const lockData = await checkBluetoothAndGetLockData();
              let syncedViaBluetooth = false;

              if (lockData) {
                try {
                  console.log(
                    "[LockSettings] Updating auto-lock delay via Bluetooth...",
                  );
                  const autoLockSeconds = settings.autoLockEnabled
                    ? option.value
                    : 0;
                  await TTLockService.setAutomaticLockingPeriod(
                    autoLockSeconds,
                    lockData,
                  );
                  syncedViaBluetooth = true;
                  console.log(
                    "[LockSettings] ✅ Auto-lock delay updated via Bluetooth",
                  );
                  Alert.alert(
                    "Success",
                    `Auto-lock delay set to ${option.label} via Bluetooth`,
                  );

                  // Also update backend database
                  try {
                    await toggleAutoLock(
                      lockId,
                      settings.autoLockEnabled,
                      option.value,
                      { useBluetooth: false },
                    );
                  } catch (dbErr) {
                    console.warn(
                      "[LockSettings] Failed to update database:",
                      dbErr,
                    );
                  }
                } catch (btError) {
                  console.warn(
                    "[LockSettings] Bluetooth SDK method failed, trying Gateway API with Bluetooth sync:",
                    btError.message,
                  );
                  // Fallback to Gateway API with type: 1 (Bluetooth sync)
                  try {
                    await toggleAutoLock(
                      lockId,
                      settings.autoLockEnabled,
                      option.value,
                      { useBluetooth: true },
                    );
                    syncedViaBluetooth = true;
                    Alert.alert(
                      "Success",
                      `Auto-lock delay set to ${option.label} via Gateway (Bluetooth sync)`,
                    );
                  } catch (gatewayErr) {
                    console.warn(
                      "[LockSettings] Gateway API also failed:",
                      gatewayErr.message,
                    );
                  }
                }
              }

              // If Bluetooth didn't work, try Gateway
              if (!syncedViaBluetooth) {
                await toggleAutoLock(
                  lockId,
                  settings.autoLockEnabled,
                  option.value,
                );
                console.log(
                  "[LockSettings] Auto-lock delay updated via Gateway:",
                  option.value,
                );
                Alert.alert(
                  "Success",
                  `Auto-lock delay set to ${option.label}`,
                );
              }
            } catch (err) {
              setSettings(originalSettings);
              Alert.alert(
                "Error",
                err.response?.data?.error?.message ||
                  err.message ||
                  "Failed to update delay",
              );
            } finally {
              setAutoLockLoading(false);
            }
          },
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // =====================================================
  // PASSAGE MODE - Works via Bluetooth (when near) or Gateway (remote)
  // =====================================================
  const handlePassageModeToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const newEnabled = !coerceBoolean(settings.passageModeEnabled);

    if (newEnabled) {
      Alert.alert(
        "Enable Passage Mode",
        "Passage mode keeps the lock unlocked permanently. This is useful for parties or high-traffic times.\n\nAre you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Enable", onPress: () => performPassageModeToggle(true) },
        ],
      );
    } else {
      performPassageModeToggle(false);
    }
  };

  const performPassageModeToggle = async (newEnabled) => {
    const originalSettings = settings;
    setPassageModeLoading(true);
    setSettings({ ...settings, passageModeEnabled: newEnabled });

    try {
      // Try Bluetooth first if lock is paired and phone is near lock
      const lockData = await checkBluetoothAndGetLockData();
      let syncedViaBluetooth = false;

      if (lockData) {
        try {
          console.log(
            "[LockSettings] Attempting passage mode via Bluetooth...",
          );
          const passageConfig = {
            enabled: newEnabled,
            isAllDay: true,
            startTime: 0,
            endTime: 1439, // 23:59
            weekDays: [1, 2, 3, 4, 5, 6, 7], // All days
          };
          await TTLockService.setPassageMode(passageConfig, lockData);
          syncedViaBluetooth = true;
          console.log("[LockSettings] ✅ Passage mode set via Bluetooth");
          Alert.alert(
            "Success",
            `Passage mode ${newEnabled ? "enabled" : "disabled"} on physical lock via Bluetooth`,
          );

          // Also update backend database
          try {
            await togglePassageMode(lockId, newEnabled, {
              isAllDay: true,
              useBluetooth: false,
            });
          } catch (dbErr) {
            console.warn(
              "[LockSettings] Failed to update database, but lock setting was applied:",
              dbErr,
            );
          }
        } catch (btError) {
          console.warn(
            "[LockSettings] Bluetooth SDK method failed, trying Gateway API with Bluetooth sync:",
            btError.message,
          );
          // Fallback to Gateway API with type: 1 (Bluetooth sync)
          try {
            const response = await togglePassageMode(lockId, newEnabled, {
              isAllDay: true,
              useBluetooth: true,
            });
            if (response.data?.data?.synced_to_lock) {
              syncedViaBluetooth = true;
              Alert.alert(
                "Success",
                `Passage mode ${newEnabled ? "enabled" : "disabled"} via Gateway (Bluetooth sync)`,
              );
            }
          } catch (gatewayErr) {
            console.warn(
              "[LockSettings] Gateway API also failed:",
              gatewayErr.message,
            );
            // Will fall through to regular Gateway attempt below
          }
        }
      }

      // If Bluetooth didn't work, try Gateway
      if (!syncedViaBluetooth) {
        const response = await togglePassageMode(lockId, newEnabled, {
          isAllDay: true,
        });
        console.log(
          "[LockSettings] Passage mode toggled via Gateway:",
          response.data,
        );

        const syncedToLock = response.data?.data?.synced_to_lock;
        if (syncedToLock) {
          Alert.alert(
            "Success",
            `Passage mode ${newEnabled ? "enabled" : "disabled"} on physical lock via Gateway`,
          );
        } else {
          Alert.alert(
            "Saved to Cloud",
            `Passage mode ${newEnabled ? "enabled" : "disabled"}.\n\nNo gateway - will sync when gateway is available.`,
          );
        }
      }
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Passage mode error:", err);
      Alert.alert(
        "Error",
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to toggle passage mode",
      );
    } finally {
      setPassageModeLoading(false);
    }
  };

  // =====================================================
  // ANTI-PEEP PASSWORD - Works via Cloud Gateway
  // =====================================================
  const handleAntiPeepToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    if (!currentLock?.ttlock_lock_id) {
      Alert.alert("Not Available", "This feature requires cloud connection");
      return;
    }

    const newValue = !coerceBoolean(settings.antiPeepPassword);
    const originalSettings = settings;

    setAntiPeepLoading(true);
    setSettings({ ...settings, antiPeepPassword: newValue });

    try {
      await updateLockConfig(
        currentLock.ttlock_lock_id,
        "antiPeepPassword",
        newValue ? "1" : "0",
      );
      await updateLockSettings(lockId, { anti_peep_password: newValue });

      console.log("[LockSettings] Anti-peep password updated:", newValue);
      Alert.alert(
        "Success",
        `Anti-peep password ${newValue ? "enabled" : "disabled"}.\n\nYou can enter random digits before and after your code.`,
      );
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Anti-peep toggle error:", err);
      Alert.alert(
        "Error",
        err.response?.data?.error?.message ||
          "Failed to update anti-peep setting",
      );
    } finally {
      setAntiPeepLoading(false);
    }
  };

  // =====================================================
  // LOCK SOUND - Works via Bluetooth ONLY
  // =====================================================
  const handleLockSoundToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) return;

    const newEnabled = !coerceBoolean(settings.lockSoundEnabled);
    const originalSettings = settings;

    setSoundLoading(true);
    setSettings({ ...settings, lockSoundEnabled: newEnabled });

    try {
      console.log(
        "[LockSettings] Setting lock sound via Bluetooth:",
        newEnabled,
      );

      // Use Bluetooth to set lock sound (config type 0 = Audio)
      await TTLockService.setLockSound(newEnabled, lockData);

      // Verify the setting was applied by reading it back from the lock
      console.log("[LockSettings] Verifying lock sound setting...");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Brief delay before verification

      try {
        const actualValue = await TTLockService.getLockSoundStatus(lockData);
        console.log(
          "[LockSettings] Lock sound verification - expected:",
          newEnabled,
          "actual:",
          actualValue,
        );

        if (actualValue !== newEnabled) {
          console.warn("[LockSettings] Lock sound mismatch! Retrying...");
          // Setting didn't apply, retry once more
          await new Promise((resolve) => setTimeout(resolve, 500));
          await TTLockService.setLockSound(newEnabled, lockData);

          // Verify again
          await new Promise((resolve) => setTimeout(resolve, 500));
          const retryValue = await TTLockService.getLockSoundStatus(lockData);
          console.log(
            "[LockSettings] Lock sound retry verification - expected:",
            newEnabled,
            "actual:",
            retryValue,
          );

          if (retryValue !== newEnabled) {
            throw new Error(
              "Setting was not applied to the lock. Please try again while standing closer to the lock.",
            );
          }
        }
      } catch (verifyErr) {
        // Verification failed but setting might still have worked
        console.warn(
          "[LockSettings] Could not verify lock sound setting:",
          verifyErr.message,
        );
        // Continue anyway - the setting command succeeded
      }

      // Save to database after successful Bluetooth operation
      await updateLockSettings(lockId, { sound_enabled: newEnabled });

      console.log(
        "[LockSettings] Lock sound updated via Bluetooth successfully",
      );
      Alert.alert(
        "Success",
        `Lock sound ${newEnabled ? "enabled" : "disabled"} via Bluetooth`,
      );
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Lock sound error:", err);
      Alert.alert(
        "Bluetooth Error",
        `Failed to change lock sound.\n\nError: ${err.message}\n\nMake sure you are within Bluetooth range of the lock.`,
      );
    } finally {
      setSoundLoading(false);
    }
  };

  // =====================================================
  // RESET BUTTON - Works via Bluetooth ONLY
  // =====================================================
  const handleResetButtonToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) return;

    const newValue = !coerceBoolean(settings.resetButtonEnabled);

    if (!newValue) {
      Alert.alert(
        "Disable Reset Button?",
        "Disabling the reset button prevents anyone from using the physical reset button on the lock.\n\nThis is a security feature. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: () => performResetButtonToggle(newValue, lockData),
          },
        ],
      );
    } else {
      performResetButtonToggle(newValue, lockData);
    }
  };

  const performResetButtonToggle = async (newValue, lockData) => {
    setResetButtonLoading(true);
    const originalSettings = settings;
    setSettings({ ...settings, resetButtonEnabled: newValue });

    try {
      console.log(
        "[LockSettings] Setting reset button via Bluetooth:",
        newValue,
      );

      await TTLockService.setResetButton(newValue, lockData);
      await updateLockSettings(lockId, { reset_button_enabled: newValue });

      console.log(
        "[LockSettings] Reset button updated via Bluetooth successfully",
      );
      Alert.alert(
        "Success",
        `Reset button ${newValue ? "enabled" : "disabled"} via Bluetooth`,
      );
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Reset button error:", err);
      Alert.alert(
        "Bluetooth Error",
        `Failed to change reset button setting.\n\nError: ${err.message}\n\nMake sure you are within Bluetooth range of the lock.`,
      );
    } finally {
      setResetButtonLoading(false);
    }
  };

  // =====================================================
  // TAMPER ALERT - Works via Bluetooth ONLY
  // =====================================================
  const handleTamperAlertToggle = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can change lock settings.",
      );
      return;
    }
    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) return;

    const newValue = !coerceBoolean(settings.tamperAlertEnabled);
    const originalSettings = settings;

    setTamperAlertLoading(true);
    setSettings({ ...settings, tamperAlertEnabled: newValue });

    try {
      console.log(
        "[LockSettings] Setting tamper alert via Bluetooth:",
        newValue,
      );

      await TTLockService.setTamperAlert(newValue, lockData);
      await updateLockSettings(lockId, { tamper_alert_enabled: newValue });

      console.log(
        "[LockSettings] Tamper alert updated via Bluetooth successfully",
      );
      Alert.alert(
        "Success",
        `Tamper alert ${newValue ? "enabled" : "disabled"} via Bluetooth`,
      );
    } catch (err) {
      setSettings(originalSettings);
      console.error("[LockSettings] Tamper alert error:", err);
      Alert.alert(
        "Bluetooth Error",
        `Failed to change tamper alert setting.\n\nError: ${err.message}\n\nMake sure you are within Bluetooth range of the lock.`,
      );
    } finally {
      setTamperAlertLoading(false);
    }
  };

  // =====================================================
  // FACTORY RESET - Bluetooth ONLY
  // =====================================================
  const handleFactoryResetPress = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Permission Denied",
        "Only lock owners and administrators can perform a factory reset.",
      );
      return;
    }

    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) return;

    Alert.alert(
      "Factory Reset",
      "This will:\n\n" +
        "- Reset lock to factory defaults\n" +
        "- Delete ALL passcodes\n" +
        "- Delete ALL fingerprints\n" +
        "- Delete ALL IC cards\n" +
        "- Remove lock from your account\n\n" +
        "This cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Lock",
          style: "destructive",
          onPress: () => {
            navigation.navigate("FactoryReset", {
              lockId,
              lockName: currentLock?.name || currentLock?.location,
              lockData,
              ttlockLockId: currentLock?.ttlock_lock_id,
            });
          },
        },
      ],
    );
  };

  // =====================================================
  // DELETE LOCK
  // =====================================================
  const handleDeleteLockPress = async () => {
    if (!isAdminOrOwner) {
      Alert.alert(
        "Cannot Remove Yourself",
        "Please contact the lock owner to remove your access.",
      );
      return;
    }

    const lockData = await checkBluetoothAndGetLockData();
    if (!lockData) return;

    Alert.alert(
      "Delete Lock",
      "This will:\n\n" +
        "- Factory reset the physical lock\n" +
        "- Remove lock from your account\n" +
        "- Remove all shared user access\n\n" +
        "This cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete & Reset",
          style: "destructive",
          onPress: () => {
            // Navigate to FactoryResetScreen which handles both factory reset AND deletion
            navigation.navigate("FactoryReset", {
              lockId,
              lockName: currentLock?.name || currentLock?.location,
              lockData,
              ttlockLockId: currentLock?.ttlock_lock_id,
              deleteAfterReset: true, // Flag to indicate full deletion after reset
            });
          },
        },
      ],
    );
  };

  // =====================================================
  // RENDER
  // =====================================================
  if (isLoading) {
    return (
      <AppScreen contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </AppScreen>
    );
  }

  if (error || !currentLock) {
    return (
      <AppScreen>
        <Text>{error || "Lock not found"}</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Lock Settings</Text>
          <Text style={styles.headerSubtitle}>
            {currentLock.location || currentLock.name}
          </Text>
        </View>
      </View>

      {/* Bluetooth Settings */}
      <Section
        title="Bluetooth Settings"
        subtitle="Direct connection - requires proximity to lock"
        gapless
      >
        <AppCard padding="none">
          {/* Auto Lock */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleAutoLockToggle}
            disabled={autoLockLoading}
          >
            <View style={styles.settingIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={Colors.iconbackground}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Auto Lock</Text>
              <Text style={styles.settingSubtitle}>
                {settings.autoLockEnabled
                  ? `Locks after ${settings.autoLockDelay}s`
                  : "Disabled"}
              </Text>
            </View>
            {autoLockLoading ? (
              <ActivityIndicator size="small" color={Colors.iconbackground} />
            ) : (
              <Switch
                value={coerceBoolean(settings.autoLockEnabled)}
                onValueChange={handleAutoLockToggle}
                trackColor={{
                  false: Colors.bordercolor,
                  true: Colors.iconbackground,
                }}
                thumbColor={Colors.textwhite}
              />
            )}
          </TouchableOpacity>

          {/* Auto-lock Delay */}
          {coerceBoolean(settings.autoLockEnabled) && (
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleAutoLockDelayPress}
              disabled={autoLockLoading}
            >
              <View style={styles.settingIcon}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={Colors.iconbackground}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Auto-lock Delay</Text>
                <Text style={styles.settingSubtitle}>
                  {settings.autoLockDelay < 60
                    ? `${settings.autoLockDelay} seconds`
                    : `${Math.floor(settings.autoLockDelay / 60)} minute${settings.autoLockDelay >= 120 ? "s" : ""}`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.subtitlecolor}
              />
            </TouchableOpacity>
          )}

          {/* Passage Mode */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handlePassageModeToggle}
            disabled={passageModeLoading}
          >
            <View style={styles.settingIcon}>
              <Ionicons
                name="lock-open-outline"
                size={20}
                color={Colors.iconbackground}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Passage Mode</Text>
              <Text style={styles.settingSubtitle}>
                {settings.passageModeEnabled
                  ? "Lock stays unlocked"
                  : "Normal locking"}
              </Text>
            </View>
            {passageModeLoading ? (
              <ActivityIndicator size="small" color={Colors.iconbackground} />
            ) : (
              <Switch
                value={coerceBoolean(settings.passageModeEnabled)}
                onValueChange={handlePassageModeToggle}
                trackColor={{
                  false: Colors.bordercolor,
                  true: Colors.iconbackground,
                }}
                thumbColor={Colors.textwhite}
              />
            )}
          </TouchableOpacity>

          {/* Lock Sound */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLockSoundToggle}
            disabled={soundLoading}
          >
            <View style={styles.settingIcon}>
              <Ionicons
                name="volume-high-outline"
                size={20}
                color={Colors.iconbackground}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Lock Sound</Text>
              <Text style={styles.settingSubtitle}>
                {settings.lockSoundEnabled ? "Sound enabled" : "Silent mode"}
              </Text>
            </View>
            {soundLoading ? (
              <ActivityIndicator size="small" color={Colors.iconbackground} />
            ) : (
              <Switch
                value={coerceBoolean(settings.lockSoundEnabled)}
                onValueChange={handleLockSoundToggle}
                trackColor={{
                  false: Colors.bordercolor,
                  true: Colors.iconbackground,
                }}
                thumbColor={Colors.textwhite}
              />
            )}
          </TouchableOpacity>

          {/* Tamper Alert */}
          {/* <TouchableOpacity
            style={styles.settingItem}
            onPress={handleTamperAlertToggle}
            disabled={tamperAlertLoading}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="warning-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Tamper Alert</Text>
              <Text style={styles.settingSubtitle}>
                {settings.tamperAlertEnabled ? 'Alert enabled' : 'Alert disabled'}
              </Text>
              <Text style={styles.settingHint}>
                Sounds alarm if lock is tampered with
              </Text>
            </View>
            {tamperAlertLoading ? (
              <ActivityIndicator size="small" color={Colors.iconbackground} />
            ) : (
              <Switch
                value={coerceBoolean(settings.tamperAlertEnabled)}
                onValueChange={handleTamperAlertToggle}
                trackColor={{ false: Colors.bordercolor, true: Colors.iconbackground }}
                thumbColor={Colors.textwhite}
              />
            )}
          </TouchableOpacity> */}

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.settingItem, styles.settingItemLast]}
            onPress={handleResetButtonToggle}
            disabled={resetButtonLoading}
          >
            <View style={styles.settingIcon}>
              <Ionicons
                name="refresh-circle-outline"
                size={20}
                color={Colors.iconbackground}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Physical Reset Button</Text>
              <Text style={styles.settingSubtitle}>
                {settings.resetButtonEnabled
                  ? "Enabled"
                  : "Disabled (more secure)"}
              </Text>
            </View>
            {resetButtonLoading ? (
              <ActivityIndicator size="small" color={Colors.iconbackground} />
            ) : (
              <Switch
                value={coerceBoolean(settings.resetButtonEnabled)}
                onValueChange={handleResetButtonToggle}
                trackColor={{
                  false: Colors.bordercolor,
                  true: Colors.iconbackground,
                }}
                thumbColor={Colors.textwhite}
              />
            )}
          </TouchableOpacity>
        </AppCard>
      </Section>

      {/* Recovery Keys Section - Hidden: Recovery keys are stored in backend only, not displayed in mobile app */}

      {/* Danger Zone - OWNER ONLY (completely hidden from Admin and others) */}
      {isOwner && (
        <Section title="Danger Zone" gapless>
          <AppCard padding="none">
            <TouchableOpacity
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={handleDeleteLockPress}
            >
              <View style={[styles.settingIcon, styles.destructiveIcon]}>
                <Ionicons name="trash-outline" size={20} color={Colors.red} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.destructiveText]}>
                  Delete Lock
                </Text>
                <Text style={styles.settingSubtitle}>
                  Remove from account & factory reset
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </AppCard>
        </Section>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    backgroundColor: Colors.cardbackground,
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Theme.spacing.md,
  },
  warningIcon: {
    backgroundColor: "#FFF3E0",
  },
  destructiveIcon: {
    backgroundColor: "#FFEBEE",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.titlecolor,
  },
  warningText: {
    color: "#FF9500",
  },
  destructiveText: {
    color: Colors.red,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  settingHint: {
    fontSize: 11,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  // Sync Button styles
  syncButton: {
    backgroundColor: Colors.iconbackground,
    padding: Theme.spacing.md,
    margin: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    alignItems: "center",
  },
  syncButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textwhite,
  },
  syncButtonHint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  // Recovery Keys styles
  recoveryKeyContainer: {
    gap: Theme.spacing.md,
  },
  recoveryKeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  recoveryKeyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  recoveryKeyDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  recoveryKeyItem: {
    backgroundColor: Colors.backgroundwhite,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  recoveryKeyLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recoveryKeyValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recoveryKeyValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.titlecolor,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  recoveryKeyWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    backgroundColor: "#FFF3E0",
    padding: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
  },
  recoveryKeyWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
  },
});

export default LockSettingsScreen;
