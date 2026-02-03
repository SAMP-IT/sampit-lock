import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, FlatList, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import LockResultModal from '../components/ui/LockResultModal';
import ActivityItem from '../components/ActivityItem';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getLockById, getLocks, getActivityByLockId, getAccessRecommendations, applyRecommendation, dismissRecommendation, getAIInsights, getBatteryFromTTLock, updateLock } from '../services/api';
import { getLockDisplayName } from '../utils/lockDisplayUtils';
import { unwrapResponseArray, unwrapResponseData } from '../utils/apiResponse';
import LockControlService from '../services/lockControlService';

// Simple cache for lock data to avoid reloading on every navigation
const lockDataCache = new Map();

const LockSwitcher = ({ currentLock, locks, onLockChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.switcherContainer}>
      <TouchableOpacity
        style={styles.switcherButton}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.switcherText}>{currentLock.name}</Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color={Colors.titlecolor}
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.switcherDropdown}>
          {locks.filter(lock => lock.id !== currentLock.id).map((lock) => (
            <TouchableOpacity
              key={lock.id}
              style={styles.switcherOption}
              onPress={() => {
                onLockChange(lock);
                setIsOpen(false);
              }}
            >
              <View style={styles.switcherOptionContent}>
                <View style={[
                  styles.lockStatusDot,
                  { backgroundColor: lock.isConnected ? Colors.iconbackground : '#FF3B30' }
                ]} />
                <Text style={styles.switcherOptionText}>{lock.name}</Text>
                <Text style={styles.switcherOptionLocation}>{lock.location}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Two separate Lock and Unlock buttons
const LockControlButtons = ({ onLock, onUnlock, isConnected, isLocking, isUnlocking }) => {
  return (
    <View style={styles.controlButtonsContainer}>
      {/* Unlock Button */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          styles.unlockButton,
          !isConnected && styles.controlButtonDisabled,
          isUnlocking && styles.controlButtonProcessing
        ]}
        onPress={onUnlock}
        disabled={!isConnected || isUnlocking || isLocking}
        activeOpacity={0.7}
      >
        {isUnlocking ? (
          <ActivityIndicator size="small" color={Colors.textwhite} />
        ) : (
          <Ionicons name="lock-open" size={22} color={Colors.textwhite} />
        )}
        <Text style={styles.controlButtonText}>
          {isUnlocking ? 'Unlocking...' : 'Unlock'}
        </Text>
      </TouchableOpacity>

      {/* Lock Button */}
      <TouchableOpacity
        style={[
          styles.controlButton,
          styles.lockButton,
          !isConnected && styles.controlButtonDisabled,
          isLocking && styles.controlButtonProcessing
        ]}
        onPress={onLock}
        disabled={!isConnected || isLocking || isUnlocking}
        activeOpacity={0.7}
      >
        {isLocking ? (
          <ActivityIndicator size="small" color={Colors.textwhite} />
        ) : (
          <Ionicons name="lock-closed" size={22} color={Colors.textwhite} />
        )}
        <Text style={styles.controlButtonText}>
          {isLocking ? 'Locking...' : 'Lock'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const ActivityFilters = ({ activeFilter, onFilterChange }) => {
  const filters = ['All', 'Unlocked', 'Locked', 'Failed'];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterButton,
            activeFilter === filter && styles.filterButtonActive
          ]}
          onPress={() => onFilterChange(filter)}
        >
          <Text style={[
            styles.filterText,
            activeFilter === filter && styles.filterTextActive
          ]}>
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// Battery indicator component
const BatteryIndicator = ({ level }) => {
  const getBatteryColor = () => {
    if (level <= 0 || level > 100) return Colors.subtitlecolor;
    if (level <= 20) return '#FF3B30';
    if (level <= 50) return '#FF9500';
    return '#34C759';
  };

  const getBatteryIcon = () => {
    if (level <= 0 || level > 100) return 'battery-dead';
    if (level <= 25) return 'battery-dead';
    if (level <= 50) return 'battery-half';
    if (level <= 75) return 'battery-half';
    return 'battery-full';
  };

  return (
    <View style={styles.batteryContainer}>
      <Ionicons name={getBatteryIcon()} size={32} color={getBatteryColor()} />
      <Text style={[styles.batteryText, { color: getBatteryColor() }]}>
        {level > 0 && level <= 100 ? `${level}%` : 'N/A'}
      </Text>
    </View>
  );
};

const LockDetailScreen = ({ navigation, route }) => {
  const { lockId, forceRefresh } = route.params;
  const [currentLock, setCurrentLock] = useState(null);
  const [allLocks, setAllLocks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activityFilter, setActivityFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [visibleActivitiesCount, setVisibleActivitiesCount] = useState(7);

  // Track if we've loaded data for this lockId to avoid reloading on every focus
  const lastLoadedLockId = useRef(null);
  const isInitialLoad = useRef(true);

  // Result modal state
  const [resultModal, setResultModal] = useState({
    visible: false,
    type: 'unlock',
    success: true,
    message: '',
  });

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transform lock data helper
  const transformLockData = (lock, permissions = {}) => {
    const hasBluetooth = !!(lock.ttlock_mac && lock.ttlock_data);
    const hasGateway = lock.has_gateway;
    const isOnline = lock.is_online;
    // Lock needs re-pairing if it was previously paired but no longer has ttlock_data (after factory reset)
    const needsRepairing = lock.ttlock_mac && !lock.ttlock_data && !lock.is_bluetooth_paired;

    return {
      ...lock,
      battery: lock.battery_level || 0,
      isConnected: isOnline || hasGateway || hasBluetooth,
      needsRepairing,
      lastActivity: lock.updated_at ? new Date(lock.updated_at).toLocaleString() : 'Unknown',
      userRole: permissions.role || 'owner',
      can_unlock: permissions.can_unlock,
      can_lock: permissions.can_lock,
      can_view_logs: permissions.can_view_logs,
      can_manage_users: permissions.can_manage_users,
      can_modify_settings: permissions.can_modify_settings,
      remote_unlock_enabled: permissions.remote_unlock_enabled,
      ttlock_mac: lock.ttlock_mac,
      ttlock_data: lock.ttlock_data,
      ttlock_lock_id: lock.ttlock_lock_id,
      has_gateway: lock.has_gateway,
      is_bluetooth_paired: lock.is_bluetooth_paired
    };
  };

  // Load critical lock data first (fast) - shows UI immediately
  const loadCriticalData = useCallback(async (forceReload = false) => {
    // Check cache first for instant display
    const cached = lockDataCache.get(lockId);
    if (cached && !forceReload) {
      console.log('[LockDetailScreen] Using cached lock data');
      setCurrentLock(cached.lock);
      setAllLocks(cached.allLocks);
      setActivities(cached.activities || []);
      setRecommendations(cached.recommendations || []);
      setIsLoading(false);
      return cached.lock;
    }

    try {
      setError(null);

      // Only show loading if no cached data
      if (!cached) {
        setIsLoading(true);
      }

      // Fetch lock details and all locks in parallel
      const [lockDetailsResponse, allLocksData] = await Promise.all([
        getLockById(lockId),
        getLocks()
      ]);

      const lockDetailsData = unwrapResponseData(lockDetailsResponse);
      const lock = lockDetailsData?.lock || lockDetailsData;

      if (!lock || !lock.id) {
        throw new Error('Lock not found');
      }

      const permissions = lockDetailsData?.permissions || {};
      const transformedLock = transformLockData(lock, permissions);
      const locksArray = unwrapResponseArray(allLocksData);

      console.log('[LockDetailScreen] Critical data loaded:', lock.name);

      // Update state immediately - UI is now visible
      setCurrentLock(transformedLock);
      setAllLocks(locksArray);
      setIsLoading(false);

      // Cache the critical data
      lockDataCache.set(lockId, {
        lock: transformedLock,
        allLocks: locksArray,
        activities: [],
        recommendations: [],
        timestamp: Date.now()
      });

      return transformedLock;
    } catch (err) {
      console.error('Failed to load lock details:', err);
      setError("Failed to load lock details. Please try again.");
      setIsLoading(false);
      return null;
    }
  }, [lockId]);

  // Load non-critical data in background (activities, AI, recommendations)
  const loadBackgroundData = useCallback(async (lock) => {
    if (!lock) return;

    setIsLoadingActivities(true);

    // Fetch battery from cloud (non-blocking)
    if (lock.ttlock_lock_id) {
      getBatteryFromTTLock(lock.id, lock.ttlock_lock_id)
        .then(batteryFromCloud => {
          if (batteryFromCloud !== null) {
            setCurrentLock(prev => prev ? { ...prev, battery: batteryFromCloud } : prev);
          }
        })
        .catch(() => console.log('Using cached battery level'));
    }

    // Fetch activities, AI insights, and recommendations in parallel (non-blocking)
    Promise.all([
      // Fetch activities
      getActivityByLockId(lockId, { limit: 50 }).catch(() => ({ data: [] })),
      // Fetch AI insights
      getAIInsights(lockId, { type: 'anomaly', limit: 50 }).catch(() => ({ data: [] })),
      // Fetch recommendations
      getAccessRecommendations(lockId).catch(() => ({ data: [] }))
    ]).then(([activitiesResponse, insightsResponse, recsResponse]) => {
      // Process activities
      const rawActivities = activitiesResponse?.data?.data ?? activitiesResponse?.data ?? [];
      let recentActivities = (Array.isArray(rawActivities) ? rawActivities : []).map(activity => ({
        ...activity,
        timestamp: activity.timestamp || activity.created_at
      }));

      // Merge AI insights
      const insightsData = insightsResponse?.data?.data ?? insightsResponse?.data;
      if (insightsData && insightsData.length > 0) {
        const anomalyMap = new Map();
        insightsData.forEach(insight => {
          if (insight.activity_id && insight.metadata) {
            anomalyMap.set(insight.activity_id, {
              is_anomaly: true,
              anomaly_score: insight.metadata.anomaly_score || 0,
              anomaly_flags: insight.metadata.anomaly_flags || [],
              anomaly_type: insight.metadata.anomaly_flags?.[0]
            });
          }
        });
        recentActivities = recentActivities.map(activity => {
          const anomalyData = anomalyMap.get(activity.id);
          return anomalyData ? { ...activity, ...anomalyData } : activity;
        });
      }

      setActivities(recentActivities);

      // Process recommendations
      const recsData = recsResponse?.data?.data ?? recsResponse?.data;
      const pendingRecs = recsData?.filter(r => r.status === 'pending') || [];
      setRecommendations(pendingRecs);

      // Update cache with background data
      const cached = lockDataCache.get(lockId);
      if (cached) {
        lockDataCache.set(lockId, {
          ...cached,
          activities: recentActivities,
          recommendations: pendingRecs,
          timestamp: Date.now()
        });
      }

      setIsLoadingActivities(false);
    }).catch((err) => {
      console.log('Background data load error:', err);
      setIsLoadingActivities(false);
    });
  }, [lockId]);

  // Main data fetch - split into critical (blocking) and background (non-blocking)
  const fetchData = useCallback(async (forceReload = false) => {
    const lock = await loadCriticalData(forceReload);
    if (lock) {
      loadBackgroundData(lock);
    }
  }, [loadCriticalData, loadBackgroundData]);

  // Refresh data when screen comes into focus - with smart caching
  useFocusEffect(
    useCallback(() => {
      console.log('[LockDetailScreen] Screen focused');

      // Force refresh requested (e.g., after factory reset) - clear cache and refetch
      if (forceRefresh) {
        console.log('[LockDetailScreen] Force refresh requested, clearing cache');
        lockDataCache.delete(lockId);
        lastLoadedLockId.current = null;
        isInitialLoad.current = true;
        // Clear the forceRefresh param to avoid repeated refreshes
        navigation.setParams({ forceRefresh: undefined });
      }

      // If same lock and not initial load, don't reload (use cache)
      if (lastLoadedLockId.current === lockId && !isInitialLoad.current) {
        console.log('[LockDetailScreen] Same lock, using cache');
        // Just refresh background data silently
        const cached = lockDataCache.get(lockId);
        if (cached?.lock) {
          loadBackgroundData(cached.lock);
        }
        return;
      }

      // Different lock or initial load - fetch data
      console.log('[LockDetailScreen] Loading lock data');
      lastLoadedLockId.current = lockId;
      isInitialLoad.current = false;
      fetchData();
    }, [lockId, forceRefresh, fetchData, loadBackgroundData, navigation])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData(true); // Force reload
    setIsRefreshing(false);
  }, [fetchData]);

  // Handle UNLOCK action
  const handleUnlock = async () => {
    if (!currentLock) return;

    try {
      setIsUnlocking(true);
      console.log(`[LockDetailScreen] Unlocking: ${currentLock.name}, role: ${currentLock.userRole}`);

      // Guest users can ONLY use Bluetooth - bypass cloud control
      const isGuest = currentLock.userRole === 'guest';
      const lockForControl = isGuest
        ? { ...currentLock, has_gateway: false, ttlock_lock_id: null } // Force Bluetooth only
        : currentLock;

      const result = await LockControlService.unlock(lockForControl);

      if (result.success) {
        console.log(`[LockDetailScreen] Unlock successful via ${result.method}`);
        setResultModal({
          visible: true,
          type: 'unlock',
          success: true,
          message: `Unlocked via ${result.method === 'cloud' ? 'Cloud Gateway' : 'Bluetooth'}`,
        });
      } else {
        console.log(`[LockDetailScreen] Unlock failed: ${result.message}`);
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
          });
        }
      }
    } catch (err) {
      console.error('[LockDetailScreen] Unlock error:', err);
      setResultModal({
        visible: true,
        type: 'unlock',
        success: false,
        message: err.message || 'An unexpected error occurred',
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle LOCK action
  const handleLock = async () => {
    if (!currentLock) return;

    try {
      setIsLocking(true);
      console.log(`[LockDetailScreen] Locking: ${currentLock.name}, role: ${currentLock.userRole}`);

      // Guest users can ONLY use Bluetooth - bypass cloud control
      const isGuest = currentLock.userRole === 'guest';
      const lockForControl = isGuest
        ? { ...currentLock, has_gateway: false, ttlock_lock_id: null } // Force Bluetooth only
        : currentLock;

      const result = await LockControlService.lock(lockForControl);

      if (result.success) {
        console.log(`[LockDetailScreen] Lock successful via ${result.method}`);
        setResultModal({
          visible: true,
          type: 'lock',
          success: true,
          message: `Locked via ${result.method === 'cloud' ? 'Cloud Gateway' : 'Bluetooth'}`,
        });
      } else {
        console.log(`[LockDetailScreen] Lock failed: ${result.message}`);
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
          });
        }
      }
    } catch (err) {
      console.error('[LockDetailScreen] Lock error:', err);
      setResultModal({
        visible: true,
        type: 'lock',
        success: false,
        message: err.message || 'An unexpected error occurred',
      });
    } finally {
      setIsLocking(false);
    }
  };

  const handleLockSwitch = (newLock) => {
    setCurrentLock(newLock);
    navigation.setParams({ lockId: newLock.id });
  };

  const handleUserManagement = () => {
    const canManage = currentLock.userRole === 'owner' || currentLock.can_manage_users;
    if (!canManage) {
      Alert.alert('Access Denied', 'Only owners can manage users for this lock');
      return;
    }
    navigation.navigate('UserManagementLock', { lockId: currentLock.id, lock: currentLock });
  };

  const handleSettings = () => {
    navigation.navigate('LockSettings', { lockId: currentLock.id });
  };

  const handleApplyRecommendation = async (recommendationId) => {
    try {
      await applyRecommendation(recommendationId);
      setRecommendations(recommendations.filter(r => r.id !== recommendationId));
      Alert.alert('Success', 'Recommendation applied successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to apply recommendation. Please try again.');
    }
  };

  const handleDismissRecommendation = async (recommendationId) => {
    try {
      await dismissRecommendation(recommendationId);
      setRecommendations(recommendations.filter(r => r.id !== recommendationId));
    } catch (err) {
      Alert.alert('Error', 'Failed to dismiss recommendation. Please try again.');
    }
  };

  // Handle opening edit modal
  const handleOpenEditModal = () => {
    setEditName(getLockDisplayName(currentLock, 'My Lock'));
    setShowEditModal(true);
  };

  // Handle saving lock name
  const handleSaveName = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Please enter a valid lock name.');
      return;
    }

    setIsSaving(true);
    try {
      await updateLock(currentLock.id, { name: trimmedName });

      // Update local state
      setCurrentLock(prev => ({ ...prev, name: trimmedName }));

      // Update cache
      const cached = lockDataCache.get(lockId);
      if (cached) {
        lockDataCache.set(lockId, {
          ...cached,
          lock: { ...cached.lock, name: trimmedName },
        });
      }

      setShowEditModal(false);
      Alert.alert('Success', 'Lock name updated successfully!');
    } catch (error) {
      console.error('Error updating lock name:', error);
      Alert.alert('Error', 'Failed to update lock name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle filter change - reset visible count
  const handleFilterChange = (filter) => {
    setActivityFilter(filter);
    setVisibleActivitiesCount(7);
  };

  const filteredActivity = activities.filter(activity => {
    if (activityFilter === 'All') return true;
    
    const action = activity.action?.toLowerCase() || '';
    
    // Map filter names to exact action values
    switch (activityFilter) {
      case 'Unlocked':
        return action === 'unlocked';
      case 'Locked':
        return action === 'locked';
      case 'Failed':
        return action === 'failed_attempt' || 
               action === 'failed' || 
               (activity.success === false);
      default:
        return false;
    }
  });

  const sortedActivity = [...filteredActivity].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  if (isLoading) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
          <Text style={styles.loadingText}>Loading lock details...</Text>
        </View>
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </AppScreen>
    );
  }

  if (!currentLock) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color={Colors.subtitlecolor} />
          <Text style={styles.errorText}>Lock not found</Text>
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
        lockName={currentLock?.name}
        onClose={() => setResultModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
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

            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter lock name"
              placeholderTextColor={Colors.subtitlecolor}
              autoFocus
              maxLength={50}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                onPress={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.textwhite} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>

        <LockSwitcher
          currentLock={currentLock}
          locks={allLocks}
          onLockChange={handleLockSwitch}
        />

        {/* Settings button - hidden for Guest users */}
        {currentLock.userRole !== 'guest' ? (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettings}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
        ) : (
          <View style={styles.settingsButton} />
        )}
      </View>

      <Section gapless>
        <AppCard style={styles.lockCard}>
          <View style={styles.lockInfo}>
            {/* Lock Header with Name and Edit Button */}
            <View style={styles.lockHeader}>
              <View style={styles.lockTitleContainer}>
                <Text style={styles.lockName}>{getLockDisplayName(currentLock, 'My Lock')}</Text>
                <Text style={styles.lockLocation}>{currentLock.location}</Text>
              </View>
              {/* Edit button - only for owners/admins */}
              {(currentLock.userRole === 'owner' || currentLock.userRole === 'admin' || currentLock.can_modify_settings) && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleOpenEditModal}
                >
                  <Ionicons name="pencil" size={18} color={Colors.iconbackground} />
                </TouchableOpacity>
              )}
            </View>

            {/* Center: Lock Icon with Battery */}
            <View style={styles.lockCenterDisplay}>
              <View style={styles.lockIconContainer}>
                <Ionicons name="lock-closed" size={48} color={Colors.iconbackground} />
              </View>
              <BatteryIndicator level={currentLock.battery} />
            </View>

            {/* Two Control Buttons: Unlock and Lock */}
            <LockControlButtons
              onLock={handleLock}
              onUnlock={handleUnlock}
              isConnected={currentLock.isConnected}
              isLocking={isLocking}
              isUnlocking={isUnlocking}
            />

            {/* Re-pairing Required Banner - shown after factory reset */}
            {currentLock.needsRepairing && (
              <View style={styles.repairBanner}>
                <Ionicons name="bluetooth" size={20} color="#FF9500" />
                <View style={styles.repairBannerContent}>
                  <Text style={styles.repairBannerTitle}>Re-pairing Required</Text>
                  <Text style={styles.repairBannerText}>
                    This lock was factory reset. Tap to re-pair via Bluetooth.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.repairButton}
                  onPress={() => navigation.navigate('BluetoothLockPairing')}
                >
                  <Text style={styles.repairButtonText}>Pair</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Last Activity */}
            <Text style={styles.lastActivity}>
              Last activity: {currentLock.lastActivity}
            </Text>
          </View>
        </AppCard>
      </Section>

      {/* AI Access Recommendations Banners - Hidden for Guest users */}
      {currentLock.userRole !== 'guest' && recommendations.length > 0 && recommendations.map((rec) => (
        <Section key={rec.id} gapless>
          <View style={styles.recommendationBanner}>
            <View style={styles.recommendationHeader}>
              <View style={styles.recommendationIconContainer}>
                <Ionicons name="bulb" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.recommendationContent}>
                <Text style={styles.recommendationTitle}>AI Suggestion</Text>
                <Text style={styles.recommendationText}>{rec.suggestion}</Text>
                {rec.reason && (
                  <Text style={styles.recommendationReason}>{rec.reason}</Text>
                )}
              </View>
            </View>
            <View style={styles.recommendationActions}>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => handleDismissRecommendation(rec.id)}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => handleApplyRecommendation(rec.id)}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>
      ))}

      {/* Quick Actions - Hidden for guest, restricted, and long_term_guest roles */}
      {!['guest', 'restricted', 'long_term_guest'].includes(currentLock.userRole) && (
        <Section
          title="Quick Actions"
          subtitle="Manage access and settings"
        >
          <AppCard style={styles.actionsCard}>
            <FlatList
              data={[
                // User Management - only for admin/owner or users with can_manage_users
                ...(currentLock.userRole === 'admin' || currentLock.userRole === 'owner' || currentLock.can_manage_users
                  ? [{ id: 1, icon: 'people-outline', text: 'User Management', onPress: handleUserManagement }]
                  : []),
                // Passcode - available to owner, admin, family
                { id: 2, icon: 'keypad-outline', text: 'Passcode', onPress: () => navigation.navigate('SendCode', { lockId: currentLock.id, lock: currentLock }) },
                // Fingerprints - available to owner, admin, family
                { id: 3, icon: 'finger-print-outline', text: 'Fingerprints', onPress: () => navigation.navigate('FingerprintManagement', { lockId: currentLock.id, lock: currentLock }) },
                // IC Cards - available to owner, admin, family
                { id: 4, icon: 'card-outline', text: 'IC Cards', onPress: () => navigation.navigate('CardManagement', { lockId: currentLock.id, lock: currentLock }) },
                // Settings - only for admin/owner or users with can_modify_settings
                ...(currentLock.userRole === 'admin' || currentLock.userRole === 'owner' || currentLock.can_modify_settings
                  ? [{ id: 5, icon: 'settings-outline', text: 'Settings', onPress: handleSettings }]
                  : []),
              ]}
              numColumns={2}
              keyExtractor={(item) => item.id.toString()}
              columnWrapperStyle={styles.actionRow}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.actionButton} onPress={item.onPress}>
                  <Ionicons name={item.icon} size={24} color={Colors.iconbackground} />
                  <Text style={styles.actionText}>{item.text}</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </AppCard>
        </Section>
      )}

      {/* Activity Log - Show for all except 'guest', with visibility notice for restricted roles */}
      {currentLock.userRole !== 'guest' && (
        <Section
          title="Activity Log"
          subtitle="Filter and sort access history"
        >
        <AppCard padding="none">
          {/* Notice for restricted visibility */}
          {['restricted', 'long_term_guest'].includes(currentLock.userRole) && (
            <View style={styles.restrictedNotice}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.restrictedNoticeText}>Showing your activity only</Text>
            </View>
          )}

          <View style={styles.activityHeader}>
            <ActivityFilters
              activeFilter={activityFilter}
              onFilterChange={handleFilterChange}
            />
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            >
              <Ionicons
                name={sortOrder === 'newest' ? "arrow-down" : "arrow-up"}
                size={16}
                color={Colors.subtitlecolor}
              />
              <Text style={styles.sortText}>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</Text>
            </TouchableOpacity>
          </View>

          {isLoadingActivities && sortedActivity.length === 0 ? (
            <View style={styles.noActivityContainer}>
              <ActivityIndicator size="small" color={Colors.iconbackground} />
              <Text style={styles.noActivityText}>Loading activities...</Text>
            </View>
          ) : sortedActivity.length > 0 ? (
            <>
              {sortedActivity.slice(0, visibleActivitiesCount).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
              {sortedActivity.length > visibleActivitiesCount && (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => setVisibleActivitiesCount(prev => prev + 7)}
                >
                  <Text style={styles.viewMoreText}>
                    View More ({sortedActivity.length - visibleActivitiesCount} remaining)
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.iconbackground} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.noActivityContainer}>
              <Ionicons name="time-outline" size={32} color={Colors.subtitlecolor} />
              <Text style={styles.noActivityText}>No activity yet</Text>
            </View>
          )}
        </AppCard>
        </Section>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: Theme.spacing.md,
  },
  errorText: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.iconbackground,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.sm,
  },
  retryButtonText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  settingsButton: {
    padding: Theme.spacing.sm,
    marginRight: -Theme.spacing.sm,
  },
  switcherContainer: {
    flex: 1,
    marginHorizontal: Theme.spacing.md,
    position: 'relative',
  },
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    gap: Theme.spacing.sm,
  },
  switcherText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  switcherDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.textwhite,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  switcherOption: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardbackground,
  },
  switcherOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  lockStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  switcherOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.titlecolor,
    flex: 1,
  },
  switcherOptionLocation: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  lockCard: {
    padding: Theme.spacing.xl,
  },
  lockInfo: {
    gap: Theme.spacing.lg,
  },
  lockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lockTitleContainer: {
    flex: 1,
  },
  lockName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  lockLocation: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCenterDisplay: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  lockIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
  },
  batteryText: {
    fontSize: 18,
    fontWeight: '700',
  },
  controlButtonsContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.lg,
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
  lockButton: {
    backgroundColor: Colors.iconbackground,
  },
  controlButtonDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.subtitlecolor,
  },
  controlButtonProcessing: {
    opacity: 0.8,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  lastActivity: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  repairBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500' + '20',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  repairBannerContent: {
    flex: 1,
  },
  repairBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 2,
  },
  repairBannerText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  repairButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
  },
  repairButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionsCard: {
    padding: Theme.spacing.lg,
  },
  actionRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.lg,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    minHeight: 80,
    marginBottom: Theme.spacing.md,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.titlecolor,
    textAlign: 'center',
  },
  restrictedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.cardbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  restrictedNoticeText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    fontStyle: 'italic',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardbackground,
  },
  filtersContainer: {
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
    marginRight: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
  },
  filterButtonActive: {
    backgroundColor: Colors.iconbackground,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.subtitlecolor,
  },
  filterTextActive: {
    color: Colors.textwhite,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Theme.spacing.sm,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.subtitlecolor,
  },
  noActivityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  noActivityText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardbackground,
    backgroundColor: Colors.backgroundwhite,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  // AI Access Recommendations Banner Styles
  recommendationBanner: {
    backgroundColor: Colors.backgroundwhite,
    borderRadius: 12,
    marginHorizontal: Theme.spacing.lg,
    padding: Theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationHeader: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.md,
  },
  recommendationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendationText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.titlecolor,
    lineHeight: 20,
    marginBottom: 4,
  },
  recommendationReason: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  recommendationActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  dismissButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    backgroundColor: Colors.backgroundwhite,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.backgroundwhite,
    borderRadius: Theme.radius.lg,
    width: '100%',
    maxWidth: 400,
    padding: Theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  modalCloseButton: {
    padding: Theme.spacing.xs,
  },
  modalInput: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    fontSize: 16,
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default LockDetailScreen;
