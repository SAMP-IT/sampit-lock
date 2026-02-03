import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import ttlockService from '../services/ttlockService';
import { backendApi, factoryResetLock, factoryResetLockComplete } from '../services/api';

const FactoryResetScreen = ({ navigation, route }) => {
  const { lockId, lockName, lockData, ttlockLockId, deleteAfterReset } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [bluetoothState, setBluetoothState] = useState(null);
  const [step, setStep] = useState('info'); // info, confirm, resetting, success, manual
  const [resetMethod, setResetMethod] = useState(null); // 'bluetooth' or 'manual'

  useEffect(() => {
    checkBluetooth();
  }, []);

  const checkBluetooth = async () => {
    if (!ttlockService.isAvailable()) {
      setBluetoothState('unavailable');
      return;
    }

    const state = await ttlockService.getBluetoothState();
    setBluetoothState(state);
  };

  const handleBluetoothReset = async () => {
    if (!lockData) {
      Alert.alert(
        'Lock Data Required',
        'This lock does not have Bluetooth data saved. Please use manual reset instead.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    setStep('resetting');

    try {
      console.log('[FactoryReset] Starting Bluetooth factory reset...');

      // Step 1: Reset via Bluetooth SDK (physically resets the lock)
      await ttlockService.resetLock(lockData);
      console.log('[FactoryReset] Bluetooth reset completed');

      // Step 2: Call backend to handle cleanup
      if (deleteAfterReset) {
        // Full deletion - remove lock from account completely
        console.log('[FactoryReset] Deleting lock from account after reset...');
        try {
          await backendApi.delete(`/locks/${lockId}`);
          console.log('[FactoryReset] Lock deleted from account');
        } catch (apiError) {
          console.warn('[FactoryReset] Backend delete warning:', apiError.message);
        }
      } else {
        // Factory reset only - clear data but keep lock record
        try {
          const response = await factoryResetLockComplete(lockId);
          console.log('[FactoryReset] Backend factory reset completed:', response.data);
        } catch (apiError) {
          console.warn('[FactoryReset] Backend cleanup warning:', apiError.message);
        }
      }

      setStep('success');
    } catch (error) {
      console.error('[FactoryReset] Bluetooth reset error:', error);
      Alert.alert(
        'Reset Failed',
        `Failed to reset the lock: ${error.message}\n\nPlease try manual reset instead.`,
        [
          { text: 'Try Manual Reset', onPress: () => setStep('manual') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      setStep('info');
    } finally {
      setLoading(false);
    }
  };

  const handleCloudReset = async () => {
    if (!ttlockLockId) {
      Alert.alert('Not Available', 'Cloud reset requires cloud connection');
      return;
    }

    setLoading(true);
    setStep('resetting');

    try {
      console.log('[FactoryReset] Starting cloud-based reset...');

      // Call our backend which clears TTLock Cloud data + local database
      // But keeps the lock record
      const response = await factoryResetLockComplete(lockId);
      console.log('[FactoryReset] Cloud reset completed:', response.data);

      setStep('success');
    } catch (error) {
      console.error('[FactoryReset] Cloud reset error:', error);
      Alert.alert(
        'Reset Failed',
        error.response?.data?.error?.message || 'Failed to reset lock via cloud. The lock may not be connected via a gateway. Try Bluetooth or manual reset instead.',
        [
          { text: 'Try Manual Reset', onPress: () => setStep('manual') },
          { text: 'Cancel', style: 'cancel', onPress: () => setStep('info') },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualResetComplete = async () => {
    // Called after user performs manual reset on the physical lock
    setLoading(true);

    try {
      console.log('[FactoryReset] Completing manual reset - clearing database...');

      if (deleteAfterReset) {
        // Full deletion - remove lock from account completely
        await backendApi.delete(`/locks/${lockId}`);
        console.log('[FactoryReset] Lock deleted from account');

        Alert.alert(
          'Lock Deleted',
          'The lock has been removed from your account. You can add it again using the "Add Lock" feature.',
          [{ text: 'OK', onPress: () => navigation.navigate('ConsumerTabs') }]
        );
      } else {
        // Factory reset only - clear data but keep lock record
        const response = await factoryResetLockComplete(lockId);
        console.log('[FactoryReset] Manual reset data cleared:', response.data);

        Alert.alert(
          'Data Cleared',
          'All access data has been cleared from your account. You will need to re-pair with the lock via Bluetooth to use it again.',
          [{ text: 'OK', onPress: () => navigation.navigate('LockDetailScreen', { lockId, forceRefresh: true }) }]
        );
      }
    } catch (error) {
      console.error('[FactoryReset] Manual reset complete error:', error);
      Alert.alert('Error', 'Failed to clear lock data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromAccount = async () => {
    // This completely removes the lock from the account (used in LockSettingsScreen delete)
    // NOT used for factory reset - factory reset should keep the lock
    setLoading(true);

    try {
      console.log('[FactoryReset] Removing lock from account completely...');

      // Delete from our database completely
      await backendApi.delete(`/locks/${lockId}`);

      // Delete from TTLock Cloud if connected
      if (ttlockLockId) {
        try {
          await backendApi.post(`/ttlock-v3/lock/delete`, { lockId: ttlockLockId });
        } catch (cloudError) {
          console.error('Failed to delete from TTLock Cloud:', cloudError);
        }
      }

      Alert.alert(
        'Lock Removed',
        'The lock has been removed from your account.',
        [{ text: 'OK', onPress: () => navigation.navigate('ConsumerTabs') }]
      );
    } catch (error) {
      console.error('[FactoryReset] Remove from account error:', error);
      Alert.alert('Error', 'Failed to remove lock from account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Factory Reset',
      'This will permanently delete all data from the lock including:\n\n- All passcodes\n- All fingerprints\n- All IC cards\n- All user access\n- Lock settings\n\nThis action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Lock',
          style: 'destructive',
          onPress: handleBluetoothReset,
        },
      ]
    );
  };

  const renderInfoStep = () => (
    <>
      {/* Warning Card */}
      <View style={styles.warningCard}>
        <Ionicons name="warning" size={32} color="#FF4444" />
        <Text style={styles.warningTitle}>
          {deleteAfterReset ? 'Delete Lock' : 'Factory Reset'}
        </Text>
        <Text style={styles.warningText}>
          {deleteAfterReset
            ? 'This will factory reset the lock and remove it from your account. This action cannot be undone.'
            : 'This will erase all data from the lock and restore it to factory settings. This action cannot be undone.'
          }
        </Text>
      </View>

      {/* Lock Info */}
      <View style={styles.lockInfoCard}>
        <Ionicons name="lock-closed" size={24} color={Colors.primary} />
        <View style={styles.lockInfo}>
          <Text style={styles.lockName}>{lockName || 'Unknown Lock'}</Text>
          <Text style={styles.lockId}>ID: {lockId?.substring(0, 8)}...</Text>
        </View>
      </View>

      {/* Reset Options */}
      <Text style={styles.sectionTitle}>Choose Reset Method</Text>

      {/* Cloud Reset Option - Only show if NOT deleting */}
      {!deleteAfterReset && (
        <TouchableOpacity
          style={[
            styles.optionCard,
            !ttlockLockId && styles.optionCardDisabled,
          ]}
          onPress={() => {
            Alert.alert(
              'Reset All Shared Access',
              'This will invalidate all shared eKeys for this lock. The admin (owner) access will be preserved.\n\nNote: Full factory reset requires Bluetooth or physical reset button.\n\nContinue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset Access', style: 'destructive', onPress: handleCloudReset },
              ]
            );
          }}
          disabled={!ttlockLockId}
        >
          <View style={[styles.optionIcon, { backgroundColor: '#9C27B0' + '20' }]}>
            <Ionicons name="key-outline" size={24} color="#9C27B0" />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>Reset All Access (Cloud)</Text>
            <Text style={styles.optionDescription}>
              {ttlockLockId
                ? 'Invalidate all shared eKeys via gateway'
                : 'Lock not connected to Cloud'}
            </Text>
          </View>
          {ttlockLockId && (
            <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
          )}
        </TouchableOpacity>
      )}

      {/* Bluetooth Reset Option - TRUE Factory Reset */}
      <TouchableOpacity
        style={[
          styles.optionCard,
          (bluetoothState !== 'poweredOn' || !lockData) && styles.optionCardDisabled,
        ]}
        onPress={() => {
          setResetMethod('bluetooth');
          setStep('confirm');
        }}
        disabled={bluetoothState !== 'poweredOn' || !lockData}
      >
        <View style={[styles.optionIcon, { backgroundColor: Colors.primary + '20' }]}>
          <Ionicons name="bluetooth" size={24} color={Colors.primary} />
        </View>
        <View style={styles.optionInfo}>
          <Text style={styles.optionTitle}>
            {deleteAfterReset ? 'Reset & Delete (Bluetooth)' : 'Full Factory Reset (Bluetooth)'}
          </Text>
          <Text style={styles.optionDescription}>
            {!lockData
              ? 'Lock data not available'
              : bluetoothState === 'poweredOn'
              ? deleteAfterReset
                ? 'Factory reset lock and remove from account'
                : 'Complete reset - erases ALL data from lock'
              : bluetoothState === 'unavailable'
              ? 'Bluetooth not available on this device'
              : 'Please turn on Bluetooth'}
          </Text>
        </View>
        {bluetoothState === 'poweredOn' && lockData && (
          <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
        )}
      </TouchableOpacity>

      {/* Manual Reset Option */}
      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => setStep('manual')}
      >
        <View style={[styles.optionIcon, { backgroundColor: '#FF9800' + '20' }]}>
          <Ionicons name="hand-left" size={24} color="#FF9800" />
        </View>
        <View style={styles.optionInfo}>
          <Text style={styles.optionTitle}>Manual Reset</Text>
          <Text style={styles.optionDescription}>
            Physical reset using the lock's reset button
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
      </TouchableOpacity>

      {/* Remove from Account Only - Only show if NOT deleting */}
      {!deleteAfterReset && (
        <TouchableOpacity
          style={[styles.optionCard, styles.dangerOption]}
          onPress={() => {
            Alert.alert(
              'Remove from Account',
              'This will completely remove the lock from your account without resetting the physical lock.\n\nThe lock will keep all its current settings, passcodes, and fingerprints.\n\nContinue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: handleRemoveFromAccount },
              ]
            );
          }}
        >
          <View style={[styles.optionIcon, { backgroundColor: '#FF4444' + '20' }]}>
            <Ionicons name="trash-outline" size={24} color="#FF4444" />
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: '#FF4444' }]}>Remove from Account</Text>
            <Text style={styles.optionDescription}>
              Only removes from your account (doesn't reset lock)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
        </TouchableOpacity>
      )}
    </>
  );

  const renderConfirmStep = () => (
    <View style={styles.centerContent}>
      <View style={styles.confirmCard}>
        <Ionicons name="warning" size={64} color="#FF4444" />
        <Text style={styles.confirmTitle}>
          {deleteAfterReset ? 'Confirm Delete' : 'Confirm Factory Reset'}
        </Text>
        <Text style={styles.confirmText}>
          {deleteAfterReset
            ? `You are about to delete "${lockName || 'this lock'}" and reset it to factory settings.`
            : `You are about to reset "${lockName || 'this lock'}" to factory settings.`
          }
        </Text>

        <View style={styles.deleteList}>
          <View style={styles.deleteItem}>
            <Ionicons name="close-circle" size={20} color="#FF4444" />
            <Text style={styles.deleteItemText}>All passcodes will be deleted</Text>
          </View>
          <View style={styles.deleteItem}>
            <Ionicons name="close-circle" size={20} color="#FF4444" />
            <Text style={styles.deleteItemText}>All fingerprints will be deleted</Text>
          </View>
          <View style={styles.deleteItem}>
            <Ionicons name="close-circle" size={20} color="#FF4444" />
            <Text style={styles.deleteItemText}>All IC cards will be deleted</Text>
          </View>
          <View style={styles.deleteItem}>
            <Ionicons name="close-circle" size={20} color="#FF4444" />
            <Text style={styles.deleteItemText}>All settings will be reset</Text>
          </View>
        </View>

        <View style={styles.confirmButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setStep('info')}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={confirmReset}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.resetButtonText}>Reset Lock</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderResettingStep = () => (
    <View style={styles.centerContent}>
      <View style={styles.progressCard}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.progressTitle}>Resetting Lock...</Text>
        <Text style={styles.progressText}>
          Please keep the phone close to the lock and don't close this app.
        </Text>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.centerContent}>
      <View style={styles.successCard}>
        <Ionicons name="checkmark-circle" size={80} color={Colors.primary} />
        <Text style={styles.successTitle}>
          {deleteAfterReset ? 'Lock Deleted!' : 'Reset Complete!'}
        </Text>
        <Text style={styles.successText}>
          {deleteAfterReset
            ? 'The lock has been factory reset and removed from your account.\n\nAll passcodes, fingerprints, IC cards, and shared access have been removed.\n\nYou can add this lock again using the "Add Lock" feature.'
            : 'The lock has been successfully reset to factory settings.\n\nAll passcodes, fingerprints, IC cards, and Bluetooth pairing have been cleared.\n\nTo use the lock again, you need to re-pair it via Bluetooth using the lock detail screen.'
          }
        </Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
            if (deleteAfterReset) {
              navigation.navigate('ConsumerTabs');
            } else {
              // Navigate to LockDetailScreen with forceRefresh to update UI
              navigation.navigate('LockDetailScreen', { lockId, forceRefresh: true });
            }
          }}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderManualStep = () => (
    <>
      <View style={styles.manualCard}>
        <Text style={styles.manualTitle}>Manual Factory Reset</Text>
        <Text style={styles.manualSubtitle}>
          Follow these steps to reset your lock physically:
        </Text>

        <View style={styles.stepsList}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Locate Reset Button</Text>
              <Text style={styles.stepText}>
                Find the small reset button on the back of the lock's interior panel.
                It's usually a small pinhole button.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Remove Batteries</Text>
              <Text style={styles.stepText}>
                Remove all batteries from the lock and wait 10 seconds.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Press and Hold Reset</Text>
              <Text style={styles.stepText}>
                While holding the reset button, insert the batteries back into the lock.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Wait for Confirmation</Text>
              <Text style={styles.stepText}>
                Continue holding for 5-10 seconds until you hear a long beep or see the LED flash.
                Release the button.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>5</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Reset Complete</Text>
              <Text style={styles.stepText}>
                The lock is now reset. You can add it as a new lock in the app.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeAccountButton}
        onPress={handleManualResetComplete}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.removeAccountButtonText}>I've Reset the Lock - Clear Data</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('info')}
      >
        <Text style={styles.backButtonText}>Back to Options</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {deleteAfterReset ? 'Delete Lock' : 'Factory Reset'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'info' && renderInfoStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'resetting' && renderResettingStep()}
        {step === 'success' && renderSuccessStep()}
        {step === 'manual' && renderManualStep()}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
  },
  headerBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warningCard: {
    backgroundColor: '#FF4444' + '15',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF4444',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  lockInfo: {
    marginLeft: 12,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  lockId: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  dangerOption: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF4444' + '30',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  confirmCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteList: {
    width: '100%',
    marginBottom: 24,
  },
  deleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteItemText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  progressCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  manualCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  manualSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: 20,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  removeAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  removeAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
});

export default FactoryResetScreen;
