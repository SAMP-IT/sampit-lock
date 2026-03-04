import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, ScrollView, Alert, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from "../components/Header";
import AppScreen from "../components/ui/AppScreen";
import Section from "../components/ui/Section";
import AppCard from "../components/ui/AppCard";
import LockCard from "../components/LockCard";
import LockResultModal from "../components/ui/LockResultModal";
import ActivityItem from "../components/ActivityItem";
import Theme from "../constants/Theme";
import Colors from "../constants/Colors";
import LockControlService from "../services/lockControlService";
import { getLockDisplayName } from "../utils/lockDisplayUtils";
import { useLocks, useRecentActivity, useTTLockStatus } from "../hooks/useQueryHooks";

const ActivityPreview = ({ activities, locks }) => {
  // Create a map of lock_id to user-friendly lock name using shared utility
  const lockNameMap = {};
  locks.forEach(lock => {
    if (lock.id) {
      lockNameMap[lock.id] = getLockDisplayName(lock, 'My Lock');
    }
  });

  // Enhance activities with resolved lock names
  const enhancedActivities = activities.slice(0, 3).map(activity => ({
    ...activity,
    resolved_lock_name: activity.lock_id ? lockNameMap[activity.lock_id] : null
  }));

  return (
    <AppCard padding="none" elevated={false}>
      {enhancedActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </AppCard>
  );
};

const HomeScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [selectedLock, setSelectedLock] = useState(null);
  const [userName, setUserName] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for scrolling
  const scrollViewRef = useRef(null);
  const switchLockRef = useRef(null);
  const [switchLockY, setSwitchLockY] = useState(0);

  // Result modal state
  const [resultModal, setResultModal] = useState({
    visible: false,
    type: 'unlock',
    success: true,
    message: '',
    lockName: '',
  });

  // React Query hooks
  const { data: locks = [], isLoading: locksLoading, error: locksError, refetch: refetchLocks } = useLocks();
  const { data: activities = [], refetch: refetchActivities } = useRecentActivity();
  const { data: ttlockStatus = null, refetch: refetchStatus } = useTTLockStatus();
  const isLoading = locksLoading;
  const error = locksError;

  // Update selected lock when locks data changes
  useEffect(() => {
    if (locks.length > 0 && !selectedLock) {
      setSelectedLock(locks[0]);
    } else if (selectedLock) {
      const updatedSelected = locks.find(l => l.id === selectedLock.id);
      if (updatedSelected) {
        setSelectedLock(updatedSelected);
      } else if (locks.length > 0) {
        setSelectedLock(locks[0]);
      }
    }
  }, [locks]);

  // Load user name from storage
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          const firstName = user.user_metadata?.first_name || user.first_name || '';
          const lastName = user.user_metadata?.last_name || user.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim();
          setUserName(fullName || 'User');
        }
      } catch (err) {
        console.warn('Failed to load user name:', err);
      }
    };
    loadUserName();
  }, []);

  // Refetch on screen focus - only invalidate so React Query respects staleTime
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['locks'] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
    }, [queryClient])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchLocks(), refetchActivities(), refetchStatus()]);
    setIsRefreshing(false);
  }, [refetchLocks, refetchActivities, refetchStatus]);

  const handleLockPress = (lock) => {
    navigation.navigate('LockDetail', { lockId: lock.id });
  };

  const handleLockSelect = (lock) => {
    setSelectedLock(lock);
  };

  // Handle UNLOCK action
  const handleUnlock = async (lock) => {
    if (isLocking || isUnlocking) return;

    try {
      setIsUnlocking(true);
      console.log(`[HomeScreen] Unlocking: ${lock.name}`);

      const result = await LockControlService.unlock(lock);

      if (result.success) {
        console.log(`[HomeScreen] Unlock successful via ${result.method}`);
        setResultModal({
          visible: true,
          type: 'unlock',
          success: true,
          message: `Unlocked via ${result.method === 'cloud' ? 'Cloud Gateway' : 'Bluetooth'}`,
          lockName: lock.name,
        });
      } else {
        console.log(`[HomeScreen] Unlock failed: ${result.message}`);
        if (result.requires_pairing) {
          Alert.alert(
            'Pairing Required',
            result.message,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Pair Now', onPress: () => navigation.navigate('BluetoothLockPairing') }
            ]
          );
        } else {
          setResultModal({
            visible: true,
            type: 'unlock',
            success: false,
            message: result.message || 'Failed to unlock',
            lockName: lock.name,
          });
        }
      }
    } catch (err) {
      console.error('[HomeScreen] Unlock error:', err);
      setResultModal({
        visible: true,
        type: 'unlock',
        success: false,
        message: err.message || 'An unexpected error occurred',
        lockName: lock.name,
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle LOCK action
  const handleLock = async (lock) => {
    if (isLocking || isUnlocking) return;

    try {
      setIsLocking(true);
      console.log(`[HomeScreen] Locking: ${lock.name}`);

      const result = await LockControlService.lock(lock);

      if (result.success) {
        console.log(`[HomeScreen] Lock successful via ${result.method}`);
        setResultModal({
          visible: true,
          type: 'lock',
          success: true,
          message: `Locked via ${result.method === 'cloud' ? 'Cloud Gateway' : 'Bluetooth'}`,
          lockName: lock.name,
        });
      } else {
        console.log(`[HomeScreen] Lock failed: ${result.message}`);
        if (result.requires_pairing) {
          Alert.alert(
            'Pairing Required',
            result.message,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Pair Now', onPress: () => navigation.navigate('BluetoothLockPairing') }
            ]
          );
        } else {
          setResultModal({
            visible: true,
            type: 'lock',
            success: false,
            message: result.message || 'Failed to lock',
            lockName: lock.name,
          });
        }
      }
    } catch (err) {
      console.error('[HomeScreen] Lock error:', err);
      setResultModal({
        visible: true,
        type: 'lock',
        success: false,
        message: err.message || 'An unexpected error occurred',
        lockName: lock.name,
      });
    } finally {
      setIsLocking(false);
    }
  };

  const handleAddLock = () => {
    if (!ttlockStatus?.connected) {
      Alert.alert(
        'Cloud Account Required',
        'To add a lock via Bluetooth, you need to connect your cloud account first. This ensures your lock data is synced to the cloud for remote access.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Cloud',
            onPress: () => navigation.navigate('ConnectTTLock')
          }
        ]
      );
      return;
    }
    navigation.navigate('PairLock');
  };

  const handleLockCountPress = () => {
    if (locks.length > 1 && switchLockY > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, switchLockY - 20), animated: true });
    }
  };

  // Empty state for locks
  const EmptyLocksState = () => (
    <AppCard style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="lock-closed-outline" size={64} color={Colors.subtitlecolor} />
      </View>
      <Text style={styles.emptyTitle}>No Locks Found</Text>
      <Text style={styles.emptySubtitle}>
        Pair a new lock via Bluetooth or provision it through the cloud wizard to see it here.
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddLock}
      >
        <Ionicons name="add" size={24} color={Colors.textwhite} />
        <Text style={styles.addButtonText}>Add Lock via Bluetooth</Text>
      </TouchableOpacity>
    </AppCard>
  );

  // Empty state for activities
  const EmptyActivitiesState = () => (
    <AppCard style={styles.emptyActivityState}>
      <Ionicons name="time-outline" size={32} color={Colors.subtitlecolor} />
      <Text style={styles.emptyActivityText}>No activity yet</Text>
    </AppCard>
  );

  // Show loading only on initial load
  if (isLoading && locks.length === 0) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <Header
          title={userName ? `Welcome ${userName}!` : 'Welcome!'}
          onMenuPress={() => navigation.navigate('Menu')}
          showNotification={false}
          showLockCount={true}
          lockCount={0}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
          <Text style={styles.loadingText}>Loading your locks...</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      ref={scrollViewRef}
      contentContainerStyle={styles.content}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
    >
      {/* Result Modal */}
      <LockResultModal
        visible={resultModal.visible}
        type={resultModal.type}
        success={resultModal.success}
        message={resultModal.message}
        lockName={resultModal.lockName}
        onClose={() => setResultModal(prev => ({ ...prev, visible: false }))}
      />

      <Header
        title={userName ? `Welcome ${userName}!` : 'Welcome!'}
        onMenuPress={() => navigation.navigate('Menu')}
        showNotification={false}
        showLockCount={true}
        lockCount={locks.length}
        onLockCountPress={locks.length > 1 ? handleLockCountPress : undefined}
      />

      {locks.length > 0 ? (
        <>
          {/* Prominent Lock Card Section */}
          <Section
            title="Your Locks"
            subtitle="Tap Unlock or Lock to control"
            actionLabel="Add Lock"
            onActionPress={handleAddLock}
          >
            {/* Main Prominent Lock Card */}
            {selectedLock && (
              <LockCard
                lock={selectedLock}
                onPress={handleLockPress}
                onLock={handleLock}
                onUnlock={handleUnlock}
                onLockUpdated={refetchLocks}
                isProminent={true}
                isLocking={isLocking}
                isUnlocking={isUnlocking}
              />
            )}

            {/* Lock Selector - Only show if multiple locks */}
            {locks.length > 1 && (
              <View 
                ref={switchLockRef}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  // Get the absolute position relative to the ScrollView
                  switchLockRef.current?.measureLayout(
                    scrollViewRef.current,
                    (x, measuredY) => {
                      setSwitchLockY(measuredY);
                    },
                    () => {
                      // Fallback: use relative Y position
                      setSwitchLockY(y);
                    }
                  );
                }}
                style={styles.lockSelectorContainer}
              >
                <Text style={styles.lockSelectorTitle}>Switch Lock</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.lockSelectorScroll}
                >
                  {locks.map((lock) => (
                    <TouchableOpacity
                      key={lock.id}
                      style={[
                        styles.lockSelectorItem,
                        selectedLock?.id === lock.id && styles.lockSelectorItemActive
                      ]}
                      onPress={() => handleLockSelect(lock)}
                      activeOpacity={0.8}
                    >
                      <View style={[
                        styles.lockSelectorIcon,
                        { backgroundColor: Colors.iconbackground },
                        selectedLock?.id === lock.id && styles.lockSelectorIconActive
                      ]}>
                        <Ionicons
                          name="lock-closed"
                          size={20}
                          color={Colors.textwhite}
                        />
                      </View>
                      <Text
                        style={[
                          styles.lockSelectorName,
                          selectedLock?.id === lock.id && styles.lockSelectorNameActive
                        ]}
                        numberOfLines={1}
                      >
                        {getLockDisplayName(lock, 'My Lock')}
                      </Text>
                      <Text style={styles.lockSelectorBattery}>{lock.battery_level || 0}%</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Section>

          {/* Recent Activity Section */}
          <Section
            title="Recent Activity"
            actionLabel={activities.length > 0 ? "View All" : ""}
            onActionPress={activities.length > 0 ? () => navigation.navigate('History') : undefined}
          >
            {activities.length > 0 ? (
              <ActivityPreview activities={activities} locks={locks} />
            ) : (
              <EmptyActivitiesState />
            )}
          </Section>
        </>
      ) : (
        <Section
          title="Your Locks"
          subtitle=""
        >
          <EmptyLocksState />
        </Section>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.lg,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.sm,
  },
  addButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyActivityState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  emptyActivityText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: Theme.spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  // Lock Selector Styles
  lockSelectorContainer: {
    marginTop: Theme.spacing.lg,
  },
  lockSelectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.md,
  },
  lockSelectorScroll: {
    gap: Theme.spacing.md,
    paddingRight: Theme.spacing.lg,
  },
  lockSelectorItem: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    alignItems: 'center',
    width: 90,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lockSelectorItemActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: `${Colors.iconbackground}10`,
  },
  lockSelectorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  lockSelectorIconActive: {
    transform: [{ scale: 1.1 }],
  },
  lockSelectorName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: 2,
  },
  lockSelectorNameActive: {
    color: Colors.iconbackground,
  },
  lockSelectorBattery: {
    fontSize: 11,
    color: Colors.subtitlecolor,
  },
});

export default HomeScreen;
