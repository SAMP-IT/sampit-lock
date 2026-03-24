import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TTLockService from '../../services/ttlockService';
import { addLock, getTTLockStatus, initializeTTLock, logLockActivity } from '../../services/api';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const BluetoothLockPairingScreen = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredLocks, setDiscoveredLocks] = useState([]);
  const [bluetoothState, setBluetoothState] = useState('unknown');
  const [selectedLock, setSelectedLock] = useState(null);
  const [isPairing, setIsPairing] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isCheckingState, setIsCheckingState] = useState(true);
  const [ttlockConnected, setTTLockConnected] = useState(false);

  useEffect(() => {
    checkTTLockAndInitialize();
  }, []);

  const checkTTLockAndInitialize = async () => {
    // First verify TTLock account is connected (safety check)
    try {
      const response = await getTTLockStatus();
      const statusPayload = response?.data ?? response;
      const normalizedStatus = statusPayload?.data ?? statusPayload;

      if (!normalizedStatus?.connected) {
        Alert.alert(
          'Cloud Account Required',
          'Please connect your cloud account before pairing a lock.',
          [
            {
              text: 'Connect Now',
              onPress: () => navigation.replace('ConnectTTLock')
            },
            {
              text: 'Go Back',
              style: 'cancel',
              onPress: () => navigation.goBack()
            }
          ]
        );
        return;
      }

      setTTLockConnected(true);
      initializeBluetoothSetup();
    } catch (error) {
      console.log('[BluetoothPairing] TTLock status check failed:', error.message);
      Alert.alert(
        'Cloud Account Required',
        'Please connect your cloud account before pairing a lock.',
        [
          {
            text: 'Connect Now',
            onPress: () => navigation.replace('ConnectTTLock')
          },
          {
            text: 'Go Back',
            style: 'cancel',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };

  const initializeBluetoothSetup = async () => {
    console.log('[BluetoothPairing] Initializing Bluetooth setup...');
    setIsCheckingState(true);

    // Step 1: Request permissions first
    const permissionsOk = await requestBluetoothPermissions();

    // Step 2: Only check Bluetooth state if permissions are granted
    if (permissionsOk) {
      await checkBluetoothState();
    }

    setIsCheckingState(false);
  };

  const checkBluetoothState = async () => {
    try {
      console.log('[BluetoothPairing] Checking Bluetooth state...');
      const state = await TTLockService.getBluetoothState();
      console.log('[BluetoothPairing] Bluetooth state received:', state);
      setBluetoothState(state);

      if (state !== 'poweredOn') {
        Alert.alert(
          'Bluetooth Required',
          `Bluetooth is currently ${state}. Please enable Bluetooth in your device settings to scan for locks.`,
          [
            { text: 'OK' },
            {
              text: 'Refresh',
              onPress: () => checkBluetoothState()
            }
          ]
        );
      }
    } catch (error) {
      console.error('[BluetoothPairing] Bluetooth state error:', error);
      setBluetoothState('error');
      Alert.alert(
        'Bluetooth Error',
        `Failed to check Bluetooth state: ${error.message}\n\nThis might be a permission or native module issue. Please check the console logs.`,
        [
          { text: 'OK' },
          {
            text: 'Retry',
            onPress: () => initializeBluetoothSetup()
          }
        ]
      );
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        console.log('[BluetoothPairing] Requesting Bluetooth permissions...');

        const androidVersion = Platform.Version;

        // Android 12+ (API 31+): request new Bluetooth permissions + fine location
        // Android 11 and below: only request fine location for BLE
        const permissions =
          androidVersion >= 31
            ? [
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              ]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        console.log('[BluetoothPairing] Permission results:', granted);

        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        setPermissionsGranted(allGranted);

        if (!allGranted) {
          const deniedPermissions = Object.entries(granted)
            .filter(([_, status]) => status !== PermissionsAndroid.RESULTS.GRANTED)
            .map(([permission]) => permission.split('.').pop());

          Alert.alert(
            'Permissions Required',
            `The following permissions are required to scan for locks:\n\n${deniedPermissions.join('\n')}\n\nPlease grant these permissions in your device settings.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Retry',
                onPress: () => requestBluetoothPermissions()
              }
            ]
          );
          return false;
        }

        console.log('[BluetoothPairing] All permissions granted');
        return true;
      } catch (err) {
        console.error('[BluetoothPairing] Permission request error:', err);
        setPermissionsGranted(false);
        return false;
      }
    } else {
      // iOS - permissions are requested automatically when needed
      console.log('[BluetoothPairing] iOS - permissions will be requested when scanning');
      setPermissionsGranted(true);
      return true;
    }
  };

  const startScanning = async () => {
    if (bluetoothState !== 'poweredOn') {
      Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to scan for locks.');
      return;
    }

    // Check if TTLock SDK is available
    if (!TTLockService.isAvailable()) {
      Alert.alert(
        'SDK Not Available',
        'The native module is not properly loaded. This usually happens if:\n\n1. The app needs to be rebuilt\n2. Bluetooth permissions are not granted\n3. The native module failed to initialize\n\nPlease try rebuilding the app or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsScanning(true);
      setDiscoveredLocks([]);

      console.log('[BluetoothPairing] Starting 10 second scan for TTLock devices...');
      const locks = await TTLockService.scanLocks(10000); // 10 second scan

      console.log('[BluetoothPairing] Scan completed. Found', locks.length, 'locks');
      setDiscoveredLocks(locks);
      setIsScanning(false);

      if (locks.length === 0) {
        Alert.alert(
          'No Locks Found',
          'No devices found nearby. Make sure the lock is powered on and within range.\n\nTroubleshooting:\n• Lock is powered on (batteries fresh)\n• Lock is within 2 meters\n• Bluetooth is enabled\n• Location permissions granted',
          [
            { text: 'Scan Again', onPress: startScanning },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('[BluetoothPairing] Scan error:', error);
      setIsScanning(false);
      Alert.alert('Scan Error', error.message);
    }
  };

  const stopScanning = () => {
    TTLockService.stopScan();
    setIsScanning(false);
  };

  const handleSelectLock = async (lock) => {
    if (lock.isInitialized) {
      Alert.alert(
        'Lock Already Paired',
        'This lock is already paired. You can:\n\n1. Add as read-only (view status only)\n2. Reset and pair (full control, removes lock app access)',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Read-Only',
            onPress: () => addExistingLock(lock)
          },
          {
            text: 'Reset & Pair',
            style: 'destructive',
            onPress: () => resetAndPair(lock)
          }
        ]
      );
      return;
    }

    setSelectedLock(lock);
    pairLock(lock);
  };

  const addExistingLock = async (lock) => {
    // Add lock without full pairing - save to database first as read-only
    try {
      console.log('[BluetoothPairing] Adding existing lock as read-only...');
      const response = await addLock({
        name: lock.lockName || 'Existing Lock',
        ttlock_mac: lock.lockMac,
        ttlock_data: null, // No admin keys - read only
        ttlock_lock_name: lock.lockName,
        is_bluetooth_paired: false, // Can't control, just monitor
        device_id: `ttlock_bt_${lock.lockMac}`,
        mac_address: lock.lockMac,
        battery_level: 50,
        is_locked: true
      });

      const savedLock = response.data;
      console.log('[BluetoothPairing] Read-only lock saved! ID:', savedLock.id);

      // Navigate to naming screen with lockId
      navigation.navigate('NameDoor', {
        lockId: savedLock.id,
        lockMac: lock.lockMac,
        lockName: lock.lockName,
        isReadOnly: true,
      });
    } catch (error) {
      console.error('[BluetoothPairing] Failed to add existing lock:', error);
      Alert.alert('Failed', error.message);
    }
  };

  const pairLock = async (lock) => {
    setIsPairing(true);

    try {
      // Step 1: Initialize lock via Bluetooth (gets encrypted lockData string)
      console.log('[BluetoothPairing] Initializing lock via Bluetooth...');
      const localLockData = await TTLockService.initializeLock(lock.lockData);
      console.log('[BluetoothPairing] Local pairing successful!');
      console.log('[BluetoothPairing] Lock data:', JSON.stringify(localLockData, null, 2));

      // Step 2: Register lock with TTLock cloud (if TTLock account is connected)
      let cloudLockId = null;
      if (ttlockConnected) {
        try {
          console.log('[BluetoothPairing] Registering lock with cloud...');
          const cloudResponse = await initializeTTLock(
            localLockData.lockData,
            localLockData.lockName
          );
          cloudLockId = cloudResponse.data?.data?.lockId;
          console.log('[BluetoothPairing] Cloud registration successful, lockId:', cloudLockId);
        } catch (cloudError) {
          console.warn('[BluetoothPairing] Cloud registration failed (non-fatal):', cloudError.message);
          // Don't fail the whole pairing if cloud registration fails
        }
      }

      // Step 3: Save lock to database IMMEDIATELY after Bluetooth pairing
      console.log('[BluetoothPairing] Saving lock to database...');
      try {
        // IMPORTANT: ttlock_data must be the encrypted lockData string from the SDK,
        // NOT a JSON object. The SDK's controlLock expects this exact string format.
        const encryptedLockData = localLockData.lockData || (typeof localLockData === 'string' ? localLockData : null);

        // Note: electricQuantity comes from scan data (lock.lockData), not from initLock result
        const batteryLevel = lock.lockData?.electricQuantity ?? 100;

        // Extract recovery keys from the SDK response
        // The TTLock SDK returns these keys during initLock:
        // - adminPwd: Admin passcode for lock management
        // - deletePwd: Factory reset passcode
        // - noKeyPwd: Super/emergency passcode to unlock without credentials
        const rawLockData = lock.lockData || {};
        const adminPwd = rawLockData.adminPwd || localLockData.adminPwd || null;
        const deletePwd = rawLockData.deletePwd || localLockData.deletePwd || null;
        const noKeyPwd = rawLockData.noKeyPwd || localLockData.noKeyPwd || null;

        // Recovery keys are sent to backend for storage (not stored locally in mobile app)
        console.log('[BluetoothPairing] Recovery keys from SDK (sending to backend only):', {
          hasAdminPwd: !!adminPwd,
          hasDeletePwd: !!deletePwd,
          hasNoKeyPwd: !!noKeyPwd,
        });

        const lockPayload = {
          name: lock.lockName || 'New Lock', // Temporary name, will be updated in NameDoor screen
          ttlock_mac: lock.lockMac,
          ttlock_data: encryptedLockData, // The encrypted string from initLock
          ttlock_lock_name: lock.lockName,
          ttlock_lock_id: cloudLockId || null, // Only from cloud registration
          is_bluetooth_paired: true,
          device_id: cloudLockId ? `ttlock_${cloudLockId}` : `ttlock_bt_${lock.lockMac}`,
          mac_address: lock.lockMac,
          is_locked: true,
          battery_level: batteryLevel,
          // TTLock recovery keys - save for emergency access
          admin_pwd: adminPwd,
          delete_pwd: deletePwd,
          no_key_pwd: noKeyPwd,
        };

        console.log('[BluetoothPairing] Lock payload:', JSON.stringify(lockPayload, null, 2));
        const response = await addLock(lockPayload);
        // Backend returns { success: true, data: lockObject }, axios wraps in response.data
        const savedLock = response.data?.data || response.data;

        console.log('[BluetoothPairing] Lock saved to database! ID:', savedLock.id);

        // Log the pairing activity
        try {
          await logLockActivity(savedLock.id, 'paired', 'bluetooth');
          console.log('[BluetoothPairing] Pairing activity logged');
        } catch (logError) {
          console.warn('[BluetoothPairing] Failed to log activity:', logError.message);
        }

        setIsPairing(false);

        // Step 4: Navigate to naming screen with database lock ID
        navigation.navigate('NameDoor', {
          lockId: savedLock.id,
          lockData: localLockData,
          lockMac: lock.lockMac,
          lockName: lock.lockName,
        });

      } catch (saveError) {
        console.error('[BluetoothPairing] Failed to save lock to database:', saveError);
        setIsPairing(false);

        // Still allow user to proceed, but with needsSave flag
        Alert.alert(
          'Partial Success',
          'Lock was paired via Bluetooth but could not be saved to the cloud. You can complete setup and try again from settings.',
          [
            {
              text: 'Continue',
              onPress: () => {
                navigation.navigate('NameDoor', {
                  lockData: localLockData,
                  lockMac: lock.lockMac,
                  lockName: lock.lockName,
                  needsSave: true,
                });
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }

    } catch (error) {
      setIsPairing(false);
      setSelectedLock(null);
      console.error('[BluetoothPairing] Pairing failed:', error);

      // Provide more helpful error message for common issues
      let errorMessage = error.message;
      if (error.message.includes('time out') || error.message.includes('disconnected')) {
        errorMessage = `${error.message}\n\nTroubleshooting tips:\n• Move closer to the lock (within 1 meter)\n• Make sure the lock has fresh batteries\n• Hold the reset button on the lock for 5 seconds\n• Try again in a few seconds`;
      }

      Alert.alert('Pairing Failed', errorMessage);
    }
  };

  const resetAndPair = async (lock) => {
    Alert.alert(
      'Reset Lock',
      'Resetting the lock will remove all users and settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsPairing(true);
              await TTLockService.resetLock(lock.lockData);
              // After reset, pair again
              await pairLock(lock);
            } catch (error) {
              setIsPairing(false);
              Alert.alert('Reset Failed', error.message);
            }
          }
        }
      ]
    );
  };


  const renderLockItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.lockItem,
        selectedLock?.lockMac === item.lockMac && styles.selectedLockItem
      ]}
      onPress={() => handleSelectLock(item)}
      disabled={isPairing}
    >
      <View style={styles.lockIcon}>
        <Ionicons
          name={item.isInitialized ? 'lock-closed' : 'lock-open-outline'}
          size={32}
          color={item.isInitialized ? Colors.subtitlecolor : Colors.primary}
        />
      </View>

      <View style={styles.lockInfo}>
        <Text style={styles.lockName}>{item.lockName}</Text>
        <Text style={styles.lockMac}>{item.lockMac}</Text>
        <Text style={styles.lockStatus}>
          {item.isInitialized ? 'Already Paired' : 'Available'}
        </Text>
      </View>

      <View style={styles.signalStrength}>
        <Ionicons
          name="bluetooth"
          size={20}
          color={item.rssi > -70 ? Colors.green : Colors.subtitlecolor}
        />
        <Text style={styles.rssiText}>{item.rssi} dBm</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pair Lock via Bluetooth</Text>
        <Text style={styles.subtitle}>
          {isScanning
            ? 'Scanning for nearby locks...'
            : `${discoveredLocks.length} lock(s) found`}
        </Text>
      </View>

      {/* Bluetooth Status Card */}
      <View style={[
        styles.bluetoothStatusCard,
        bluetoothState === 'poweredOn' ? styles.bluetoothOn : styles.bluetoothOff
      ]}>
        <View style={styles.bluetoothStatusHeader}>
          <Ionicons
            name="bluetooth"
            size={24}
            color={bluetoothState === 'poweredOn' ? Colors.green : Colors.red}
          />
          <View style={styles.bluetoothStatusInfo}>
            <Text style={styles.bluetoothStatusTitle}>
              Bluetooth Status: {bluetoothState === 'poweredOn' ? 'ON' : bluetoothState === 'error' ? 'ERROR' : 'OFF'}
            </Text>
            <Text style={styles.bluetoothStatusSubtitle}>
              {isCheckingState
                ? 'Checking Bluetooth state...'
                : bluetoothState === 'poweredOn'
                  ? 'Ready to scan for locks'
                  : bluetoothState === 'error'
                    ? 'Failed to detect Bluetooth state'
                    : `Please enable Bluetooth (Currently: ${bluetoothState})`
              }
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={checkBluetoothState}
            disabled={isCheckingState}
          >
            {isCheckingState ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={discoveredLocks}
        renderItem={renderLockItem}
        keyExtractor={(item) => item.lockMac}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color={Colors.subtitlecolor} />
            <Text style={styles.emptyText}>
              {isScanning ? 'Searching...' : 'No locks found'}
            </Text>
            <Text style={styles.emptySubtext}>
              Make sure your lock is powered on and within range
            </Text>
          </View>
        }
      />

      <View style={styles.bottomContainer}>
        {isScanning ? (
          <TouchableOpacity
            style={[styles.scanButton, styles.stopButton]}
            onPress={stopScanning}
          >
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>Stop Scanning</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.scanButton,
                bluetoothState !== 'poweredOn' && styles.scanButtonDisabled
              ]}
              onPress={startScanning}
              disabled={bluetoothState !== 'poweredOn' || isCheckingState}
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {discoveredLocks.length > 0 ? 'Check for New Devices' : 'Start Scanning'}
              </Text>
            </TouchableOpacity>

            {discoveredLocks.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setDiscoveredLocks([])}
              >
                <Text style={styles.clearButtonText}>Clear Results</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {isPairing && (
        <View style={styles.pairingOverlay}>
          <View style={styles.pairingModal}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.pairingText}>Pairing with lock...</Text>
            <Text style={styles.pairingSubtext}>Please wait</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  bluetoothStatusCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  bluetoothOn: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  bluetoothOff: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  bluetoothStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bluetoothStatusInfo: {
    flex: 1,
  },
  bluetoothStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bluetoothStatusSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  lockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedLockItem: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  lockInfo: {
    flex: 1,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lockMac: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  lockStatus: {
    fontSize: 12,
    color: '#666',
  },
  signalStrength: {
    alignItems: 'center',
    gap: 4,
  },
  rssiText: {
    fontSize: 10,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  stopButton: {
    backgroundColor: Colors.red,
  },
  scanButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.subtitlecolor,
    alignItems: 'center',
  },
  clearButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontWeight: '500',
  },
  pairingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingModal: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  pairingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  pairingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});

export default BluetoothLockPairingScreen;
