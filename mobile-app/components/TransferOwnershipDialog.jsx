import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { getUsersForLock, transferLockOwnership } from '../services/api';

const TransferOwnershipDialog = ({ visible, onClose, lockId, lockName, onTransferComplete }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (visible && lockId) {
      loadUsers();
    }
  }, [visible, lockId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsersForLock(lockId);
      // Filter out current owner and only show users who can become owners
      const eligibleUsers = response.data.filter(user => user.role !== 'owner');
      setUsers(eligibleUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Please select a user to transfer ownership to');
      return;
    }

    Alert.alert(
      'Transfer Ownership',
      `Are you sure you want to transfer ownership of "${lockName}" to ${selectedUser.name}?\n\n⚠️ WARNING:\n• You will lose all admin privileges\n• You cannot undo this action\n• The new owner can remove your access`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: confirmTransfer
        }
      ]
    );
  };

  const confirmTransfer = async () => {
    setTransferring(true);
    try {
      await transferLockOwnership(lockId, selectedUser.id);
      Alert.alert(
        'Success',
        `Ownership of "${lockName}" has been transferred to ${selectedUser.name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onTransferComplete?.();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Transfer failed:', error);
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="swap-horizontal" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Transfer Ownership</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#FF6B00" />
            <Text style={styles.warningText}>
              This action cannot be undone. You will lose all admin rights.
            </Text>
          </View>

          {/* Lock Info */}
          <View style={styles.lockInfo}>
            <Text style={styles.label}>Transferring lock:</Text>
            <Text style={styles.lockName}>{lockName}</Text>
          </View>

          {/* User List */}
          <Text style={styles.sectionTitle}>Select New Owner</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={Colors.subtitlecolor} />
              <Text style={styles.emptyText}>No eligible users found</Text>
              <Text style={styles.emptySubtext}>Add users to this lock first</Text>
            </View>
          ) : (
            <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
              {users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.userItem,
                    selectedUser?.id === user.id && styles.userItemSelected
                  ]}
                  onPress={() => setSelectedUser(user)}
                >
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name || user.email}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userRole}>{user.role || 'User'}</Text>
                  </View>
                  {selectedUser?.id === user.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={transferring}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.transferButton, (!selectedUser || transferring) && styles.transferButtonDisabled]}
              onPress={handleTransfer}
              disabled={!selectedUser || transferring}
            >
              {transferring ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.transferButtonText}>Transfer Ownership</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
  },
  lockInfo: {
    padding: 20,
    paddingBottom: 12,
  },
  label: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: 4,
  },
  lockName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 4,
  },
  userList: {
    maxHeight: 250,
    paddingHorizontal: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  userItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  transferButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferButtonDisabled: {
    backgroundColor: Colors.subtitlecolor,
  },
  transferButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default TransferOwnershipDialog;
