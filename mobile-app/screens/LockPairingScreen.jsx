import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { pairLock, getLockById } from '../services/api';

const LockPairingScreen = ({ navigation, route }) => {
  const { lockId } = route.params || {};

  const [lock, setLock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [pairingStatus, setPairingStatus] = useState('idle'); // idle, scanning, pairing, success, error

  useEffect(() => {
    if (lockId) {
      loadLockDetails();
    }
  }, [lockId]);

  const loadLockDetails = async () => {
    setLoading(true);
    try {
      const response = await getLockById(lockId);
      setLock(response.data);
    } catch (error) {
      console.error('Failed to load lock details:', error);
      Alert.alert('Error', 'Failed to load lock details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPairing = () => {
    Alert.alert(
      'Start Bluetooth Pairing?',
      'Make sure you are standing close to the lock (within 1-2 meters) and that Bluetooth is enabled on your device.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Start Pairing',
          onPress: performPairing
        }
      ]
    );
  };

  const performPairing = async () => {
    setPairing(true);
    setPairingStatus('scanning');

    try {
      // Simulate scanning phase
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPairingStatus('pairing');

      // Call the pairing API
      await pairLock(lockId);

      setPairingStatus('success');

      Alert.alert(
        'Pairing Successful!',
        `${lock?.name || 'Lock'} has been successfully paired via Bluetooth.\n\nYou can now control the lock remotely.`,
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Pairing failed:', error);
      setPairingStatus('error');

      const errorMessage = error.response?.data?.error?.message
        || 'Failed to pair with the lock. Please ensure you are close to the lock and try again.';

      Alert.alert(
        'Pairing Failed',
        errorMessage,
        [
          {
            text: 'Retry',
            onPress: performPairing
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setPairingStatus('idle')
          }
        ]
      );
    } finally {
      setPairing(false);
    }
  };

  const getPairingStatusInfo = () => {
    switch (pairingStatus) {
      case 'scanning':
        return {
          icon: 'search',
          color: Colors.iconbackground,
          title: 'Scanning for Lock...',
          message: 'Looking for nearby Bluetooth devices'
        };
      case 'pairing':
        return {
          icon: 'sync',
          color: Colors.iconbackground,
          title: 'Pairing in Progress...',
          message: 'Establishing secure connection with lock'
        };
      case 'success':
        return {
          icon: 'checkmark-circle',
          color: Colors.success,
          title: 'Pairing Successful!',
          message: 'Lock is now connected'
        };
      case 'error':
        return {
          icon: 'close-circle',
          color: Colors.red,
          title: 'Pairing Failed',
          message: 'Could not connect to lock'
        };
      default:
        return {
          icon: 'bluetooth',
          color: Colors.iconbackground,
          title: 'Ready to Pair',
          message: 'Start Bluetooth pairing process'
        };
    }
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading lock details...</Text>
      </AppScreen>
    );
  }

  if (!lock) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lock Pairing</Text>
        </View>

        <Section>
          <AppCard style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={60} color={Colors.red} />
            <Text style={styles.errorTitle}>Lock Not Found</Text>
            <Text style={styles.errorSubtitle}>
              Could not find the specified lock.
            </Text>
          </AppCard>
        </Section>
      </AppScreen>
    );
  }

  const statusInfo = getPairingStatusInfo();

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
          <Text style={styles.headerTitle}>Bluetooth Pairing</Text>
          <Text style={styles.headerSubtitle}>{lock.name}</Text>
        </View>
      </View>

      {/* Pairing Status */}
      <Section>
        <AppCard style={styles.statusCard}>
          <View style={[styles.statusIconContainer, { backgroundColor: `${statusInfo.color}20` }]}>
            {pairing && pairingStatus !== 'success' && pairingStatus !== 'error' ? (
              <ActivityIndicator size="large" color={statusInfo.color} />
            ) : (
              <Ionicons name={statusInfo.icon} size={64} color={statusInfo.color} />
            )}
          </View>
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusMessage}>{statusInfo.message}</Text>
        </AppCard>
      </Section>

      {/* Lock Information */}
      <Section title="Lock Information" gapless>
        <AppCard padding="none">
          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Lock Name</Text>
              <Text style={styles.infoValue}>{lock.name}</Text>
            </View>
          </View>

          {lock.model && (
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Ionicons name="hardware-chip-outline" size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Model</Text>
                <Text style={styles.infoValue}>{lock.model}</Text>
              </View>
            </View>
          )}

          {lock.macAddress && (
            <View style={[styles.infoItem, styles.infoItemLast]}>
              <View style={styles.infoIcon}>
                <Ionicons name="bluetooth-outline" size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>MAC Address</Text>
                <Text style={styles.infoValue}>{lock.macAddress}</Text>
              </View>
            </View>
          )}
        </AppCard>
      </Section>

      {/* Instructions */}
      <Section title="Pairing Instructions" gapless>
        <AppCard>
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Ensure Bluetooth is enabled on your device
            </Text>
          </View>

          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Stand within 1-2 meters (3-6 feet) of the lock
            </Text>
          </View>

          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Press the "Start Pairing" button below
            </Text>
          </View>

          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Wait for the pairing process to complete (10-30 seconds)
            </Text>
          </View>
        </AppCard>
      </Section>

      {/* Pairing Button */}
      <Section>
        {pairingStatus === 'idle' || pairingStatus === 'error' ? (
          <TouchableOpacity
            style={[styles.pairButton, pairing && styles.pairButtonDisabled]}
            onPress={handleStartPairing}
            disabled={pairing}
          >
            <Ionicons name="bluetooth" size={24} color={Colors.textwhite} />
            <Text style={styles.pairButtonText}>
              {pairingStatus === 'error' ? 'Retry Pairing' : 'Start Pairing'}
            </Text>
          </TouchableOpacity>
        ) : pairingStatus === 'success' ? (
          <TouchableOpacity
            style={[styles.pairButton, styles.successButton]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="checkmark-circle" size={24} color={Colors.textwhite} />
            <Text style={styles.pairButtonText}>Done</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
          <Text style={styles.warningText}>
            Pairing is required for Bluetooth-based lock control. If pairing fails, try moving closer to the lock or resetting the lock's Bluetooth module.
          </Text>
        </View>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  statusCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.xl,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  infoItemLast: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.iconbackground}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.titlecolor,
    lineHeight: 20,
    paddingTop: 4,
  },
  pairButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    elevation: 4,
    shadowColor: Colors.iconbackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pairButtonDisabled: {
    backgroundColor: Colors.bordercolor,
    elevation: 0,
    shadowOpacity: 0,
  },
  successButton: {
    backgroundColor: Colors.success,
  },
  pairButtonText: {
    color: Colors.textwhite,
    fontSize: 18,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: `${Colors.iconbackground}10`,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  errorCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.xl * 2,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LockPairingScreen;
