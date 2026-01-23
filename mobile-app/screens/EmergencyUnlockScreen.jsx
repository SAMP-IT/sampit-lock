import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getLocks, emergencyUnlock } from '../services/api';
import { unwrapResponseArray } from '../utils/apiResponse';

const EmergencyUnlockScreen = ({ navigation, route }) => {
  const { lockId: initialLockId } = route.params || {};

  const [locks, setLocks] = useState([]);
  const [selectedLock, setSelectedLock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  useEffect(() => {
    loadLocks();
    // Vibrate to get user attention
    Vibration.vibrate([0, 300, 100, 300]);
  }, []);

  useEffect(() => {
    if (initialLockId && locks.length > 0) {
      const lock = locks.find(l => l.id === initialLockId);
      if (lock) {
        setSelectedLock(lock);
      }
    } else if (locks.length === 1) {
      // Auto-select if only one lock
      setSelectedLock(locks[0]);
    }
  }, [initialLockId, locks]);

  const loadLocks = async () => {
    setLoading(true);
    try {
      const response = await getLocks();
      setLocks(unwrapResponseArray(response));
    } catch (error) {
      console.error('Failed to load locks:', error);
      Alert.alert('Error', 'Failed to load your locks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyUnlock = () => {
    if (!selectedLock) {
      Alert.alert('No Lock Selected', 'Please select a lock to unlock');
      return;
    }

    Alert.alert(
      'Emergency Unlock',
      `This will immediately unlock ${selectedLock.name}.\n\nUse this feature only in genuine emergencies.\n\nAre you sure?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unlock Now',
          style: 'destructive',
          onPress: performEmergencyUnlock
        }
      ]
    );
  };

  const performEmergencyUnlock = async () => {
    setUnlocking(true);
    try {
      // Use emergency unlock API with reason
      await emergencyUnlock(selectedLock.id, 'Emergency unlock initiated by user');

      // Success feedback
      Vibration.vibrate([0, 100, 50, 100, 50, 200]);
      setUnlockSuccess(true);

      Alert.alert(
        'Emergency Unlock Successful!',
        `${selectedLock.name} has been unlocked remotely.\n\nThis emergency unlock has been logged for security purposes.\n\nThe lock will auto-lock after the configured delay.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Emergency unlock failed:', error);

      // Error feedback
      Vibration.vibrate([0, 500, 200, 500]);

      const errorMessage = error.response?.data?.error?.message
        || 'Unable to perform emergency unlock. Please check your connection and try again.';

      Alert.alert(
        'Emergency Unlock Failed',
        errorMessage,
        [
          {
            text: 'Try Again',
            onPress: performEmergencyUnlock
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } finally {
      setUnlocking(false);
    }
  };

  const handleSelectLock = (lock) => {
    setSelectedLock(lock);
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your locks...</Text>
      </AppScreen>
    );
  }

  if (locks.length === 0) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Emergency Unlock</Text>
          </View>
        </View>

        <Section>
          <AppCard style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={60} color={Colors.subtitlecolor} />
            <Text style={styles.emptyTitle}>No Locks Found</Text>
            <Text style={styles.emptySubtitle}>
              You don't have any locks configured in your account.
            </Text>
          </AppCard>
        </Section>
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
        <View>
          <Text style={styles.headerTitle}>Emergency Unlock</Text>
          <Text style={styles.headerSubtitle}>Remote unlock for emergencies only</Text>
        </View>
      </View>

      {/* Emergency Warning */}
      <Section>
        <AppCard style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <Ionicons name="warning" size={32} color="#FF9500" />
          </View>
          <Text style={styles.warningTitle}>Emergency Feature</Text>
          <Text style={styles.warningText}>
            This feature immediately unlocks your door remotely. Use only in genuine emergencies like:
            {'\n\n'}• Locked out and need immediate access
            {'\n'}• Someone needs urgent entry
            {'\n'}• Emergency services require access
            {'\n\n'}All emergency unlocks are logged for security.
          </Text>
        </AppCard>
      </Section>

      {/* Lock Selection */}
      <Section title="Select Lock" gapless>
        <AppCard padding="none">
          {locks.map((lock, index) => (
            <TouchableOpacity
              key={lock.id}
              style={[
                styles.lockItem,
                index === locks.length - 1 && styles.lockItemLast
              ]}
              onPress={() => handleSelectLock(lock)}
            >
              <View style={styles.lockIcon}>
                <Ionicons
                  name={selectedLock?.id === lock.id ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={selectedLock?.id === lock.id ? Colors.iconbackground : Colors.subtitlecolor}
                />
              </View>
              <View style={styles.lockContent}>
                <Text style={styles.lockName}>{lock.name}</Text>
                <View style={styles.lockStatus}>
                  <Ionicons
                    name={lock.status === 'locked' ? 'lock-closed' : 'lock-open'}
                    size={14}
                    color={lock.status === 'locked' ? Colors.iconbackground : Colors.success}
                  />
                  <Text style={styles.lockStatusText}>
                    {lock.status === 'locked' ? 'Locked' : 'Unlocked'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          ))}
        </AppCard>
      </Section>

      {/* Emergency Unlock Button */}
      <Section>
        <TouchableOpacity
          style={[
            styles.emergencyButton,
            (!selectedLock || unlocking || unlockSuccess) && styles.emergencyButtonDisabled
          ]}
          onPress={handleEmergencyUnlock}
          disabled={!selectedLock || unlocking || unlockSuccess}
        >
          {unlocking ? (
            <ActivityIndicator color={Colors.textwhite} />
          ) : unlockSuccess ? (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.textwhite} />
              <Text style={styles.emergencyButtonText}>Unlocked Successfully</Text>
            </>
          ) : (
            <>
              <Ionicons name="lock-open" size={24} color={Colors.textwhite} />
              <Text style={styles.emergencyButtonText}>Emergency Unlock</Text>
            </>
          )}
        </TouchableOpacity>

        {selectedLock && !unlockSuccess && (
          <Text style={styles.selectedLockText}>
            Will unlock: {selectedLock.name}
          </Text>
        )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  warningCard: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: '#FFF3E0',
  },
  warningIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF9500',
  },
  warningText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 22,
  },
  lockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  lockItemLast: {
    borderBottomWidth: 0,
  },
  lockIcon: {
    marginRight: Theme.spacing.md,
  },
  lockContent: {
    flex: 1,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  lockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockStatusText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  emergencyButton: {
    backgroundColor: '#FF5722',
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    elevation: 4,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emergencyButtonDisabled: {
    backgroundColor: Colors.bordercolor,
    elevation: 0,
    shadowOpacity: 0,
  },
  emergencyButtonText: {
    color: Colors.textwhite,
    fontSize: 18,
    fontWeight: '700',
  },
  selectedLockText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EmergencyUnlockScreen;
