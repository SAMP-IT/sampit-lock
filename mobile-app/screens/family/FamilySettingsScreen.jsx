import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';

const roles = [
  {
    id: 'owner',
    title: 'Owner/Admin',
    subtitle: 'Full control and management access',
    icon: 'shield-checkmark-outline',
    description: 'Manage all devices, users, and settings'
  },
  {
    id: 'family',
    title: 'Family Member',
    subtitle: 'Standard access with personal tracking',
    icon: 'people-outline',
    description: 'Access assigned locks and view personal history'
  },
  {
    id: 'guest',
    title: 'Guest',
    subtitle: 'Temporary access with restrictions',
    icon: 'person-outline',
    description: 'Limited access to specific locks for a set time'
  },
  {
    id: 'service',
    title: 'Service Provider',
    subtitle: 'Maintenance and diagnostic access',
    icon: 'build-outline',
    description: 'Device diagnostics and maintenance tasks'
  },
  {
    id: 'enterprise',
    title: 'Enterprise Admin',
    subtitle: 'Organization-wide management',
    icon: 'business-outline',
    description: 'Manage enterprise fleet and policies'
  }
];

const settingsOptions = [
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage alerts and updates',
    icon: 'notifications-outline'
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    subtitle: 'Control your data and access',
    icon: 'lock-closed-outline'
  },
  {
    id: 'preferences',
    title: 'Preferences',
    subtitle: 'Customize your experience',
    icon: 'settings-outline'
  },
  {
    id: 'help',
    title: 'Help & Support',
    subtitle: 'Get assistance and feedback',
    icon: 'help-circle-outline'
  }
];

const FamilySettingsScreen = ({ navigation }) => {
  const { role, setRole } = useRole();

  const switchRole = (newRole) => {
    Alert.alert(
      'Switch Role',
      `Switch to ${newRole.title}? This will change your access level.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            setRole(newRole.id);
            Alert.alert(
              'Role Changed',
              `You are now: ${newRole.title}`,
              [{ text: 'OK', onPress: () => navigation.navigate('FamilyHome') }]
            );
          }
        }
      ]
    );
  };

  const openSettingsOption = (option) => {
    Alert.alert(option.title, 'Coming soon in a future update.');
  };

  const currentRole = roles.find(r => r.id === role);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
        </View>
      </View>

      {/* Current Role Section */}
      <Section title="Current Role">
        <AppCard variant="primary" padding="lg">
          <View style={styles.currentRoleInfo}>
            <View style={styles.roleIcon}>
              <Ionicons
                name={currentRole?.icon || 'person-outline'}
                size={24}
                color={Colors.textwhite}
              />
            </View>
            <View style={styles.roleDetails}>
              <Text style={styles.currentRoleTitle}>{currentRole?.title || 'Family Member'}</Text>
              <Text style={styles.currentRoleSubtitle}>{currentRole?.description}</Text>
            </View>
          </View>
        </AppCard>
      </Section>

      {/* Role Switching Section */}
      <Section title="Switch Role" subtitle="Change your access level">
        <AppCard padding="none">
          {roles.map((roleOption) => (
            <TouchableOpacity
              key={roleOption.id}
              style={[
                styles.roleOption,
                role === roleOption.id && styles.roleOptionCurrent
              ]}
              onPress={() => switchRole(roleOption)}
              disabled={role === roleOption.id}
            >
              <View style={styles.roleOptionIcon}>
                <Ionicons
                  name={roleOption.icon}
                  size={20}
                  color={role === roleOption.id ? Colors.iconbackground : Colors.subtitlecolor}
                />
              </View>
              <View style={styles.roleOptionContent}>
                <Text style={[
                  styles.roleOptionTitle,
                  role === roleOption.id && styles.roleOptionTitleCurrent
                ]}>
                  {roleOption.title}
                </Text>
                <Text style={styles.roleOptionSubtitle}>{roleOption.subtitle}</Text>
              </View>
              {role === roleOption.id && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
              {role !== roleOption.id && (
                <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
              )}
            </TouchableOpacity>
          ))}
        </AppCard>
      </Section>

      {/* Settings Options */}
      <Section title="Account Settings">
        <AppCard padding="none">
          {settingsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.settingOption}
              onPress={() => openSettingsOption(option)}
            >
              <View style={styles.settingIcon}>
                <Ionicons name={option.icon} size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{option.title}</Text>
                <Text style={styles.settingSubtitle}>{option.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          ))}
        </AppCard>
      </Section>

      {/* Account Actions */}
      <Section title="Account">
        <View style={styles.accountActions}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => Alert.alert('Sign Out', 'Coming soon!')}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.red} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg, // section spacing
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
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
  currentRoleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  roleIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.textwhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleDetails: {
    flex: 1,
  },
  currentRoleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textwhite,
    marginBottom: Theme.spacing.xs,
  },
  currentRoleSubtitle: {
    fontSize: 14,
    color: Colors.textwhite,
    opacity: 0.8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  roleOptionCurrent: {
    backgroundColor: Colors.cardbackground,
  },
  roleOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  roleOptionTitleCurrent: {
    color: Colors.iconbackground,
  },
  roleOptionSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  currentBadge: {
    backgroundColor: Colors.iconbackground,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.radius.pill,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  accountActions: {
    gap: Theme.spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Colors.red,
    gap: Theme.spacing.sm,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.red,
  },
});

export default FamilySettingsScreen;