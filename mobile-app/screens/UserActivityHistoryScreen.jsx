import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getUserActivityHistory, getLockUsers } from '../services/api';

const UserActivityHistoryScreen = ({ navigation, route }) => {
  const { lockId, userId: initialUserId, userName: initialUserName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [activityHistory, setActivityHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [lockId]);

  useEffect(() => {
    if (initialUserId) {
      const user = { id: initialUserId, name: initialUserName || 'User' };
      setSelectedUser(user);
      loadUserActivity(initialUserId);
    } else if (users.length > 0) {
      // Auto-select first user if no initial user specified
      setSelectedUser(users[0]);
      loadUserActivity(users[0].id);
    }
  }, [initialUserId, users]);

  const loadUsers = async () => {
    try {
      if (lockId) {
        const response = await getLockUsers(lockId);
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadUserActivity = async (userId) => {
    setLoading(true);
    try {
      const response = await getUserActivityHistory(userId);
      setActivityHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load user activity:', error);
      Alert.alert('Error', 'Failed to load user activity history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (selectedUser) {
      setRefreshing(true);
      loadUserActivity(selectedUser.id);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setShowUserSelector(false);
    loadUserActivity(user.id);
  };

  const getActivityIcon = (action) => {
    switch (action?.toLowerCase()) {
      case 'unlock':
      case 'unlocked':
        return { name: 'lock-open', color: Colors.success };
      case 'lock':
      case 'locked':
        return { name: 'lock-closed', color: Colors.iconbackground };
      case 'failed_attempt':
      case 'failed':
        return { name: 'close-circle', color: Colors.red };
      case 'access_granted':
        return { name: 'checkmark-circle', color: Colors.success };
      case 'access_denied':
        return { name: 'ban', color: Colors.red };
      default:
        return { name: 'radio-button-on', color: Colors.subtitlecolor };
    }
  };

  const getAccessMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'pin':
      case 'code':
        return 'keypad';
      case 'fingerprint':
      case 'biometric':
        return 'finger-print';
      case 'card':
      case 'rfid':
        return 'card';
      case 'bluetooth':
        return 'bluetooth';
      case 'app':
      case 'mobile':
        return 'phone-portrait';
      default:
        return 'key';
    }
  };

  const renderActivityItem = ({ item }) => {
    const icon = getActivityIcon(item.action);
    const methodIcon = getAccessMethodIcon(item.accessMethod);

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityHeader}>
          <View style={[styles.activityIcon, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityAction}>{item.action || 'Activity'}</Text>
            <Text style={styles.activityTime}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.activityDetails}>
          {item.lockName && (
            <View style={styles.detailRow}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>{item.lockName}</Text>
            </View>
          )}

          {item.accessMethod && (
            <View style={styles.detailRow}>
              <Ionicons name={methodIcon} size={14} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                Method: {item.accessMethod}
              </Text>
            </View>
          )}

          {item.location && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
          )}

          {item.ipAddress && (
            <View style={styles.detailRow}>
              <Ionicons name="globe-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>{item.ipAddress}</Text>
            </View>
          )}

          {item.result && (
            <View style={styles.detailRow}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                Result: {item.result}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderUserSelector = () => (
    <View style={styles.userSelectorOverlay}>
      <View style={styles.userSelectorCard}>
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorTitle}>Select User</Text>
          <TouchableOpacity onPress={() => setShowUserSelector(false)}>
            <Ionicons name="close" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.userItem,
                selectedUser?.id === item.id && styles.userItemSelected
              ]}
              onPress={() => handleUserSelect(item)}
            >
              <View style={styles.userAvatar}>
                <Ionicons name="person" size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name || item.email}</Text>
                {item.role && <Text style={styles.userRole}>{item.role}</Text>}
              </View>
              {selectedUser?.id === item.id && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.iconbackground} />
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading activity history...</Text>
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

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>User Activity History</Text>
          {selectedUser && (
            <TouchableOpacity
              style={styles.userSelector}
              onPress={() => setShowUserSelector(true)}
            >
              <Text style={styles.selectedUserText}>{selectedUser.name || selectedUser.email}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={22} color={Colors.iconbackground} />
        </TouchableOpacity>
      </View>

      {activityHistory.length === 0 ? (
        <Section>
          <AppCard style={styles.emptyCard}>
            <Ionicons name="time-outline" size={64} color={Colors.subtitlecolor} />
            <Text style={styles.emptyTitle}>No Activity Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedUser?.name || 'This user'} hasn't performed any actions yet.
            </Text>
          </AppCard>
        </Section>
      ) : (
        <Section>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{activityHistory.length}</Text>
              <Text style={styles.statLabel}>Total Activities</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {activityHistory.filter(a => a.action?.toLowerCase().includes('unlock')).length}
              </Text>
              <Text style={styles.statLabel}>Unlocks</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.red }]}>
                {activityHistory.filter(a => a.action?.toLowerCase().includes('failed')).length}
              </Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
          </View>

          <FlatList
            data={activityHistory}
            renderItem={renderActivityItem}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListHeaderComponent={() => (
              <Text style={styles.listHeader}>Recent Activity</Text>
            )}
          />
        </Section>
      )}

      {showUserSelector && renderUserSelector()}
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
  userSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  selectedUserText: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.md,
  },
  listContent: {
    gap: Theme.spacing.md,
  },
  activityItem: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityAction: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  activityDetails: {
    gap: 6,
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    flex: 1,
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
    paddingHorizontal: Theme.spacing.lg,
  },
  userSelectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  userSelectorCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    width: '100%',
    maxHeight: '70%',
    padding: Theme.spacing.lg,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    marginBottom: Theme.spacing.xs,
  },
  userItemSelected: {
    backgroundColor: `${Colors.iconbackground}10`,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.iconbackground}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  userRole: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
});

export default UserActivityHistoryScreen;
