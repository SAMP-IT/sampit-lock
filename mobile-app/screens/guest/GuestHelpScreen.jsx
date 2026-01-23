import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Theme from '../../constants/Theme';

const steps = [
  'Make sure Bluetooth and Wi-Fi are enabled on your phone.',
  'Stand close to the door and press the Unlock button again.',
  'If the code has expired, contact your host for a new invite.',
];

const GuestHelpScreen = () => {
  return (
    <AppScreen>
      <Section title="Troubleshooting" subtitle="Steps to unlock without issues">
        <AppCard>
          <View style={styles.list}>
            {steps.map((step, index) => (
              <Text key={step} style={styles.stepText}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: Theme.spacing.md,
  },
  stepText: {
    ...Theme.typography.body,
  },
});

export default GuestHelpScreen;
