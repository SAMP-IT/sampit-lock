import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const steps = [
  {
    title: 'Pair your Awakey lock or hub',
    description: 'Use the app to scan and connect every device in minutes.',
  },
  {
    title: 'Protect access with biometrics',
    description: 'Set passcodes, fingerprints, and backup methods for each user.',
  },
  {
    title: 'Invite your trusted circle',
    description: 'Share access instantly with family, guests, and teammates.',
  },
  {
    title: 'Enable smart monitoring',
    description: 'Turn on AI insights and emergency workflows tailored to you.',
  },
];

const OnboardingScreen = ({ navigation }) => {
  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerBlock}>
        <Text style={styles.headerBadge}>Quick start</Text>
        <Text style={styles.headerTitle}>Ready in four simple steps</Text>
        <Text style={styles.headerSubtitle}>
          Follow this guided checklist to launch Awakey for any home or organization.
        </Text>
      </View>

      <AppCard style={styles.stepCard}>
        <View style={styles.stepList}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('RoleSelection')}
          activeOpacity={0.9}
        >
          <Ionicons name="arrow-back" size={18} color={Colors.textwhite} style={styles.primaryIcon} />
          <Text style={styles.primaryButtonText}>Back to roles</Text>
        </TouchableOpacity>
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
  headerBlock: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.textwhite,
    color: Colors.iconbackground,
    fontWeight: '700',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
    marginBottom: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
    lineHeight: 22,
  },
  stepCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.xl,
  },
  stepList: {
    gap: Theme.spacing.lg,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: Colors.textwhite,
    fontWeight: '700',
  },
  stepCopy: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  stepDescription: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
  },
  primaryIcon: {
    marginRight: Theme.spacing.xs,
  },
  primaryButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreen;
