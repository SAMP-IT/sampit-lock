import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import {
  getLockInvites,
  createInvite,
  revokeInvite,
} from '../services/api';

const InviteManagementScreen = ({ route, navigation }) => {
  const { lockId, lockName } = route.params;

  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [accessType, setAccessType] = useState('temporary');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const response = await getLockInvites(lockId);
      setInvites(response.data || []);
    } catch (error) {
      console.error('Failed to load invites:', error);
      Alert.alert('Error', 'Failed to load guest invites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!guestEmail.trim() || !guestName.trim()) {
      Alert.alert('Error', 'Please enter guest name and email');
      return;
    }

    if (accessType === 'temporary' && !expiresAt) {
      Alert.alert('Error', 'Please select an expiration date for temporary access');
      return;
    }

    setCreating(true);
    try {
      await createInvite(lockId, {
        email: guestEmail.trim(),
        name: guestName.trim(),
        access_type: accessType,
        expires_at: accessType === 'temporary' ? expiresAt : null,
      });

      Alert.alert('Success', `Invite sent to ${guestEmail}`);
      setShowCreateModal(false);
      resetForm();
      loadInvites();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeInvite = (invite) => {
    Alert.alert(
      'Revoke Invite',
      `Are you sure you want to revoke the invite for ${invite.guest_email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => confirmRevokeInvite(invite.id),
        },
      ]
    );
  };

  const confirmRevokeInvite = async (inviteId) => {
    try {
      await revokeInvite(inviteId);
      Alert.alert('Success', 'Invite has been revoked');
      loadInvites();
    } catch (error) {
      Alert.alert('Error', 'Failed to revoke invite');
    }
  };

  const handleResendInvite = async (invite) => {
    // TODO: Backend API for resending invites doesn't exist yet
    // Need to implement /invites/:inviteId/resend endpoint in backend
    Alert.alert(
      'Feature Unavailable',
      'Resend functionality is not yet available. The invite is still active and the guest can use the original email.'
    );
  };

  const resetForm = () => {
    setGuestEmail('');
    setGuestName('');
    setAccessType('temporary');
    setExpiresAt('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9800';
      case 'accepted':
        return '#4CAF50';
      case 'expired':
        return '#9E9E9E';
      case 'revoked':
        return '#FF4444';
      default:
        return Colors.subtitlecolor;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'accepted':
        return 'checkmark-circle-outline';
      case 'expired':
        return 'alert-circle-outline';
      case 'revoked':
        return 'close-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const getQuickExpiryOptions = () => {
    const now = new Date();
    return [
      { label: '1 Hour', value: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString() },
      { label: '24 Hours', value: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() },
      { label: '3 Days', value: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() },
      { label: '1 Week', value: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    ];
  };

  const renderCreateInviteModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Guest Invite</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Guest Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter guest name"
                placeholderTextColor={Colors.subtitlecolor}
                value={guestName}
                onChangeText={setGuestName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Guest Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="guest@example.com"
                placeholderTextColor={Colors.subtitlecolor}
                value={guestEmail}
                onChangeText={setGuestEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Access Type</Text>
              <View style={styles.accessTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.accessTypeOption,
                    accessType === 'temporary' && styles.accessTypeOptionSelected,
                  ]}
                  onPress={() => setAccessType('temporary')}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={accessType === 'temporary' ? '#fff' : Colors.subtitlecolor}
                  />
                  <Text
                    style={[
                      styles.accessTypeText,
                      accessType === 'temporary' && styles.accessTypeTextSelected,
                    ]}
                  >
                    Temporary
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.accessTypeOption,
                    accessType === 'permanent' && styles.accessTypeOptionSelected,
                  ]}
                  onPress={() => setAccessType('permanent')}
                >
                  <Ionicons
                    name="infinite-outline"
                    size={20}
                    color={accessType === 'permanent' ? '#fff' : Colors.subtitlecolor}
                  />
                  <Text
                    style={[
                      styles.accessTypeText,
                      accessType === 'permanent' && styles.accessTypeTextSelected,
                    ]}
                  >
                    Permanent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {accessType === 'temporary' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Expiration</Text>
                <View style={styles.quickExpiryOptions}>
                  {getQuickExpiryOptions().map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        styles.quickExpiryButton,
                        expiresAt === option.value && styles.quickExpiryButtonSelected,
                      ]}
                      onPress={() => setExpiresAt(option.value)}
                    >
                      <Text
                        style={[
                          styles.quickExpiryText,
                          expiresAt === option.value && styles.quickExpiryTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {expiresAt && (
                  <Text style={styles.expiryPreview}>
                    Expires: {new Date(expiresAt).toLocaleString()}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>
                The guest will receive an email with instructions to access the lock.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, creating && styles.modalButtonDisabled]}
                onPress={handleCreateInvite}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading invites...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Guest Invites</Text>
          <Text style={styles.headerSubtitle}>{lockName}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Active Invites ({invites.filter((i) => i.status !== 'revoked' && i.status !== 'expired').length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {invites.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={60} color={Colors.subtitlecolor} />
              <Text style={styles.emptyTitle}>No Guest Invites</Text>
              <Text style={styles.emptySubtitle}>
                Send an invite to grant temporary or permanent access to your lock
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.emptyButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.invitesList}>
              {invites.map((invite) => (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteHeader}>
                    <View style={styles.inviteMainInfo}>
                      <View style={styles.inviteIcon}>
                        <Ionicons name="person-outline" size={20} color={Colors.primary} />
                      </View>
                      <View style={styles.inviteDetails}>
                        <Text style={styles.inviteName}>{invite.guest_name || 'Guest'}</Text>
                        <Text style={styles.inviteEmail}>{invite.guest_email}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(invite.status)}20` },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(invite.status)}
                        size={14}
                        color={getStatusColor(invite.status)}
                      />
                      <Text
                        style={[styles.statusText, { color: getStatusColor(invite.status) }]}
                      >
                        {invite.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inviteMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.subtitlecolor} />
                      <Text style={styles.metaText}>
                        Sent {new Date(invite.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    {invite.expires_at && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={Colors.subtitlecolor} />
                        <Text style={styles.metaText}>
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {invite.status === 'pending' && (
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleResendInvite(invite)}
                      >
                        <Ionicons name="mail-outline" size={16} color={Colors.primary} />
                        <Text style={styles.actionButtonText}>Resend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonDanger]}
                        onPress={() => handleRevokeInvite(invite)}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#FF4444" />
                        <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                          Revoke
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {invite.status === 'accepted' && (
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonDanger]}
                        onPress={() => handleRevokeInvite(invite)}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#FF4444" />
                        <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                          Revoke Access
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderCreateInviteModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  addButton: {
    padding: 4,
  },
  invitesList: {
    gap: 12,
  },
  inviteCard: {
    backgroundColor: Colors.cardbackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inviteMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteDetails: {
    flex: 1,
  },
  inviteName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  inviteEmail: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  inviteMeta: {
    gap: 8,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}10`,
    gap: 6,
  },
  actionButtonDanger: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionButtonTextDanger: {
    color: '#FF4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  accessTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  accessTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  accessTypeOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  accessTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.subtitlecolor,
  },
  accessTypeTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  quickExpiryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickExpiryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  quickExpiryButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickExpiryText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  quickExpiryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  expiryPreview: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${Colors.primary}10`,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  modalButtonPrimary: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default InviteManagementScreen;
