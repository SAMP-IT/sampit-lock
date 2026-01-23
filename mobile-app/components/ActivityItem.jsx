// ActivityItem.js
// ------------------------------------------------------
// This component renders a single activity log entry
// showing an icon, action performed, user involved, and
// timestamp. It is used inside an Activity/History screen
// to provide users with a clear record of past events.
// ------------------------------------------------------

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getFriendlyLockNameForActivity } from '../utils/lockDisplayUtils';

// Action display mapping - converts raw action names to user-friendly text
const ACTION_DISPLAY_MAP = {
  // Lock/Unlock actions
  'locked': { label: 'Locked', icon: 'lock-closed', color: '#34C759' },
  'unlocked': { label: 'Unlocked', icon: 'lock-open', color: '#FF9500' },
  'failed': { label: 'Failed Attempt', icon: 'alert-circle', color: '#FF3B30' },

  // Pairing/Setup actions
  'paired': { label: 'Lock Paired', icon: 'bluetooth', color: '#007AFF' },
  'reset': { label: 'Lock Reset', icon: 'refresh-circle', color: '#FF3B30' },

  // User management actions
  'user_added': { label: 'User Added', icon: 'person-add', color: '#34C759' },
  'user_removed': { label: 'User Removed', icon: 'person-remove', color: '#FF3B30' },
  'user_invited': { label: 'User Invited', icon: 'mail', color: '#007AFF' },

  // Permission/Role actions
  'permission_changed': { label: 'Permission Updated', icon: 'shield-checkmark', color: '#5856D6' },
  'role_changed': { label: 'Role Changed', icon: 'key', color: '#5856D6' },

  // Settings actions
  'setting_changed': { label: 'Settings Updated', icon: 'settings', color: '#8E8E93' },
  'settings_changed': { label: 'Settings Updated', icon: 'settings', color: '#8E8E93' },
  'name_changed': { label: 'Name Changed', icon: 'create', color: '#007AFF' },

  // Credential actions
  'passcode_created': { label: 'Passcode Created', icon: 'keypad', color: '#34C759' },
  'passcode_deleted': { label: 'Passcode Deleted', icon: 'keypad', color: '#FF3B30' },
  'fingerprint_added': { label: 'Fingerprint Added', icon: 'finger-print', color: '#34C759' },
  'fingerprint_removed': { label: 'Fingerprint Removed', icon: 'finger-print', color: '#FF3B30' },
  'card_added': { label: 'Card Added', icon: 'card', color: '#34C759' },
  'card_removed': { label: 'Card Removed', icon: 'card', color: '#FF3B30' },

  // Access actions
  'access_granted': { label: 'Access Granted', icon: 'checkmark-circle', color: '#34C759' },
  'access_revoked': { label: 'Access Revoked', icon: 'close-circle', color: '#FF3B30' },
  'access_expired': { label: 'Access Expired', icon: 'time', color: '#FF9500' },
};

// Get icon based on action type
const getActionIcon = (action) => {
  const normalizedAction = action?.toLowerCase()?.replace(/-/g, '_');
  return ACTION_DISPLAY_MAP[normalizedAction]?.icon || 'time-outline';
};

// Get friendly action label
const getFriendlyActionLabel = (action) => {
  if (!action) return 'Activity';

  const normalizedAction = action.toLowerCase().replace(/-/g, '_');

  // Check if we have a mapped display name
  if (ACTION_DISPLAY_MAP[normalizedAction]) {
    return ACTION_DISPLAY_MAP[normalizedAction].label;
  }

  // Fallback: Convert snake_case/kebab-case to Title Case
  return action
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Get action display text with lock name
const getActionText = (action, lockName, isResolved = false) => {
  const actionLabel = getFriendlyActionLabel(action);

  if (lockName) {
    // If the lock name is already resolved (from parent component), use it directly
    // Otherwise, run it through getFriendlyLockNameForActivity to filter out model numbers
    const friendlyName = isResolved ? lockName : getFriendlyLockNameForActivity(lockName);
    return { actionLabel, lockName: friendlyName };
  }
  return { actionLabel, lockName: null };
};

// Format timestamp to exact time with date
const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const activityTime = new Date(timestamp);

  // Format as "Jan 12, 4:35 PM"
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  return activityTime.toLocaleString('en-US', options);
};

// Props:
// - activity: An object containing activity details from API:
//   { id, action, access_method, timestamp, lock_name, user_name, is_anomaly, anomaly_type, resolved_lock_name }
// OR legacy format:
//   { icon, action, user, time }
const ActivityItem = ({ activity }) => {
  // Support both new API format and legacy format
  // Priority: resolved_lock_name (from parent with lock lookup) > lock_name (raw API) > lock (transformed)
  const icon = activity.icon || getActionIcon(activity.action);
  const hasResolvedName = !!activity.resolved_lock_name;
  const rawLockName = activity.resolved_lock_name || activity.lock_name || activity.lock;
  const { actionLabel, lockName } = getActionText(activity.action, rawLockName, hasResolvedName);
  const user = activity.user || activity.user_name || 'Unknown';
  const time = activity.time || formatTime(activity.timestamp);

  // AI anomaly detection
  const isAnomaly = activity.is_anomaly || activity.anomaly_score > 0;
  const anomalyType = activity.anomaly_type || activity.anomaly_flags?.[0];

  // Get anomaly badge text
  const getAnomalyBadge = (type) => {
    if (!type) return 'Unusual';
    switch (type?.toLowerCase()) {
      case 'unusual_hours':
      case 'unusual_hour':
        return 'Unusual Time';
      case 'first_time_user':
        return 'First Time';
      case 'rapid_events':
        return 'Rapid Activity';
      case 'failed_attempt':
        return 'Failed Attempt';
      default:
        return 'Unusual';
    }
  };

  return (
    <View style={styles.container}>
      {/* Left: Activity Icon */}
      <View style={[
        styles.iconContainer,
        isAnomaly && styles.iconContainerAnomaly
      ]}>
        <Ionicons name={icon} size={20} color={isAnomaly ? '#F59E0B' : Colors.iconbackground} />
      </View>

      {/* Middle: Activity Details */}
      <View style={styles.content}>
        <View style={styles.actionRow}>
          <Text style={styles.action}>{actionLabel}</Text>
          {isAnomaly && (
            <View style={styles.anomalyBadge}>
              <Ionicons name="alert-circle" size={12} color="#F59E0B" />
              <Text style={styles.anomalyBadgeText}>{getAnomalyBadge(anomalyType)}</Text>
            </View>
          )}
        </View>
        {lockName && <Text style={styles.lockName}>{lockName}</Text>}
        <Text style={styles.user}>By {user}</Text>
      </View>

      {/* Right: Activity Timestamp */}
      <Text style={styles.time}>{time}</Text>
    </View>
  );
};

// Styles for layout and UI consistency
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',          // Align items in a row
    alignItems: 'center',          // Vertically center
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderBottomWidth: 1,          // Divider line for separation
    borderBottomColor: Colors.bordercolor,
  },
  iconContainer: {
    backgroundColor: Colors.cardbackground,
    width: 40,
    height: 40,
    borderRadius: 20,              // Circular icon background
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,               // Spacing between icon and text
  },
  iconContainerAnomaly: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  content: {
    flex: 1,                       // Take remaining width
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  action: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  lockName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.iconbackground,
    marginTop: 1,
  },
  anomalyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  anomalyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  user: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  time: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
});

export default ActivityItem;
