import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppScreen from "../../components/ui/AppScreen";
import Section from "../../components/ui/Section";
import AppCard from "../../components/ui/AppCard";
import Colors from "../../constants/Colors";
import Theme from "../../constants/Theme";

const steps = [
  {
    title: "Pair the lock",
    description:
      "Stand near your door. We'll connect.",
  },
  {
    title: "Name your door",
    description:
      "Give it a name like 'Front Door' or 'Grandma's Room'.",
  },
];

const AddLockWizardScreen = ({ navigation }) => {
  const handleStart = () => {
    // Navigate directly to PairLock - TTLock/Bluetooth setup is handled there
    navigation.navigate("PairLock");
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Add a new lock</Text>
          <Text style={styles.headerSubtitle}>Follow these guided steps</Text>
        </View>
      </View>

      <Section gapless>
        <AppCard style={styles.card}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStart}
          >
            <Text style={styles.primaryText}>Start</Text>
          </TouchableOpacity>
        </AppCard>
      </Section>

      <Section title="Need help?">
        <AppCard>
          <Text style={styles.helpText}>
            • Keep your phone charged above 30% to avoid pairing interruptions.
            {"\n"}• If the LED flashes red, hold reset for 10 seconds and retry.
            {"\n"}• You can always add locks later from the Devices tab.
          </Text>
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  card: {
    gap: Theme.spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.iconbackground,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    color: Colors.textwhite,
    fontWeight: "600",
  },
  stepCopy: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  stepDescription: {
    ...Theme.typography.subtitle,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
  },
  primaryText: {
    color: Colors.textwhite,
    fontWeight: "600",
  },
  helpText: {
    ...Theme.typography.subtitle,
    lineHeight: 20,
  },
});

export default AddLockWizardScreen;
