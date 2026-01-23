import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppScreen from "../../components/ui/AppScreen";
import Section from "../../components/ui/Section";
import AppCard from "../../components/ui/AppCard";
import Colors from "../../constants/Colors";
import Theme from "../../constants/Theme";
import { getLocks, getRecentActivity } from "../../services/api";
import { unwrapResponseArray } from "../../utils/apiResponse";
import LockControlService from "../../services/lockControlService";

const DeviceDiagnosticsScreen = ({ navigation }) => {
  const [locks, setLocks] = useState([]);
  const [selectedLock, setSelectedLock] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch locks
      const locksResponse = await getLocks();
      const locksData = unwrapResponseArray(locksResponse);
      setLocks(locksData);

      if (locksData.length > 0) {
        setSelectedLock(locksData[0]);
      }

      // Fetch recent activities
      try {
        const activityResponse = await getRecentActivity();
        const activityData = activityResponse?.data?.data ?? activityResponse?.data ?? [];
        setActivities(Array.isArray(activityData) ? activityData.slice(0, 5) : []);
      } catch (e) {
        setActivities([]);
      }
    } catch (error) {
      console.warn('Failed to fetch diagnostic data:', error?.message);
      setLocks([]);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async () => {
    if (!selectedLock) {
      Alert.alert('No Lock Selected', 'Please select a lock to run diagnostics.');
      return;
    }

    setRunningDiagnostic(true);
    try {
      // Try to get lock status via Bluetooth
      const status = await LockControlService.getStatus(selectedLock);

      Alert.alert(
        'Diagnostic Complete',
        `Lock: ${selectedLock.name}\n` +
        `Status: ${status.is_locked ? 'Locked' : 'Unlocked'}\n` +
        `Battery: ${status.battery_level || 'N/A'}%\n` +
        `Method: ${status.method === 'bluetooth' ? 'Bluetooth' : 'Cached'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Diagnostic Failed', error.message || 'Could not connect to lock');
    } finally {
      setRunningDiagnostic(false);
    }
  };

  const getBatteryStatus = (level) => {
    if (!level || level <= 0) return { text: 'Unknown', color: Colors.subtitlecolor };
    if (level > 50) return { text: `Good (${level}%)`, color: Colors.green };
    if (level > 20) return { text: `Fair (${level}%)`, color: Colors.indicatorcolor };
    return { text: `Low (${level}%)`, color: Colors.red };
  };

  const getConnectionStatus = (lock) => {
    if (!lock) return { text: 'N/A', color: Colors.subtitlecolor };
    const method = LockControlService.getControlMethodDescription(lock);
    const hasConnection = lock.has_gateway || lock.ttlock_data;
    return {
      text: method,
      color: hasConnection ? Colors.iconbackground : Colors.subtitlecolor
    };
  };

  const formatActivityTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Device diagnostics</Text>
            <Text style={styles.headerSubtitle}>Loading...</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
        </View>
      </AppScreen>
    );
  }

  if (locks.length === 0) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Device diagnostics</Text>
            <Text style={styles.headerSubtitle}>No locks found</Text>
          </View>
        </View>
        <AppCard style={styles.emptyCard}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.subtitlecolor} />
          <Text style={styles.emptyText}>No locks to diagnose</Text>
          <Text style={styles.emptySubtext}>Add a lock first to run diagnostics</Text>
        </AppCard>
      </AppScreen>
    );
  }

  const batteryStatus = getBatteryStatus(selectedLock?.battery_level);
  const connectionStatus = getConnectionStatus(selectedLock);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Device diagnostics</Text>
          <Text style={styles.headerSubtitle}>
            {selectedLock ? `Health check for ${selectedLock.name}` : 'Select a lock'}
          </Text>
        </View>
      </View>

      {/* Lock selector if multiple locks */}
      {locks.length > 1 && (
        <Section title="Select Lock">
          <View style={styles.lockSelector}>
            {locks.map((lock) => (
              <TouchableOpacity
                key={lock.id}
                style={[
                  styles.lockOption,
                  selectedLock?.id === lock.id && styles.lockOptionSelected
                ]}
                onPress={() => setSelectedLock(lock)}
              >
                <Text style={[
                  styles.lockOptionText,
                  selectedLock?.id === lock.id && styles.lockOptionTextSelected
                ]}>
                  {lock.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>
      )}

      <Section>
        <AppCard style={styles.card}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Battery health</Text>
            <Text style={[styles.metricValue, { color: batteryStatus.color }]}>
              {batteryStatus.text}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Connection</Text>
            <Text style={[styles.metricValue, { color: connectionStatus.color }]}>
              {connectionStatus.text}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Lock status</Text>
            <Text style={styles.metricValue}>
              {selectedLock?.is_locked ? 'Locked' : 'Unlocked'}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>MAC Address</Text>
            <Text style={styles.metricValue}>
              {selectedLock?.ttlock_mac || 'N/A'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, runningDiagnostic && styles.primaryButtonDisabled]}
            onPress={runDiagnostic}
            disabled={runningDiagnostic}
          >
            {runningDiagnostic ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <Text style={styles.primaryText}>Run diagnostic</Text>
            )}
          </TouchableOpacity>
        </AppCard>
      </Section>

      {activities.length > 0 && (
        <Section title="Recent events" subtitle="Latest lock activity">
          <AppCard>
            {activities.map((activity, index) => (
              <Text key={activity.id || index} style={styles.eventText}>
                {formatActivityTime(activity.created_at)} • {activity.action_type || activity.event_type || 'Activity'}
                {activity.performed_by_name ? ` by ${activity.performed_by_name}` : ''}
              </Text>
            ))}
          </AppCard>
        </Section>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  lockSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  lockOption: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    backgroundColor: Colors.cardbackground,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  lockOptionSelected: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  lockOptionText: {
    fontSize: 14,
    color: Colors.titlecolor,
  },
  lockOptionTextSelected: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  card: {
    gap: Theme.spacing.md,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricLabel: {
    ...Theme.typography.subtitle,
  },
  metricValue: {
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    marginTop: Theme.spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: Colors.textwhite,
    fontWeight: "600",
  },
  eventText: {
    ...Theme.typography.subtitle,
    marginBottom: Theme.spacing.sm,
  },
});

export default DeviceDiagnosticsScreen;
