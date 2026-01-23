import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const SecuritySettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    biometricEnabled: false,
    autoLock: true,
    hideContent: true,
    twoFactorEnabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('securitySettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load security settings:', err);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('securitySettings', JSON.stringify(newSettings));
    } catch (err) {
      console.error('Failed to save security settings:', err);
    }
  };

  const toggleSetting = (key) => {
    if (key === 'twoFactorEnabled' && !settings.twoFactorEnabled) {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'Two-factor authentication adds an extra layer of security. You will need to verify your identity via email when logging in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => updateSetting(key) }
        ]
      );
    } else {
      updateSetting(key);
    }
  };

  const updateSetting = (key) => {
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

  const renderAction = (title, subtitle, icon, onPress) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={Colors.iconbackground} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
    </TouchableOpacity>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Security</Text>
          <Text style={styles.headerSubtitle}>Protect your account</Text>
        </View>
      </View>

      <Section title="Authentication" gapless>
        <AppCard padding="none">
          {renderToggle('Face ID / Fingerprint', 'Use biometrics to unlock app', 'biometricEnabled', 'finger-print-outline')}
          {renderToggle('Two-Factor Authentication', 'Extra verification on login', 'twoFactorEnabled', 'shield-checkmark-outline')}
        </AppCard>
      </Section>

      <Section title="Privacy" gapless>
        <AppCard padding="none">
          {renderToggle('Auto-Lock App', 'Lock when in background', 'autoLock', 'lock-closed-outline')}
          {renderToggle('Hide Sensitive Content', 'Blur content in app switcher', 'hideContent', 'eye-off-outline')}
        </AppCard>
      </Section>

      <Section title="Account" gapless>
        <AppCard padding="none">
          {renderAction('Change Password', 'Update your password', 'key-outline', () => navigation.navigate('ForgotPassword'))}
          {renderAction('Active Sessions', 'Manage logged-in devices', 'laptop-outline', () => Alert.alert('Active Sessions', 'You are logged in on 1 device.'))}
        </AppCard>
      </Section>

      <Section title="Danger Zone" gapless>
        <AppCard padding="none">
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() => Alert.alert('Delete Account', 'This action cannot be undone. Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive' }
            ])}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, styles.dangerIcon]}>
              <Ionicons name="trash-outline" size={20} color={Colors.red} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Delete Account</Text>
              <Text style={styles.settingSubtitle}>Permanently remove your account</Text>
            </View>
          </TouchableOpacity>
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
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerIcon: {
    backgroundColor: '#FFEBEE',
  },
  dangerText: {
    color: Colors.red,
  },
});

export default SecuritySettingsScreen;
