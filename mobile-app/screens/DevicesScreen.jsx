import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppScreen from "../components/ui/AppScreen";
import Section from "../components/ui/Section";
import AppCard from "../components/ui/AppCard";
import QuickActionButton from "../components/QuickActionButton";
import Colors from "../constants/Colors";
import Theme from "../constants/Theme";
import { deleteLock } from "../services/api";
import { useLocks } from "../hooks/useQueryHooks";
import { invalidateCacheAfterLockDelete } from "../utils/queryClient";

const DeviceTile = ({ device, onSettingsPress, onLongPress }) => {
  // Get the user-given name as main title, model number as subtitle
  const lockName = device.name || 'Unnamed Lock';
  const modelNumber = device.ttlock_model || device.model || '';

  return (
    <TouchableOpacity onLongPress={onLongPress} activeOpacity={0.9} delayLongPress={500}>
      <AppCard style={styles.deviceTile}>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceTitleArea}>
            <Text style={styles.deviceName}>{lockName}</Text>
            {modelNumber && (
              <Text style={styles.modelNumber}>{modelNumber}</Text>
            )}
          </View>
        </View>

        {/* Lock Information - integrated into card */}
        <View style={styles.lockInfoRow}>
          {device.location && (
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.infoText}>{device.location}</Text>
            </View>
          )}
          {device.created_at && (
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={14} color={Colors.subtitlecolor} />
              <Text style={styles.infoText}>
                Added: {new Date(device.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom row with battery and settings */}
        <View style={styles.deviceFooter}>
          <View style={styles.batteryContainer}>
            <Ionicons
              name={device.battery_level > 20 ? "battery-full-outline" : "battery-dead-outline"}
              size={16}
              color={device.battery_level > 20 ? Colors.iconbackground : Colors.red}
            />
            <Text style={[
              styles.batteryText,
              device.battery_level <= 20 && styles.batteryLow
            ]}>
              {device.battery_level != null ? `${device.battery_level}%` : '--'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.subtitlecolor} />
          </TouchableOpacity>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
};

const DevicesScreen = ({ navigation }) => {
  const { data: devices = [], isLoading } = useLocks();

  const handleAddLock = () => {
    // Go to Pair to lock Step 1 of 2 flow (same as + Add Lock button)
    navigation.navigate("PairLock");
  };

  const handleOpenLockDetail = (device) => {
    navigation.navigate('LockDetail', { lockId: device.id, lock: device });
  };

  const handleDeleteLock = (device) => {
    Alert.alert(
      'Delete Lock',
      `Are you sure you want to delete "${device.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLock(device.id);
              invalidateCacheAfterLockDelete(device.id);
              Alert.alert('Success', 'Lock deleted successfully');
            } catch (error) {
              console.error('Delete lock error:', error);
              Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete lock');
            }
          }
        }
      ]
    );
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>All Locks</Text>
          <Text style={styles.headerSubtitle}>
            {devices.length > 0 ? `${devices.length} lock${devices.length !== 1 ? 's' : ''} configured` : "No locks added yet"}
          </Text>
        </View>
      </View>

      <Section title="" subtitle="">
        {devices.length > 0 ? (
          <View style={styles.grid}>
            {devices.map((device) => (
              <DeviceTile
                key={device.id}
                device={device}
                onSettingsPress={() => handleOpenLockDetail(device)}
                onLongPress={() => handleDeleteLock(device)}
              />
            ))}
          </View>
        ) : (
          <AppCard style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={48} color={Colors.subtitlecolor} />
            <Text style={styles.emptyText}>Add your first lock to get started</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleAddLock}
            >
              <Text style={styles.emptyButtonText}>Add Lock</Text>
            </TouchableOpacity>
          </AppCard>
        )}
      </Section>

      <Section title="Tools">
        <View style={styles.actionsRow}>
          <QuickActionButton
            action={{
              icon: "add-circle-outline",
              title: "Add new lock",
              subtitle: "Pair a device",
            }}
            onPress={handleAddLock}
            style={styles.actionItem}
          />
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
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  grid: {
    gap: Theme.spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Theme.spacing.md,
  },
  actionItem: {
    flex: 1,
    maxWidth: '50%',
  },
  deviceTile: {
    gap: Theme.spacing.sm,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  deviceTitleArea: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.titlecolor,
  },
  modelNumber: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  lockInfoRow: {
    gap: Theme.spacing.xs,
    paddingTop: Theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  deviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  batteryText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  batteryLow: {
    color: Colors.red,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
    gap: Theme.spacing.md,
  },
  emptyText: {
    ...Theme.typography.subtitle,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
  },
  emptyButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DevicesScreen;
