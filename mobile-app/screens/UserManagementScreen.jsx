import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import {
  removeUserFromLock,
  removeUserFromMultipleLocks
} from '../services/api';
import { useAllUsersForAllLocks } from '../hooks/useQueryHooks';

const roleFilters = [
  { id: 'all', label: 'All' },
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'family', label: 'Family' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'guest_longterm', label: 'Long Term' },
  { id: 'guest_otp', label: 'OTP Guest' },
];

const UserManagementScreen = ({ navigation, route }) => {
  const { lockId, lock, refresh } = route.params || {};
  const queryClient = useQueryClient();

  const [roleFilter, setRoleFilter] = useState('all');
  const [lockFilter, setLockFilter] = useState(lockId || null);

  // Refetch when navigating back from AddUserScreen (refresh timestamp changes)
  useEffect(() => {
    if (refresh) {
      queryClient.invalidateQueries({ queryKey: ['allUsersForAllLocks'] });
    }
  }, [refresh]);

  // Build filters for the query
  const filters = useMemo(() => {
    const f = {};
    if (roleFilter !== 'all') f.role = roleFilter;
    if (lockFilter) f.lock_id = lockFilter;
    return f;
  }, [roleFilter, lockFilter]);

  const { data, isLoading, error: queryError, refetch } = useAllUsersForAllLocks(filters);

  const usersData = data?.users || [];
  const locksData = data?.locks || [];
  const stats = data?.stats || { total_users: 0, admins: 0, family: 0, owners: 0 };
  // User can manage if the backend returned any manageable locks
  // (getAllUsersForAllLocks only returns locks where user is owner or has can_manage_users)
  const canManageUsers = locksData.length > 0;
  const error = queryError ? 'Failed to load users. Please try again.' : null;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleAddUser = () => {
    // Navigate to AddUser screen, optionally with pre-selected lock
    navigation.navigate('AddUser', lockFilter ? { lockId: lockFilter } : {});
  };

  const handleViewUser = (user) => {
    // Build user object with all necessary data for EditUserAccessScreen
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const initials = (user.first_name?.[0] || user.email?.[0] || '?').toUpperCase();

    // Get dominant role
    const roles = (user.locks || []).map(l => l.role);
    const dominantRole = roles.includes('owner') ? 'owner' :
      roles.includes('admin') ? 'admin' :
      roles.includes('family') ? 'family' :
      roles.includes('scheduled') ? 'scheduled' :
      roles.includes('guest_longterm') ? 'guest_longterm' :
      roles.includes('guest_otp') ? 'guest_otp' : 'guest';

    const userForEdit = {
      ...user,
      name: displayName,
      initials,
      role: dominantRole,
      locks: user.locks || []
    };

    // Navigate to user detail/edit screen
    navigation.navigate('EditUserAccess', {
      user: userForEdit,
      lockId: lockFilter,
      lock: lockFilter ? locksData.find(l => l.id === lockFilter) : null
    });
  };

  const handleRemoveUser = (user) => {
    // Check if user is an owner of any lock
    const isOwner = (user.locks || []).some(lock => lock.role === 'owner');
    if (isOwner) {
      Alert.alert(
        'Cannot Remove Owner',
        'Lock owners cannot be removed. Transfer ownership first if needed.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Use the user's actual lock data — filter to the selected lock if applicable
    const locksToRemove = lockFilter
      ? (user.locks || []).filter(l => l.lock_id === lockFilter)
      : user.locks;

    if (!locksToRemove || locksToRemove.length === 0) {
      Alert.alert('Error', 'User does not have access to this lock.');
      return;
    }

    if (locksToRemove.length === 1) {
      // Single lock removal
      Alert.alert(
        'Remove User',
        `Remove ${user.first_name || user.email} from ${locksToRemove[0].lock_name || 'this lock'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeUserFromLock(locksToRemove[0].lock_id, user.id);
                queryClient.invalidateQueries({ queryKey: ['allUsersForAllLocks'] });
              } catch (err) {
                const errorMsg = err.response?.data?.error?.message || 'Failed to remove user. Please try again.';
                Alert.alert('Error', errorMsg);
              }
            },
          },
        ]
      );
    } else {
      // Multiple locks - show selection dialog
      Alert.alert(
        'Remove User',
        `${user.first_name || user.email} has access to ${locksToRemove.length} locks. Remove from all locks?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove from All',
            style: 'destructive',
            onPress: async () => {
              try {
                const lockIds = locksToRemove.map(l => l.lock_id);
                await removeUserFromMultipleLocks(user.id, lockIds);
                queryClient.invalidateQueries({ queryKey: ['allUsersForAllLocks'] });
              } catch (err) {
                const errorMsg = err.response?.data?.error?.message || 'Failed to remove user. Please try again.';
                Alert.alert('Error', errorMsg);
              }
            },
          },
        ]
      );
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return '#dc2626'; // Red
      case 'admin':
        return '#7c3aed'; // Purple
      case 'family':
        return '#2563eb'; // Blue
      case 'scheduled':
        return '#0891b2'; // Cyan
      case 'guest_longterm':
        return '#d97706'; // Amber
      case 'guest_otp':
        return '#059669'; // Green
      case 'guest':
        return '#6b7280'; // Gray
      default:
        return Colors.subtitlecolor;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'family':
        return 'Family';
      case 'scheduled':
        return 'Scheduled';
      case 'guest_longterm':
        return 'Long Term';
      case 'guest_otp':
        return 'OTP Guest';
      case 'guest':
        return 'Guest';
      default:
        return role;
    }
  };

  const renderUserCard = (user) => {
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const userLocks = user.locks || [];

    // Get the dominant role (highest permission level)
    const roles = userLocks.map(l => l.role);
    const dominantRole = roles.includes('owner') ? 'owner' :
      roles.includes('admin') ? 'admin' :
      roles.includes('family') ? 'family' :
      roles.includes('scheduled') ? 'scheduled' :
      roles.includes('guest_longterm') ? 'guest_longterm' :
      roles.includes('guest_otp') ? 'guest_otp' : 'guest';

    return (
      <AppCard key={user.id} style={styles.userCard}>
        <TouchableOpacity
          style={styles.userCardContent}
          onPress={() => handleViewUser(user)}
        >
          {/* Avatar */}
          <View style={styles.avatar}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(user.first_name?.[0] || user.email?.[0] || '?').toUpperCase()}
              </Text>
            )}
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>

            {/* Lock badges */}
            <View style={styles.lockBadges}>
              {userLocks.slice(0, 3).map((lockAccess, index) => (
                <View
                  key={lockAccess.lock_id || index}
                  style={[styles.lockBadge, { borderColor: getRoleColor(lockAccess.role) }]}
                >
                  <Ionicons name="lock-closed-outline" size={10} color={getRoleColor(lockAccess.role)} />
                  <Text style={[styles.lockBadgeText, { color: getRoleColor(lockAccess.role) }]}>
                    {lockAccess.lock_name?.substring(0, 12) || 'Lock'}
                  </Text>
                </View>
              ))}
              {userLocks.length > 3 && (
                <View style={styles.moreBadge}>
                  <Text style={styles.moreBadgeText}>+{userLocks.length - 3}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Role Badge & Actions */}
          <View style={styles.userActions}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(dominantRole) + '20' }]}>
              <Text style={[styles.roleBadgeText, { color: getRoleColor(dominantRole) }]}>
                {getRoleLabel(dominantRole)}
              </Text>
            </View>

            {canManageUsers && dominantRole !== 'owner' &&
              // When filtering by lock, only show delete if user is actually on that lock
              (!lockFilter || userLocks.some(l => l.lock_id === lockFilter)) && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveUser(user)}
              >
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </AppCard>
    );
  };

  return (
    <AppScreen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          colors={[Colors.iconbackground]}
          tintColor={Colors.iconbackground}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>Manage access & permissions</Text>
        </View>

        {canManageUsers && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
            <Ionicons name="person-add-outline" size={20} color={Colors.textwhite} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <Section gapless>
        <AppCard variant="primary" padding="lg">
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {(stats.total_users || 0).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.statLabel}>Users</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {(stats.admins || 0).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {(stats.family || 0).toString().padStart(2, '0')}
              </Text>
              <Text style={styles.statLabel}>Family</Text>
            </View>
          </View>
        </AppCard>
      </Section>

      {/* Role Filters */}
      <Section title="Filter by Role">
        <View style={styles.filterRow}>
          {roleFilters.map((item) => {
            const active = item.id === roleFilter;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setRoleFilter(item.id)}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* Lock Filter */}
      {locksData.length > 1 && (
        <Section title="Filter by Lock">
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !lockFilter && styles.filterChipActive]}
              onPress={() => setLockFilter(null)}
            >
              <Text style={[styles.filterLabel, !lockFilter && styles.filterLabelActive]}>
                All Locks
              </Text>
            </TouchableOpacity>
            {locksData.map((lock) => {
              const active = lock.id === lockFilter;
              return (
                <TouchableOpacity
                  key={lock.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setLockFilter(lock.id)}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={12}
                    color={active ? Colors.iconbackground : Colors.subtitlecolor}
                  />
                  <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                    {lock.name?.substring(0, 15) || 'Lock'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>
      )}

      {/* User List */}
      <Section title="Users" gapless>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.iconbackground} />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : error ? (
          <AppCard>
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        ) : usersData.length === 0 ? (
          <AppCard>
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.subtitlecolor} />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySubtitle}>
                {roleFilter !== 'all' || lockFilter
                  ? 'Try changing your filters'
                  : 'Add users to give them access to your locks'}
              </Text>
              {canManageUsers && !lockFilter && roleFilter === 'all' && (
                <TouchableOpacity style={styles.addFirstUserButton} onPress={handleAddUser}>
                  <Ionicons name="person-add-outline" size={20} color={Colors.textwhite} />
                  <Text style={styles.addFirstUserText}>Add First User</Text>
                </TouchableOpacity>
              )}
            </View>
          </AppCard>
        ) : (
          <View style={styles.usersList}>
            {usersData.map(renderUserCard)}
          </View>
        )}
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
  },
  addButtonText: {
    color: Colors.textwhite,
    fontSize: 14,
    fontWeight: '600',
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
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.textwhite,
    opacity: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  filterChipActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.cardbackground,
  },
  filterLabel: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  filterLabelActive: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl * 2,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  errorText: {
    marginTop: Theme.spacing.sm,
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.md,
  },
  retryText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginTop: Theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  addFirstUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.md,
  },
  addFirstUserText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  usersList: {
    gap: Theme.spacing.md,
  },
  userCard: {
    marginBottom: 0,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.iconbackground + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  lockBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Theme.spacing.xs,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.cardbackground,
  },
  moreBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  userActions: {
    alignItems: 'flex-end',
    gap: Theme.spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    padding: Theme.spacing.xs,
  },
});

export default UserManagementScreen;
