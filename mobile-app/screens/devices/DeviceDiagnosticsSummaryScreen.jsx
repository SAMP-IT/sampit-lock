import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const DeviceDiagnosticsSummaryScreen = ({ navigation }) => {
  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Diagnostics summary</Text>
          <Text style={styles.headerSubtitle}>Main Door Lock • 09:35 AM run</Text>
        </View>
      </View>

      <Section gapless>
        <AppCard style={styles.card}>
          <View style={styles.resultRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.iconbackground} />
            <Text style={styles.resultText}>All systems operating normally</Text>
          </View>
          <View style={styles.listRow}>
            <Text style={styles.listLabel}>Battery</Text>
            <Text style={styles.listValue}>82% • healthy</Text>
          </View>
          <View style={styles.listRow}>
            <Text style={styles.listLabel}>Connectivity</Text>
            <Text style={styles.listValue}>Strong • no packet loss</Text>
          </View>
          <View style={styles.listRow}>
            <Text style={styles.listLabel}>Sensors</Text>
            <Text style={styles.listValue}>Door alignment OK</Text>
          </View>
        </AppCard>
      </Section>

      <Section title="Recommended actions">
        <AppCard>
          <Text style={styles.recommendation}>• Schedule a battery replacement in 30 days.</Text>
          <Text style={styles.recommendation}>• Review access schedules for visitors every Friday.</Text>
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
  card: {
    gap: Theme.spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listLabel: {
    ...Theme.typography.subtitle,
  },
  listValue: {
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  recommendation: {
    ...Theme.typography.subtitle,
    marginBottom: Theme.spacing.xs,
  },
});

export default DeviceDiagnosticsSummaryScreen;
