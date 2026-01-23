import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const IntentScreen = ({ navigation }) => {
  // TTLock is now the primary auth, so user is already connected after login

  const handleSetupNewLock = () => {
    // User is already authenticated with TTLock, proceed to add lock wizard
    navigation.navigate('AddLockWizard');
  };

  const handleUseExistingLock = () => {
    // This will trigger resident/guest role inference
    navigation.navigate('InviteCode');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Let's get started</Text>
        <Text style={styles.heroTitle}>What do you want to do today?</Text>
        <Text style={styles.heroSubtitle}>
          Choose the option that best describes your situation. We'll guide you through the rest.
        </Text>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          onPress={handleSetupNewLock}
          activeOpacity={0.9}
        >
          <AppCard style={styles.optionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name="lock-closed-outline" size={24} color={Colors.textwhite} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
            </View>
            <Text style={styles.cardTitle}>Set up a new lock</Text>
            <Text style={styles.cardDescription}>I have the lock with me.</Text>
          </AppCard>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleUseExistingLock}
          activeOpacity={0.9}
        >
          <AppCard style={styles.optionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name="key-outline" size={24} color={Colors.textwhite} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
            </View>
            <Text style={styles.cardTitle}>Use a lock I already have</Text>
            <Text style={styles.cardDescription}>I received an invite or code.</Text>
          </AppCard>
        </TouchableOpacity>
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
  optionsList: {
    gap: Theme.spacing.md,
  },
  optionCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  cardHeader: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  cardDescription: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default IntentScreen;