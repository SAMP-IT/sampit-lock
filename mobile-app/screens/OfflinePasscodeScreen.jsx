import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Colors from '../constants/Colors';
import { backendApi } from '../services/api';
import { useRolePermissions } from '../hooks/useRolePermissions';

const PASSCODE_TYPES = [
  {
    id: 1,
    name: 'One-Time',
    description: 'Valid for single use within 6 hours',
    icon: 'key-outline',
    color: '#4CAF50',
  },
  {
    id: 2,
    name: 'Permanent',
    description: 'No expiration (use within 24h of start)',
    icon: 'infinite-outline',
    color: '#2196F3',
  },
  {
    id: 3,
    name: 'Time Period',
    description: 'Valid during specific date range',
    icon: 'calendar-outline',
    color: '#FF9800',
  },
  {
    id: 6,
    name: 'Daily Recurring',
    description: 'Valid every day during time window',
    icon: 'repeat-outline',
    color: '#9C27B0',
  },
  {
    id: 7,
    name: 'Weekday Only',
    description: 'Valid Monday to Friday',
    icon: 'briefcase-outline',
    color: '#00BCD4',
  },
  {
    id: 5,
    name: 'Weekend Only',
    description: 'Valid Saturday and Sunday',
    icon: 'sunny-outline',
    color: '#E91E63',
  },
];

const OfflinePasscodeScreen = ({ navigation, route }) => {
  const { lockId, lockName, ttlockLockId, lock } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [generatedPasscode, setGeneratedPasscode] = useState(null);
  const [passcodeDetails, setPasscodeDetails] = useState(null);
  const [lockInfo, setLockInfo] = useState(null);
  const [assignedPasscode, setAssignedPasscode] = useState(null);
  const [assignedPasscodeLoading, setAssignedPasscodeLoading] = useState(false);

  // Get role-based permissions
  const permissions = useRolePermissions(lock || lockInfo);
  const isFamilyUser = permissions.role === 'family';
  const isRestrictedUser = permissions.role === 'restricted' || permissions.role === 'long_term_guest';
  const canGeneratePasscodes = permissions.canManageAllCredentials;

  useEffect(() => {
    if (lockId) {
      fetchLockInfo();
    }
  }, [lockId]);

  // Fetch assigned passcode for family/restricted users
  useEffect(() => {
    if (lockId && (isFamilyUser || isRestrictedUser)) {
      fetchAssignedPasscode();
    }
  }, [lockId, isFamilyUser, isRestrictedUser]);

  const fetchLockInfo = async () => {
    try {
      const response = await backendApi.get(`/locks/${lockId}`);
      if (response.data.success) {
        setLockInfo(response.data.data.lock);
      }
    } catch (error) {
      console.error('Failed to fetch lock info:', error);
    }
  };

  const fetchAssignedPasscode = async () => {
    setAssignedPasscodeLoading(true);
    try {
      const response = await backendApi.get(`/locks/${lockId}/my-passcode`);
      if (response.data.success && response.data.data?.passcode) {
        setAssignedPasscode(response.data.data.passcode);
      }
    } catch (error) {
      // 404 means no passcode assigned - that's OK
      if (error.response?.status !== 404) {
        console.error('Failed to fetch assigned passcode:', error);
      }
    } finally {
      setAssignedPasscodeLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyAssignedPasscode = async () => {
    if (assignedPasscode?.code) {
      await Clipboard.setStringAsync(assignedPasscode.code);
      Alert.alert('Copied!', 'Your passcode has been copied to clipboard');
    }
  };

  const generatePasscode = async (type) => {
    if (!ttlockLockId && !lockInfo?.ttlock_lock_id) {
      Alert.alert(
        'Cloud Connection Required',
        'This lock is not connected to Cloud. Please connect it first to generate offline passcodes.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    setSelectedType(type);
    setGeneratedPasscode(null);

    try {
      // Calculate time range based on type
      const now = Date.now();
      let startDate = now;
      let endDate;

      switch (type.id) {
        case 1: // One-time (6 hours)
          // IMPORTANT: Round start time to nearest hour (TTLock API requirement)
          const startDateObj = new Date(startDate);
          startDateObj.setMinutes(0);
          startDateObj.setSeconds(0);
          startDateObj.setMilliseconds(0);
          startDate = startDateObj.getTime();
          
          // End time is 6 hours later, also rounded to hour
          endDate = startDate + (6 * 60 * 60 * 1000);
          const endDateObj = new Date(endDate);
          endDateObj.setMinutes(0);
          endDateObj.setSeconds(0);
          endDateObj.setMilliseconds(0);
          endDate = endDateObj.getTime();
          break;
        case 2: // Permanent (1 year)
          endDate = now + (365 * 24 * 60 * 60 * 1000);
          break;
        case 3: // Time period (7 days default)
          endDate = now + (7 * 24 * 60 * 60 * 1000);
          break;
        case 5: // Weekend
        case 6: // Daily
        case 7: // Weekday
          // For cyclic passcodes, set a 30-day period
          endDate = now + (30 * 24 * 60 * 60 * 1000);
          break;
        default:
          endDate = now + (24 * 60 * 60 * 1000);
      }

      // Call backend to generate passcode
      const response = await backendApi.post('/ttlock-v3/passcode/get', {
        lockId: ttlockLockId || lockInfo?.ttlock_lock_id,
        keyboardPwdVersion: 4, // V4 for latest locks
        keyboardPwdType: type.id,
        keyboardPwdName: `${type.name} Passcode`,
        startDate,
        endDate,
      });

      if (response.data.success) {
        const data = response.data.data;
        setGeneratedPasscode(data.passcode);
        
        // Use dates from backend response if available (they're properly rounded)
        const validStartDate = data.validity?.startDate ? new Date(data.validity.startDate) : new Date(startDate);
        const validEndDate = data.validity?.endDate ? new Date(data.validity.endDate) : new Date(endDate);
        
        setPasscodeDetails({
          id: data.passcodeId,
          type: type.name,
          startDate: validStartDate.toLocaleString(),
          endDate: validEndDate.toLocaleString(),
          typeDescription: type.id === 1 
            ? `${data.typeDescription}\n\n⚠️ This code works ONLY ONCE within 6 hours. After first use, it will be automatically invalidated.`
            : data.typeDescription,
          expirationInfo: data.expiration_info,
        });
      } else {
        throw new Error(response.data.error?.message || 'Failed to generate passcode');
      }
    } catch (error) {
      console.error('Generate passcode error:', error);
      Alert.alert(
        'Generation Failed',
        error.response?.data?.error?.message || error.message || 'Failed to generate passcode. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedPasscode) {
      await Clipboard.setStringAsync(generatedPasscode);
      Alert.alert('Copied!', 'Passcode copied to clipboard');
    }
  };

  const sharePasscode = async () => {
    if (!generatedPasscode) return;

    const message = `Here's your ${selectedType?.name} passcode for ${lockName || 'the lock'}:\n\n${generatedPasscode}\n\nValid: ${passcodeDetails?.startDate} - ${passcodeDetails?.endDate}\n\nType: ${passcodeDetails?.typeDescription}`;

    try {
      await Share.share({
        message,
        title: 'Share Passcode',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const resetPasscode = () => {
    setGeneratedPasscode(null);
    setPasscodeDetails(null);
    setSelectedType(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offline Passcode</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Family/Restricted User: Your Assigned Passcode Section */}
        {(isFamilyUser || isRestrictedUser) && (
          <View style={styles.assignedSection}>
            <Text style={styles.sectionTitle}>Your Passcode</Text>
            <Text style={styles.sectionSubtitle}>Assigned by lock owner/admin</Text>

            {assignedPasscodeLoading ? (
              <View style={styles.assignedPasscodeCard}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading your passcode...</Text>
              </View>
            ) : assignedPasscode ? (
              <View style={styles.assignedPasscodeCard}>
                <View style={styles.assignedPasscodeHeader}>
                  <Ionicons name="key" size={24} color={Colors.primary} />
                  <Text style={styles.assignedPasscodeLabel}>
                    {assignedPasscode.name || 'Your Access Code'}
                  </Text>
                </View>

                <Text style={styles.assignedPasscodeValue}>{assignedPasscode.code}</Text>

                <View style={styles.assignedValidityInfo}>
                  <View style={styles.validityRow}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.subtitlecolor} />
                    <Text style={styles.validityText}>
                      Valid from: {formatDate(assignedPasscode.start_date || assignedPasscode.valid_from)}
                    </Text>
                  </View>
                  <View style={styles.validityRow}>
                    <Ionicons name="time-outline" size={16} color={Colors.subtitlecolor} />
                    <Text style={styles.validityText}>
                      Valid until: {formatDate(assignedPasscode.end_date || assignedPasscode.valid_until)}
                    </Text>
                  </View>
                  {assignedPasscode.type_description && (
                    <View style={styles.validityRow}>
                      <Ionicons name="information-circle-outline" size={16} color={Colors.subtitlecolor} />
                      <Text style={styles.validityText}>{assignedPasscode.type_description}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.copyAssignedButton} onPress={copyAssignedPasscode}>
                  <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                  <Text style={styles.copyAssignedText}>Copy Passcode</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noPasscodeCard}>
                <Ionicons name="key-outline" size={48} color={Colors.subtitlecolor} />
                <Text style={styles.noPasscodeTitle}>No Passcode Assigned</Text>
                <Text style={styles.noPasscodeText}>
                  Ask the lock owner or admin to create a passcode for you.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Info Card - Show for users who can generate passcodes */}
        {canGeneratePasscodes && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={Colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>How Offline Passcodes Work</Text>
              <Text style={styles.infoText}>
                Offline passcodes are generated using a secure algorithm and work even when the lock
                has no internet connection. They are automatically validated by the lock's firmware.
              </Text>
            </View>
          </View>
        )}

        {/* Lock Info */}
        <View style={styles.lockInfoCard}>
          <Ionicons name="lock-closed" size={20} color={Colors.primary} />
          <Text style={styles.lockName}>{lockName || lockInfo?.name || 'Selected Lock'}</Text>
        </View>

        {/* Generated Passcode Display */}
        {generatedPasscode && (
          <View style={styles.passcodeCard}>
            <Text style={styles.passcodeLabel}>Your {selectedType?.name} Passcode</Text>
            <Text style={styles.passcodeValue}>{generatedPasscode}</Text>
            <Text style={styles.passcodeType}>{passcodeDetails?.typeDescription}</Text>

            <View style={styles.validityInfo}>
              <View style={styles.validityRow}>
                <Ionicons name="time-outline" size={16} color={Colors.subtitlecolor} />
                <Text style={styles.validityText}>Valid from: {passcodeDetails?.startDate}</Text>
              </View>
              <View style={styles.validityRow}>
                <Ionicons name="time-outline" size={16} color={Colors.subtitlecolor} />
                <Text style={styles.validityText}>
                  {selectedType?.id === 1 && passcodeDetails?.expirationInfo
                    ? `Expires in: ${passcodeDetails.expirationInfo.expires_in_text} (one-time use)`
                    : `Valid until: ${passcodeDetails?.endDate}`}
                </Text>
              </View>
              {selectedType?.id === 1 && (
                <View style={styles.validityRow}>
                  <Ionicons name="warning-outline" size={16} color="#FF9800" />
                  <Text style={[styles.validityText, { color: '#FF9800', fontWeight: 'bold' }]}>
                    ⚠️ This code works ONLY ONCE. After first unlock, it will be invalidated.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.passcodeActions}>
              <TouchableOpacity style={styles.actionButton} onPress={copyToClipboard}>
                <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={sharePasscode}>
                <Ionicons name="share-outline" size={20} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={resetPasscode}>
                <Ionicons name="refresh-outline" size={20} color={Colors.accent} />
                <Text style={[styles.actionButtonText, { color: Colors.accent }]}>New</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Passcode Type Selection - Only for owner/admin who can generate */}
        {canGeneratePasscodes && !generatedPasscode && (
          <>
            <Text style={styles.sectionTitle}>Generate Passcode</Text>
            <Text style={styles.sectionSubtitle}>Create temporary access codes for others</Text>

            {PASSCODE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType?.id === type.id && loading && styles.typeCardSelected,
                ]}
                onPress={() => generatePasscode(type)}
                disabled={loading}
              >
                <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon} size={24} color={type.color} />
                </View>
                <View style={styles.typeInfo}>
                  <Text style={styles.typeName}>{type.name}</Text>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                </View>
                {loading && selectedType?.id === type.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Important Notes - Show for users who can generate passcodes */}
        {canGeneratePasscodes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Important Notes</Text>
            <View style={styles.noteItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.noteText}>Passcodes are 6-9 digits long</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.noteText}>One-time codes expire after single use</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.noteText}>Permanent codes must be used within 24h of creation</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="warning" size={16} color={Colors.accent} />
              <Text style={styles.noteText}>Offline passcodes cannot be deleted remotely</Text>
            </View>
          </View>
        )}

        {/* Info for family/restricted users */}
        {(isFamilyUser || isRestrictedUser) && (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>About Your Passcode</Text>
            <View style={styles.noteItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.noteText}>Enter the code on the lock keypad to unlock</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={styles.noteText}>Works even when the lock has no internet</Text>
            </View>
            <View style={styles.noteItem}>
              <Ionicons name="information-circle" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.noteText}>Contact the lock owner if you need a new passcode</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  lockInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 12,
  },
  assignedSection: {
    marginBottom: 20,
  },
  assignedPasscodeCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  assignedPasscodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  assignedPasscodeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  assignedPasscodeValue: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 6,
    marginBottom: 16,
  },
  assignedValidityInfo: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border || '#E0E0E0',
    marginBottom: 16,
  },
  copyAssignedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  copyAssignedText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  noPasscodeCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  noPasscodeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noPasscodeText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  typeCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  passcodeCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  passcodeLabel: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: 8,
  },
  passcodeValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 4,
    marginBottom: 8,
  },
  passcodeType: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 16,
  },
  validityInfo: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border || '#E0E0E0',
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  validityText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginLeft: 8,
  },
  passcodeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionButtonText: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  notesCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginLeft: 8,
    flex: 1,
  },
});

export default OfflinePasscodeScreen;
