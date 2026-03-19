import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { updateLock } from '../services/api';

/**
 * Check if ttlock_data contains valid data for Bluetooth control.
 * Returns object with control capabilities.
 */
const checkTTLockData = (ttlockData, hasGateway, ttlockLockId) => {
  const result = {
    hasBluetoothControl: false,
    hasCloudControl: false,
    hasCloudKeys: false
  };

  // Cloud control is available if lock has gateway AND ttlock_lock_id
  if (hasGateway && ttlockLockId) {
    result.hasCloudControl = true;
  }

  if (!ttlockData) return result;

  // If it's a plain string that doesn't start with '{', it's likely the encrypted lockData
  if (typeof ttlockData === 'string' && !ttlockData.startsWith('{')) {
    result.hasBluetoothControl = true;
    return result;
  }

  // Try to parse as JSON and check for lockData or cloud keys
  try {
    const parsed = JSON.parse(ttlockData);
    // Valid for Bluetooth if it has the lockData property (from Bluetooth pairing)
    if (parsed.lockData && typeof parsed.lockData === 'string') {
      result.hasBluetoothControl = true;
    }
    // Cloud-imported locks have lockKey/aesKeyStr - can use Cloud API if gateway
    if (parsed.lockKey && parsed.aesKeyStr) {
      result.hasCloudKeys = true;
      // If we have gateway and cloud keys, we can use cloud API
      if (hasGateway) {
        result.hasCloudControl = true;
      }
    }
  } catch (e) {
    // If parse fails, might be raw encrypted string
    result.hasBluetoothControl = true;
  }

  return result;
};

/**
 * Main prominent lock card - full width, with two separate Lock/Unlock buttons
 */
const LockCard = ({
  lock,
  onPress,
  onLock,
  onUnlock,
  onLockUpdated,
  isProminent = false,
  isLocking = false,
  isUnlocking = false,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasGateway = lock.has_gateway === true || lock.has_gateway === 'true';
  const batteryLevel = lock.battery_level || 0;

  const ttlockCapabilities = checkTTLockData(lock.ttlock_data, hasGateway, lock.ttlock_lock_id);
  const hasCloudControl = ttlockCapabilities.hasCloudControl;
  const hasBluetooth = ttlockCapabilities.hasBluetoothControl;

  const getControlMethod = () => {
    if (hasCloudControl && hasBluetooth) return 'hybrid';
    if (hasCloudControl) return 'cloud';
    if (hasBluetooth) return 'bluetooth';
    return 'none';
  };

  const controlMethod = getControlMethod();
  const isProcessing = isLocking || isUnlocking;
  const canControl = controlMethod !== 'none';

  // Schedule status for scheduled/time-restricted users
  const scheduleStatus = useMemo(() => {
    // Only check for scheduled role with time restrictions
    const userRole = lock.userRole || lock.user_role;
    if (!lock.time_restricted && userRole !== 'scheduled') {
      return { isWithinSchedule: true, message: null };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Check day of week
    const allowedDays = lock.days_of_week || [0, 1, 2, 3, 4, 5, 6];
    if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
      const nextAllowedDay = allowedDays.find(d => d > currentDay) || allowedDays[0];
      return {
        isWithinSchedule: false,
        message: `Available ${dayNames[nextAllowedDay]}`
      };
    }

    // Check time window
    if (lock.time_restriction_start && lock.time_restriction_end) {
      const startTime = lock.time_restriction_start.slice(0, 5);
      const endTime = lock.time_restriction_end.slice(0, 5);

      if (currentTime < startTime) {
        return {
          isWithinSchedule: false,
          message: `Available from ${startTime}`
        };
      }

      if (currentTime > endTime) {
        return {
          isWithinSchedule: false,
          message: `Available tomorrow ${startTime}`
        };
      }
    }

    return { isWithinSchedule: true, message: null };
  }, [lock]);

  // Adjusted canControl based on schedule
  const effectiveCanControl = canControl && scheduleStatus.isWithinSchedule;

  const handleUnlock = (e) => {
    e.stopPropagation();
    if (effectiveCanControl && onUnlock && !isProcessing) {
      onUnlock(lock);
    } else if (!scheduleStatus.isWithinSchedule) {
      Alert.alert(
        'Access Restricted',
        `You can only access this lock during your scheduled times.\n\n${scheduleStatus.message}`
      );
    }
  };

  const handleLock = (e) => {
    e.stopPropagation();
    if (effectiveCanControl && onLock && !isProcessing) {
      onLock(lock);
    } else if (!scheduleStatus.isWithinSchedule) {
      Alert.alert(
        'Access Restricted',
        `You can only access this lock during your scheduled times.\n\n${scheduleStatus.message}`
      );
    }
  };

  const handleSettings = (e) => {
    e.stopPropagation();
    if (onPress) {
      onPress(lock);
    }
  };

  const handleEditPress = (e) => {
    e.stopPropagation();
    // Pre-fill with current display name or empty for new name
    const currentName = getLockDisplayName();
    setEditName(currentName === 'My Lock' ? '' : currentName);
    setShowEditModal(true);
  };

  const handleSaveName = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Please enter a valid lock name.');
      return;
    }

    // Skip API call if name hasn't changed
    const currentName = getLockDisplayName();
    if (trimmedName === currentName) {
      setShowEditModal(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateLock(lock.id, { name: trimmedName });
      setShowEditModal(false);
      Alert.alert('Success', 'Lock name updated successfully!');
      // Notify parent to refresh data
      if (onLockUpdated) {
        onLockUpdated();
      }
    } catch (error) {
      console.error('Failed to update lock name:', error);
      Alert.alert('Error', 'Failed to update lock name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Get user-given lock name
  // Priority: name (if not a model number) > location > 'My Lock'
  const getLockDisplayName = () => {
    const name = lock.name;

    // Check if name looks like a TTLock model number
    // Patterns to detect:
    // - M201_12345678 (starts with letter(s) + numbers + underscore)
    // - P6PRO_ABC123 (letters + numbers + underscore)
    // - S31_ABCD1234 (letter + numbers + underscore)
    // - LOCK_12345678 (all caps + underscore + alphanumeric)
    // - Pure alphanumeric codes like "ABC123DEF456"
    // - MAC address style: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
    const modelNumberPatterns = [
      /^[A-Z]+\d*_/i,                    // M201_, P6PRO_, S31_
      /^[A-Z0-9]+_[A-Z0-9]+$/i,          // LOCK_12345678
      /^[A-Z]{1,3}\d+[A-Z]*_/i,          // M201_, S31PRO_
      /^[A-F0-9]{2}[:\-][A-F0-9]{2}/i,   // MAC address style
      /^[A-Z0-9]{12,}$/i,                // Long alphanumeric codes
      /^New Lock$/i,                      // Default name from pairing
    ];

    const isModelNumber = name && modelNumberPatterns.some(pattern => pattern.test(name));

    if (name && !isModelNumber) {
      return name;
    }
    // Fallback to 'My Lock' (not location, as requested)
    return 'My Lock';
  };

  // Get battery color
  const getBatteryColor = () => {
    if (batteryLevel <= 0 || batteryLevel > 100) return Colors.subtitlecolor;
    if (batteryLevel <= 20) return '#FF3B30';
    if (batteryLevel <= 50) return '#FF9500';
    return '#34C759';
  };

  // Prominent card layout (full width, two buttons)
  if (isProminent) {
    return (
      <>
        {/* Edit Name Modal */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Lock Name</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Ionicons name="close" size={24} color={Colors.subtitlecolor} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Give your lock a custom name that will be displayed throughout the app.
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Front Door, Office, Garage"
                placeholderTextColor={Colors.subtitlecolor}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                maxLength={50}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowEditModal(false)}
                  disabled={isSaving}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton, (isSaving || !editName.trim()) && styles.modalButtonDisabled]}
                  onPress={handleSaveName}
                  disabled={isSaving || !editName.trim()}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.textwhite} />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <TouchableOpacity
          style={styles.prominentCard}
          onPress={() => onPress(lock)}
          activeOpacity={0.9}
        >
          {/* Top Row: Edit Icon + Lock Name | Passage Mode Indicator (when on) | Battery Level */}
          <View style={styles.topRow}>
            <View style={styles.nameWithEditContainer}>
              <TouchableOpacity
                style={styles.editButtonInline}
                onPress={handleEditPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="create-outline" size={16} color={Colors.iconbackground} />
              </TouchableOpacity>
              <Text style={styles.prominentLockName} numberOfLines={1}>
                {getLockDisplayName()}
              </Text>
            </View>
            {(lock.passage_mode_enabled || lock.passageModeEnabled) && (
              <View style={styles.passageModeIndicator}>
                <Ionicons name="swap-horizontal" size={14} color={Colors.iconbackground} />
                <Text style={styles.passageModeLabel}>Passage</Text>
              </View>
            )}
            <View style={styles.batteryBadgeCompact}>
              <Ionicons
                name={batteryLevel <= 25 ? "battery-dead" : batteryLevel <= 50 ? "battery-half" : "battery-full"}
                size={18}
                color={getBatteryColor()}
              />
              <Text style={[styles.batteryBadgeTextCompact, { color: getBatteryColor() }]}>
                {batteryLevel > 0 && batteryLevel <= 100 ? `${batteryLevel}%` : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Second Row: Control Buttons */}
          <View style={styles.secondRow}>
            {/* Control Buttons */}
            {canControl ? (
              !scheduleStatus.isWithinSchedule ? (
                // Schedule restricted - show disabled buttons with message
                <View style={styles.controlButtonsColumn}>
                  <View style={styles.scheduleRestrictedBadgeCompact}>
                    <Ionicons name="time-outline" size={14} color={Colors.subtitlecolor} />
                    <Text style={styles.scheduleRestrictedTextCompact}>{scheduleStatus.message}</Text>
                  </View>
                  <View style={styles.controlButtonsRowCompact}>
                    <TouchableOpacity
                      style={[styles.controlButtonCompact, styles.controlButtonScheduleDisabled]}
                      onPress={handleUnlock}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="lock-open" size={16} color={Colors.subtitlecolor} />
                      <Text style={styles.controlButtonTextDisabledCompact}>Unlock</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.controlButtonCompact, styles.controlButtonScheduleDisabled]}
                      onPress={handleLock}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="lock-closed" size={16} color={Colors.subtitlecolor} />
                      <Text style={styles.controlButtonTextDisabledCompact}>Lock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Normal control buttons
                <View style={styles.controlButtonsRowCompact}>
                  {/* Unlock Button */}
                  <TouchableOpacity
                    style={[
                      styles.controlButtonCompact,
                      styles.unlockButton,
                      isUnlocking && styles.controlButtonProcessing,
                      isLocking && styles.controlButtonDisabled,
                    ]}
                    onPress={handleUnlock}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isUnlocking ? (
                      <ActivityIndicator size="small" color={Colors.textwhite} />
                    ) : (
                      <Ionicons name="lock-open" size={16} color={Colors.textwhite} />
                    )}
                    <Text style={styles.controlButtonTextCompact}>
                      {isUnlocking ? '...' : 'Unlock'}
                    </Text>
                  </TouchableOpacity>

                  {/* Lock Button */}
                  <TouchableOpacity
                    style={[
                      styles.controlButtonCompact,
                      styles.lockButtonStyle,
                      isLocking && styles.controlButtonProcessing,
                      isUnlocking && styles.controlButtonDisabled,
                    ]}
                    onPress={handleLock}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isLocking ? (
                      <ActivityIndicator size="small" color={Colors.textwhite} />
                    ) : (
                      <Ionicons name="lock-closed" size={16} color={Colors.textwhite} />
                    )}
                    <Text style={styles.controlButtonTextCompact}>
                      {isLocking ? '...' : 'Lock'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.noControlContainerCompact}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF3B30" />
                <Text style={styles.noControlTextCompact}>No control available</Text>
              </View>
            )}
          </View>

          {/* Bottom Row - Explore More Features */}
          <View style={styles.prominentFooter}>
            <TouchableOpacity
              style={[styles.settingsButton, isProcessing && { opacity: 0.4 }]}
              onPress={handleSettings}
              disabled={isProcessing}
            >
              <Ionicons name="settings-outline" size={18} color={Colors.subtitlecolor} />
              <Text style={styles.settingsText}>Explore More Features</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </>
    );
  }

  // Mini card for lock selector (when multiple locks)
  return (
    <TouchableOpacity
      style={styles.miniCard}
      onPress={() => onPress(lock)}
      activeOpacity={0.8}
    >
      <View style={[
        styles.miniLockIcon,
        { backgroundColor: canControl ? Colors.iconbackground : Colors.subtitlecolor }
      ]}>
        <Ionicons
          name={canControl ? 'lock-closed' : 'alert-circle-outline'}
          size={24}
          color={Colors.textwhite}
        />
      </View>
      <Text style={styles.miniLockName} numberOfLines={1}>
        {getLockDisplayName()}
      </Text>
      <Text style={styles.miniBattery}>{batteryLevel}%</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Prominent Card Styles (Full Width) - Compact Version
  prominentCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    paddingTop: Theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    minHeight: 140,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  nameWithEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: Theme.spacing.sm,
  },
  editButtonInline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundwhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  prominentLockName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
    flex: 1,
  },
  passageModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.pill,
    marginRight: Theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.red || '#FF3B30',
    flexShrink: 0,
  },
  passageModeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  batteryBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundwhite,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
    flexShrink: 0,
  },
  batteryBadgeTextCompact: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Theme.spacing.sm,
  },
  controlButtonsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    width: '100%',
    marginTop: Theme.spacing.md,
  },
  controlButtonsRowCompact: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    flex: 1,
  },
  controlButtonsColumn: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
    borderRadius: Theme.radius.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  unlockButton: {
    backgroundColor: '#FF9500',
  },
  lockButtonStyle: {
    backgroundColor: Colors.iconbackground,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonProcessing: {
    opacity: 0.8,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  controlButtonTextCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  scheduleRestrictedContainer: {
    gap: Theme.spacing.sm,
  },
  scheduleRestrictedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: Colors.cardbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    marginBottom: Theme.spacing.sm,
  },
  scheduleRestrictedBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.cardbackground,
    paddingVertical: 4,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
  },
  scheduleRestrictedText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  scheduleRestrictedTextCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  controlButtonScheduleDisabled: {
    backgroundColor: Colors.cardbackground,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  controlButtonTextDisabled: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  controlButtonTextDisabledCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  noControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.md,
  },
  noControlContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
    flex: 1,
  },
  noControlText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
  noControlTextCompact: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '500',
  },
  prominentFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
  },
  settingsText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },

  // Mini Card Styles (For Lock Selector)
  miniCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    alignItems: 'center',
    width: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  miniLockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  miniLockName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: 4,
  },
  miniBattery: {
    fontSize: 11,
    color: Colors.subtitlecolor,
  },

  // Edit Button Styles

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.backgroundwhite,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  modalCloseButton: {
    padding: Theme.spacing.xs,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.lg,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    fontSize: 16,
    color: Colors.titlecolor,
    backgroundColor: Colors.cardbackground,
    marginBottom: Theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.cardbackground,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  modalSaveButton: {
    backgroundColor: Colors.iconbackground,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default LockCard;
