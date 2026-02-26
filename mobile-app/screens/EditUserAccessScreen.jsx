import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { removeUserFromLock, updateUserAccess } from '../services/api';

// Role descriptions - what each role can do
const ROLE_DESCRIPTIONS = {
  owner: {
    title: 'Owner',
    description: 'Primary lock owner with ultimate authority',
    color: '#4CAF50',
    icon: 'shield',
    features: [
      'Full control over the lock',
      'Add, edit, and remove all users',
      'Change all lock settings',
      'View complete activity history',
      'Factory reset and delete lock',
      'Transfer ownership to another user'
    ],
    canChangeTo: [] // Cannot change owner role
  },
  admin: {
    title: 'Admin',
    description: 'Trusted administrator/manager',
    color: '#2196F3',
    icon: 'key',
    features: [
      'Full lock control (lock/unlock)',
      'Add and remove users (except owner)',
      'Manage all credentials (except owner)',
      'View all access logs',
      'Change settings (except factory reset)',
      'Cannot delete lock or transfer ownership'
    ],
    canChangeTo: ['family', 'scheduled', 'guest_longterm']
  },
  family: {
    title: 'Family / Resident',
    description: 'Household member with transparency',
    color: '#9C27B0',
    icon: 'people',
    features: [
      'Lock and unlock the door',
      'Manage own fingerprint',
      'View assigned passcode',
      'View full household activity history',
      'Cannot add or remove users',
      'Cannot modify lock settings'
    ],
    canChangeTo: ['admin', 'scheduled', 'guest_longterm']
  },
  scheduled: {
    title: 'Scheduled',
    description: 'Staff, drivers, cleaners with time-based access',
    color: '#00BCD4',
    icon: 'time',
    features: [
      'Unlock only during assigned schedule',
      'Manage own fingerprint',
      'View only own access history',
      'Cannot add or remove users',
      'Cannot modify lock settings',
      'Access limited to specific days/times'
    ],
    canChangeTo: ['admin', 'family', 'guest_longterm']
  },
  guest_longterm: {
    title: 'Long Term Guest',
    description: 'Airbnb, rental, tenant with auto-expiring access',
    color: '#FF9800',
    icon: 'calendar',
    features: [
      'Lock and unlock the door',
      'Manage own fingerprint/PIN',
      'View only own access history',
      'Credentials auto-expire on end date',
      'Cannot add or remove users',
      'Cannot modify lock settings'
    ],
    canChangeTo: ['admin', 'family', 'scheduled']
  },
  guest: {
    title: 'Guest (Legacy)',
    description: 'Basic short-term access',
    color: '#9E9E9E',
    icon: 'person',
    features: [
      'Lock and unlock the door only',
      'No activity log access',
      'No credential management',
      'Access can be revoked anytime',
      'May have temporary access period'
    ],
    canChangeTo: ['admin', 'family', 'scheduled', 'guest_longterm']
  }
};

const EditUserAccessScreen = ({ route, navigation }) => {
  const { user, lockId, lock } = route.params;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState(user.notes || '');
  const [originalNotes] = useState(user.notes || '');
  const [error, setError] = useState(null);

  const hasChanges = notes !== originalNotes;
  const [selectedLockIndex, setSelectedLockIndex] = useState(0); // Track selected lock for role display

  // Get user display info
  const userName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  const userInitials = user.initials ||
    (user.first_name ? user.first_name[0].toUpperCase() : null) ||
    (user.name ? user.name[0].toUpperCase() : null);

  // Get all locks this user has access to from the user object
  // The user object should contain lock_access array with lock details
  const userLocks = user.locks || (lock ? [{ ...lock, role: user.role }] : []);

  // Get selected lock and its role
  const selectedLock = userLocks[selectedLockIndex] || userLocks[0];
  const selectedRole = selectedLock?.role || user.role || 'guest';

  // Debug logging
  useEffect(() => {
    console.log('[EditUserAccess] User data:', {
      name: userName,
      email: user.email,
      initials: userInitials,
      locks: userLocks,
      selectedLock,
      selectedRole,
      rawUser: user
    });
  }, []);

  const getRoleInfo = (role) => {
    const normalizedRole = (role || 'guest').toLowerCase();
    return ROLE_DESCRIPTIONS[normalizedRole] || ROLE_DESCRIPTIONS.guest;
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await updateUserAccess(lockId, user.id, { notes });
      Alert.alert(
        'Changes Saved',
        'Notes have been updated successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveUser = () => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${user.name} from this lock?\n\nThis will revoke their access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await removeUserFromLock(lockId, user.id);
              Alert.alert(
                'User Removed',
                `${user.name} has been removed from the lock.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error?.message || 'Failed to remove user.');
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const roleInfo = getRoleInfo(selectedRole);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>User Details</Text>
          <Text style={styles.headerSubtitle}>View {userName}'s access</Text>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <Section gapless>
          <AppCard padding="lg">
            <View style={styles.userInfoContainer}>
              <View style={styles.avatar}>
                {userInitials ? (
                  <Text style={styles.initials}>{userInitials}</Text>
                ) : (
                  <Ionicons name="person" size={28} color={Colors.textwhite} />
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
          </AppCard>
        </Section>

        {/* Lock Access */}
        <Section title="Lock Access" subtitle={userLocks.length > 1 ? "Tap a lock to see role permissions" : "Locks this user can access"}>
          <AppCard padding="none">
            {userLocks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No lock access information available</Text>
              </View>
            ) : (
              userLocks.map((lockItem, index) => {
                const lockRole = lockItem.role || selectedRole || 'guest';
                const lockRoleInfo = getRoleInfo(lockRole);
                const isSelected = index === selectedLockIndex;
                return (
                  <TouchableOpacity
                    key={lockItem.lock_id || lockItem.id || index}
                    style={[
                      styles.lockRow,
                      index === userLocks.length - 1 && styles.lastRow,
                      isSelected && styles.lockRowSelected
                    ]}
                    onPress={() => setSelectedLockIndex(index)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.lockIcon, isSelected && styles.lockIconSelected]}>
                      <Ionicons name="lock-closed" size={20} color={isSelected ? Colors.textwhite : Colors.iconbackground} />
                    </View>
                    <View style={styles.lockDetails}>
                      <Text style={styles.lockName}>{lockItem.lock_name || lockItem.lock_alias || lockItem.name || 'Lock'}</Text>
                      <Text style={styles.lockLocation}>{lockItem.location || lockItem.lock_model || 'No location set'}</Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: lockRoleInfo.color + '20' }]}>
                      <Text style={[styles.roleBadgeText, { color: lockRoleInfo.color }]}>
                        {lockRoleInfo.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </AppCard>
        </Section>

        {/* Role Permissions Description */}
        <Section title="Role Permissions" subtitle={`What ${roleInfo.title} users can do`}>
          <AppCard padding="md">
            <View style={styles.roleHeader}>
              <View style={[styles.roleIcon, { backgroundColor: roleInfo.color + '20' }]}>
                <Ionicons
                  name={roleInfo.icon || 'person'}
                  size={24}
                  color={roleInfo.color}
                />
              </View>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleTitle, { color: roleInfo.color }]}>{roleInfo.title}</Text>
                <Text style={styles.roleSubtitle}>
                  {roleInfo.description || (selectedLock ? `Role for ${selectedLock.lock_name || selectedLock.name || 'this lock'}` : 'Current role')}
                </Text>
              </View>
            </View>

            <View style={styles.featuresList}>
              {roleInfo.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={roleInfo.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        </Section>

        {/* Additional Notes */}
        <Section title="Additional Notes" subtitle="Notes about this user (editable)">
          <AppCard padding="md">
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this user..."
              placeholderTextColor={Colors.subtitlecolor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </AppCard>
        </Section>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, (isSaving || !hasChanges) && styles.buttonDisabled]}
            onPress={handleSaveChanges}
            disabled={isSaving || isLoading || !hasChanges}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <Text style={styles.saveButtonText}>{hasChanges ? 'Save Changes' : 'No Changes'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.removeButton, isLoading && styles.buttonDisabled]}
            onPress={handleRemoveUser}
            disabled={isSaving || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.red} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={Colors.red} />
                <Text style={styles.removeButtonText}>Remove User</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
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
  headerTextContainer: {
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
  errorText: {
    color: Colors.red,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
    fontSize: 14,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  avatar: {
    backgroundColor: Colors.iconbackground,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.textwhite,
    fontSize: 22,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  lockRowSelected: {
    backgroundColor: Colors.iconbackground + '10',
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  lockIconSelected: {
    backgroundColor: Colors.iconbackground,
  },
  lockDetails: {
    flex: 1,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  lockLocation: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleSubtitle: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  featuresList: {
    gap: Theme.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: Colors.titlecolor,
    lineHeight: 20,
  },
  notesInput: {
    fontSize: 15,
    color: Colors.titlecolor,
    minHeight: 100,
    padding: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  actionButtons: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
    paddingHorizontal: 0,
  },
  saveButton: {
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.red,
    gap: Theme.spacing.sm,
    height: 50,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.red,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
});

export default EditUserAccessScreen;
