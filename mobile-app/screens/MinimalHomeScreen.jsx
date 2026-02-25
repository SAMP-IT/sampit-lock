import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';
import { unlockDoor } from '../services/api';
import { useLocks } from '../hooks/useQueryHooks';

const MinimalHomeScreen = ({ navigation }) => {
  const { role, isSimpleMode, toggleSimpleMode } = useRole();
  const [doorStatus, setDoorStatus] = useState('locked'); // locked, unlocked, unlocking, locking

  const { data: locks = [], isLoading: loading } = useLocks();
  const primaryLock = locks.length > 0 ? locks[0] : null;

  const isOwner = role === 'owner';
  const isFamily = role === 'family';
  const isGuest = role === 'guest';

  // Set door status based on lock state
  useEffect(() => {
    if (primaryLock) {
      setDoorStatus(primaryLock.is_locked === false ? 'unlocked' : 'locked');
    }
  }, [primaryLock]);

  const handleUnlockDoor = async () => {
    if (!primaryLock || doorStatus === 'unlocking') return;

    Alert.alert(
      `Unlock ${primaryLock.lock_alias || 'Front Door'}?`,
      'Tap "Unlock" to confirm remote unlock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: async () => {
            setDoorStatus('unlocking');
            try {
              const response = await unlockDoor(primaryLock.id, 'remote');

              if (response.data?.success) {
                setDoorStatus('unlocked');
                Alert.alert('Success', 'Door unlocked successfully');

                // Refresh lock state after 2 seconds
                setTimeout(() => {
                  fetchLocks();
                }, 2000);
              } else {
                throw new Error(response.data?.error?.message || 'Failed to unlock');
              }
            } catch (error) {
              console.error('Unlock error:', error);
              Alert.alert(
                'Unlock Failed',
                error.response?.data?.error?.message || error.message || 'Could not unlock the door. Please try again.'
              );
              setDoorStatus('locked');
            }
          }
        }
      ]
    );
  };

  const handleLockDoor = async () => {
    if (!primaryLock || doorStatus === 'locking') return;

    Alert.alert(
      `Lock ${primaryLock.lock_alias || 'Front Door'}?`,
      'Note: Some TTLock models do not support remote locking for security reasons.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: () => {
            // TTLock typically doesn't support remote lock for security
            Alert.alert(
              'Remote Lock Not Supported',
              'For security, most TTLock models only support remote unlock. Please use the physical lock button or Bluetooth to lock.'
            );
          }
        }
      ]
    );
  };

  const handleAddGuest = () => {
    navigation.navigate('AddUser');
  };

  const handleGetHelp = () => {
    navigation.navigate('Help');
  };

  const getDoorStatusText = () => {
    switch (doorStatus) {
      case 'unlocking':
        return 'Unlocking...';
      case 'unlocked':
        return 'Unlocked';
      case 'locked':
      default:
        return 'Locked';
    }
  };

  const getDoorStatusIcon = () => {
    switch (doorStatus) {
      case 'unlocking':
        return 'radio-outline';
      case 'unlocked':
        return 'lock-open-outline';
      case 'locked':
      default:
        return 'lock-closed-outline';
    }
  };

  const getDoorStatusColor = () => {
    switch (doorStatus) {
      case 'unlocking':
        return '#2196F3';
      case 'unlocked':
        return '#4CAF50';
      case 'locked':
      default:
        return Colors.iconbackground;
    }
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
          <SimpleModeText style={styles.loadingText}>Loading your locks...</SimpleModeText>
        </View>
      </AppScreen>
    );
  }

  if (!primaryLock) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.noLocksContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.iconbackground} />
          <SimpleModeText variant="heading" style={styles.noLocksTitle}>No Locks Found</SimpleModeText>
          <SimpleModeText style={styles.noLocksText}>
            You don't have any locks set up yet. Add a lock to get started.
          </SimpleModeText>
          <SimpleModeButton
            onPress={() => navigation.navigate('ConnectTTLock')}
            style={styles.addLockButton}
          >
            Add Lock
          </SimpleModeButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <SimpleModeText variant="heading" style={styles.greeting}>
            {isGuest ? 'Welcome, Guest' : isFamily ? 'Welcome Home' : 'Good morning'}
          </SimpleModeText>
          <SimpleModeText style={styles.subtitle}>
            {isGuest ? 'Your access is ready to use' : 'Your home is secure'}
          </SimpleModeText>
        </View>

        {!isGuest && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('SimpleModeSettings')}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
        )}
      </View>

      <VoiceHelperButton
        text={`Your ${primaryLock.lock_alias || 'door'} is ${doorStatus === 'locked' ? 'locked and secure' : 'unlocked'}. Tap the card below to control it.`}
      />

      {/* Main Door Card */}
      <SimpleModeCard style={[styles.doorCard, { backgroundColor: getDoorStatusColor() }]}>
        <View style={styles.doorHeader}>
          <View style={styles.doorInfo}>
            <SimpleModeText variant="title" style={styles.doorName}>
              {primaryLock.lock_alias || 'Front Door'}
            </SimpleModeText>
            <Text style={styles.doorStatus}>{getDoorStatusText()}</Text>
            {primaryLock.battery_level && (
              <Text style={styles.batteryText}>
                <Ionicons name="battery-half-outline" size={14} color="rgba(255,255,255,0.8)" />
                {' '}{primaryLock.battery_level}%
              </Text>
            )}
          </View>
          <View style={styles.doorIconWrap}>
            <Ionicons
              name={getDoorStatusIcon()}
              size={isSimpleMode ? 40 : 32}
              color={Colors.textwhite}
            />
          </View>
        </View>

        <View style={styles.doorActions}>
          {doorStatus === 'locked' ? (
            <SimpleModeButton
              onPress={handleUnlockDoor}
              style={[styles.doorActionButton, styles.unlockButton]}
            >
              Unlock Door
            </SimpleModeButton>
          ) : doorStatus === 'unlocked' ? (
            <SimpleModeButton
              onPress={handleLockDoor}
              style={[styles.doorActionButton, styles.lockButton]}
            >
              Lock Door
            </SimpleModeButton>
          ) : (
            <View style={[styles.doorActionButton, styles.processingButton]}>
              <ActivityIndicator color={Colors.textwhite} style={{ marginRight: 8 }} />
              <SimpleModeText style={styles.processingText}>
                {doorStatus === 'unlocking' ? 'Unlocking...' : 'Locking...'}
              </SimpleModeText>
            </View>
          )}
        </View>

        <SimpleModeText style={styles.doorDescription}>
          {isGuest
            ? 'Available 8 AM–6 PM on Mon–Fri'
            : 'Tap to remotely unlock your door'
          }
        </SimpleModeText>
      </SimpleModeCard>

      {/* Action Cards */}
      <View style={styles.actionGrid}>
        {/* Add Guest Card - Only for Owner */}
        {isOwner && (
          <TouchableOpacity onPress={handleAddGuest} activeOpacity={0.9}>
            <SimpleModeCard style={styles.actionCard}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="person-add-outline" size={24} color={Colors.textwhite} />
              </View>
              <SimpleModeText variant="title" style={styles.actionTitle}>
                Add Guest
              </SimpleModeText>
              <SimpleModeText style={styles.actionDescription}>
                Invite family or friends
              </SimpleModeText>
            </SimpleModeCard>
          </TouchableOpacity>
        )}

        {/* Help Card - Always visible */}
        <TouchableOpacity onPress={handleGetHelp} activeOpacity={0.9}>
          <SimpleModeCard style={styles.actionCard}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="help-circle-outline" size={24} color={Colors.textwhite} />
            </View>
            <SimpleModeText variant="title" style={styles.actionTitle}>
              Get Help
            </SimpleModeText>
            <SimpleModeText style={styles.actionDescription}>
              {isGuest ? 'Call a family member' : 'Support and tutorials'}
            </SimpleModeText>
          </SimpleModeCard>
        </TouchableOpacity>

        {/* Simple Mode Toggle - Only for non-guests */}
        {!isGuest && (
          <TouchableOpacity onPress={toggleSimpleMode} activeOpacity={0.9}>
            <SimpleModeCard style={styles.actionCard}>
              <View style={styles.actionIconWrap}>
                <Ionicons
                  name={isSimpleMode ? "eye-outline" : "accessibility-outline"}
                  size={24}
                  color={Colors.textwhite}
                />
              </View>
              <SimpleModeText variant="title" style={styles.actionTitle}>
                {isSimpleMode ? 'Advanced View' : 'Simple Mode'}
              </SimpleModeText>
              <SimpleModeText style={styles.actionDescription}>
                {isSimpleMode ? 'More features' : 'Bigger buttons'}
              </SimpleModeText>
            </SimpleModeCard>
          </TouchableOpacity>
        )}
      </View>

      {/* Emergency Info for Guests */}
      {isGuest && (
        <SimpleModeCard style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="shield-outline" size={20} color="#FF9800" />
            </View>
            <SimpleModeText variant="title" style={styles.emergencyTitle}>
              Need Help?
            </SimpleModeText>
          </View>
          <SimpleModeText style={styles.emergencyText}>
            If you're locked out or need assistance, tap "Get Help" above to contact your host or building management.
          </SimpleModeText>
        </SimpleModeCard>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  loadingText: {
    opacity: 0.7,
  },
  noLocksContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
  },
  noLocksTitle: {
    marginTop: Theme.spacing.lg,
  },
  noLocksText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  addLockButton: {
    marginTop: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Theme.spacing.md,
  },
  greeting: {
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.8,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  doorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  doorInfo: {
    flex: 1,
  },
  doorName: {
    color: Colors.textwhite,
    marginBottom: 4,
  },
  doorStatus: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  batteryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  doorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActions: {
    width: '100%',
  },
  doorActionButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  unlockButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  lockButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  processingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
  },
  processingText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  doorDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  actionCard: {
    flex: 1,
    minWidth: 150,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  actionTitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  actionDescription: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.8,
  },
  emergencyCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  emergencyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTitle: {
    fontSize: 16,
    color: '#F57C00',
  },
  emergencyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F57C00',
  },
});

export default MinimalHomeScreen;