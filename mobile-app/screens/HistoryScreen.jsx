import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView, Text, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Header from "../components/Header";
import ActivityItem from "../components/ActivityItem";
import Colors from "../constants/Colors";
import Theme from "../constants/Theme";
import AppScreen from "../components/ui/AppScreen";
import Section from "../components/ui/Section";
import AppCard from "../components/ui/AppCard";
import { useActivities, useLocks } from "../hooks/useQueryHooks";

// Action type filters
const actionFilters = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "locked", label: "Locked" },
  { id: "failed_attempt", label: "Failed" },
];

// Access method filters
const accessMethodFilters = [
  { id: "all", label: "All Methods" },
  { id: "bluetooth", label: "Bluetooth" },
  { id: "fingerprint", label: "Fingerprint" },
  { id: "pin", label: "PIN Code" },
  { id: "card", label: "Card" },
  { id: "remote", label: "Remote" },
];

// Date preset options
const datePresets = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "3months", label: "3 Months" },
];

const HistoryScreen = ({ navigation }) => {
  // Filter states
  const [actionFilter, setActionFilter] = useState("all");
  const [accessMethodFilter, setAccessMethodFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [sortNewest, setSortNewest] = useState(true);

  // Modal states
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Calculate date range based on preset
  const getDateRange = useCallback((preset) => {
    const now = new Date();
    let start = null;
    let end = new Date();

    switch (preset) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case "3months":
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      default:
        return { start: null, end: null };
    }

    return { start, end };
  }, []);

  // Build filter params for React Query
  const filters = useMemo(() => {
    const dateRange = getDateRange(datePreset);
    const f = {
      limit: 200,
      action: actionFilter,
      access_method: accessMethodFilter,
      sort_by: 'created_at',
      sort_order: sortNewest ? 'desc' : 'asc',
    };
    if (dateRange.start) f.start_date = dateRange.start.toISOString();
    if (dateRange.end) f.end_date = dateRange.end.toISOString();
    return f;
  }, [actionFilter, accessMethodFilter, datePreset, sortNewest, getDateRange]);

  // React Query hooks
  const { data: activityData, isLoading, error } = useActivities(filters);
  const { data: locks = [] } = useLocks();

  const activities = activityData?.activities ?? [];
  const totalCount = activityData?.totalCount ?? 0;

  // Create lock name map for resolving user-friendly names
  const lockNameMap = useMemo(() => {
    const map = {};
    locks.forEach(lock => {
      if (lock.id) {
        const name = lock.name;
        if (name && !name.match(/^M\d+_|^[A-Z0-9_]+$/)) {
          map[lock.id] = name;
        } else if (lock.location) {
          map[lock.id] = lock.location;
        } else {
          map[lock.id] = 'My Lock';
        }
      }
    });
    return map;
  }, [locks]);

  // Enhance activities with resolved lock names
  const enhancedActivities = useMemo(() => {
    return activities.map(activity => ({
      ...activity,
      resolved_lock_name: activity.lock_id ? lockNameMap[activity.lock_id] : null
    }));
  }, [activities, lockNameMap]);

  const handleMenuPress = () => {
    navigation.navigate("Menu");
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (actionFilter !== "all") count++;
    if (accessMethodFilter !== "all") count++;
    if (datePreset !== "all") count++;
    return count;
  }, [actionFilter, accessMethodFilter, datePreset]);

  // Clear all filters
  const clearFilters = () => {
    setActionFilter("all");
    setAccessMethodFilter("all");
    setDatePreset("all");
    setSortNewest(true);
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <Header
        title="History"
        subtitle="Every access event, on every door"
        onMenuPress={handleMenuPress}
        showNotification={false}
      />

      {/* Action Type Filters */}
      <Section title="Filter by Action">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {actionFilters.map((filter) => {
            const active = filter.id === actionFilter;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActionFilter(filter.id)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Section>

      {/* Sort & Filter Controls */}
      <View style={styles.controlsRow}>
        {/* Sort Toggle */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortNewest(!sortNewest)}
        >
          <Ionicons
            name={sortNewest ? "arrow-down" : "arrow-up"}
            size={16}
            color={Colors.iconbackground}
          />
          <Text style={styles.sortText}>
            {sortNewest ? "Newest First" : "Oldest First"}
          </Text>
        </TouchableOpacity>

        {/* More Filters Button */}
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFiltersModal(true)}
        >
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? Colors.textwhite : Colors.iconbackground} />
          <Text style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonTextActive]}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results Summary */}
      <View style={styles.resultsSummary}>
        <Text style={styles.resultsText}>
          {isLoading ? "Loading..." : `${totalCount} event${totalCount !== 1 ? 's' : ''}`}
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Activity List */}
      <Section
        title="Activity Log"
        gapless
      >
        <AppCard padding="none" elevated={false}>
          {isLoading && <Text style={styles.loadingText}>Loading history...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && enhancedActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
          {!isLoading && !error && enhancedActivities.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="time-outline" size={32} color={Colors.subtitlecolor} />
              </View>
              <Text style={styles.emptyTitle}>No activity found</Text>
              <Text style={styles.emptyMessage}>
                {activeFilterCount > 0
                  ? "Try adjusting your filters"
                  : "Lock and unlock events will appear here"}
              </Text>
            </View>
          )}
        </AppCard>
      </Section>

      {/* Advanced Filters Modal */}
      <Modal
        visible={showFiltersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Advanced Filters</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color={Colors.titlecolor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Date Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.datePresetsRow}>
                  {datePresets.map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.datePresetChip,
                        datePreset === preset.id && styles.datePresetChipActive
                      ]}
                      onPress={() => setDatePreset(preset.id)}
                    >
                      <Text style={[
                        styles.datePresetText,
                        datePreset === preset.id && styles.datePresetTextActive
                      ]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Access Method */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Access Method</Text>
                <View style={styles.filterOptionsWrap}>
                  {accessMethodFilters.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.filterOptionChip,
                        accessMethodFilter === method.id && styles.filterOptionChipActive
                      ]}
                      onPress={() => setAccessMethodFilter(method.id)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        accessMethodFilter === method.id && styles.filterOptionTextActive
                      ]}>
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  clearFilters();
                  setShowFiltersModal(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFiltersModal(false)}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  filterScroll: {
    marginHorizontal: -Theme.spacing.lg,
  },
  filterContainer: {
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  filterChip: {
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.backgroundwhite,
  },
  filterChipActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.iconbackground,
  },
  filterText: {
    color: Colors.subtitlecolor,
    fontWeight: "500",
  },
  filterTextActive: {
    color: Colors.textwhite,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
  },
  sortText: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
  },
  filterButtonActive: {
    backgroundColor: Colors.iconbackground,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: Colors.textwhite,
  },
  resultsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  clearText: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cardbackground,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: Colors.subtitlecolor,
  },
  errorText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: 'red',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundwhite,
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  modalScroll: {
    padding: Theme.spacing.lg,
  },
  filterSection: {
    marginBottom: Theme.spacing.xl,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.md,
  },
  datePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  datePresetChip: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    backgroundColor: Colors.backgroundwhite,
  },
  datePresetChipActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.iconbackground,
  },
  datePresetText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  datePresetTextActive: {
    color: Colors.textwhite,
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  filterOptionChip: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    backgroundColor: Colors.backgroundwhite,
  },
  filterOptionChipActive: {
    borderColor: Colors.iconbackground,
    backgroundColor: Colors.iconbackground,
  },
  filterOptionText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  filterOptionTextActive: {
    color: Colors.textwhite,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  clearButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: Colors.textwhite,
    fontWeight: '600',
  },
});

export default HistoryScreen;
