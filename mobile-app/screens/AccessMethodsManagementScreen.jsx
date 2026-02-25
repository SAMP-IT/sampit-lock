import React, { useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { addAccessMethod, deleteAccessMethod } from '../services/api';
import { useAccessMethods } from '../hooks/useQueryHooks';

const AccessMethodsManagementScreen = ({ route, navigation }) => {
  const { lockId, userId, userName, lockName } = route.params;
  const queryClient = useQueryClient();

  const { data: accessMethods = [], isLoading: loading } = useAccessMethods(lockId, userId);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [selectedType, setSelectedType] = useState('pin');
  const [pinCode, setPinCode] = useState('');

  const loadAccessMethods = () => {
    queryClient.invalidateQueries({ queryKey: ['accessMethods', lockId, userId] });
  };

  const handleAddMethod = async () => {
    if (selectedType === 'pin' && !pinCode.trim()) {
      Alert.alert('Error', 'Please enter a PIN code');
      return;
    }

    if (selectedType === 'pin' && (pinCode.length < 4 || pinCode.length > 8)) {
      Alert.alert('Error', 'PIN code must be between 4 and 8 digits');
      return;
    }

    setAddingMethod(true);
    try {
      await addAccessMethod(lockId, userId, {
        type: selectedType,
        code: selectedType === 'pin' ? pinCode : undefined,
      });

      Alert.alert('Success', `${getMethodTypeLabel(selectedType)} added successfully`);
      setShowAddModal(false);
      setPinCode('');
      loadAccessMethods();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add access method');
    } finally {
      setAddingMethod(false);
    }
  };

  const handleRemoveMethod = (method) => {
    Alert.alert(
      'Remove Access Method',
      `Are you sure you want to remove this ${getMethodTypeLabel(method.type).toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => confirmRemoveMethod(method.id),
        },
      ]
    );
  };

  const confirmRemoveMethod = async (methodId) => {
    try {
      await deleteAccessMethod(lockId, userId, methodId);
      Alert.alert('Success', 'Access method removed successfully');
      loadAccessMethods();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove access method');
    }
  };

  const getMethodIcon = (type) => {
    switch (type) {
      case 'pin':
        return 'keypad-outline';
      case 'fingerprint':
        return 'finger-print-outline';
      case 'card':
        return 'card-outline';
      case 'bluetooth':
        return 'bluetooth-outline';
      default:
        return 'key-outline';
    }
  };

  const getMethodTypeLabel = (type) => {
    switch (type) {
      case 'pin':
        return 'PIN Code';
      case 'fingerprint':
        return 'Fingerprint';
      case 'card':
        return 'Access Card';
      case 'bluetooth':
        return 'Bluetooth';
      default:
        return 'Unknown';
    }
  };

  const getMethodColor = (type) => {
    switch (type) {
      case 'pin':
        return Colors.primary;
      case 'fingerprint':
        return '#9C27B0';
      case 'card':
        return '#FF9800';
      case 'bluetooth':
        return '#2196F3';
      default:
        return Colors.subtitlecolor;
    }
  };

  const renderAddMethodModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Access Method</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Method Type</Text>
          <View style={styles.methodTypeSelector}>
            {['pin', 'fingerprint', 'card'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.methodTypeOption,
                  selectedType === type && styles.methodTypeOptionSelected,
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Ionicons
                  name={getMethodIcon(type)}
                  size={24}
                  color={selectedType === type ? '#fff' : Colors.subtitlecolor}
                />
                <Text
                  style={[
                    styles.methodTypeText,
                    selectedType === type && styles.methodTypeTextSelected,
                  ]}
                >
                  {getMethodTypeLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedType === 'pin' && (
            <View style={styles.pinInputContainer}>
              <Text style={styles.modalLabel}>PIN Code (4-8 digits)</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="Enter PIN code"
                placeholderTextColor={Colors.subtitlecolor}
                value={pinCode}
                onChangeText={setPinCode}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
          )}

          {selectedType === 'fingerprint' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                For fingerprint management, please use the dedicated Fingerprint Management screen from Lock Settings.
              </Text>
            </View>
          )}

          {selectedType === 'card' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                For IC card management, please use the dedicated Card Management screen from Lock Settings.
              </Text>
            </View>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButtonPrimary, addingMethod && styles.modalButtonDisabled]}
              onPress={handleAddMethod}
              disabled={addingMethod}
            >
              {addingMethod ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Add Method</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading access methods...</Text>
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
          <Text style={styles.headerTitle}>Access Methods</Text>
          <Text style={styles.headerSubtitle}>
            {userName} • {lockName}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Access Methods</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {accessMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="key-outline" size={60} color={Colors.subtitlecolor} />
              <Text style={styles.emptyTitle}>No Access Methods</Text>
              <Text style={styles.emptySubtitle}>
                Add a PIN code, fingerprint, or access card for this user
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.emptyButtonText}>Add Access Method</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.methodsList}>
              {accessMethods.map((method, index) => (
                <View key={method.id || index} style={styles.methodCard}>
                  <View
                    style={[
                      styles.methodIconContainer,
                      { backgroundColor: `${getMethodColor(method.type)}20` },
                    ]}
                  >
                    <Ionicons
                      name={getMethodIcon(method.type)}
                      size={24}
                      color={getMethodColor(method.type)}
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodType}>{getMethodTypeLabel(method.type)}</Text>
                    {method.code && (
                      <Text style={styles.methodCode}>Code: {method.code}</Text>
                    )}
                    {method.createdAt && (
                      <Text style={styles.methodDate}>
                        Added {new Date(method.createdAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMethod(method)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Each user can have multiple access methods. Changes take effect immediately on the lock.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderAddMethodModal()}
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
  methodsList: {
    gap: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  methodCode: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontFamily: 'monospace',
  },
  methodDate: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
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
  infoSection: {
    marginTop: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.cardbackground,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 12,
  },
  methodTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodTypeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodTypeOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodTypeText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 8,
    textAlign: 'center',
  },
  methodTypeTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  pinInputContainer: {
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    fontFamily: 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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

export default AccessMethodsManagementScreen;
