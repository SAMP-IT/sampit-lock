import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import ActivityItem from '../components/ActivityItem';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getUserActivityHistory } from '../services/api';

// UI configuration options (not mock data)
const TIME_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' }
];

const ACTION_FILTERS = [
  { id: 'all', label: 'All Actions' },
  { id: 'unlock', label: 'Unlocks' },
  { id: 'lock', label: 'Locks' },
  { id: 'failed', label: 'Failed' }
];

// Helper function to format activity from API response
// Backend returns: { id, action, access_method, success, failure_reason, created_at, metadata, lock: { id, name, location } }
const formatActivity = (activity, userName) => {
  // Map action enum values to display text and icons
  const actionMap = {
    'unlocked': { action: 'Door Unlocked', icon: 'lock-open-outline' },
    'locked': { action: 'Door Locked', icon: 'lock-closed-outline' },
    'failed_attempt': { action: 'Access Failed', icon: 'close-circle-outline' },
    'auto_lock': { action: 'Auto Locked', icon: 'lock-closed-outline' },
    'passage_mode': { action: 'Passage Mode', icon: 'swap-horizontal-outline' },
    'battery_warning': { action: 'Battery Warning', icon: 'battery-half-outline' },
    'offline': { action: 'Went Offline', icon: 'cloud-offline-outline' },
    'tamper_detected': { action: 'Tamper Detected', icon: 'warning-outline' }
  };

  // Map access method to icons
  const accessMethodIcons = {
    'fingerprint': 'finger-print',
    'pin': 'keypad-outline',
    'phone': 'phone-portrait-outline',
    'card': 'card-outline',
    'remote': 'phone-portrait-outline',
    'auto': 'time-outline'
  };

  const actionKey = activity.action || 'unlocked';
  const mapped = actionMap[actionKey] || { action: actionKey, icon: 'ellipse-outline' };

  // Use access_method icon if available, otherwise use action-based icon
  const icon = activity.access_method
    ? (accessMethodIcons[activity.access_method] || mapped.icon)
    : mapped.icon;

  // Format timestamp
  const timestamp = activity.created_at;
  let timeStr = 'Unknown time';
  if (timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      timeStr = `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      timeStr = `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      timeStr = `${diffDays} days ago, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  // Get lock name from nested lock object or fallback
  const lockName = activity.lock?.name || activity.lock?.location || 'Lock';

  return {
    id: activity.id,
    action: mapped.action,
    user: userName,
    time: timeStr,
    icon: icon,
    location: lockName
  };
};

const UserHistoryScreen = ({ route, navigation }) => {
  const { user } = route.params;
  const [timeFilter, setTimeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userActivity, setUserActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user activity from API
  useEffect(() => {
    const fetchUserActivity = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getUserActivityHistory(user.id);
        // Backend returns: { success: true, data: { logs: [...], pagination: {...} } }
        const activities = response.data?.data?.logs || response.data?.logs || response.data?.data || [];
        const formattedActivities = Array.isArray(activities) ? activities.map(a => formatActivity(a, user.name)) : [];
        setUserActivity(formattedActivities);
      } catch (err) {
        console.error('Failed to fetch user activity:', err);
        setError('Failed to load activity history');
        setUserActivity([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserActivity();
  }, [user.id, user.name]);

  const filteredActivity = useMemo(() => {
    let activities = userActivity;

    // Apply time filter
    if (timeFilter === 'today') {
      activities = activities.filter(item => item.time.includes('Today'));
    } else if (timeFilter === 'week') {
      activities = activities.filter(item =>
        item.time.includes('Today') || item.time.includes('Yesterday')
      );
    }

    // Apply action filter
    if (actionFilter !== 'all') {
      const filterMap = {
        'unlock': 'Unlock',
        'lock': 'Lock',
        'failed': 'Failed'
      };
      const searchTerm = filterMap[actionFilter];
      if (searchTerm) {
        activities = activities.filter(item => item.action.includes(searchTerm));
      }
    }

    return activities;
  }, [userActivity, timeFilter, actionFilter]);

  // Calculate stats from activity data
  const totalAccess = userActivity.length;
  const successfulAccess = userActivity.filter(activity => !activity.action.includes('Failed')).length;
  const failedAccess = totalAccess - successfulAccess;

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{user.name}'s History</Text>
          <Text style={styles.headerSubtitle}>Activity log and access patterns</Text>
        </View>
      </View>

      {/* User Summary Card */}
      <Section gapless>
        <AppCard variant="primary" padding="lg">
          <View style={styles.userSummary}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{user.initials}</Text>
              </View>
              <View>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userRole}>{user.role}</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalAccess}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{successfulAccess}</Text>
                <Text style={styles.statLabel}>Success</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{failedAccess}</Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
            </View>
          </View>
        </AppCard>
      </Section>

      {/* Time Filter */}
      <Section title="Time Period">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {TIME_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                timeFilter === filter.id && styles.filterChipActive
              ]}
              onPress={() => setTimeFilter(filter.id)}
            >
              <Text style={[
                styles.filterText,
                timeFilter === filter.id && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Section>

      {/* Action Filter */}
      <Section title="Activity Type">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {ACTION_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                actionFilter === filter.id && styles.filterChipActive
              ]}
              onPress={() => setActionFilter(filter.id)}
            >
              <Text style={[
                styles.filterText,
                actionFilter === filter.id && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Section>

      {/* Activity Timeline */}
      <Section
        title="Activity Timeline"
        subtitle={isLoading ? 'Loading...' : `${filteredActivity.length} activities found`}
        gapless
      >
        <AppCard padding="none" elevated={false}>
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={Colors.iconbackground} />
              <Text style={styles.loadingText}>Loading activity...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="alert-circle-outline" size={32} color={Colors.red} />
              </View>
              <Text style={styles.emptyTitle}>Error</Text>
              <Text style={styles.emptyMessage}>{error}</Text>
            </View>
          ) : filteredActivity.length > 0 ? (
            filteredActivity.map((item) => (
              <View key={item.id} style={styles.activityItemWrapper}>
                <View style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.action.includes('Failed') ? Colors.red : Colors.iconbackground}
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityAction}>{item.action}</Text>
                    <Text style={styles.activityLocation}>{item.location}</Text>
                  </View>
                  <View style={styles.activityTime}>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="time-outline" size={32} color={Colors.subtitlecolor} />
              </View>
              <Text style={styles.emptyTitle}>No activity found</Text>
              <Text style={styles.emptyMessage}>
                {userActivity.length === 0
                  ? 'This user has no recorded activity yet.'
                  : 'Try adjusting your filters to see more results.'}
              </Text>
            </View>
          )}
        </AppCard>
      </Section>

    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg, // consistent vertical spacing
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  userSummary: {
    gap: Theme.spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  avatar: {
    backgroundColor: Colors.textwhite,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.iconbackground,
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  userRole: {
    fontSize: 14,
    color: Colors.textwhite,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textwhite,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textwhite,
    opacity: 0.8,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.textwhite,
    opacity: 0.3,
  },
  filterContainer: {
    gap: Theme.spacing.sm,
    paddingHorizontal: 2,
  },
  filterChip: {
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.backgroundwhite,
  },
  filterChipActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.cardbackground,
  },
  filterText: {
    color: Colors.subtitlecolor,
    fontWeight: '500',
    fontSize: 14,
  },
  filterTextActive: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  activityItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  activityContent: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  activityAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  activityLocation: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  activityTime: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
});

export default UserHistoryScreen;