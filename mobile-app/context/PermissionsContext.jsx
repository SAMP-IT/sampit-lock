import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TTLockService from '../services/ttlockService';

const PermissionsContext = createContext({
  permissionsGranted: false,
  bluetoothEnabled: false,
  isCheckingPermissions: true,
  checkPermissions: () => {},
  setPermissionsVerified: () => {},
});

export const PermissionsProvider = ({ children }) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissionsVerified, setPermissionsVerified] = useState(false);

  // Check permissions on mount and when app comes to foreground
  useEffect(() => {
    checkPermissions();

    // Listen for app state changes to recheck Bluetooth when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[PermissionsContext] App came to foreground, checking Bluetooth...');
        checkBluetoothState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkPermissions = useCallback(async () => {
    setIsCheckingPermissions(true);
    console.log('[PermissionsContext] Checking all permissions...');

    try {
      const [notifGranted, btPermsGranted, btOn] = await Promise.all([
        checkNotificationPermission(),
        checkBluetoothPermissions(),
        checkBluetoothState(),
      ]);

      const allGranted = notifGranted && btPermsGranted;
      setPermissionsGranted(allGranted);
      setBluetoothEnabled(btOn);

      console.log('[PermissionsContext] Status:', {
        notifications: notifGranted,
        bluetoothPermissions: btPermsGranted,
        bluetoothEnabled: btOn,
        allReady: allGranted && btOn,
      });

      // If everything is good, mark as verified
      if (allGranted && btOn) {
        setPermissionsVerified(true);
      }
    } catch (error) {
      console.error('[PermissionsContext] Error checking permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  }, []);

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[PermissionsContext] Notification check error:', error);
      return false;
    }
  };

  const checkBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // Android 12+ (API 31+) requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        // Older versions only need ACCESS_FINE_LOCATION for BLE scanning
        const androidVersion = Platform.Version;

        if (androidVersion >= 31) {
          // Android 12+
          const bluetoothScan = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
          );
          const bluetoothConnect = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          );
          const fineLocation = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          console.log('[PermissionsContext] Android 12+ permissions:', { bluetoothScan, bluetoothConnect, fineLocation });
          return bluetoothScan && bluetoothConnect && fineLocation;
        } else {
          // Android 11 and below - only location needed for BLE
          const fineLocation = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          console.log('[PermissionsContext] Android <12 permissions:', { fineLocation });
          return fineLocation;
        }
      } catch (error) {
        console.error('[PermissionsContext] Bluetooth permissions check error:', error);
        return false;
      }
    }
    // iOS handles permissions differently
    return true;
  };

  const checkBluetoothState = async () => {
    try {
      const state = await TTLockService.getBluetoothState();
      const isOn = state === 'poweredOn';
      setBluetoothEnabled(isOn);
      return isOn;
    } catch (error) {
      console.error('[PermissionsContext] Bluetooth state check error:', error);
      return false;
    }
  };

  const handleSetPermissionsVerified = useCallback((verified) => {
    console.log('[PermissionsContext] Setting permissions verified:', verified);
    setPermissionsVerified(verified);
    if (verified) {
      setPermissionsGranted(true);
      setBluetoothEnabled(true);
    }
  }, []);

  // Determine if we should show permissions screen
  // Show if permissions are not verified OR bluetooth is off
  const shouldShowPermissionsScreen = !permissionsVerified || !bluetoothEnabled;

  return (
    <PermissionsContext.Provider
      value={{
        permissionsGranted,
        bluetoothEnabled,
        isCheckingPermissions,
        shouldShowPermissionsScreen,
        checkPermissions,
        setPermissionsVerified: handleSetPermissionsVerified,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
