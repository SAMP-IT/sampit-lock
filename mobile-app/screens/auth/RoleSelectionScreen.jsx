import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';

const roles = [
  {
    id: 'owner',
    label: 'Home Owner / Admin',
    description: 'Full command of devices, users, security alerts, and automations.',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'family',
    label: 'Family Member',
    description: 'Daily access to home locks with curated shortcuts.',
    icon: 'home-outline',
  },
  {
    id: 'guest',
    label: 'Guest',
    description: 'Effortless short-term entry with step-by-step guidance.',
    icon: 'key-outline',
  },
  {
    id: 'service',
    label: 'Service Provider',
    description: 'Diagnostics workspace for installers and maintenance partners.',
    icon: 'construct-outline',
  },
];

const RoleSelectionScreen = () => {
  const { setRole } = useRole();

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Pick your path</Text>
        <Text style={styles.heroTitle}>Tailored dashboards for every role</Text>
        <Text style={styles.heroSubtitle}>
          Explore Awakey as an owner, family member, trusted guest, or service partner. You can switch roles anytime.
        </Text>
      </View>

      <View style={styles.list}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role.id}
            onPress={() => setRole(role.id)}
            activeOpacity={0.9}
          >
            <AppCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name={role.icon} size={20} color={Colors.textwhite} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
              </View>
              <Text style={styles.cardTitle}>{role.label}</Text>
              <Text style={styles.cardDescription}>{role.description}</Text>
            </AppCard>
          </TouchableOpacity>
        ))}
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 64,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  heroBlock: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.textwhite,
    color: Colors.iconbackground,
    fontWeight: '700',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  heroSubtitle: {
    ...Theme.typography.subtitle,
    lineHeight: 22,
  },
  list: {
    gap: Theme.spacing.md,
  },
  card: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  cardDescription: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default RoleSelectionScreen;
