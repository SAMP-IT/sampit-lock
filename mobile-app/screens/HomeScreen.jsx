import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ScrollView, Alert, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
import { getLocks, getTTLockStatus, getRecentActivity } from "../services/api";
import LockControlService from "../services/lockControlService";
import { unwrapResponseArray } from "../utils/apiResponse";
import { getLockDisplayName } from "../utils/lockDisplayUtils";

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
  const [locks, setLocks] = useState([]);
  const [selectedLock, setSelectedLock] = useState(null);
  const [activities, setActivities] = useState([]);
  const [ttlockStatus, setTTLockStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userName, setUserName] = useState('');
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Result modal state
  const [resultModal, setResultModal] = useState({
    visible: false,
    type: 'unlock',
    success: true,
    message: '',
    lockName: '',
  });

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

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const locksResponse = await getLocks();
      const normalizedLocks = unwrapResponseArray(locksResponse);
      setLocks(normalizedLocks);

      // Set first lock as selected if none selected
      if (normalizedLocks.length > 0 && !selectedLock) {
        setSelectedLock(normalizedLocks[0]);
      } else if (selectedLock) {
        // Update selected lock data if it exists
        const updatedSelected = normalizedLocks.find(l => l.id === selectedLock.id);
        if (updatedSelected) {
          setSelectedLock(updatedSelected);
        } else if (normalizedLocks.length > 0) {
          setSelectedLock(normalizedLocks[0]);
        }
      }

      // Fetch recent activities
      try {
        const activityResponse = await getRecentActivity();
        const activityData = activityResponse?.data?.data ?? activityResponse?.data ?? [];
        setActivities(Array.isArray(activityData) ? activityData : []);
      } catch (activityErr) {
        console.warn('Failed to fetch activities:', activityErr?.message);
        setActivities([]);
      }

      // Still fetch TTLock status for Add Lock validation
      try {
        const statusResponse = await getTTLockStatus();
        const statusPayload = statusResponse?.data ?? statusResponse;
        const normalizedStatus = statusPayload?.data ?? statusPayload;
        setTTLockStatus(normalizedStatus);
      } catch (statusErr) {
        setTTLockStatus(null);
      }

    } catch (err) {
      const is404 = err?.response?.status === 404;
      if (!is404) {
        console.warn('Failed to fetch locks:', err?.message || err);
      }
      setError(null);
      setLocks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

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
        'TTLock Account Required',
        'To add a lock via Bluetooth, you need to connect your TTLock account first. This ensures your lock data is synced to the cloud for remote access.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect TTLock',
            onPress: () => navigation.navigate('ConnectTTLock')
          }
        ]
      );
      return;
    }
    navigation.navigate('AddLockWizard');
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
                onLockUpdated={fetchData}
                isProminent={true}
                isLocking={isLocking}
                isUnlocking={isUnlocking}
              />
            )}

            {/* Lock Selector - Only show if multiple locks */}
            {locks.length > 1 && (
              <View style={styles.lockSelectorContainer}>
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
