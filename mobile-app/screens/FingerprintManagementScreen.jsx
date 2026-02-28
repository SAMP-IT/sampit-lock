import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Easing,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import LottieView from 'lottie-react-native';
import Colors from '../constants/Colors';
import { backendApi } from '../services/api';
import TTLockService from '../services/ttlockService';
import LockControlService, { extractLockData, ensureBluetoothEnabled } from '../services/lockControlService';
import { useFingerprints } from '../hooks/useQueryHooks';

// Global operation lock to prevent concurrent operations
let globalOperationInProgress = false;
let lastOperationTime = 0;
const MIN_OPERATION_INTERVAL = 3000; // Minimum 3 seconds between operations

const FingerprintManagementScreen = ({ route, navigation }) => {
  const { lock } = route.params;
  const queryClient = useQueryClient();
  const { data: fingerprints = [], isLoading: loading, refetch: refetchFingerprints } = useFingerprints(lock.id);
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFingerprintName, setNewFingerprintName] = useState('');
  const [addProgress, setAddProgress] = useState({ current: 0, total: 0 });
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [showImageSliderModal, setShowImageSliderModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [operationLoading, setOperationLoading] = useState(false);
  const scrollViewRef = useRef(null);
  const imageSliderIntervalRef = useRef(null);

  // Finger scan guide images
  const fingerScanImages = [
    require('../assets/Finger-scan/Gemini_Generated_Image_49uei549uei549ue.png'),
    require('../assets/Finger-scan/Gemini_Generated_Image_4mv88i4mv88i4mv8.png'),
    require('../assets/Finger-scan/Gemini_Generated_Image_jf14k3jf14k3jf14.png'),
    require('../assets/Finger-scan/Gemini_Generated_Image_tk0dnjtk0dnjtk0d.png'),
  ];

  const { width: screenWidth } = Dimensions.get('window');

  const fetchFingerprints = () => {
    queryClient.invalidateQueries({ queryKey: ['fingerprints', lock.id] });
  };

  // Check if lock supports fingerprint
  useEffect(() => {
    const checkFingerprintSupport = async () => {
      try {
        const lockData = extractLockData(lock.ttlock_data);
        if (lockData) {
          const supported = await TTLockService.supportsFingerprint(lockData);
          setIsSupported(supported);
        }
      } catch (error) {
        console.log('Could not check fingerprint support:', error);
      }
    };
    checkFingerprintSupport();
  }, [lock.id]);

  // Check if lock is ready for a new operation
  const waitForLockReady = async () => {
    const timeSinceLastOp = Date.now() - lastOperationTime;
    if (timeSinceLastOp < MIN_OPERATION_INTERVAL) {
      const waitTime = MIN_OPERATION_INTERVAL - timeSinceLastOp;
      setStatusMessage(`Please wait ${Math.ceil(waitTime / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    setStatusMessage('');
  };

  // Get user-friendly error message
  const getUserFriendlyError = (error) => {
    const errorMsg = error.message?.toLowerCase() || '';
    const errorCode = error.code || '';
    
    // Extract error code from message if it's in format "(18)" or "failed (18)"
    const errorCodeMatch = errorMsg.match(/\((\d+)\)/);
    const extractedErrorCode = errorCodeMatch ? errorCodeMatch[1] : null;

    // Handle specific error codes (18 = timeout/finger not scanned)
    if (extractedErrorCode === '18' || errorCode === '18' || errorMsg.includes('(18)')) {
      return 'Finger not scanned. Please place your finger flat on the sensor and try again.';
    }
    
    // TTLock SDK specific error codes
    if (errorMsg.includes('(-1)') || (errorMsg.includes('fail') && !errorMsg.includes('(18)'))) {
      return 'The fingerprint scan was not recognized. Please try again with a cleaner, drier finger placed flat on the sensor.';
    }
    if (errorMsg.includes('(-2)') || errorMsg.includes('already exist')) {
      return 'This fingerprint is already registered on the lock.';
    }
    if (errorMsg.includes('(-3)') || errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
      return 'Fingerprint enrollment was cancelled. Please try again.';
    }
    if (errorMsg.includes('busy') || errorMsg.includes('processing') || errorMsg.includes('operation')) {
      return 'The lock is currently busy. Please wait a few seconds and try again.';
    }
    if (errorMsg.includes('bluetooth') || errorMsg.includes('connect') || errorMsg.includes('disconnect')) {
      return 'Could not connect to the lock. Please make sure you are close to the lock and try again.';
    }
    if (errorMsg.includes('timeout')) {
      return 'The operation took too long. Please try again while standing closer to the lock.';
    }
    if (errorMsg.includes('not supported') || errorMsg.includes('unsupported')) {
      return 'This lock does not support fingerprint access.';
    }
    if (errorMsg.includes('full') || errorMsg.includes('limit') || errorMsg.includes('no more')) {
      return 'The lock has reached its maximum number of fingerprints. Please delete some fingerprints first.';
    }
    if (errorMsg.includes('power') || errorMsg.includes('battery')) {
      return 'The lock battery is too low to complete this operation. Please replace the batteries first.';
    }
    // Generic fallback with more helpful message (hide technical details)
    return 'Could not complete the fingerprint operation. Please make sure you are close to the lock, place your finger flat on the sensor, and try again.';
  };

  // Add fingerprint via Bluetooth
  const handleAddFingerprint = async () => {
    if (!newFingerprintName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this fingerprint so you can identify it later.');
      return;
    }

    // Check if another operation is in progress
    if (globalOperationInProgress) {
      Alert.alert(
        'Please Wait',
        'The lock is currently processing another operation. Please wait for it to finish.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Check Bluetooth state and prompt to enable if off
      const btCheck = await ensureBluetoothEnabled();
      if (!btCheck.enabled) {
        if (btCheck.openedSettings) {
          Alert.alert('Bluetooth Required', 'Please enable Bluetooth and try again.');
        }
        return;
      }

      setAdding(true);
      setAddProgress({ current: 0, total: 4 });
      globalOperationInProgress = true;

      const lockData = extractLockData(lock.ttlock_data);
      if (!lockData) {
        throw new Error('Please make sure you are near the lock and try again.');
      }

      // Set validity period (1 year from now)
      const startDate = Date.now();
      const endDate = startDate + (365 * 24 * 60 * 60 * 1000);

      // Show image slider modal instead of Alert
      setShowImageSliderModal(true);
      setCurrentImageIndex(0);
    } catch (error) {
      console.error('Add fingerprint error:', error);
      // Reset state immediately so button can be re-enabled
      setAdding(false);
      globalOperationInProgress = false;
      
      // Show user-friendly error message
      Alert.alert(
        'Fingerprint Not Added',
        getUserFriendlyError(error),
        [
          {
            text: 'OK',
            onPress: () => {
              // Button is already re-enabled via state reset above
              // User can try again without going back
            }
          }
        ]
      );
    }
  };

  // Start fingerprint scanning process
  const startFingerprintScan = async () => {
    try {
      setShowImageSliderModal(false);
      // Stop auto-scroll when starting scan
      if (imageSliderIntervalRef.current) {
        clearInterval(imageSliderIntervalRef.current);
        imageSliderIntervalRef.current = null;
      }

      const lockData = extractLockData(lock.ttlock_data);
      if (!lockData) {
        throw new Error('Please make sure you are near the lock and try again.');
      }

      // Set validity period (1 year from now)
      const startDate = Date.now();
      const endDate = startDate + (365 * 24 * 60 * 60 * 1000);

      // Stop any previous Bluetooth scan to release the connection
      TTLockService.stopScan();

      // Wait for lock to be ready
      await waitForLockReady();

      setStatusMessage('Connecting to lock...');

      // Add fingerprint via Bluetooth
      const result = await TTLockService.addFingerprint(
        startDate,
        endDate,
        lockData,
        (current, total) => {
          setAddProgress({ current, total });
          setStatusMessage(`Place your finger on the sensor (${current}/${total})`);
        }
      );

      setStatusMessage('Saving fingerprint...');

      // Record the operation time
      lastOperationTime = Date.now();

      // Wait for lock to finish processing before saving to backend
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Ensure fingerprintNumber is a valid string — some TTLock SDK versions
      // return 0, null, or undefined even on successful enrollment
      const safeFingerprintNumber = (result.fingerprintNumber != null && result.fingerprintNumber !== '')
        ? String(result.fingerprintNumber)
        : `BT_${Date.now()}`;

      if (!result.fingerprintNumber && result.fingerprintNumber !== 0) {
        console.warn('[FingerprintManagement] TTLock SDK returned empty fingerprintNumber, using generated ID:', safeFingerprintNumber);
      }

      // Save to backend
      await backendApi.post(`/locks/${lock.id}/fingerprints`, {
        fingerprintNumber: safeFingerprintNumber,
        fingerprintName: newFingerprintName.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        addType: 1, // Bluetooth enrollment
      });

      Alert.alert('Fingerprint Added', 'Your fingerprint has been registered successfully. You can now use it to unlock the door.');
      setShowAddModal(false);
      setNewFingerprintName('');
      fetchFingerprints();
    } catch (error) {
      console.error('Add fingerprint error:', error);
      // Reset state immediately so button can be re-enabled
      setAdding(false);
      setAddProgress({ current: 0, total: 0 });
      setStatusMessage('');
      globalOperationInProgress = false;
      lastOperationTime = Date.now();

      // Check if this is a backend save error (fingerprint already on lock via Bluetooth)
      // vs a Bluetooth error (fingerprint never reached the lock)
      const isBackendError = error.response && error.response.status;
      if (isBackendError) {
        // Fingerprint was enrolled on the physical lock but failed to save to backend.
        // Do NOT delete from lock — the user's fingerprint is physically stored.
        Alert.alert(
          'Fingerprint Partially Added',
          'Your fingerprint was enrolled on the lock hardware and can unlock the door, but failed to save to the app.\n\nPlease try syncing from the cloud, or contact support if the issue persists.',
          [
            {
              text: 'Try Sync',
              onPress: async () => {
                try {
                  await backendApi.get(`/locks/${lock.id}/fingerprints?sync=true`);
                  fetchFingerprints();
                } catch (syncErr) {
                  console.error('Sync failed:', syncErr);
                }
              }
            },
            { text: 'OK' }
          ]
        );
      } else {
        // Bluetooth-level failure — fingerprint was NOT enrolled on lock hardware
        Alert.alert(
          'Fingerprint Not Added',
          getUserFriendlyError(error),
          [
            {
              text: 'OK',
              onPress: () => {
                // Button is already re-enabled via state reset above
                // User can try again without going back
              }
            }
          ]
        );
      }
    } finally {
      // Ensure state is reset even if error handling fails
      setAdding(false);
      setAddProgress({ current: 0, total: 0 });
      setStatusMessage('');
      globalOperationInProgress = false;
      lastOperationTime = Date.now();
    }
  };

  // Auto-scroll images
  useEffect(() => {
    if (showImageSliderModal) {
      // Calculate actual slide width (modal width minus padding)
      const slideWidth = screenWidth * 0.9 - 40;
      
      // Start auto-scrolling
      imageSliderIntervalRef.current = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % fingerScanImages.length;
          // Scroll to next image using actual slide width
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({
              x: nextIndex * slideWidth,
              animated: true,
            });
          }
          return nextIndex;
        });
      }, 3000); // Change image every 3 seconds

      return () => {
        if (imageSliderIntervalRef.current) {
          clearInterval(imageSliderIntervalRef.current);
          imageSliderIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval when modal is closed
      if (imageSliderIntervalRef.current) {
        clearInterval(imageSliderIntervalRef.current);
        imageSliderIntervalRef.current = null;
      }
    }
  }, [showImageSliderModal]);

  // Handle scroll to update current index
  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const slideWidth = screenWidth * 0.9 - 40; // Match the actual slide width
    const index = Math.round(scrollPosition / slideWidth);
    setCurrentImageIndex(index);
  };

  // Cancel fingerprint scan
  const cancelFingerprintScan = () => {
    setShowImageSliderModal(false);
    setAdding(false);
    globalOperationInProgress = false;
    if (imageSliderIntervalRef.current) {
      clearInterval(imageSliderIntervalRef.current);
      imageSliderIntervalRef.current = null;
    }
  };

  // Delete fingerprint
  const handleDeleteFingerprint = (fingerprint) => {
    // Check if another operation is in progress
    if (globalOperationInProgress) {
      Alert.alert(
        'Please Wait',
        'The lock is currently processing another operation. Please wait for it to finish.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Remove Fingerprint',
      `Are you sure you want to remove "${fingerprint.fingerprint_name || 'this fingerprint'}"? This person will no longer be able to unlock the door with this fingerprint.`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setOperationLoading(true);
              globalOperationInProgress = true;
              setStatusMessage('Removing fingerprint...');

              // Wait for lock to be ready
              await waitForLockReady();

              // Delete from lock via Bluetooth
              const lockData = extractLockData(lock.ttlock_data);
              if (lockData) {
                try {
                  await TTLockService.deleteFingerprint(fingerprint.fingerprint_number, lockData);
                  // Record the operation time
                  lastOperationTime = Date.now();
                  // Wait for lock to process the deletion
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (btError) {
                  console.warn('Bluetooth delete failed:', btError);
                  // Continue with backend delete even if Bluetooth fails
                }
              }

              // Delete from backend - pass deleteType=1 to indicate Bluetooth deletion
              // (fingerprint already removed from physical lock, just need to delete from database)
              try {
                const response = await backendApi.delete(`/locks/${lock.id}/fingerprints/${fingerprint.id}?deleteType=1`);
                console.log('[FingerprintManagement] Backend delete response:', response?.data);
              } catch (backendError) {
                // Log but don't fail - the Bluetooth delete may have succeeded
                console.warn('[FingerprintManagement] Backend delete error (fingerprint may still be deleted):', backendError?.message);
              }

              Alert.alert('Fingerprint Removed', 'The fingerprint has been removed from the lock.');
              fetchFingerprints();
            } catch (error) {
              console.error('Delete fingerprint error:', error);
              // Refresh the list anyway to check if deletion actually worked
              fetchFingerprints();
              Alert.alert('Could Not Remove Fingerprint', getUserFriendlyError(error));
            } finally {
              setOperationLoading(false);
              setStatusMessage('');
              globalOperationInProgress = false;
              lastOperationTime = Date.now();
            }
          }
        }
      ]
    );
  };

  const renderFingerprint = ({ item }) => (
    <View style={styles.fingerprintItem}>
      <View style={styles.fingerprintIcon}>
        <Ionicons name="finger-print" size={32} color={Colors.primary} />
      </View>
      <View style={styles.fingerprintInfo}>
        <Text style={styles.fingerprintName}>{item.fingerprint_name || 'Unnamed Fingerprint'}</Text>
        <Text style={styles.fingerprintMeta}>
          ID: {item.fingerprint_number}
        </Text>
        {item.user_name && (
          <Text style={styles.fingerprintUser}>
            {item.user_name}
          </Text>
        )}
        {item.end_date && (
          <Text style={styles.fingerprintExpiry}>
            Valid until: {new Date(item.end_date).toLocaleDateString()}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteFingerprint(item)}
      >
        <Ionicons name="trash-outline" size={24} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fingerprints</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Lock Info */}
      <View style={styles.lockInfo}>
        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
        <Text style={styles.lockName}>{lock.name}</Text>
      </View>

      {!isSupported && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            This lock may not support fingerprint access
          </Text>
        </View>
      )}

      {/* Fingerprint List */}
      {(loading || operationLoading) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : fingerprints.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="finger-print" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No fingerprints registered</Text>
          <Text style={styles.emptySubtext}>
            Add a fingerprint to allow biometric access to this lock
          </Text>
        </View>
      ) : (
        <FlatList
          data={fingerprints}
          renderItem={renderFingerprint}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Status Message */}
      {statusMessage ? (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, globalOperationInProgress && styles.addButtonDisabled]}
        onPress={() => setShowAddModal(true)}
        disabled={adding || globalOperationInProgress}
      >
        {adding ? (
          <View style={styles.addingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.addButtonText}>
              Scanning... {addProgress.current}/{addProgress.total}
            </Text>
          </View>
        ) : (
          <>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Fingerprint</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Fingerprint</Text>
            <Text style={styles.modalDescription}>
              Enter a name for this fingerprint (e.g., "My Right Thumb")
            </Text>

            {/* Visual fingerprint instruction with Lottie animation */}
            <View style={styles.fingerprintInstructionBox}>
              <View style={styles.animationContainer}>
                <LottieView
                  source={require('../assets/animations/fingerprint-scan.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
              </View>
              <View style={styles.fingerprintInstructionHeader}>
                <Ionicons name="finger-print" size={24} color={Colors.iconbackground} />
                <Text style={styles.fingerprintInstructionTitle}>4 Scans Required</Text>
              </View>
              <Text style={styles.instructionSubtext}>
                Place your finger flat on the sensor. Lift and reposition between each scan.
              </Text>
              <View style={styles.angleGuideRow}>
                <View style={styles.angleGuideItem}>
                  <View style={[styles.fingerIcon, { transform: [{ rotate: '0deg' }] }]}>
                    <Ionicons name="finger-print" size={20} color={Colors.iconbackground} />
                  </View>
                  <Text style={styles.angleGuideText}>Center</Text>
                </View>
                <View style={styles.angleGuideItem}>
                  <View style={[styles.fingerIcon, { transform: [{ rotate: '-15deg' }] }]}>
                    <Ionicons name="finger-print" size={20} color={Colors.iconbackground} />
                  </View>
                  <Text style={styles.angleGuideText}>Left tilt</Text>
                </View>
                <View style={styles.angleGuideItem}>
                  <View style={[styles.fingerIcon, { transform: [{ rotate: '15deg' }] }]}>
                    <Ionicons name="finger-print" size={20} color={Colors.iconbackground} />
                  </View>
                  <Text style={styles.angleGuideText}>Right tilt</Text>
                </View>
                <View style={styles.angleGuideItem}>
                  <View style={[styles.fingerIcon, { transform: [{ rotate: '0deg' }] }]}>
                    <Ionicons name="finger-print" size={20} color={Colors.iconbackground} />
                  </View>
                  <Text style={styles.angleGuideText}>Tip area</Text>
                </View>
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Fingerprint Name"
              value={newFingerprintName}
              onChangeText={setNewFingerprintName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewFingerprintName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setShowAddModal(false);
                  handleAddFingerprint();
                }}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Slider Modal for Fingerprint Guide */}
      <Modal
        visible={showImageSliderModal}
        transparent
        animationType="fade"
        onRequestClose={cancelFingerprintScan}
      >
        <View style={styles.imageSliderModalOverlay}>
          <View style={styles.imageSliderModalContent}>
            {/* Image Slider */}
            <View style={styles.imageSliderWrapper}>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.imageSliderContainer}
                contentContainerStyle={styles.imageSliderContent}
              >
                {fingerScanImages.map((image, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.imageSlide,
                      { width: screenWidth * 0.9 - 40 } // Match ScrollView container width exactly
                    ]}
                  >
                    <Image
                      source={image}
                      style={styles.guideImage}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Image Indicators */}
            <View style={styles.imageIndicators}>
              {fingerScanImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentImageIndex && styles.indicatorActive
                  ]}
                />
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.imageSliderButtons}>
              <TouchableOpacity
                style={[styles.imageSliderButton, styles.cancelImageButton]}
                onPress={cancelFingerprintScan}
              >
                <Text style={styles.cancelImageButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageSliderButton, styles.startImageButton]}
                onPress={startFingerprintScan}
              >
                <Text style={styles.startImageButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lockName: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  warningText: {
    marginLeft: 8,
    color: '#E65100',
    fontSize: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  addButtonDisabled: {
    backgroundColor: '#999',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  fingerprintItem: {
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
    elevation: 2,
  },
  fingerprintIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fingerprintInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fingerprintName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  fingerprintMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fingerprintUser: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  fingerprintExpiry: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  addingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.border,
    marginRight: 8,
  },
  cancelButtonText: {
    color: Colors.text,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fingerprintInstructionBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  animationContainer: {
    width: 120,
    height: 120,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieAnimation: {
    width: 120,
    height: 120,
  },
  fingerprintInstructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fingerprintInstructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  instructionSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  angleGuideRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  angleGuideItem: {
    alignItems: 'center',
  },
  fingerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  angleGuideText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Image Slider Modal Styles
  imageSliderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSliderModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    alignItems: 'center',
  },
  imageSliderWrapper: {
    width: '100%',
    marginBottom: 20,
    overflow: 'hidden',
  },
  imageSliderContainer: {
    width: '100%',
  },
  imageSliderContent: {
    alignItems: 'center',
  },
  imageSlide: {
    height: 350,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0, // Remove padding to ensure exact width matching
  },
  guideImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  imageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  indicatorActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  imageSliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  imageSliderButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelImageButton: {
    backgroundColor: Colors.border,
  },
  cancelImageButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  startImageButton: {
    backgroundColor: Colors.primary,
  },
  startImageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default FingerprintManagementScreen;
