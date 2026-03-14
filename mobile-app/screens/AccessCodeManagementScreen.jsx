import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import {
  createAccessCode,
  updateAccessCode,
  deleteAccessCode,
} from '../services/api';
import { useAccessCodes } from '../hooks/useQueryHooks';

const AccessCodeManagementScreen = ({ navigation, route }) => {
  const { lockId, lockName, readOnly = false } = route.params;
  const queryClient = useQueryClient();

  const { data: accessCodes = [], isLoading: loading } = useAccessCodes(lockId);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'permanent',
    starts_at: null,
    expires_at: null,
  });

  const editHasChanges = !editingCode || !originalFormData ||
    formData.name !== originalFormData.name ||
    formData.code !== originalFormData.code ||
    formData.type !== originalFormData.type ||
    formData.expires_at !== originalFormData.expires_at;

  const codeTypes = [
    { value: 'permanent', label: 'Permanent Code', icon: 'infinite-outline' },
    { value: 'temporary', label: 'Temporary Code', icon: 'time-outline' },
    { value: 'one_time', label: 'One-Time Use', icon: 'key-outline' },
  ];

  const loadAccessCodes = () => {
    queryClient.invalidateQueries({ queryKey: ['accessCodes', lockId] });
  };

  const generateRandomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData({ ...formData, code });
  };

  const handleSaveCode = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Missing Information', 'Please enter a name for this code.');
      return;
    }

    if (!formData.code || formData.code.length < 4) {
      Alert.alert('Invalid Code', 'Access code must be at least 4 digits.');
      return;
    }

    if (formData.type === 'temporary' && !formData.expires_at) {
      Alert.alert('Missing Expiry', 'Temporary codes require an expiry date.');
      return;
    }

    setSaving(true);
    try {
      const codeData = {
        name: formData.name.trim(),
        code: formData.code,
        type: formData.type,
        starts_at: formData.starts_at || new Date().toISOString(),
        expires_at: formData.expires_at,
      };

      if (editingCode) {
        await updateAccessCode(lockId, editingCode.id, codeData);
        Alert.alert('Success', 'Access code updated successfully');
      } else {
        await createAccessCode(lockId, codeData);
        Alert.alert('Success', 'Access code created successfully');
      }

      resetForm();
      await loadAccessCodes();
    } catch (error) {
      console.error('Failed to save access code:', error);
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to save access code');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCode = (code) => {
    setEditingCode(code);
    const data = {
      name: code.name,
      code: code.code,
      type: code.type,
      starts_at: code.starts_at,
      expires_at: code.expires_at,
    };
    setFormData(data);
    setOriginalFormData(data);
    setShowAddForm(true);
  };

  const handleDeleteCode = (code) => {
    Alert.alert(
      'Delete Access Code?',
      `Are you sure you want to delete "${code.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteCode(code.id),
        },
      ]
    );
  };

  const confirmDeleteCode = async (codeId) => {
    try {
      await deleteAccessCode(lockId, codeId);
      Alert.alert('Success', 'Access code deleted successfully');
      await loadAccessCodes();
    } catch (error) {
      console.error('Failed to delete access code:', error);
      Alert.alert('Error', 'Failed to delete access code');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'permanent',
      starts_at: null,
      expires_at: null,
    });
    setEditingCode(null);
    setOriginalFormData(null);
    setShowAddForm(false);
  };

  const getCodeStatusText = (code) => {
    if (code.type === 'one_time' && code.used) {
      return 'Used';
    }

    if (code.type === 'temporary') {
      const now = new Date();
      const expiry = new Date(code.expires_at);
      if (expiry < now) {
        return 'Expired';
      }
      return 'Active';
    }

    return 'Active';
  };

  const getCodeIcon = (type) => {
    const codeType = codeTypes.find((t) => t.value === type);
    return codeType?.icon || 'keypad-outline';
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading access codes...</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Access Codes</Text>
          <Text style={styles.headerSubtitle}>{lockName}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <Section>
          <AppCard style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.iconbackground} />
            <Text style={styles.infoText}>
              {readOnly
                ? 'These are the PIN codes available for this lock. Contact the lock owner or admin to add or change codes.'
                : 'Create PIN codes to unlock your door. Permanent codes never expire, temporary codes expire after a set time, and one-time codes can only be used once.'}
            </Text>
          </AppCard>
        </Section>

        {/* Existing Access Codes */}
        {accessCodes.length > 0 && !showAddForm && (
          <Section title={`Access Codes (${accessCodes.length})`} gapless>
            <AppCard padding="none">
              {accessCodes.map((code, index) => (
                <View
                  key={code.id}
                  style={[
                    styles.codeItem,
                    index === accessCodes.length - 1 && styles.codeItemLast,
                  ]}
                >
                  <View style={styles.codeIconContainer}>
                    <Ionicons
                      name={getCodeIcon(code.type)}
                      size={24}
                      color={Colors.iconbackground}
                    />
                  </View>

                  <View style={styles.codeDetails}>
                    <Text style={styles.codeName}>{code.name}</Text>
                    <View style={styles.codeMetaRow}>
                      <Text style={styles.codeNumber}>Code: {code.code}</Text>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{getCodeStatusText(code)}</Text>
                      </View>
                    </View>
                    {code.type === 'temporary' && code.expires_at && (
                      <Text style={styles.codeExpiry}>
                        Expires: {new Date(code.expires_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.codeActions}>
                    {!readOnly && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditCode(code)}
                      >
                        <Ionicons name="create-outline" size={20} color={Colors.iconbackground} />
                      </TouchableOpacity>
                    )}
                    {!readOnly && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteCode(code)}
                      >
                        <Ionicons name="trash-outline" size={20} color={Colors.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </AppCard>
          </Section>
        )}

        {/* Add/Edit Form */}
        {showAddForm ? (
          <Section title={editingCode ? 'Edit Access Code' : 'Add Access Code'}>
            <AppCard>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Code Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Guest Room, Cleaning Service"
                  placeholderTextColor={Colors.subtitlecolor}
                  editable={!saving}
                />
              </View>

              {/* Code Input */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>PIN Code (4-8 digits)</Text>
                  <TouchableOpacity onPress={generateRandomCode} disabled={saving}>
                    <Text style={styles.generateButton}>Generate</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={formData.code}
                  onChangeText={(text) =>
                    setFormData({ ...formData, code: text.replace(/\D/g, '') })
                  }
                  placeholder="Enter 4-8 digit code"
                  placeholderTextColor={Colors.subtitlecolor}
                  keyboardType="numeric"
                  maxLength={8}
                  editable={!saving}
                />
              </View>

              {/* Code Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Code Type</Text>
                <View style={styles.codeTypeButtons}>
                  {codeTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.codeTypeButton,
                        formData.type === type.value && styles.codeTypeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type: type.value })}
                      disabled={saving}
                    >
                      <Ionicons
                        name={type.icon}
                        size={20}
                        color={
                          formData.type === type.value ? Colors.textwhite : Colors.titlecolor
                        }
                      />
                      <Text
                        style={[
                          styles.codeTypeButtonText,
                          formData.type === type.value && styles.codeTypeButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Expiry for Temporary Codes */}
              {formData.type === 'temporary' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Expires In</Text>
                  <View style={styles.expiryButtons}>
                    {[
                      { hours: 1, label: '1 Hour' },
                      { hours: 24, label: '1 Day' },
                      { hours: 168, label: '1 Week' },
                      { hours: 720, label: '1 Month' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.hours}
                        style={styles.expiryButton}
                        onPress={() => {
                          const expiry = new Date();
                          expiry.setHours(expiry.getHours() + option.hours);
                          setFormData({ ...formData, expires_at: expiry.toISOString() });
                        }}
                        disabled={saving}
                      >
                        <Text style={styles.expiryButtonText}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, (saving || (editingCode && !editHasChanges)) && styles.saveButtonDisabled]}
                  onPress={handleSaveCode}
                  disabled={saving || (editingCode && !editHasChanges)}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.textwhite} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingCode ? (editHasChanges ? 'Update Code' : 'No Changes') : 'Add Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </AppCard>
          </Section>
        ) : (
          !readOnly && (
          <Section>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.textwhite} />
              <Text style={styles.addButtonText}>Add Access Code</Text>
            </TouchableOpacity>
          </Section>
          )
        )}
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
    backgroundColor: Colors.cardbackground,
    padding: Theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  codeItemLast: {
    borderBottomWidth: 0,
  },
  codeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.iconbackground}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  codeDetails: {
    flex: 1,
  },
  codeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  codeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: 2,
  },
  codeNumber: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontFamily: 'monospace',
  },
  codeBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  codeExpiry: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  generateButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.iconbackground,
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
  codeTypeButtons: {
    gap: Theme.spacing.xs,
  },
  codeTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  codeTypeButtonActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  codeTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  codeTypeButtonTextActive: {
    color: Colors.textwhite,
  },
  expiryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  expiryButton: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  expiryButtonText: {
    fontSize: 13,
    color: Colors.titlecolor,
  },
  formActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  addButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default AccessCodeManagementScreen;
