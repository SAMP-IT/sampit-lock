import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, PermissionsAndroid, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { SimpleModeText, SimpleModeButton } from '../../components/ui/SimpleMode';
import TTLockService from '../../services/ttlockService';
import { addLock, logLockActivity } from '../../services/api';

// TTLock Bluetooth State constants (from native module)
const BluetoothState = {
  Unknown: 0,
  Resetting: 1,
  Unsupported: 2,
  Unauthorized: 3,
  PoweredOff: 5,
  PoweredOn: 4,
};

// Helper to check if Bluetooth is ready
const isBluetoothReady = (state) => {
  return state === BluetoothState.PoweredOn || state === 'poweredOn';
};

// Helper to get human-readable Bluetooth state
const getBluetoothStateText = (state) => {
  switch (state) {
    case BluetoothState.PoweredOn:
    case 'poweredOn':
      return 'enabled';
    case BluetoothState.PoweredOff:
    case 'poweredOff':
      return 'turned off';
    case BluetoothState.Unauthorized:
    case 'unauthorized':
      return 'not authorized';
    case BluetoothState.Unsupported:
    case 'unsupported':
      return 'not supported on this device';
    case 'unavailable':
      return 'unavailable (native module not loaded)';
    default:
      return `in state ${state}`;
  }
};

const PairLockScreen = ({ navigation }) => {
  const [connectionStatus, setConnectionStatus] = useState('waiting'); // waiting, checking, scanning, selecting, pairing, connected, failed
  const [bluetoothState, setBluetoothState] = useState('unknown');
  const [discoveredLocks, setDiscoveredLocks] = useState([]);
  const [selectedLock, setSelectedLock] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pairedLockData, setPairedLockData] = useState(null);

  useEffect(() => {
    checkBluetoothSetup();
  }, []);

  const checkBluetoothSetup = async () => {
    console.log('[PairLock] Checking Bluetooth setup...');
    setConnectionStatus('checking');

    // Step 1: Request permissions
    const permissionsOk = await requestBluetoothPermissions();
    if (!permissionsOk) {
      setConnectionStatus('failed');
      setErrorMessage('Bluetooth permissions are required to pair locks.');
      return;
    }

    // Step 2: Check Bluetooth state
    try {
      const state = await TTLockService.getBluetoothState();
      console.log('[PairLock] Bluetooth state:', state, '- Ready:', isBluetoothReady(state));
      setBluetoothState(state);

      if (isBluetoothReady(state)) {
        setConnectionStatus('waiting');
      } else {
        setConnectionStatus('failed');
        setErrorMessage(`Bluetooth is ${getBluetoothStateText(state)}. Please enable Bluetooth to continue.`);
      }
    } catch (error) {
      console.error('[PairLock] Bluetooth state error:', error);
      setConnectionStatus('failed');
      setErrorMessage('Failed to check Bluetooth state. Please check permissions.');
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        console.log('[PairLock] Requesting Bluetooth permissions...');
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.log('[PairLock] Permissions denied:', granted);
          return false;
        }

        console.log('[PairLock] All permissions granted');
        return true;
      } catch (err) {
        console.error('[PairLock] Permission error:', err);
        return false;
      }
    }
    return true; // iOS
  };

  const handleStartPairing = async () => {
    if (!isBluetoothReady(bluetoothState)) {
      Alert.alert(
        'Bluetooth Required',
        `Bluetooth is ${getBluetoothStateText(bluetoothState)}. Please turn on Bluetooth to scan for locks.`,
        [
          { text: 'OK' },
          {
            text: 'Check Again',
            onPress: () => checkBluetoothSetup()
          }
        ]
      );
      return;
    }

    setConnectionStatus('scanning');
    setIsScanning(true);
    setDiscoveredLocks([]);

    try {
      console.log('[PairLock] Starting scan for TTLock devices...');
      const locks = await TTLockService.scanLocks(10000); // 10-second scan

      console.log(`[PairLock] Scan completed. Found ${locks.length} device(s)`);
      setDiscoveredLocks(locks);
      setIsScanning(false);

      if (locks.length === 0) {
        setConnectionStatus('failed');
        setErrorMessage('No locks found nearby. Make sure your lock is powered on and within range.');
      } else if (locks.length === 1) {
        // Auto-select if only one lock found
        handleSelectLock(locks[0]);
      } else {
        setConnectionStatus('selecting');
      }
    } catch (error) {
      console.error('[PairLock] Scan error:', error);
      setIsScanning(false);
      setConnectionStatus('failed');
      setErrorMessage(error.message || 'Failed to scan for locks. Please try again.');
    }
  };

  const handleSelectLock = async (lock) => {
    // Prevent double-tap while already processing a selection
    if (connectionStatus === 'pairing' || connectionStatus === 'saving' || connectionStatus === 'connected') {
      return;
    }
    console.log('[PairLock] Lock selected:', lock.lockMac);
    setSelectedLock(lock);

    if (lock.isInitialized) {
      Alert.alert(
        'Lock Already Paired',
        'This lock is already paired with another account. Please select a different lock that is available for pairing.',
        [
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    await pairLock(lock);
  };

  const pairLock = async (lock) => {
    setConnectionStatus('pairing');

    try {
      console.log('[PairLock] Initializing lock via Bluetooth...');
      const lockData = await TTLockService.initializeLock(lock.lockData);

      console.log('[PairLock] Lock paired successfully!');
      console.log('[PairLock] Lock data:', JSON.stringify(lockData, null, 2));
      setPairedLockData(lockData);

      // Save lock to database immediately after Bluetooth pairing
      console.log('[PairLock] Saving lock to database...');
      setConnectionStatus('saving');

      try {
        // Prepare lock data for database
        // IMPORTANT: ttlock_data must be the encrypted lockData string from the SDK,
        // NOT a JSON object. The SDK's controlLock expects this exact string format.
        const encryptedLockData = typeof lockData === 'string' ? lockData : lockData.lockData;

        // Extract recovery keys from the SDK response
        // The TTLock SDK returns these keys during initLock:
        // - adminPwd: Admin passcode for lock management
        // - deletePwd: Factory reset passcode
        // - noKeyPwd: Super/emergency passcode to unlock without credentials
        const rawLockData = lock.lockData || {};
        const adminPwd = rawLockData.adminPwd || lockData.adminPwd || null;
        const deletePwd = rawLockData.deletePwd || lockData.deletePwd || null;
        const noKeyPwd = rawLockData.noKeyPwd || lockData.noKeyPwd || null;

        // Recovery keys are sent to backend for storage (not stored locally in mobile app)
        console.log('[PairLock] Recovery keys from SDK (sending to backend only):', {
          hasAdminPwd: !!adminPwd,
          hasDeletePwd: !!deletePwd,
          hasNoKeyPwd: !!noKeyPwd,
        });

        const lockPayload = {
          name: lock.lockName || 'New Lock', // Temporary name, will be updated in Step 2
          ttlock_mac: lock.lockMac,
          ttlock_data: encryptedLockData, // The encrypted string from initLock
          ttlock_lock_name: lock.lockName,
          ttlock_lock_id: lockData.lockId || null,
          is_bluetooth_paired: true,
          device_id: lockData.lockId ? `ttlock_${lockData.lockId}` : `ttlock_bt_${lock.lockMac}`,
          mac_address: lock.lockMac,
          is_locked: true, // Assume locked by default
          battery_level: lockData.electricQuantity || null,
          // TTLock recovery keys - save for emergency access
          admin_pwd: adminPwd,
          delete_pwd: deletePwd,
          no_key_pwd: noKeyPwd,
        };

        console.log('[PairLock] Lock payload:', JSON.stringify(lockPayload, null, 2));
        const response = await addLock(lockPayload);
        // Backend returns { success: true, data: lockObject }, axios wraps in response.data
        const savedLock = response.data?.data || response.data;

        console.log('[PairLock] Lock saved to database! ID:', savedLock.id);

        // Log the pairing activity
        try {
          await logLockActivity(savedLock.id, 'paired', 'bluetooth');
          console.log('[PairLock] Pairing activity logged');
        } catch (logError) {
          console.warn('[PairLock] Failed to log activity:', logError.message);
        }

        setConnectionStatus('connected');

        // Auto-advance to naming screen after 2 seconds with the database lock ID
        setTimeout(() => {
          navigation.navigate('NameDoor', {
            lockId: savedLock.id,
            lockData: lockData,
            lockMac: lock.lockMac,
            lockName: lock.lockName,
          });
        }, 2000);

      } catch (saveError) {
        console.error('[PairLock] Failed to save lock to database:', saveError);
        // Still proceed to naming screen but with lockData only
        // The naming screen will need to handle this case
        setConnectionStatus('connected');

        Alert.alert(
          'Partial Success',
          'Lock was paired via Bluetooth but could not be saved to the cloud. You can try again from settings.',
          [{ text: 'OK' }]
        );

        setTimeout(() => {
          navigation.navigate('NameDoor', {
            lockData: lockData,
            lockMac: lock.lockMac,
            lockName: lock.lockName,
            needsSave: true, // Flag to indicate lock needs to be saved
          });
        }, 2000);
      }

    } catch (error) {
      console.error('[PairLock] Pairing failed:', error);
      setConnectionStatus('failed');
      setErrorMessage(error.message || 'Failed to pair with lock. Please try again.');
    }
  };

  const resetAndPair = async (lock) => {
    setConnectionStatus('pairing');

    try {
      console.log('[PairLock] Resetting lock...');
      await TTLockService.resetLock(lock.lockData);
      console.log('[PairLock] Lock reset successful, now pairing...');
      await pairLock(lock);
    } catch (error) {
      console.error('[PairLock] Reset/pair failed:', error);
      setConnectionStatus('failed');
      setErrorMessage(error.message || 'Failed to reset lock. Please try again.');
    }
  };

  const renderLockItem = ({ item, isNearest = false }) => {
    const isAvailable = !item.isInitialized;
    
    return (
      <TouchableOpacity
        style={[
          styles.lockCard,
          isAvailable && styles.lockCardAvailable,
          selectedLock?.lockMac === item.lockMac && styles.lockCardSelected,
          isNearest && isAvailable && styles.lockCardNearest
        ]}
        onPress={() => handleSelectLock(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.lockIconContainer,
          isAvailable && !isNearest && styles.lockIconContainerAvailable,
          isNearest && isAvailable && styles.lockIconContainerNearest
        ]}>
          <Ionicons
            name={item.isInitialized ? 'lock-closed' : 'lock-open-outline'}
            size={24}
            color={item.isInitialized ? Colors.subtitlecolor : Colors.iconbackground}
          />
          {isNearest && isAvailable && (
            <View style={styles.locationPinOverlay}>
              <Ionicons name="location" size={12} color={Colors.iconbackground} />
            </View>
          )}
        </View>
        <View style={styles.lockInfo}>
          <View style={styles.lockNameRow}>
            <Text style={[
              styles.lockName,
              isAvailable && styles.lockNameAvailable
            ]}>
              {item.lockName}
            </Text>
            {isNearest && isAvailable && (
              <View style={styles.nearestBadge}>
                <Ionicons name="star" size={10} color={Colors.textwhite} />
                <Text style={styles.nearestBadgeText}>NEAREST</Text>
              </View>
            )}
          </View>
          <View style={styles.lockStatusRow}>
            {isAvailable ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={Colors.iconbackground} />
                <Text style={styles.lockStatusAvailable}>
                  Available to Pair
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="information-circle-outline" size={16} color={Colors.subtitlecolor} />
                <Text style={styles.lockStatus}>
                  Already Paired
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.signalContainer}>
          <Ionicons
            name="bluetooth"
            size={18}
            color={isAvailable ? Colors.iconbackground : Colors.subtitlecolor}
          />
          <Text style={[
            styles.signalText,
            isAvailable && styles.signalTextAvailable
          ]}>
            {item.rssi} dBm
          </Text>
          {isAvailable && item.rssi > -70 && (
            <Text style={styles.signalStrengthLabel}>STRONG</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.loadingIconWrap}>
              <ActivityIndicator size="large" color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Checking Bluetooth...
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Verifying permissions and Bluetooth status
            </SimpleModeText>
          </View>
        );

      case 'scanning':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.loadingIconWrap}>
              <Ionicons name="bluetooth-outline" size={32} color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Scanning for locks...
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Keep your phone near the door. This takes about 10 seconds.
            </SimpleModeText>
            <ActivityIndicator size="small" color={Colors.iconbackground} style={{ marginTop: 16 }} />
          </View>
        );

      case 'selecting':
        // Sort locks: available first, then by signal strength (highest RSSI = nearest)
        const sortedLocks = [...discoveredLocks].sort((a, b) => {
          // Available locks first
          if (!a.isInitialized && b.isInitialized) return -1;
          if (a.isInitialized && !b.isInitialized) return 1;
          // Then sort by RSSI (higher = closer)
          return (b.rssi || -100) - (a.rssi || -100);
        });
        
        // Find the nearest available lock
        const nearestAvailableLock = sortedLocks.find(lock => !lock.isInitialized);
        const nearestLockMac = nearestAvailableLock?.lockMac;

        return (
          <View style={styles.statusContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="search" size={32} color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              {discoveredLocks.length} Lock{discoveredLocks.length > 1 ? 's' : ''} Found
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Select the lock you want to pair
            </SimpleModeText>

            <FlatList
              data={sortedLocks}
              renderItem={({ item }) => renderLockItem({ item, isNearest: item.lockMac === nearestLockMac })}
              keyExtractor={(item) => item.lockMac}
              style={styles.locksList}
              scrollEnabled={false}
            />

            <SimpleModeButton
              onPress={handleStartPairing}
              icon="refresh-outline"
              style={styles.rescanButton}
            >
              Scan Again
            </SimpleModeButton>
          </View>
        );

      case 'pairing':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.loadingIconWrap}>
              <ActivityIndicator size="large" color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Pairing with lock...
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              {selectedLock?.lockName || 'Lock'} is being initialized. Please wait.
            </SimpleModeText>
          </View>
        );

      case 'saving':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.loadingIconWrap}>
              <ActivityIndicator size="large" color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Saving to cloud...
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Syncing your lock with your account. Almost done!
            </SimpleModeText>
          </View>
        );

      case 'connected':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Connected!
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Your lock is paired. Moving to next step...
            </SimpleModeText>
          </View>
        );

      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={32} color="#FF6B6B" />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Connection failed
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              {errorMessage || 'Something went wrong. Please try again.'}
            </SimpleModeText>
            <SimpleModeButton onPress={handleStartPairing} style={styles.retryButton}>
              Try Again
            </SimpleModeButton>
          </View>
        );

      default: // waiting
        return (
          <View style={styles.statusContainer}>
            <View style={styles.iconWrap}>
              <Ionicons name="radio-outline" size={32} color={Colors.iconbackground} />
            </View>
            <SimpleModeText variant="title" style={styles.statusTitle}>
              Ready to pair
            </SimpleModeText>
            <SimpleModeText style={styles.statusDescription}>
              Stand near your door. We'll scan for locks automatically.
            </SimpleModeText>
            
            <View style={styles.wakeUpReminder}>
              <View style={styles.wakeUpIconContainer}>
                <Ionicons name="flash-outline" size={20} color={Colors.iconbackground} />
              </View>
              <Text style={styles.wakeUpText}>
                <Text style={styles.wakeUpTextBold}>Wake up the lock</Text> before Start
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.stepIndicator}>Step 1 of 2</Text>
          <SimpleModeText variant="heading" style={styles.headerTitle}>
            Pair the lock
          </SimpleModeText>
        </View>
      </View>

      <AppCard style={styles.mainCard}>
        {renderConnectionStatus()}

        {connectionStatus === 'waiting' && (
          <>
            <SimpleModeButton
              onPress={handleStartPairing}
              icon="play-outline"
              style={styles.startButton}
            >
              Start
            </SimpleModeButton>
          </>
        )}
      </AppCard>

      <AppCard style={styles.helpCard}>
        <View style={styles.helpHeader}>
          <View style={styles.helpIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.helpTitle}>
            Tips for success
          </SimpleModeText>
        </View>
        <View style={styles.helpList}>
          <SimpleModeText style={styles.helpItem}>
            • Make sure you wake up the lock by touching the lock keypad before Start
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • Stand within 2 meters of your door
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • Make sure your lock has fresh batteries
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • If it fails, hold the reset button for 5 seconds
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • Ensure Bluetooth is enabled on your phone
          </SimpleModeText>
        </View>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  stepIndicator: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },
  headerTitle: {
    marginTop: 2,
  },
  mainCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  statusContainer: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    width: '100%',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  loadingIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  statusTitle: {
    textAlign: 'center',
  },
  statusDescription: {
    textAlign: 'center',
    maxWidth: 280,
  },
  wakeUpReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F7F5', // Light teal background matching app theme
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: 12,
    marginTop: Theme.spacing.md,
    borderWidth: 2,
    borderColor: Colors.iconbackground,
    gap: Theme.spacing.sm,
    maxWidth: 320,
  },
  wakeUpIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeUpText: {
    fontSize: 14,
    color: Colors.titlecolor,
    textAlign: 'center',
  },
  wakeUpTextBold: {
    fontWeight: '700',
    color: Colors.iconbackground,
  },
  locksList: {
    width: '100%',
    maxHeight: 300,
    marginTop: Theme.spacing.md,
  },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundcolor,
    padding: Theme.spacing.md,
    borderRadius: 12,
    marginBottom: Theme.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lockCardAvailable: {
    backgroundColor: '#f0f9ff', // Light blue background
    borderColor: '#bae6fd', // Light blue border
    borderWidth: 2,
  },
  lockCardNearest: {
    backgroundColor: '#f0fdf4', // Light green background
    borderColor: '#bbf7d0', // Light green border
    borderWidth: 2.5,
    shadowColor: Colors.iconbackground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  lockCardSelected: {
    borderColor: Colors.iconbackground,
    backgroundColor: `${Colors.iconbackground}15`,
  },
  lockIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
    position: 'relative',
  },
  lockIconContainerAvailable: {
    backgroundColor: '#dbeafe', // Light blue icon background for available locks
  },
  lockIconContainerNearest: {
    backgroundColor: '#dcfce7', // Light green icon background for nearest lock
  },
  locationPinOverlay: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E0F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.iconbackground,
  },
  lockInfo: {
    flex: 1,
  },
  lockNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  lockName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  lockNameAvailable: {
    color: Colors.iconbackground,
    fontWeight: '700',
  },
  lockMac: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginBottom: 2,
  },
  lockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  lockStatus: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    fontStyle: 'italic',
  },
  lockStatusAvailable: {
    fontSize: 12,
    color: Colors.iconbackground,
    fontWeight: '600',
    fontStyle: 'normal',
  },
  nearestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#86efac', // Light green badge for nearest lock
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#bfdbfe', // Light blue badge for available locks
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  nearestBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textwhite,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signalContainer: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  signalText: {
    fontSize: 10,
    color: Colors.subtitlecolor,
  },
  signalTextAvailable: {
    fontSize: 11,
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  signalStrengthLabel: {
    fontSize: 9,
    color: Colors.iconbackground,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  startButton: {
    minWidth: 120,
  },
  retryButton: {
    marginTop: Theme.spacing.md,
  },
  rescanButton: {
    marginTop: Theme.spacing.md,
  },
  helpCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  helpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 16,
  },
  helpList: {
    gap: Theme.spacing.xs,
  },
  helpItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PairLockScreen;
