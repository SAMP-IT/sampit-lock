import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { getNotificationPreferences, updateNotificationPreferences } from '../services/api';
import { coerceBoolean } from '../utils/lockSettings';

const defaultPreferences = {
  lock_unlock: true,
  low_battery: true,
  guest_access: true,
  emergency_alerts: true,
  firmware_updates: false,
  user_activity: true,
  failed_attempts: true,
  email_notifications: false,
  push_notifications: true,
};

const extractPayload = (payload) => {
  if (!payload) return {};
  if (payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload;
};

const normalizePreferences = (payload = {}) => {
  const source = extractPayload(payload);
  const normalized = { ...defaultPreferences };

  Object.keys(defaultPreferences).forEach((key) => {
    const value = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : normalized[key];
    normalized[key] = coerceBoolean(value, defaultPreferences[key]);
  });

  if (source.notification_types) {
    const types = source.notification_types;
    normalized.lock_unlock = coerceBoolean(
      types.unlock ?? types.lock ?? source.lock_unlock,
      normalized.lock_unlock
    );
    normalized.low_battery = coerceBoolean(
      types.battery_warning ?? source.low_battery,
      normalized.low_battery
    );
    normalized.failed_attempts = coerceBoolean(
      types.failed_attempt ?? source.failed_attempts,
      normalized.failed_attempts
    );
    normalized.guest_access = coerceBoolean(
      types.guest_access ?? source.guest_access,
      normalized.guest_access
    );
    normalized.emergency_alerts = coerceBoolean(
      types.tamper_alert ?? source.emergency_alerts,
      normalized.emergency_alerts
    );
  }

  normalized.email_notifications = coerceBoolean(
    source.email_notifications,
    normalized.email_notifications
  );
  normalized.push_notifications = coerceBoolean(
    source.push_notifications,
    normalized.push_notifications
  );

  return normalized;
};

const NotificationPreferencesScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] = useState(null);

  const hasChanges = originalPreferences &&
    JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const response = await getNotificationPreferences();
      const normalized = normalizePreferences(response.data);
      setPreferences(normalized);
      setOriginalPreferences(normalized);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    const current = coerceBoolean(preferences[key]);
    setPreferences({ ...preferences, [key]: !current });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(preferences);
      Alert.alert('Success', 'Notification preferences updated successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Lock Events</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="lock-closed-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Lock/Unlock Events</Text>
              <Text style={styles.preferenceDescription}>Get notified when locks are operated</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.lock_unlock)}
            onValueChange={() => handleToggle('lock_unlock')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="battery-half-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Low Battery Alerts</Text>
              <Text style={styles.preferenceDescription}>Alert when lock battery is low</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.low_battery)}
            onValueChange={() => handleToggle('low_battery')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <Text style={styles.sectionTitle}>Security</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="warning-outline" size={22} color={Colors.accent} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Failed Attempts</Text>
              <Text style={styles.preferenceDescription}>Alert on failed unlock attempts</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.failed_attempts)}
            onValueChange={() => handleToggle('failed_attempts')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="alert-circle-outline" size={22} color="#FF4444" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Emergency Alerts</Text>
              <Text style={styles.preferenceDescription}>Critical security notifications</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.emergency_alerts)}
            onValueChange={() => handleToggle('emergency_alerts')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <Text style={styles.sectionTitle}>Access Management</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="people-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Guest Access</Text>
              <Text style={styles.preferenceDescription}>Guest codes and invites</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.guest_access)}
            onValueChange={() => handleToggle('guest_access')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="person-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>User Activity</Text>
              <Text style={styles.preferenceDescription}>User access changes</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.user_activity)}
            onValueChange={() => handleToggle('user_activity')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <Text style={styles.sectionTitle}>System</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="cloud-download-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Firmware Updates</Text>
              <Text style={styles.preferenceDescription}>Updates available notifications</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.firmware_updates)}
            onValueChange={() => handleToggle('firmware_updates')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <Text style={styles.sectionTitle}>Delivery Method</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Push Notifications</Text>
              <Text style={styles.preferenceDescription}>Instant alerts on your device</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.push_notifications)}
            onValueChange={() => handleToggle('push_notifications')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="mail-outline" size={22} color={Colors.primary} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Email Notifications</Text>
              <Text style={styles.preferenceDescription}>Receive alerts via email</Text>
            </View>
          </View>
          <Switch
            value={coerceBoolean(preferences.email_notifications)}
            onValueChange={() => handleToggle('email_notifications')}
            trackColor={{ false: '#D1D1D6', true: Colors.primary }}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !hasChanges) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{hasChanges ? 'Save Preferences' : 'No Changes'}</Text>
          )}
        </TouchableOpacity>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 12,
    paddingLeft: 4,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardbackground,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  preferenceText: {
    marginLeft: 12,
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.subtitlecolor,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationPreferencesScreen;
