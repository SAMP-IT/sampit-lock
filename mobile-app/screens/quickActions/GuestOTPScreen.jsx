import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { generateOTP, getLockInvites, createCloudPasscode } from '../../services/api';

const GuestOTPScreen = ({ navigation, route }) => {
  const { lockId, lockName, lock } = route.params || {};
  const hasGateway = lock?.has_gateway === true;

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [upcomingAccess, setUpcomingAccess] = useState([]);

  const [otpForm, setOtpForm] = useState({
    guestName: '',
    validDuration: 3600, // 1 hour in seconds
  });

  const durationOptions = [
    { value: 1800, label: '30 Minutes' },
    { value: 3600, label: '1 Hour' },
    { value: 7200, label: '2 Hours' },
    { value: 14400, label: '4 Hours' },
    { value: 28800, label: '8 Hours' },
    { value: 86400, label: '24 Hours' },
  ];

  useEffect(() => {
    if (lockId) {
      loadUpcomingAccess();
    }
  }, [lockId]);

  const loadUpcomingAccess = async () => {
    try {
      const response = await getLockInvites(lockId);
      const invites = response.data || [];

      // Filter for active invites
      const active = invites.filter((invite) => {
        if (!invite.expires_at) return false;
        const expiry = new Date(invite.expires_at);
        return expiry > new Date();
      });

      setUpcomingAccess(active);
    } catch (error) {
      console.error('Failed to load upcoming access:', error);
    }
  };

  const handleGenerateOTP = async () => {
    if (!lockId) {
      Alert.alert('Error', 'No lock selected');
      return;
    }

    if (!otpForm.guestName.trim()) {
      Alert.alert('Missing Information', 'Please enter the guest name');
      return;
    }

    setGenerating(true);
    try {
      const validUntil = new Date();
      validUntil.setSeconds(validUntil.getSeconds() + otpForm.validDuration);

      let otp;
      let isLockPasscode = false;

      // If lock has gateway, create a real one-time passcode on the lock
      if (hasGateway) {
        console.log('[GuestOTP] Creating one-time passcode via TTLock Cloud API...');
        const response = await createCloudPasscode(lockId, {
          type: 'one_time',
          name: `Guest: ${otpForm.guestName.trim()}`
        });

        if (response.data?.success) {
          otp = {
            code: response.data.data.passcode,
            guest_name: otpForm.guestName.trim(),
            expires_at: response.data.data.end_date,
            isLockPasscode: true
          };
          isLockPasscode = true;
          console.log('[GuestOTP] One-time passcode created:', otp.code);
        } else {
          throw new Error(response.data?.error?.message || 'Failed to create passcode');
        }
      } else {
        // No gateway - create app-based OTP (for verification through app only)
        console.log('[GuestOTP] No gateway - creating app-based OTP...');
        const otpData = {
          guest_name: otpForm.guestName.trim(),
          valid_duration: otpForm.validDuration,
          expires_at: validUntil.toISOString(),
        };

        const response = await generateOTP(lockId, otpData);
        otp = response.data?.data || response.data;
        otp.isLockPasscode = false;
      }

      setGeneratedOTP({
        ...otp,
        guestName: otpForm.guestName,
        expiresAt: isLockPasscode ? new Date(otp.expires_at) : validUntil,
        isLockPasscode
      });

      setShowOTPModal(true);

      // Reset form
      setOtpForm({
        guestName: '',
        validDuration: 3600,
      });

      await loadUpcomingAccess();
    } catch (error) {
      console.error('Failed to generate OTP:', error);
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to generate OTP');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareOTP = async () => {
    if (!generatedOTP) return;

    const expiryTime = new Date(generatedOTP.expiresAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let message;
    if (generatedOTP.isLockPasscode) {
      message = `🔑 One-Time Lock Code for ${lockName}\n\nGuest: ${generatedOTP.guestName}\nCode: ${generatedOTP.code}\nValid Until: ${expiryTime}\n\nEnter this code on the lock's keypad to unlock.\nThis code works ONCE then expires.\n\n- Sent from Awakey Smart Lock`;
    } else {
      message = `🔑 Guest Access Code for ${lockName}\n\nGuest: ${generatedOTP.guestName}\nCode: ${generatedOTP.code}\nValid Until: ${expiryTime}\n\nThis code can only be used once and will expire automatically.\n\n- Sent from Awakey Smart Lock`;
    }

    try {
      await Share.share({
        message,
        title: 'Guest Access Code',
      });
    } catch (error) {
      console.error('Failed to share OTP:', error);
    }
  };

  const getDurationLabel = (seconds) => {
    const option = durationOptions.find((opt) => opt.value === seconds);
    return option ? option.label : `${Math.floor(seconds / 60)} minutes`;
  };

  const getTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Guest OTP</Text>
          <Text style={styles.headerSubtitle}>{lockName || 'One-time codes for guests'}</Text>
        </View>
      </View>

      {/* Info Card */}
      <Section>
        <AppCard style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.iconbackground} />
          <Text style={styles.infoText}>
            {hasGateway
              ? 'Generate one-time codes that work directly on the lock\'s keypad. The code expires after single use.'
              : 'Generate guest access codes. Note: Without a WiFi gateway, these codes are for app verification only.'}
          </Text>
        </AppCard>
      </Section>

      {!hasGateway && (
        <Section>
          <AppCard style={styles.warningCard}>
            <Ionicons name="wifi-outline" size={24} color="#FF9500" />
            <Text style={styles.warningText}>
              Tip: Connect a WiFi gateway to enable true one-time lock passcodes that guests can enter on the keypad.
            </Text>
          </AppCard>
        </Section>
      )}

      {/* Generate OTP Form */}
      <Section title="Generate One-Time Code">
        <AppCard>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Guest Name</Text>
            <TextInput
              style={styles.textInput}
              value={otpForm.guestName}
              onChangeText={(text) => setOtpForm({ ...otpForm, guestName: text })}
              placeholder="e.g., John Smith"
              placeholderTextColor={Colors.subtitlecolor}
              editable={!generating}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Valid For</Text>
            <View style={styles.durationGrid}>
              {durationOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationButton,
                    otpForm.validDuration === option.value && styles.durationButtonActive,
                  ]}
                  onPress={() => setOtpForm({ ...otpForm, validDuration: option.value })}
                  disabled={generating}
                >
                  <Text
                    style={[
                      styles.durationButtonText,
                      otpForm.validDuration === option.value && styles.durationButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.generateButton, generating && styles.generateButtonDisabled]}
            onPress={handleGenerateOTP}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <>
                <Ionicons name="key-outline" size={20} color={Colors.textwhite} />
                <Text style={styles.generateText}>Generate OTP</Text>
              </>
            )}
          </TouchableOpacity>
        </AppCard>
      </Section>

      {/* Upcoming Access */}
      {upcomingAccess.length > 0 && (
        <Section title="Active Guest Codes" subtitle="Codes that haven't expired yet">
          <AppCard padding="none">
            {upcomingAccess.map((invite, index) => (
              <View
                key={invite.id}
                style={[
                  styles.accessItem,
                  index === upcomingAccess.length - 1 && styles.accessItemLast,
                ]}
              >
                <View style={styles.accessIconContainer}>
                  <Ionicons name="person-outline" size={20} color={Colors.iconbackground} />
                </View>
                <View style={styles.accessDetails}>
                  <Text style={styles.accessGuest}>{invite.guest_name || 'Guest'}</Text>
                  <Text style={styles.accessWindow}>
                    Expires in {getTimeRemaining(invite.expires_at)}
                  </Text>
                </View>
                {invite.status === 'active' && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Active</Text>
                  </View>
                )}
              </View>
            ))}
          </AppCard>
        </Section>
      )}

      {/* OTP Display Modal */}
      <Modal
        visible={showOTPModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOTPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            </View>

            <Text style={styles.modalTitle}>OTP Generated!</Text>
            <Text style={styles.modalSubtitle}>One-Time Password for {generatedOTP?.guestName}</Text>

            <View style={styles.otpDisplay}>
              <Text style={styles.otpCode}>{generatedOTP?.code}</Text>
              <Text style={styles.otpExpiry}>
                {generatedOTP?.isLockPasscode
                  ? 'Works ONCE on the lock keypad'
                  : `Valid for ${getDurationLabel(otpForm.validDuration)}`}
              </Text>
              {generatedOTP?.isLockPasscode && (
                <View style={styles.lockBadge}>
                  <Ionicons name="keypad-outline" size={14} color="#fff" />
                  <Text style={styles.lockBadgeText}>Lock Keypad Code</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareOTP}>
                <Ionicons name="share-outline" size={20} color={Colors.textwhite} />
                <Text style={styles.shareButtonText}>Share Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowOTPModal(false)}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  infoCard: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    backgroundColor: `${Colors.iconbackground}10`,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  warningCard: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    backgroundColor: '#FFF3E0',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: Theme.spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  durationButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  durationButtonActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  durationButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  durationButtonTextActive: {
    color: Colors.textwhite,
  },
  generateButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  accessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  accessItemLast: {
    borderBottomWidth: 0,
  },
  accessIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.iconbackground}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  accessDetails: {
    flex: 1,
  },
  accessGuest: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  accessWindow: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  statusBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.textwhite,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    marginBottom: Theme.spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  otpDisplay: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  otpCode: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.iconbackground,
    letterSpacing: 8,
    fontFamily: 'monospace',
    marginBottom: Theme.spacing.xs,
  },
  otpExpiry: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: Theme.spacing.sm,
  },
  lockBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    width: '100%',
    gap: Theme.spacing.sm,
  },
  shareButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  shareButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  closeButtonText: {
    color: Colors.titlecolor,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GuestOTPScreen;
