import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { addUserToMultipleLocks, getLocks } from '../services/api';

const userRoles = [
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'Trusted administrator / manager',
    icon: 'shield-checkmark-outline',
    permissions: [
      'Full lock control',
      'Add/remove users (except owner)',
      'Manage all credentials',
      'View all access logs',
      'Change settings (except factory reset)'
    ]
  },
  {
    id: 'family',
    title: 'Family / Resident',
    subtitle: 'Household member with transparency',
    icon: 'people-outline',
    permissions: [
      'Unlock/lock access',
      'Manage own fingerprint',
      'View assigned passcode',
      'View full household history'
    ]
  },
  {
    id: 'restricted',
    title: 'Restricted / Scheduled',
    subtitle: 'Staff, drivers, cleaners, office team',
    icon: 'time-outline',
    permissions: [
      'Unlock only during assigned times',
      'Manage own fingerprint',
      'View only own access history'
    ],
    requiresSchedule: true
  },
  {
    id: 'long_term_guest',
    title: 'Long Term Guest',
    subtitle: 'Airbnb, rental, tenant',
    icon: 'calendar-outline',
    permissions: [
      'Unlock/lock through app',
      'Manage own fingerprint/PIN',
      'Credentials auto-expire on end date'
    ],
    requiresEndDate: true
  }
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

const AddUserScreen = ({ navigation, route }) => {
  // Get pre-selected lock if navigating from lock detail
  const { lockId: preSelectedLockId, lock: preSelectedLock } = route.params || {};

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    role: '',
    notes: '',
    selectedLocks: preSelectedLockId ? [preSelectedLockId] : []
  });

  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocks, setIsLoadingLocks] = useState(true);
  const [error, setError] = useState(null);
  const [availableLocks, setAvailableLocks] = useState([]);

  // Schedule state for 'restricted' role
  const [selectedDays, setSelectedDays] = useState(DEFAULT_DAYS);
  const [startTime, setStartTime] = useState(new Date(2024, 0, 1, 9, 0)); // 9:00 AM
  const [endTime, setEndTime] = useState(new Date(2024, 0, 1, 17, 0)); // 5:00 PM
  const [showTimePicker, setShowTimePicker] = useState(null); // 'start' | 'end' | null

  // Date range state for 'long_term_guest' role
  const [accessValidFrom, setAccessValidFrom] = useState(new Date());
  const [accessValidUntil, setAccessValidUntil] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(null); // 'from' | 'until' | null

  // Fetch available locks on mount
  useEffect(() => {
    const fetchLocks = async () => {
      try {
        setIsLoadingLocks(true);
        const response = await getLocks();
        const locks = response?.data?.data || response?.data || [];

        // Filter to only locks where user can manage users
        // Only owner and admin roles can add users (not family or guest)
        // user_role is returned from the API (not userRole)
        const manageableLocks = locks.filter(lock => {
          const role = lock.user_role || lock.userRole;
          const canManageUsers = lock.can_manage_users;
          // Only admin (owner) can manage users - family and guest cannot
          return role === 'admin' || role === 'owner' || canManageUsers === true;
        });

        setAvailableLocks(manageableLocks);

        // If pre-selected lock exists and is manageable, keep it selected
        if (preSelectedLockId && manageableLocks.some(l => l.id === preSelectedLockId)) {
          setFormData(prev => ({
            ...prev,
            selectedLocks: [preSelectedLockId]
          }));
        }
      } catch (err) {
        console.error('[AddUserScreen] Failed to fetch locks:', err);
        setError('Failed to load locks. Please try again.');
      } finally {
        setIsLoadingLocks(false);
      }
    };

    fetchLocks();
  }, [preSelectedLockId]);

  const updateField = (field, value) => {
    setFormData(prevData => ({
      ...prevData,
      [field]: value
    }));
    if (error) setError(null);
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    updateField('role', role.id);
  };

  // Toggle day selection for restricted schedule
  const toggleDay = (dayIndex) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle time picker change
  const handleTimeChange = (event, selectedDate, type) => {
    setShowTimePicker(null);
    if (selectedDate) {
      if (type === 'start') {
        setStartTime(selectedDate);
      } else {
        setEndTime(selectedDate);
      }
    }
  };

  // Handle date picker change
  const handleDateChange = (event, selectedDate, type) => {
    setShowDatePicker(null);
    if (selectedDate) {
      if (type === 'from') {
        setAccessValidFrom(selectedDate);
      } else {
        setAccessValidUntil(selectedDate);
      }
    }
  };

  // Format time for API (HH:MM format)
  const formatTimeForAPI = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const toggleLockSelection = (lockId) => {
    setFormData(prev => {
      const currentSelection = prev.selectedLocks;
      const isSelected = currentSelection.includes(lockId);

      return {
        ...prev,
        selectedLocks: isSelected
          ? currentSelection.filter(id => id !== lockId)
          : [...currentSelection, lockId]
      };
    });
  };

  const selectAllLocks = () => {
    const allLockIds = availableLocks.map(lock => lock.id);
    const allSelected = formData.selectedLocks.length === availableLocks.length;

    setFormData(prev => ({
      ...prev,
      selectedLocks: allSelected ? [] : allLockIds
    }));
  };

  const handleSaveUser = async () => {
    // Validate email
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate locks selection
    if (formData.selectedLocks.length === 0) {
      setError('Please select at least one lock');
      return;
    }

    // Validate role
    if (!formData.role) {
      setError('Please select a role');
      return;
    }

    // Validate schedule for restricted role
    if (selectedRole?.requiresSchedule && selectedDays.length === 0) {
      setError('Please select at least one day for the access schedule');
      return;
    }

    // Validate end date for long_term_guest role
    if (selectedRole?.requiresEndDate && !accessValidUntil) {
      setError('Please select an end date for the guest access');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build payload with role-specific fields
      const payload = {
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone?.trim() || null,
        lock_ids: formData.selectedLocks,
        role: formData.role,
        notes: formData.notes || null
      };

      // Add schedule for restricted role
      if (selectedRole?.requiresSchedule) {
        payload.time_restricted = true;
        payload.days_of_week = selectedDays;
        payload.time_restriction_start = formatTimeForAPI(startTime);
        payload.time_restriction_end = formatTimeForAPI(endTime);
      }

      // Add validity dates for long_term_guest role
      if (selectedRole?.requiresEndDate) {
        payload.access_valid_from = accessValidFrom.toISOString();
        payload.access_valid_until = accessValidUntil.toISOString();
      }

      const response = await addUserToMultipleLocks(payload);

      const result = response?.data?.data;
      const message = result?.message || 'User added successfully';

      Alert.alert(
        'Success',
        message,
        [{
          text: 'OK',
          onPress: () => {
            // Navigate back and trigger refresh in UserManagementScreen
            navigation.navigate('UserManagement', { refresh: Date.now() });
          }
        }]
      );
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to add user. Please try again.';

      // Special handling for user not found
      if (err.response?.status === 404) {
        setError('No AwayKey account found with this email. The user must sign up for AwayKey first.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const allLocksSelected = availableLocks.length > 0 &&
    formData.selectedLocks.length === availableLocks.length;

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Add User</Text>
          <Text style={styles.headerSubtitle}>Grant lock access to an AwayKey user</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Lock Selection - At the top */}
        <Section title="Select Locks">
          <AppCard>
            <Text style={styles.sectionDescription}>
              Choose which locks this user should have access to
            </Text>

            {isLoadingLocks ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.iconbackground} />
                <Text style={styles.loadingText}>Loading locks...</Text>
              </View>
            ) : availableLocks.length === 0 ? (
              <Text style={styles.noLocksText}>
                No locks available. You need to be an owner, admin, or family member of a lock to add users.
              </Text>
            ) : (
              <>
                {/* Select All Button */}
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={selectAllLocks}
                >
                  <Ionicons
                    name={allLocksSelected ? "checkbox" : "square-outline"}
                    size={20}
                    color={Colors.iconbackground}
                  />
                  <Text style={styles.selectAllText}>
                    {allLocksSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                {/* Lock List */}
                <View style={styles.locksList}>
                  {availableLocks.map((lock) => {
                    const isSelected = formData.selectedLocks.includes(lock.id);
                    return (
                      <TouchableOpacity
                        key={lock.id}
                        style={[styles.lockItem, isSelected && styles.lockItemSelected]}
                        onPress={() => toggleLockSelection(lock.id)}
                      >
                        <View style={styles.lockItemContent}>
                          <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={22}
                            color={isSelected ? Colors.iconbackground : Colors.subtitlecolor}
                          />
                          <View style={styles.lockInfo}>
                            <Text style={[
                              styles.lockName,
                              isSelected && styles.lockNameSelected
                            ]}>
                              {lock.name || 'Unnamed Lock'}
                            </Text>
                            <Text style={styles.lockLocation}>
                              {lock.ttlock_model || lock.location || 'No details'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={Colors.subtitlecolor}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {formData.selectedLocks.length > 0 && (
              <Text style={styles.selectedCount}>
                {formData.selectedLocks.length} lock{formData.selectedLocks.length !== 1 ? 's' : ''} selected
              </Text>
            )}
          </AppCard>
        </Section>

        {/* Email Input - Only email required */}
        <Section title="User Email">
          <AppCard>
            <Text style={styles.sectionDescription}>
              Enter the email of an existing AwayKey user
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.textInput}
                placeholder="user@example.com"
                value={formData.email}
                onChangeText={(text) => updateField('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={Colors.subtitlecolor}
              />
            </View>
            <Text style={styles.helperText}>
              The user must have an AwayKey account. If they don't, ask them to sign up first.
            </Text>
          </AppCard>
        </Section>

        {/* Phone Number Input - Optional */}
        <Section title="Phone Number (Optional)">
          <AppCard>
            <Text style={styles.sectionDescription}>
              Provide a phone number for emergency contact
            </Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.textInput}
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChangeText={(text) => updateField('phone', text)}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={Colors.subtitlecolor}
              />
            </View>
            <Text style={styles.helperText}>
              This number will be stored for reference and emergency contact purposes.
            </Text>
          </AppCard>
        </Section>

        {/* Role Selection */}
        <Section title="Role">
          <AppCard padding="none">
            {userRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleOption,
                  selectedRole?.id === role.id && styles.roleOptionSelected
                ]}
                onPress={() => selectRole(role)}
              >
                <View style={styles.roleIcon}>
                  <Ionicons
                    name={role.icon}
                    size={24}
                    color={selectedRole?.id === role.id ? Colors.iconbackground : Colors.subtitlecolor}
                  />
                </View>
                <View style={styles.roleContent}>
                  <Text style={[
                    styles.roleTitle,
                    selectedRole?.id === role.id && styles.roleTitleSelected
                  ]}>
                    {role.title}
                  </Text>
                  <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                  <View style={styles.permissionsList}>
                    {role.permissions.map((permission, index) => (
                      <Text key={index} style={styles.permissionText}>• {permission}</Text>
                    ))}
                  </View>
                </View>
                <View style={styles.roleSelector}>
                  <View style={[
                    styles.radioButton,
                    selectedRole?.id === role.id && styles.radioButtonSelected
                  ]}>
                    {selectedRole?.id === role.id && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </AppCard>
          <Text style={styles.roleHelperText}>
            Same role will be applied to all selected locks
          </Text>
        </Section>

        {/* Schedule Selection for Restricted Role */}
        {selectedRole?.requiresSchedule && (
          <Section title="Access Schedule" subtitle="When can this user access?">
            <AppCard>
              {/* Days of week selector */}
              <Text style={styles.fieldLabel}>Days of Week</Text>
              <View style={styles.daysRow}>
                {DAY_NAMES.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayChip,
                      selectedDays.includes(index) && styles.dayChipSelected
                    ]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text style={[
                      styles.dayChipText,
                      selectedDays.includes(index) && styles.dayChipTextSelected
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time range */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Time Window</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity
                  style={styles.timeInput}
                  onPress={() => setShowTimePicker('start')}
                >
                  <Ionicons name="time-outline" size={20} color={Colors.iconbackground} />
                  <Text style={styles.timeText}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
                <Text style={styles.toText}>to</Text>
                <TouchableOpacity
                  style={styles.timeInput}
                  onPress={() => setShowTimePicker('end')}
                >
                  <Ionicons name="time-outline" size={20} color={Colors.iconbackground} />
                  <Text style={styles.timeText}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scheduleNote}>
                User can only unlock during this time window on selected days
              </Text>
            </AppCard>
          </Section>
        )}

        {/* Date Range for Long Term Guest */}
        {selectedRole?.requiresEndDate && (
          <Section title="Stay Duration" subtitle="Credentials auto-expire after end date">
            <AppCard>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker('from')}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.iconbackground} />
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>{formatDate(accessValidFrom)}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.dateSeparator} />

              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker('until')}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.iconbackground} />
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={[
                    styles.dateValue,
                    !accessValidUntil && styles.dateValuePlaceholder
                  ]}>
                    {formatDate(accessValidUntil)}
                  </Text>
                </View>
                {!accessValidUntil && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.expiryNote}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.subtitlecolor} />
                <Text style={styles.expiryNoteText}>
                  User's app access, fingerprints, and PINs will be automatically deleted after the end date.
                </Text>
              </View>
            </AppCard>
          </Section>
        )}

        {/* Time/Date Pickers (conditionally rendered) */}
        {showTimePicker && (
          <DateTimePicker
            value={showTimePicker === 'start' ? startTime : endTime}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => handleTimeChange(event, date, showTimePicker)}
          />
        )}

        {showDatePicker && (
          <DateTimePicker
            value={showDatePicker === 'from' ? accessValidFrom : (accessValidUntil || new Date())}
            mode="date"
            minimumDate={showDatePicker === 'until' ? accessValidFrom : new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => handleDateChange(event, date, showDatePicker)}
          />
        )}

        {/* Notes */}
        <Section title="Notes (Optional)">
          <AppCard>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="e.g., Cleaning service - Mondays and Thursdays"
              value={formData.notes}
              onChangeText={(text) => updateField('notes', text)}
              multiline
              numberOfLines={3}
              placeholderTextColor={Colors.subtitlecolor}
            />
          </AppCard>
        </Section>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (isLoading || formData.selectedLocks.length === 0) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveUser}
            disabled={isLoading || formData.selectedLocks.length === 0}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.textwhite} />
            ) : (
              <Text style={styles.saveButtonText}>Add User</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: 72,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  errorText: {
    color: '#dc2626',
    flex: 1,
    fontSize: 14,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  noLocksText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  locksList: {
    gap: Theme.spacing.sm,
  },
  lockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  lockItemSelected: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.cardbackground,
  },
  lockItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  lockInfo: {
    flex: 1,
  },
  lockName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  lockNameSelected: {
    color: Colors.iconbackground,
  },
  lockLocation: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  selectedCount: {
    fontSize: 13,
    color: Colors.iconbackground,
    fontWeight: '600',
    marginTop: Theme.spacing.md,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: Theme.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
    backgroundColor: Colors.backgroundwhite,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: Theme.spacing.xs,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  roleOptionSelected: {
    backgroundColor: Colors.cardbackground,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  roleTitleSelected: {
    color: Colors.iconbackground,
  },
  roleSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.sm,
  },
  permissionsList: {
    gap: 2,
  },
  permissionText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  roleSelector: {
    paddingTop: 4,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: Colors.iconbackground,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.iconbackground,
  },
  roleHelperText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  saveButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.bordercolor,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  // Schedule styles
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  dayChip: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    backgroundColor: Colors.backgroundwhite,
  },
  dayChipSelected: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.iconbackground,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  dayChipTextSelected: {
    color: Colors.textwhite,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  timeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    backgroundColor: Colors.backgroundwhite,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  toText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  scheduleNote: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: Theme.spacing.md,
    fontStyle: 'italic',
  },
  // Date range styles
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  dateContent: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginTop: 2,
  },
  dateValuePlaceholder: {
    color: Colors.subtitlecolor,
  },
  dateSeparator: {
    height: 1,
    backgroundColor: Colors.bordercolor,
  },
  requiredBadge: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: Theme.radius.sm,
    backgroundColor: '#fef2f2',
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  expiryNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
  },
  expiryNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
});

export default AddUserScreen;
