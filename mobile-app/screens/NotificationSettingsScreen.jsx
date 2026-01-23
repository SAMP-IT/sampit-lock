import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const NotificationSettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    pushEnabled: true,
    lockAlerts: true,
    batteryAlerts: true,
    userActivity: true,
    securityAlerts: true,
    promotions: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    }
  };

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const renderToggle = (title, subtitle, key, icon) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={Colors.iconbackground} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={settings[key]}
        onValueChange={() => toggleSetting(key)}
        trackColor={{ false: Colors.bordercolor, true: Colors.iconbackground }}
        thumbColor={settings[key] ? '#FFF' : Colors.subtitlecolor}
      />
    </View>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Manage your alerts</Text>
        </View>
      </View>

      <Section title="General" gapless>
        <AppCard padding="none">
          {renderToggle('Push Notifications', 'Enable all notifications', 'pushEnabled', 'notifications-outline')}
        </AppCard>
      </Section>

      <Section title="Alert Types" gapless>
        <AppCard padding="none">
          {renderToggle('Lock Alerts', 'Lock/unlock events', 'lockAlerts', 'lock-closed-outline')}
          {renderToggle('Battery Alerts', 'Low battery warnings', 'batteryAlerts', 'battery-half-outline')}
          {renderToggle('User Activity', 'Guest access events', 'userActivity', 'people-outline')}
          {renderToggle('Security Alerts', 'Failed attempts & anomalies', 'securityAlerts', 'shield-checkmark-outline')}
        </AppCard>
      </Section>

      <Section title="Other" gapless>
        <AppCard padding="none">
          {renderToggle('Promotions', 'News and offers', 'promotions', 'megaphone-outline')}
        </AppCard>
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
    marginLeft: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
});

export default NotificationSettingsScreen;
