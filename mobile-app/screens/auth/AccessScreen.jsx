import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const AccessScreen = ({ navigation, route }) => {
  const { role, doorName, schedule } = route.params || {
    role: 'guest',
    doorName: 'Front Door',
    schedule: '8 AM–6 PM on Mon–Fri',
  };

  const handleUnlock = () => {
    // TODO: Implement unlock functionality
    console.log('Unlocking door...');
  };

  const handleGetHelp = () => {
    // TODO: Implement help/support functionality
    navigation.navigate('Help');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Access granted</Text>
        <Text style={styles.heroTitle}>You're all set!</Text>
        <Text style={styles.heroSubtitle}>
          You can open {doorName} from {schedule}.
        </Text>
      </View>

      <View style={styles.actionsList}>
        <TouchableOpacity onPress={handleUnlock} activeOpacity={0.9}>
          <AppCard style={styles.primaryActionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.primaryIconWrap}>
                <Ionicons name="lock-open-outline" size={32} color={Colors.textwhite} />
              </View>
            </View>
            <Text style={styles.primaryActionTitle}>Unlock {doorName}</Text>
            <Text style={styles.primaryActionDescription}>
              Tap to unlock the door remotely
            </Text>
          </AppCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGetHelp} activeOpacity={0.9}>
          <AppCard style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name="help-circle-outline" size={24} color={Colors.textwhite} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
            </View>
            <Text style={styles.actionTitle}>Get Help</Text>
            <Text style={styles.actionDescription}>
              Call a family member or get support
            </Text>
          </AppCard>
        </TouchableOpacity>
      </View>

      <AppCard style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.iconbackground} />
          </View>
          <Text style={styles.infoTitle}>Your access details</Text>
        </View>
        <View style={styles.infoList}>
          <Text style={styles.infoItem}>
            <Text style={styles.infoLabel}>Door:</Text> {doorName}
          </Text>
          <Text style={styles.infoItem}>
            <Text style={styles.infoLabel}>Schedule:</Text> {schedule}
          </Text>
          <Text style={styles.infoItem}>
            <Text style={styles.infoLabel}>Type:</Text> {role === 'guest' ? 'Guest Access' : 'Family Member'}
          </Text>
        </View>
      </AppCard>
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
  actionsList: {
    gap: Theme.spacing.md,
  },
  primaryActionCard: {
    padding: Theme.spacing.xl,
    backgroundColor: Colors.iconbackground,
    gap: Theme.spacing.md,
  },
  primaryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  primaryActionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  actionCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  actionDescription: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  infoList: {
    gap: Theme.spacing.xs,
  },
  infoItem: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
  infoLabel: {
    fontWeight: '600',
    color: Colors.titlecolor,
  },
});

export default AccessScreen;